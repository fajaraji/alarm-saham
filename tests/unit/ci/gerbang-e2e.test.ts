// Gerbang atas gerbangnya sendiri (tiket 15, keberatan 1).
//
// Sampai tiket 15, CI hanya menjalankan Playwright dengan `E2E_TANPA_PGLITE=1`.
// Akibatnya bentuk yang DIDEPLOY — jalur database — adalah satu-satunya bentuk
// yang tidak pernah dijalankan mesin: tiga spec yang menjaga klaim data nyata
// (nama perusahaan & tautan PDF BEI di /putar-ulang, COWL, portofolio tersimpan
// di server) di-skip di setiap run dan hanya hijau kalau seorang manusia
// menjalankannya di laptopnya.
//
// Tes ini membaca .github/workflows/ci.yml apa adanya dan menuntut KEDUA
// konfigurasi benar-benar dijalankan. Ia juga menutup mode kegagalan yang paling
// mudah lolos mata: job jalur DB menyemai satu folder tetapi servernya menunjuk
// folder lain — semua spec jalur DB akan di-skip diam-diam dan job tetap hijau.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const akar = process.cwd();
const BERKAS = ".github/workflows/ci.yml";
const isi = readFileSync(path.join(akar, BERKAS), "utf8");
const baris = isi.split(/\r?\n/);

/**
 * Potong blok satu job dari workflow. Job adalah kunci berindentasi 2 spasi di
 * bawah `jobs:`; bloknya berakhir tepat sebelum kunci 2 spasi berikutnya.
 */
function blokJob(nama: string): string {
  const mulai = baris.findIndex((b) => b === `  ${nama}:`);
  expect(mulai, `job "${nama}" tidak ada di ${BERKAS}`).toBeGreaterThanOrEqual(0);
  const sisa = baris.slice(mulai + 1);
  const akhir = sisa.findIndex((b) => /^ {2}\S/.test(b));
  return sisa.slice(0, akhir < 0 ? sisa.length : akhir).join("\n");
}

/** Perintah `run:` di dalam satu blok job. */
function perintah(blok: string): string[] {
  return [...blok.matchAll(/^\s*run:\s*(.+)$/gm)].map((m) => m[1].trim());
}

describe("CI menjalankan KEDUA konfigurasi e2e", () => {
  const jalurContoh = blokJob("e2e");
  const jalurDb = blokJob("e2e-db");

  it("job `e2e` menjalankan Playwright pada jalur data contoh", () => {
    expect(jalurContoh).toMatch(/E2E_TANPA_PGLITE:\s*"1"/);
    expect(perintah(jalurContoh)).toContain("npm run test:e2e");
  });

  it("job `e2e-db` menjalankan Playwright pada jalur database, bukan fixture", () => {
    // Kalau job ini ikut menyetel E2E_TANPA_PGLITE, seluruh spec jalur DB
    // kembali di-skip dan namanya jadi bohong.
    expect(jalurDb).not.toMatch(/E2E_TANPA_PGLITE/);
    expect(jalurDb).not.toMatch(/TANPA_PGLITE:\s*"?1/);
    expect(perintah(jalurDb)).toContain("npm run test:e2e");
  });

  it("job `e2e-db` membangun databasenya dari benih yang di-commit", () => {
    const semai = perintah(jalurDb).find((p) => p.includes("e2e:seed"));
    expect(semai, "job e2e-db tidak menjalankan npm run e2e:seed").toBeDefined();
    expect(existsSync(path.join(akar, "tests/e2e/seed/universe-uji.json"))).toBe(true);
    // Nol panggilan API: yang boleh dijalankan hanya penyemai, bukan penarik universe.
    expect(perintah(jalurDb).some((p) => /pull-universe|sectors|data-proof/.test(p))).toBe(false);
  });

  it("folder yang disemai = folder yang dibaca server e2e (kalau beda, spec DB di-skip diam-diam)", () => {
    const semai = perintah(jalurDb).find((p) => p.includes("e2e:seed"))!;
    const dirSemai = /--dir=(\S+)/.exec(semai)?.[1];
    const dirServer = /E2E_PGLITE_DIR:\s*(\S+)/.exec(jalurDb)?.[1]?.replace(/^["']|["']$/g, "");
    expect(dirSemai, "perintah e2e:seed harus menyebut --dir=<folder>").toBeDefined();
    expect(dirServer, "job e2e-db harus menyetel E2E_PGLITE_DIR").toBeDefined();
    expect(dirSemai).toBe(dirServer);
  });

  it("folder database e2e di-gitignore (isinya biner puluhan MB)", () => {
    const semai = perintah(jalurDb).find((p) => p.includes("e2e:seed"))!;
    const dir = /--dir=(\S+)/.exec(semai)![1].replace(/^\.\//, "");
    const abaikan = readFileSync(path.join(akar, ".gitignore"), "utf8");
    const pola = abaikan
      .split(/\r?\n/)
      .map((b) => b.trim())
      .filter((b) => b && !b.startsWith("#"));
    const cocok = pola.some((p) => {
      const bersih = p.replace(/\/$/, "");
      return bersih === dir || (bersih.endsWith("*") && dir.startsWith(bersih.slice(0, -1)));
    });
    expect(cocok, `${dir} tidak ter-cover .gitignore`).toBe(true);
  });

  it("kedua job e2e menunggu job verify, jadi lint/typecheck/test tetap gerbang pertama", () => {
    expect(jalurContoh).toMatch(/needs:\s*verify/);
    expect(jalurDb).toMatch(/needs:\s*verify/);
  });
});
