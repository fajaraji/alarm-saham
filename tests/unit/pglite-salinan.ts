// Tes yang membaca ./.pglite milik pengembang membuka SALINAN-nya, bukan
// foldernya sendiri.
//
// PGlite tidak tahan dibuka dua proses sekaligus. Vitest menjalankan berkas tes
// secara paralel (tiga berkas membaca ./.pglite), dan pengembang bisa saja
// menjalankan `npm test` selagi server e2e jalur database memakai folder yang
// sama. Pada 2026-09-19 kombinasi itu membuat ./.pglite rusak: PGlite berhenti
// dengan "Aborted()" setiap kali dibuka, dan data hasil penarikan 395 kredit
// Sectors harus dipulihkan dari salinan lama. Dengan salinan per berkas tes,
// tes tetap membandingkan snapshot dengan data yang sama persis, tetapi tidak
// pernah menulis ke folder aslinya.
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

export interface SalinanPglite {
  dir: string;
  hapus: () => void;
}

export function salinPglite(sumber = path.resolve(process.cwd(), ".pglite")): SalinanPglite {
  const dir = mkdtempSync(path.join(os.tmpdir(), "alarm-saham-pglite-"));
  // postmaster.pid ditulis PGlite saat folder terbuka; salinan tidak butuh itu.
  cpSync(sumber, dir, { recursive: true, filter: (src) => path.basename(src) !== "postmaster.pid" });
  return { dir, hapus: () => rmSync(dir, { recursive: true, force: true }) };
}
