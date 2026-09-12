// Benih gerbang e2e jalur DB (tiket 15, keberatan 1).
//
// Job CI `e2e-db` membangun database dari tests/e2e/seed/universe-uji.json lalu
// menjalankan spec yang menuntut data nyata (nama perusahaan, tautan PDF BEI,
// COWL, portofolio tersimpan di server). Kalau benihnya kehilangan baris yang
// dituntut spec itu, kegagalannya baru kelihatan setelah `npm ci` + build +
// unduh peramban di runner — dan kelihatannya sebagai spec merah yang
// membingungkan, bukan sebagai "benihnya kurang".
//
// Tes ini menanam benih yang sama ke PGlite in-memory dan menuntut fakta yang
// PERSIS dituntut spec e2e jalur DB, memakai loader yang sama dengan halamannya.
// Jadi benih yang rusak gagal di `npm test`, dalam hitungan detik.
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";
import path from "node:path";

import { BERKAS_BENIH_E2E, tanamBenih, type BenihE2E } from "../../src/lib/db/benih";
import { universeFromDb } from "../../src/lib/engine/events";
import { muatEmiten } from "../../src/lib/putar-ulang/muat";
import { makeTestDb, type TestDb } from "./test-db";

const adaPglite = await import("@electric-sql/pglite").then(
  () => true,
  () => false,
);
if (!adaPglite) console.warn("[benih] Tes benih e2e DI-SKIP: @electric-sql/pglite tidak terpasang.");

/** Sama dengan playwright.config.ts → ALARM_HARI_INI, dan docs/skor-nyata.json.today. */
const TODAY = "2026-09-07";

const benih = JSON.parse(readFileSync(path.resolve(process.cwd(), BERKAS_BENIH_E2E), "utf8")) as BenihE2E;

describe.skipIf(!adaPglite)("benih e2e jalur DB (tests/e2e/seed/universe-uji.json)", () => {
  let t: TestDb;

  beforeAll(async () => {
    t = await makeTestDb("pglite");
    await tanamBenih(t.db, benih);
  }, 180_000);

  afterAll(async () => {
    await t?.close();
  });

  it("berisi universe uji utuh 107 emiten (angka yang dijanjikan /rakit & smoke)", async () => {
    const universe = await universeFromDb(t.db);
    expect(universe).toHaveLength(107);
    const perGrup = universe.reduce<Record<string, number>>((a, u) => {
      a[u.group] = (a[u.group] ?? 0) + 1;
      return a;
    }, {});
    expect(perGrup).toEqual({ control: 30, watchlist: 59, delisting: 18 });
    // Chip "kasus nyata" di /putar-ulang dan emiten yang dipakai spec kotak masuk.
    for (const k of ["SRIL", "TELE", "WIKA", "INAF", "BTEL", "GOLL", "BBCA"]) {
      expect(universe.some((u) => u.symbol === k), `${k} hilang dari benih`).toBe(true);
    }
  });

  it("SRIL: nama perusahaan, ≥ 3 kejadian, suspensi beralasan BEI + tautan PDF idx.co.id", async () => {
    // Mencerminkan tests/e2e/putar-ulang.spec.ts "cari SRIL → garis waktu dari DB".
    const e = await muatEmiten(t.db, "SRIL", TODAY);
    expect(e.status).toBe("lengkap");
    expect(e.companyName).toMatch(/Sri Rejeki Isman/);
    expect(e.sumberContoh).toBe(false);
    expect(e.kejadian.length).toBeGreaterThanOrEqual(3);

    const suspensi = e.kejadian.find((k) => k.jenis === "suspensi")!;
    expect(suspensi.rincian).toContain("Suspend more than 6 month");
    expect(suspensi.rincian).toContain("Alasan resmi BEI");
    expect(suspensi.sumber.url).toMatch(/idx\.co\.id/);
    // Setiap kejadian menyebut sumbernya sebagai endpoint Sectors, bukan fixture.
    for (const k of e.kejadian) expect(k.sumber.nama).toMatch(/^Sectors \//);

    // Lampu merah di posisi hari ini butuh dua jenis tanda ini ada di data.
    expect(e.kejadian.some((k) => k.jenis === "laporan_hilang")).toBe(true);
    expect(e.kejadian.some((k) => k.jenis === "ekuitas_negatif")).toBe(true);
  });

  it("COWL: hanya suspensi + catatan 'tidak tersedia di sumber' (emiten dates-404)", async () => {
    // Mencerminkan tests/e2e/putar-ulang.spec.ts "emiten 404 di sumber (COWL)".
    const e = await muatEmiten(t.db, "COWL", TODAY);
    expect(e.status).toBe("laporan_tidak_tersedia");
    expect(e.kejadian.map((k) => k.jenis)).toEqual(["suspensi"]);
    expect(e.catatan[0]).toMatch(/tidak tersedia di sumber/);
  });

  it("WIKA: tepat 2 rights issue (jumlah yang ditegaskan spec di kedua jalur)", async () => {
    const e = await muatEmiten(t.db, "WIKA", TODAY);
    expect(e.kejadian.filter((k) => k.jenis === "rights_issue")).toHaveLength(2);
  });

  it("tidak membawa buku kredit, cache, atau data pengguna — hanya kelas A", () => {
    // Benih adalah berkas yang di-commit ke repo publik: isinya tidak boleh
    // memuat baris yang bisa mengungkap kunci, kuota, atau data orang.
    expect(Object.keys(benih).sort()).toEqual(
      ["corporateActions", "dibuat", "filings", "financialsQ", "reportDates", "sumber", "suspensions", "symbols"].sort(),
    );
    expect(JSON.stringify(benih)).not.toMatch(/api[_-]?key|authorization|bearer |chat_id|telegram/i);
  });
});
