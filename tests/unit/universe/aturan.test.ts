import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { CorporateActionsSchema, FilingsPageSchema, QuarterlyFinancialDatesSchema, QuarterlyFinancialsSchema } from "../../../src/lib/data";
import {
  barisAksiKorporasi,
  barisFiling,
  barisFinancial,
  barisReportDates,
  geserHari,
  jumlahHalaman,
  nQuartersTersedia,
  parseTimestampUtc,
  pasKuartal,
  pilihKontrol,
  targetDelisting,
  targetPemantauan,
} from "../../../src/lib/universe/aturan";
import { EMITEN_DELISTING, EMITEN_PEMANTAUAN, JUMLAH_KONTROL } from "../../../src/lib/universe/daftar";

async function sampel(nama: string): Promise<unknown> {
  const isi = JSON.parse(await readFile(`tests/unit/data/samples/${nama}.json`, "utf8")) as { body: unknown };
  return isi.body;
}

describe("daftar universe", () => {
  it("18 delisting + 59 pemantauan, tanpa duplikat, simbol 4 huruf, tanggal sah", () => {
    expect(EMITEN_DELISTING).toHaveLength(18);
    expect(EMITEN_PEMANTAUAN).toHaveLength(59);
    const semua = [...EMITEN_DELISTING.map((e) => e.symbol), ...EMITEN_PEMANTAUAN];
    expect(new Set(semua).size).toBe(77);
    for (const s of semua) expect(s).toMatch(/^[A-Z0-9]{4}$/);
    for (const e of EMITEN_DELISTING) expect(Number.isNaN(Date.parse(e.suspensiCatatan))).toBe(false);
    expect(18 + 59 + JUMLAH_KONTROL).toBe(107);
  });
});

describe("pilihKontrol", () => {
  const kandidat = [
    { symbol: "BBCA", market_cap: 1000, company_name: "BCA", sub_sector: "banks" },
    { symbol: "BBRI", market_cap: 900 },
    { symbol: "WIKA", market_cap: 800 }, // universe → kecuali
    { symbol: "ANTM", market_cap: 700 }, // pernah suspensi
    { symbol: "TLKM", market_cap: 500 },
    { symbol: "XXXX", market_cap: null },
    { symbol: "BBCA", market_cap: 1 }, // duplikat dibuang
  ];
  it("membuang tersuspensi & universe, urut market_cap turun, null di belakang, ambil n", () => {
    const hasil = pilihKontrol(kandidat, new Set(["ANTM"]), new Set(["WIKA"]), 3);
    expect(hasil.map((h) => h.symbol)).toEqual(["BBCA", "BBRI", "TLKM"]);
    expect(hasil[0]).toEqual({ symbol: "BBCA", companyName: "BCA", subSector: "banks", marketCap: 1000 });
    expect(pilihKontrol(kandidat, new Set(), new Set(), 10).map((h) => h.symbol)).toEqual(["BBCA", "BBRI", "WIKA", "ANTM", "TLKM", "XXXX"]);
  });
  it("tanpa market_cap sama sekali: urutan API dipertahankan (server sudah order_by market_cap)", () => {
    const tanpa = [{ symbol: "TLKM" }, { symbol: "BBCA" }, { symbol: "ASII" }, { symbol: "BBRI" }];
    expect(pilihKontrol(tanpa, new Set(["ASII"]), new Set(), 2).map((h) => h.symbol)).toEqual(["TLKM", "BBCA"]);
  });
});

describe("tanggal kejadian target", () => {
  it("pemantauan: suspensi TERAKHIR ≤ acuan; null bila tidak ada", () => {
    expect(targetPemantauan(["2024-07-02", "2025-02-18", "2026-08-01"], "2026-06-30")).toBe("2025-02-18");
    expect(targetPemantauan(["2026-08-01"], "2026-06-30")).toBeNull();
    expect(targetPemantauan([], "2026-06-30")).toBeNull();
  });
  it("delisting: suspensi TERAWAL ≥ catatan − 60 hari; fallback tanggal catatan", () => {
    expect(targetDelisting(["2019-01-30", "2021-05-18", "2024-11-01"], "2021-05-18")).toEqual({ tanggal: "2021-05-18", terverifikasi: true });
    // feed sedikit lebih awal dari catatan (dalam toleransi)
    expect(targetDelisting(["2021-04-01", "2024-11-01"], "2021-05-18")).toEqual({ tanggal: "2021-04-01", terverifikasi: true });
    // hanya kejadian jauh sebelum catatan → tidak terverifikasi
    expect(targetDelisting(["2024-12-27"], "2025-06-06")).toEqual({ tanggal: "2025-06-06", terverifikasi: false });
    expect(targetDelisting([], "2020-07-13")).toEqual({ tanggal: "2020-07-13", terverifikasi: false });
    expect(geserHari("2021-05-18", -60)).toBe("2021-03-19");
  });
});

describe("nQuartersTersedia & jumlahHalaman", () => {
  it("menghitung kuartal ≥ 2020 q1 dari sampel SRIL (19 kuartal) dibatasi 8", async () => {
    const dates = QuarterlyFinancialDatesSchema.parse(await sampel("dates-SRIL"));
    expect(nQuartersTersedia(dates)).toBe(8);
    expect(nQuartersTersedia(dates, "2020-01-01", 100)).toBe(19);
    expect(nQuartersTersedia(dates, "2024-07-01")).toBe(1);
    expect(nQuartersTersedia({}, "2020-01-01")).toBe(0);
  });
  it("583 baris / 30 = 20 halaman; minimal 1", () => {
    expect(jumlahHalaman(583, 30)).toBe(20);
    expect(jumlahHalaman(0, 30)).toBe(1);
  });
});

describe("pemetaan respons → baris tabel", () => {
  it("report_dates dari sampel SRIL: 19 baris dengan tahun & kuartal", async () => {
    const dates = QuarterlyFinancialDatesSchema.parse(await sampel("dates-SRIL"));
    const rows = barisReportDates("SRIL", dates);
    expect(rows).toHaveLength(19);
    expect(rows[0]).toEqual({ symbol: "SRIL", reportDate: "2020-03-31", quarter: "q1", fiscalYear: 2020 });
  });

  it("corporate_actions dari sampel WIKA: agm 2, dividend 1, right_issue 2; daftar null dilewati", async () => {
    const aksi = CorporateActionsSchema.parse(await sampel("corporate-actions-WIKA"));
    const rows = barisAksiKorporasi("WIKA", aksi);
    const perJenis = new Map<string, string[]>();
    for (const r of rows) perJenis.set(r.kind, [...(perJenis.get(r.kind) ?? []), r.eventDate]);
    expect(perJenis.get("agm")).toEqual(["2022-02-04", "2023-09-22"]);
    expect(perJenis.get("dividend")).toEqual(["2020-06-17"]);
    expect(perJenis.get("right_issue")).toEqual(["2016-11-11", "2024-04-17"]);
    expect(rows).toHaveLength(5);
    const ri = rows.find((r) => r.kind === "right_issue" && r.eventDate === "2024-04-17")!;
    expect(ri.payload).toMatchObject({ new_ratio: 521982000, old_ratio: 100000000, price: 197 });
  });

  it("filings dari sampel WIKA: timestamp naif → UTC, angka tersalin", async () => {
    const page = FilingsPageSchema.parse(await sampel("filings-WIKA"));
    const rows = page.results.map((f) => barisFiling("WIKA", f));
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]).toMatchObject({
      symbol: "WIKA",
      holderType: "insider",
      transactionType: "others",
      amountTransaction: 362917026,
      price: 100,
      transactionValue: 36291702700,
      sharePctBefore: 0,
      sharePctAfter: 0.91,
    });
    expect(rows[0]!.timestamp.toISOString()).toBe("2026-01-09T10:22:00.000Z");
    expect(parseTimestampUtc("2026-01-09T10:22:00+07:00")).toBe(Date.parse("2026-01-09T03:22:00Z"));
    expect(barisFiling("WIKA", { ...page.results[0], timestamp: "bukan-tanggal" })).toBeNull();
  });

  it("financials_q dari sampel SRIL: ekuitas negatif, payload utuh", async () => {
    const q = QuarterlyFinancialsSchema.parse(await sampel("financials-SRIL"));
    const rows = q.map((x) => barisFinancial("SRIL", x));
    expect(rows.map((r) => r!.reportDate)).toEqual(["2024-06-30", "2024-09-30"]);
    const terakhir = rows[1]!;
    expect(terakhir.totalEquity).toBe(-15460123473432);
    expect(terakhir.totalLiabilities).toBe(24455852953176);
    expect((terakhir.payload as Record<string, unknown>).report_date).toBe("2024-09-30");
  });
});

describe("pasKuartal", () => {
  it("menurunkan batas kuartal seragam sampai total muat; minimal 1", () => {
    const tersedia = [...Array(17).fill(19), 7]; // 17 emiten ≥ 8 kuartal, GOLL 7
    expect(pasKuartal(tersedia, 200, 8)).toBe(8); // 17*8+7 = 143 ≤ 200
    expect(pasKuartal(tersedia, 124, 8)).toBe(6); // 7 → 126 > 124; 6 → 108
    expect(pasKuartal(tersedia, 0, 8)).toBe(1);
    expect(pasKuartal([], 0, 8)).toBe(8);
  });
});
