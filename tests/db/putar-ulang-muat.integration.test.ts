// Loader per simbol layar putar ulang di atas PGlite in-memory dengan fixture kecil:
// status lengkap / laporan_tidak_tersedia / hanya_suspensi / tidak_ada, pdf_url ikut.
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { financialsQ, reportDates, suspensions, symbols } from "../../src/lib/db/schema";
import { fromDb, universeFromDb } from "../../src/lib/engine/events";
import { muatEmiten, muatEmitenDariSumber } from "../../src/lib/putar-ulang/muat";
import { makeTestDb, type TestDb } from "./test-db";

const adaPglite = await import("@electric-sql/pglite").then(
  () => true,
  () => false,
);
if (!adaPglite) console.warn("[putar-ulang] Tes muatEmiten DI-SKIP: @electric-sql/pglite tidak terpasang.");

const TODAY = "2026-09-07";

describe.skipIf(!adaPglite)("muatEmiten (PGlite in-memory)", () => {
  let t: TestDb;

  beforeAll(async () => {
    t = await makeTestDb("pglite");
    await t.db.insert(symbols).values([
      { symbol: "UJIA", companyName: "PT Uji A Tbk", group: "delisting", targetEventDate: "2021-05-18" },
      { symbol: "UJIB", companyName: "PT Uji B Tbk", group: "delisting", targetEventDate: "2020-07-13" },
    ]);
    await t.db.insert(suspensions).values([
      { symbol: "UJIA", suspensionDate: "2021-05-18", reason: "Suspend more than 6 month", pdfUrl: "https://www.idx.co.id/a.pdf" },
      { symbol: "UJIB", suspensionDate: "2020-07-13", reason: "Suspend more than 6 month", pdfUrl: null },
      { symbol: "UJIC", suspensionDate: "2025-03-03", reason: "Dalam rangka cooling down", pdfUrl: "https://www.idx.co.id/c.pdf" },
    ]);
    await t.db.insert(reportDates).values(
      ["2020-03-31", "2020-06-30", "2020-09-30", "2020-12-31", "2021-03-31"].map((d) => ({
        symbol: "UJIA",
        reportDate: d,
        fiscalYear: Number(d.slice(0, 4)),
        quarter: `q${Math.ceil(Number(d.slice(5, 7)) / 3)}`,
      })),
    );
    await t.db.insert(financialsQ).values([
      { symbol: "UJIA", reportDate: "2020-12-31", totalEquity: 100 },
      { symbol: "UJIA", reportDate: "2021-03-31", totalEquity: -5e12 },
    ]);
  }, 120_000);

  afterAll(async () => {
    await t?.close();
  });

  it("emiten lengkap: metadata, pdf_url, laporan hilang diturunkan, ekuitas negatif", async () => {
    const e = await muatEmiten(t.db, "sril".replace("sril", "ujia"), TODAY);
    expect(e).toMatchObject({
      symbol: "UJIA",
      status: "lengkap",
      companyName: "PT Uji A Tbk",
      group: "delisting",
      targetEventDate: "2021-05-18",
      today: TODAY,
    });
    const susp = e.kejadian.find((k) => k.jenis === "suspensi")!;
    expect(susp.sumber.url).toBe("https://www.idx.co.id/a.pdf");
    // Kuartal terakhir 2021-03-31 → 2021-06-30 hilang pada 2021-10-28, dst. sampai 2026-03-31 (2026-06-30 belum lewat 120 hari).
    const hilang = e.kejadian.filter((k) => k.jenis === "laporan_hilang");
    expect(hilang[0]).toMatchObject({ date: "2021-10-28" });
    expect(hilang).toHaveLength(20);
    expect(e.kejadian.filter((k) => k.jenis === "ekuitas_negatif").map((k) => k.date)).toEqual(["2021-03-31"]);
    expect(e.catatan.some((c) => /filing/i.test(c))).toBe(true);
  });

  it("emiten universe tanpa dates (404 di sumber) → hanya suspensi + catatan", async () => {
    const e = await muatEmiten(t.db, "UJIB", TODAY);
    expect(e.status).toBe("laporan_tidak_tersedia");
    expect(e.kejadian.map((k) => k.jenis)).toEqual(["suspensi"]);
    expect(e.catatan[0]).toMatch(/tidak tersedia di sumber/);
  });

  it("emiten di luar universe yang ada di feed suspensi → hanya_suspensi", async () => {
    const e = await muatEmiten(t.db, "UJIC", TODAY);
    expect(e.status).toBe("hanya_suspensi");
    expect(e.group).toBeNull();
    expect(e.kejadian[0].sumber.url).toBe("https://www.idx.co.id/c.pdf");
  });

  it("kode tak dikenal → tidak_ada tanpa kejadian; kode tidak sah → tidak_ada + catatan", async () => {
    expect(await muatEmiten(t.db, "ZZZZ", TODAY)).toMatchObject({ status: "tidak_ada", kejadian: [] });
    expect(await muatEmiten(t.db, "12", TODAY)).toMatchObject({ status: "tidak_ada", catatan: [expect.stringMatching(/2–5 huruf/)] });
  });

  it("muatEmitenDariSumber lewat DB identik dengan muatEmiten; lewat sumber tanpa DB tetap jalan (tanpa pdf_url)", async () => {
    const sumber = { db: t.db, source: fromDb(t.db), universe: () => universeFromDb(t.db) };
    expect(await muatEmitenDariSumber(sumber, "UJIA", TODAY)).toEqual(await muatEmiten(t.db, "UJIA", TODAY));
    const tanpaDb = { db: null, source: fromDb(t.db), universe: () => universeFromDb(t.db) };
    const e = await muatEmitenDariSumber(tanpaDb, "UJIA", TODAY);
    expect(e.status).toBe("lengkap");
    expect(e.companyName).toBeNull();
    expect(e.kejadian.find((k) => k.jenis === "suspensi")!.sumber.url).toBeNull();
  });
});
