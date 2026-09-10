#!/usr/bin/env node
// Pemindai rahasia untuk SELURUH riwayat git (npm run scan:history).
//
// Kenapa perlu, padahal sudah ada hook pre-commit: hook itu hanya melihat isi
// yang di-stage dan mudah dilewati (`git commit --no-verify`, commit dari mesin
// yang belum menjalankan `npm install` sehingga husky belum memasang hook, atau
// commit lewat UI web GitHub). Repo lomba wajib publik >= 90 hari, jadi kunci
// yang sempat masuk lalu dihapus di commit berikutnya tetap bisa dibaca siapa
// pun dari riwayat. Pemindai ini adalah gerbang yang tidak bisa dilewati karena
// dijalankan CI pada setiap push.
//
// Cara kerja (cepat: satu pass, tiap isi berkas dibaca sekali saja):
//   1. `git cat-file --batch-all-objects` mendaftar SEMUA objek di database —
//      termasuk blob yang sudah tidak terjangkau dari ref mana pun (sisa commit
//      yang di-amend/rebase). Blob seperti itu tidak ikut ter-push, tetapi
//      memindainya gratis dan menutup jalur "sudah saya amend, aman kok".
//   2. `git rev-list --objects --all` memberi nama berkas untuk tiap blob.
//   3. Isi tiap blob unik dipindai sekali dengan pola scripts/pola-rahasia.mjs
//      (blob yang sama di 20 commit = 1 kali baca, bukan 20).
//   4. Nomor commit hanya dicari untuk blob yang BERMASALAH (jarang), sehingga
//      pencarian mahal `--find-object` tidak pernah dijalankan pada jalur bersih.
//
// Keluaran sengaja tidak pernah memuat isi baris yang cocok — hanya commit,
// blob, nama berkas, nomor baris, dan nama pola. Log CI itu publik; mencetak
// nilai rahasianya justru menyebarkannya lebih jauh.
//
// Keluar dengan kode 1 bila ada temuan, 0 bila bersih.

import { execFileSync } from "node:child_process";

import { berkasDilewati, periksaIsi } from "./pola-rahasia.mjs";

// Blob raksasa (mis. berkas data yang pernah ter-commit) dilewati: memuatnya ke
// memori mahal dan isinya bukan teks yang ditulis manusia. Dihitung di ringkasan
// supaya "dilewati" tidak pernah menjadi diam-diam.
const MAKS_UKURAN_BYTE = 8 * 1024 * 1024;
// Berapa blob dibaca per pemanggilan `git cat-file --batch`.
const UKURAN_BATCH = 256;

function git(args, opsi = {}) {
  return execFileSync("git", args, { maxBuffer: 512 * 1024 * 1024, ...opsi });
}

function gitTeks(args, opsi = {}) {
  return git(args, { encoding: "utf8", ...opsi });
}

/** Peta blob -> nama berkas (nama pertama yang ditemui di riwayat). */
function petaNamaBerkas() {
  const peta = new Map();
  for (const baris of gitTeks(["rev-list", "--objects", "--all"]).split("\n")) {
    const spasi = baris.indexOf(" ");
    if (spasi < 0) continue; // commit/tag: tanpa nama berkas
    const sha = baris.slice(0, spasi);
    if (!peta.has(sha)) peta.set(sha, baris.slice(spasi + 1).trim());
  }
  return peta;
}

/** Semua blob di database objek, termasuk yang tidak terjangkau ref mana pun. */
function daftarBlob() {
  const keluaran = gitTeks([
    "cat-file",
    "--batch-all-objects",
    "--batch-check=%(objectname) %(objecttype) %(objectsize)",
  ]);
  const blob = [];
  for (const baris of keluaran.split("\n")) {
    const [sha, tipe, ukuran] = baris.split(" ");
    if (tipe === "blob") blob.push({ sha, ukuran: Number(ukuran) });
  }
  return blob;
}

/**
 * Baca isi sekumpulan blob sekaligus. Keluaran `git cat-file --batch` berupa
 * rekaman "<sha> <tipe> <ukuran>\n<isi>\n" beruntun, jadi diurai sebagai Buffer
 * (isi bisa memuat byte apa pun, termasuk baris baru).
 */
function bacaIsi(daftarSha) {
  const keluaran = git(["cat-file", "--batch"], { input: `${daftarSha.join("\n")}\n` });
  const hasil = [];
  let i = 0;
  while (i < keluaran.length) {
    const akhirHeader = keluaran.indexOf(0x0a, i);
    if (akhirHeader < 0) break;
    const [sha, tipe, ukuran] = keluaran.toString("utf8", i, akhirHeader).split(" ");
    if (tipe !== "blob") {
      i = akhirHeader + 1; // "<sha> missing" — tidak mungkin terjadi di sini
      continue;
    }
    const mulai = akhirHeader + 1;
    const selesai = mulai + Number(ukuran);
    hasil.push({ sha, isi: keluaran.subarray(mulai, selesai) });
    i = selesai + 1; // lewati baris baru penutup rekaman
  }
  return hasil;
}

/** Blob biner tanpa nama berkas dikenali dari byte NUL di awal isinya. */
function tampakBiner(buf) {
  return buf.subarray(0, 8000).includes(0);
}

/** Commit pertama yang memuat blob ini (untuk pesan temuan saja). */
function commitPemuat(sha) {
  try {
    const keluaran = gitTeks(["log", "--all", "--format=%h", "-1", `--find-object=${sha}`]).trim();
    return keluaran || "(objek lepas)";
  } catch {
    return "(tidak diketahui)";
  }
}

const nama = petaNamaBerkas();
const blob = daftarBlob();

let diperiksa = 0;
let dilewati = 0;
const jalurDipindai = new Set();
const temuan = [];

for (let i = 0; i < blob.length; i += UKURAN_BATCH) {
  const potongan = blob.slice(i, i + UKURAN_BATCH).filter((b) => {
    const jalur = nama.get(b.sha);
    if (b.ukuran > MAKS_UKURAN_BYTE || (jalur && berkasDilewati(jalur))) {
      dilewati += 1;
      return false;
    }
    return true;
  });
  if (potongan.length === 0) continue;

  for (const { sha, isi } of bacaIsi(potongan.map((b) => b.sha))) {
    const jalur = nama.get(sha);
    if (!jalur && tampakBiner(isi)) {
      dilewati += 1;
      continue;
    }
    diperiksa += 1;
    if (jalur) jalurDipindai.add(jalur);
    for (const t of periksaIsi(jalur ?? `(blob tanpa nama ${sha.slice(0, 8)})`, isi.toString("utf8"))) {
      temuan.push({ ...t, sha });
    }
  }
}

const jumlahCommit = gitTeks(["rev-list", "--all", "--count"]).trim();

if (temuan.length > 0) {
  console.error(
    `\nSCAN RIWAYAT GAGAL: ${temuan.length} kecocokan pola kunci/kredensial di riwayat git.\n`,
  );
  for (const t of temuan) {
    console.error(`  commit ${commitPemuat(t.sha)}  blob ${t.sha.slice(0, 8)}  ${t.jalur}:${t.baris}  ->  ${t.pola}`);
  }
  console.error(
    "\nIsi barisnya sengaja tidak dicetak. Buka berkas itu pada commit tersebut untuk memastikan,\n" +
      "lalu: (1) cabut/ganti kunci di penyedianya — riwayat publik harus dianggap sudah bocor,\n" +
      "(2) tulis ulang riwayat (git filter-repo / rebase) sebelum push, (3) jalankan ulang perintah ini.\n",
  );
  process.exit(1);
}

console.log(
  `scan-history: 0 temuan. ${diperiksa} blob teks dipindai (${dilewati} dilewati: biner/besar) ` +
    `pada ${jumlahCommit} commit, ${jalurDipindai.size} nama berkas unik.`,
);
