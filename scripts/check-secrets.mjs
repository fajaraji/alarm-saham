#!/usr/bin/env node
// Pemindai rahasia untuk pre-commit.
// Memeriksa ISI YANG DI-STAGE (bukan working tree) dari setiap file yang akan
// masuk commit, dan menolak commit bila ditemukan pola kunci/kredensial.
// Aturan hackathon: API key tidak boleh pernah masuk repo.

import { execFileSync } from "node:child_process";

// File yang dikecualikan: contoh env (nilainya kosong) dan skrip ini sendiri
// (berisi pola regex yang akan memicu dirinya sendiri).
const DIKECUALIKAN = new Set([".env.example", "scripts/check-secrets.mjs"]);

// Ekstensi biner yang tidak perlu dipindai.
const EKSTENSI_BINER = /\.(png|jpe?g|gif|webp|ico|svg|woff2?|ttf|eot|pdf|zip|gz)$/i;

const POLA = [
  // Prefiks kunci Anthropic diikuti karakter kunci. Placeholder dokumentasi
  // seperti "sk-ant-..." (titik) tidak dihitung; "sk-ant-xxxx" atau kunci asli iya.
  { nama: "Kunci Anthropic (awalan sk-ant-)", regex: /sk-ant-[A-Za-z0-9_-]{4,}/ },
  {
    nama: "SECTORS_API_KEY berisi nilai",
    regex: /SECTORS_API_KEY\s*=\s*['"]?[^\s'"]+/,
  },
  {
    nama: "ANTHROPIC_API_KEY berisi nilai",
    regex: /ANTHROPIC_API_KEY\s*=\s*['"]?[^\s'"]+/,
  },
  {
    nama: "DEEPSEEK_API_KEY berisi nilai",
    regex: /DEEPSEEK_API_KEY\s*=\s*['"]?[^\s'"]+/,
  },
  {
    nama: "URL Postgres dengan kredensial",
    regex: /postgres(?:ql)?:\/\/[^\s/:@]+:[^\s@]+@/,
  },
  {
    nama: "Token bot Telegram",
    regex: /\b\d{8,10}:[A-Za-z0-9_-]{35}\b/,
  },
];

function git(args) {
  return execFileSync("git", args, { encoding: "utf8" });
}

function daftarFileStaged() {
  const keluaran = git([
    "diff",
    "--cached",
    "--name-only",
    "--diff-filter=ACMR",
    "-z",
  ]);
  return keluaran.split("\0").filter(Boolean);
}

function isiStaged(path) {
  // ":path" = versi file di index (yang benar-benar akan di-commit).
  return git(["show", `:${path}`]);
}

const temuan = [];

for (const file of daftarFileStaged()) {
  const normal = file.replace(/\\/g, "/");
  if (DIKECUALIKAN.has(normal) || EKSTENSI_BINER.test(normal)) continue;

  let isi;
  try {
    isi = isiStaged(normal);
  } catch {
    continue; // file tidak bisa dibaca dari index (mis. submodule) — lewati
  }

  const baris = isi.split(/\r?\n/);
  baris.forEach((teks, i) => {
    for (const p of POLA) {
      if (p.regex.test(teks)) {
        temuan.push({ file: normal, baris: i + 1, pola: p.nama });
      }
    }
  });
}

if (temuan.length > 0) {
  console.error("\nCOMMIT DITOLAK: terdeteksi pola kunci/kredensial pada file yang di-stage.\n");
  for (const t of temuan) {
    console.error(`  ${t.file}:${t.baris}  ->  ${t.pola}`);
  }
  console.error(
    "\nPindahkan nilai rahasia ke .env.local (sudah di-gitignore), lalu ulangi commit.\n",
  );
  process.exit(1);
}

console.log("check-secrets: tidak ada pola kunci pada file yang di-stage.");
