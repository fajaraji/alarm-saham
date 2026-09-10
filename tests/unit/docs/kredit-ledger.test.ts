// Satu sumber kebenaran angka kredit Sectors.
//
// Sebelum tiket 15 angka ini diketik ulang di dua permukaan dan berbeda untuk
// tanggal yang sama: /cara-kami-menghitung menulis "Per 2026-09-07: 463 dari
// 1000 kredit terpakai; sisa 537" sedangkan README menulis 467 — halaman yang
// justru dibuat untuk juri menyebut angka pra-tiket-11 dengan tanggal
// pasca-tiket-11. Tes ini gagal kalau kedua permukaan berbeda lagi.
//
// Bila ./.pglite ada, angka snapshot dihitung ULANG dari tabel api_ledger.
// Tanpa PGlite (clone bersih / CI), hitung ulang di-skip dengan pesan; seluruh
// pemeriksaan konsistensi antar permukaan tetap berjalan.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { BERKAS_KREDIT_LEDGER, KREDIT_LEDGER } from "../../../src/lib/metodologi/kredit";
import {
  KREDIT_ANGGARAN,
  KREDIT_KELAS_B,
  KREDIT_PEMBUKTIAN,
  KREDIT_TANGGAL_LEDGER,
  KREDIT_TOTAL_LEDGER,
  KREDIT_UNIVERSE,
  totalKredit,
} from "../../../src/lib/metodologi/skor";

const DIR_PGLITE = path.resolve(process.cwd(), ".pglite");
const dipaksaTanpa = process.env.TANPA_PGLITE === "1";
const adaPglite = !dipaksaTanpa && existsSync(DIR_PGLITE);
if (!adaPglite) {
  console.warn(
    `[kredit-ledger] Hitung ulang DI-SKIP: ${
      dipaksaTanpa ? "TANPA_PGLITE=1 diset" : `folder PGlite ${DIR_PGLITE} tidak ada`
    }. Jalankan \`npm run kredit:snapshot -- --pglite\` untuk memperbarui snapshot.`,
  );
}

const README = readFileSync(path.resolve(process.cwd(), "README.md"), "utf8");

/** Semua angka yang README klaim sebagai total buku kredit. */
function angkaKreditDiReadme(): number[] {
  const angka: number[] = [];
  const bersih = (s: string) => Number(s.replace(/[.,]/g, ""));
  for (const m of README.matchAll(/\*\*([\d.,]+)\*\* dari 1\.000 kredit terpakai/g)) angka.push(bersih(m[1]));
  for (const m of README.matchAll(/buku kredit total \*\*([\d.,]+)\*\*/g)) angka.push(bersih(m[1]));
  return angka;
}

describe("docs/kredit-ledger.json: satu angka kredit untuk semua permukaan", () => {
  it("snapshot berbentuk lengkap dan totalnya sama dengan jumlah per-endpoint", () => {
    expect(KREDIT_LEDGER.tanggal).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(KREDIT_LEDGER.baris).toBeGreaterThan(0);
    expect(KREDIT_LEDGER.total).toBeGreaterThan(0);
    expect(KREDIT_LEDGER.perEndpoint.reduce((a, b) => a + b.kredit, 0)).toBe(KREDIT_LEDGER.total);
    expect(KREDIT_LEDGER.perEndpoint.reduce((a, b) => a + b.baris, 0)).toBe(KREDIT_LEDGER.baris);
    expect(KREDIT_LEDGER.panggilanSungguhan + KREDIT_LEDGER.cacheHit).toBe(KREDIT_LEDGER.baris);
    expect(KREDIT_LEDGER.total).toBeLessThan(KREDIT_ANGGARAN);
  });

  it("halaman metodologi memakai angka snapshot, bukan angka yang diketik ulang", () => {
    expect(KREDIT_TOTAL_LEDGER).toBe(KREDIT_LEDGER.total);
    expect(KREDIT_TANGGAL_LEDGER).toBe(KREDIT_LEDGER.tanggal);
  });

  it("rincian langkah di tabel metodologi berjumlah persis total ledger", () => {
    const rincian = totalKredit(KREDIT_PEMBUKTIAN) + totalKredit(KREDIT_UNIVERSE) + totalKredit(KREDIT_KELAS_B);
    expect(rincian).toBe(KREDIT_LEDGER.total);
  });

  it("README menyebut angka yang sama persis (bukan 463 vs 467)", () => {
    const angka = angkaKreditDiReadme();
    expect(angka.length, "README harus menyebut total buku kredit").toBeGreaterThan(0);
    for (const n of angka) expect(n).toBe(KREDIT_LEDGER.total);
    // Sisa kredit yang diumumkan juga harus ikut angka yang benar.
    const sisa = [...README.matchAll(/sisa \*\*([\d.,]+)\*\* kredit/g)].map((m) => Number(m[1].replace(/[.,]/g, "")));
    expect(sisa.length, "README harus menyebut sisa kredit").toBeGreaterThan(0);
    for (const n of sisa) expect(n).toBe(KREDIT_ANGGARAN - KREDIT_LEDGER.total);
  });

  it("nama berkas snapshot yang dipakai kode sama dengan berkas yang ada di repo", () => {
    expect(existsSync(path.resolve(process.cwd(), BERKAS_KREDIT_LEDGER))).toBe(true);
  });

  it.skipIf(!adaPglite)("angka snapshot = hitung ulang dari tabel api_ledger di ./.pglite", async () => {
    const { bukaDb, DIR_PGLITE_DEFAULT } = await import("../../../src/lib/db/buka");
    const { apiLedger } = await import("../../../src/lib/db/schema");
    const { sql } = await import("drizzle-orm");
    const t = await bukaDb({ pgliteDir: DIR_PGLITE_DEFAULT });
    try {
      const [r] = await t.db
        .select({
          baris: sql<number>`count(*)::int`,
          total: sql<number>`coalesce(sum(${apiLedger.credits}), 0)::int`,
          cacheHit: sql<number>`coalesce(sum(${apiLedger.cacheHit}), 0)::int`,
        })
        .from(apiLedger);
      expect(r.total, "jalankan `npm run kredit:snapshot -- --pglite`").toBe(KREDIT_LEDGER.total);
      expect(r.baris).toBe(KREDIT_LEDGER.baris);
      expect(r.cacheHit).toBe(KREDIT_LEDGER.cacheHit);
    } finally {
      await t.tutup();
    }
  }, 60_000);
});
