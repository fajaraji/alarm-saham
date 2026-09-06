// Skema Zod diuji terhadap SAMPEL RESPONS NYATA Sectors v2 (tiket 04, 7 Sep 2026).
// Sampel di ./samples/ dipotong dan disamarkan (nama pemegang saham, alamat RUPS
// dihapus); angka & tanggal asli. Setiap file: { _catatan, body }.
import { describe, expect, it } from "vitest";
import {
  BrokerSummarySchema,
  CorporateActionsSchema,
  DailySchema,
  FilingsPageSchema,
  FreeFloatSchema,
  ListingPerformanceSchema,
  QuarterlyFinancialDatesSchema,
  QuarterlyFinancialsSchema,
  SuspensionsPageSchema,
} from "../../../src/lib/data";
import brokerBBCA from "./samples/broker-BBCA.json";
import brokerWIKA from "./samples/broker-WIKA.json";
import caINAF from "./samples/corporate-actions-INAF.json";
import caWIKA from "./samples/corporate-actions-WIKA.json";
import dailyWIKA from "./samples/daily-WIKA.json";
import datesSRIL from "./samples/dates-SRIL.json";
import filingsWIKA from "./samples/filings-WIKA.json";
import financialsSRIL from "./samples/financials-SRIL.json";
import freeFloat from "./samples/free-float.json";
import listingGOLL from "./samples/listing-GOLL.json";
import suspSRIL from "./samples/suspensions-SRIL.json";
import suspUniverse from "./samples/suspensions-universe.json";

describe("skema Zod vs respons nyata Sectors v2", () => {
  it("suspensions per simbol: symbol 'SRIL.JK' dinormalisasi ke 'SRIL'", () => {
    const page = SuspensionsPageSchema.parse(suspSRIL.body);
    expect(page.results).toHaveLength(1);
    expect(page.results[0].symbol).toBe("SRIL");
    expect(page.results[0].suspension_date).toBe("2021-05-18");
    expect(page.results[0].reason).toBe("Suspend more than 6 month");
    expect(page.pagination?.total_count).toBe(1);
  });

  it("suspensions universe: paginasi total_count/has_next/has_previous", () => {
    const page = SuspensionsPageSchema.parse(suspUniverse.body);
    expect(page.results.length).toBeGreaterThan(1);
    expect(page.results.every((s) => /^[A-Z0-9]{4}$/.test(s.symbol))).toBe(true);
    expect(page.pagination).toMatchObject({ total_count: 583, has_next: true, has_previous: false });
  });

  it("quarterly financial dates: dict tahun -> [[akhir periode, q], ...]; SRIL berhenti 2024 q3", () => {
    const d = QuarterlyFinancialDatesSchema.parse(datesSRIL.body);
    expect(Object.keys(d)).toEqual(["2020", "2021", "2022", "2023", "2024"]);
    expect(d["2020"]).toEqual([
      ["2020-03-31", "q1"],
      ["2020-06-30", "q2"],
      ["2020-09-30", "q3"],
      ["2020-12-31", "q4"],
    ]);
    expect(d["2024"].map(([, q]) => q)).toEqual(["q1", "q2", "q3"]);
    // bentuk lama (asumsi tiket 03) harus DITOLAK agar tidak ada yang mengandalkannya
    expect(QuarterlyFinancialDatesSchema.safeParse({ "2020": ["2021-03-31", "2020-05-29", null, null, null] }).success).toBe(false);
  });

  it("filings: persen dalam satuan persen, ada title/body/tags, symbol dinormalisasi", () => {
    const page = FilingsPageSchema.parse(filingsWIKA.body);
    expect(page.results).toHaveLength(2);
    const f = page.results[0];
    expect(f.symbol).toBe("WIKA");
    expect(f.holder_type).toBe("insider");
    expect(f.transaction_type).toBe("others");
    expect(f.share_percentage_after).toBe(0.91); // 0,91 %
    expect(f.tags).toContain("share-transfer");
    expect(f.timestamp).toMatch(/^2026-01-09T/);
    expect(f.holder_name).toContain("disamarkan");
  });

  it("corporate-actions: pembungkus corporate_actions diratakan, null -> []", () => {
    const ca = CorporateActionsSchema.parse(caWIKA.body);
    expect(ca.symbol).toBe("WIKA");
    expect(ca.right_issue).toHaveLength(2);
    expect(ca.right_issue[1]).toMatchObject({ ex_date: "2024-04-17", price: 197, new_ratio: 521982000, old_ratio: 100000000 });
    expect(ca.dividend).toHaveLength(1);
    expect(ca.dividend[0].ex_date).toBe("2020-06-17");
    expect(ca.agm).toHaveLength(2);
    expect(ca.agm[0].agm_date).toBe("2022-02-04");
    expect(ca.bonus).toEqual([]);
    expect(ca.stock_split).toEqual([]);
    expect(ca.upcoming_dividend).toEqual([]);

    const inaf = CorporateActionsSchema.parse(caINAF.body);
    expect(inaf.symbol).toBe("INAF");
    expect(inaf.right_issue).toEqual([]);
    expect(inaf.dividend).toEqual([]);
  });

  it("financials quarterly: `date` -> report_date, urut naik, ekuitas SRIL negatif", () => {
    const q = QuarterlyFinancialsSchema.parse(financialsSRIL.body);
    expect(q.map((x) => x.report_date)).toEqual(["2024-06-30", "2024-09-30"]);
    expect(q[1].date).toBe("2024-09-30");
    expect(q[1].symbol).toBe("SRIL");
    expect(q[1].total_equity).toBeLessThan(0);
    expect(q[1].total_liabilities).toBeGreaterThan(q[1].total_assets!);
    expect(typeof q[1].earnings).toBe("number");
    // tanpa date maupun report_date → ditolak
    expect(QuarterlyFinancialsSchema.safeParse([{ symbol: "X", revenue: 1 }]).success).toBe(false);
  });

  it("broker-summary: {symbol,start,end,data:[{date,summary:[...]}]}; kosong saat tersuspensi", () => {
    const b = BrokerSummarySchema.parse(brokerBBCA.body);
    expect(b.symbol).toBe("BBCA");
    expect(b.start).toBe("2026-08-24");
    expect(b.data).toHaveLength(2);
    expect(b.data[0].date).toBe("2026-08-24");
    expect(b.data[0].summary).toHaveLength(3);
    expect(b.data[0].summary[0]).toMatchObject({ broker_code: "AG", bfreq: 122, blot: 8577, nlot: 6604 });
    expect(b.data[0].summary[1].bavg_per_share).toBeNull();

    const w = BrokerSummarySchema.parse(brokerWIKA.body);
    expect(w.symbol).toBe("WIKA");
    expect(w.data).toEqual([]);
  });

  it("listing-performance: hanya chg_*; listing_date tidak ada", () => {
    const lp = ListingPerformanceSchema.parse(listingGOLL.body);
    expect(lp.symbol).toBe("GOLL");
    expect(lp.chg_365d).toBeCloseTo(-0.770833);
    expect(lp.listing_date).toBeUndefined();
  });

  it("daily: saham tersuspensi -> open null, volume 0; symbol dinormalisasi", () => {
    const d = DailySchema.parse(dailyWIKA.body);
    expect(d).toHaveLength(3);
    expect(d[0]).toMatchObject({ symbol: "WIKA", date: "2026-06-09", close: 204, open: null, volume: 0 });
  });

  it("free-float: desimal (1 = 100 %), symbol dinormalisasi", () => {
    const ff = FreeFloatSchema.parse(freeFloat.body);
    expect(ff).toHaveLength(3);
    expect(ff[0]).toMatchObject({ symbol: "HKMU", free_float: 1 });
    expect(typeof ff[1].company_name).toBe("string");
  });
});
