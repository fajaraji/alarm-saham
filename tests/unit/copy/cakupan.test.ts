// Klaim cakupan data ("berapa emiten dan data apa yang ada di server ini")
// hanya boleh datang dari src/lib/cakupan.ts, dan angkanya harus mengikuti
// universe yang benar-benar dimuat.
//
// Cacatnya nyata: pada jalur data contoh (bentuk deploy pertama, DATABASE_URL
// masih kosong) kotak cari /putar-ulang menjanjikan "107 emiten universe uji +
// feed suspensi seluruh bursa" tiga baris di bawah lede yang mengaku "data
// contoh (8 emiten)" — satu layar membantah labelnya sendiri.
//
// Dua lapis di berkas ini:
//   1. perilaku fungsinya (angka ikut argumen, klaim feed hanya di jalur nyata);
//   2. pindai repositori: tidak boleh ada lagi total universe nyata yang
//      dipakukan di komponen/jalur pesan. Daftar-hitam kata di gerbang e2e akan
//      selalu bocor karena urutan kata; pindaian ini menutup sumbernya.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { kalimatCakupan, catatanHanyaSuspensi, catatanTidakAdaData } from "../../../src/lib/cakupan";

const AKAR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

/** Klaim bahwa server ini memegang feed/universe Sectors yang nyata. */
const KLAIM_NYATA = [/\b107\b/, /universe uji/i, /feed suspensi/i];

describe("kalimatCakupan", () => {
  it("jalur data contoh: memakai jumlah yang diberikan dan tidak menjanjikan feed sebursa", () => {
    for (const jumlah of [0, 1, 8, 42]) {
      const teks = kalimatCakupan({ jumlah, contoh: true });
      expect(teks, `jumlah ${jumlah}`).toContain(`${jumlah} emiten`);
      expect(teks, `jumlah ${jumlah}`).toContain("data contoh");
      for (const pola of KLAIM_NYATA) expect(teks, `${jumlah} vs ${pola}`).not.toMatch(pola);
    }
  });

  it("jalur data nyata: menyebut universe uji dan feed suspensi bursa", () => {
    const teks = kalimatCakupan({ jumlah: 107, contoh: false });
    expect(teks).toContain("107 emiten universe uji");
    expect(teks).toMatch(/feed suspensi/i);
  });

  it("catatan per-saham ikut sumber yang dipakai", () => {
    const contoh = catatanTidakAdaData("BBRI", { jumlah: 8, contoh: true });
    expect(contoh).toContain("BBRI");
    expect(contoh).toContain("8 emiten");
    for (const pola of KLAIM_NYATA) expect(contoh, String(pola)).not.toMatch(pola);
    const nyata = catatanTidakAdaData("BBRI", { jumlah: 107, contoh: false });
    expect(nyata).toContain("107 emiten universe uji");
  });

  it("catatan 'hanya suspensi' tidak memakukan angka universe", () => {
    const contoh = catatanHanyaSuspensi("BTEL", true);
    for (const pola of KLAIM_NYATA) expect(contoh, String(pola)).not.toMatch(pola);
    expect(catatanHanyaSuspensi("BTEL", false)).toMatch(/universe uji/i);
  });
});

/** Semua berkas .ts/.tsx di bawah `dir`. */
function berkasSumber(dir: string, keluar: string[] = []): string[] {
  for (const nama of readdirSync(dir)) {
    const p = path.join(dir, nama);
    if (statSync(p).isDirectory()) berkasSumber(p, keluar);
    else if (/\.tsx?$/.test(nama)) keluar.push(p);
  }
  return keluar;
}

/**
 * Berkas yang MEMANG boleh menyebut total universe nyata: keduanya bagian dari
 * halaman metodologi, yang menyatakan sendiri bahwa angkanya snapshot yang
 * di-commit — bukan hitung ulang dari sumber data yang sedang dipakai server.
 */
const BOLEH_MENYEBUT_TOTAL = ["src/lib/metodologi/skor.ts", "src/app/cara-kami-menghitung/page.tsx"];

/** Buang komentar blok dan komentar satu baris penuh — yang dijaga adalah TEKS yang dirender. */
function tanpaKomentar(isi: string): string {
  return isi.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^[ \t]*\/\/.*$/gm, " ");
}

describe("pindaian repositori: total universe nyata tidak dipakukan di teks UI", () => {
  it("hanya halaman metodologi yang boleh menulis '107 emiten' / '107 saham'", () => {
    const pelanggar: string[] = [];
    for (const berkas of berkasSumber(path.join(AKAR, "src"))) {
      const rel = path.relative(AKAR, berkas).split(path.sep).join("/");
      if (BOLEH_MENYEBUT_TOTAL.includes(rel)) continue;
      const isi = tanpaKomentar(readFileSync(berkas, "utf8"));
      if (/107\s*(emiten|saham)/i.test(isi)) pelanggar.push(rel);
    }
    expect(pelanggar, `pakai kalimatCakupan()/catatan*() dari src/lib/cakupan.ts: ${pelanggar.join(", ")}`).toEqual([]);
  });
});
