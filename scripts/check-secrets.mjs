#!/usr/bin/env node
// Pemindai rahasia untuk pre-commit.
// Memeriksa ISI YANG DI-STAGE (bukan working tree) dari setiap file yang akan
// masuk commit, dan menolak commit bila ditemukan pola kunci/kredensial.
// Aturan hackathon: API key tidak boleh pernah masuk repo.
//
// Pola hidup di scripts/pola-rahasia.mjs, dipakai bersama pemindai riwayat
// (npm run scan:history) yang berjalan di CI. Hook ini bisa dilewati
// (`git commit --no-verify`, commit dari mesin yang belum `npm install`, commit
// lewat UI web GitHub) — gerbang yang tidak bisa dilewati adalah CI.

import { execFileSync } from "node:child_process";

import { berkasDilewati, periksaIsi } from "./pola-rahasia.mjs";

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
  if (berkasDilewati(normal)) continue;

  let isi;
  try {
    isi = isiStaged(normal);
  } catch {
    continue; // file tidak bisa dibaca dari index (mis. submodule) — lewati
  }

  temuan.push(...periksaIsi(normal, isi));
}

if (temuan.length > 0) {
  console.error("\nCOMMIT DITOLAK: terdeteksi pola kunci/kredensial pada file yang di-stage.\n");
  for (const t of temuan) {
    console.error(`  ${t.jalur}:${t.baris}  ->  ${t.pola}`);
  }
  console.error(
    "\nPindahkan nilai rahasia ke .env.local (sudah di-gitignore), lalu ulangi commit.\n",
  );
  process.exit(1);
}

console.log("check-secrets: tidak ada pola kunci pada file yang di-stage.");
