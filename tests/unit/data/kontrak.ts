// Tes kontrak DataProvider: dijalankan identik untuk FixtureProvider dan
// SectorsProvider (dengan fetch tiruan). Data acuan = fixture SRIL & BBCA.
import { describe, expect, it } from "vitest";
import {
  InvalidQueryError,
  NotFoundError,
  type DataProvider,
} from "../../../src/lib/data";

export function ujiKontrakDataProvider(nama: string, buat: () => Promise<DataProvider>) {
  describe(`kontrak DataProvider: ${nama}`, () => {
    it("suspensions per simbol: SRIL punya 2 suspensi dengan reason & pdf_url", async () => {
      const p = await buat();
      const page = await p.suspensions({ symbol: "SRIL" });
      expect(page.results).toHaveLength(2);
      for (const s of page.results) {
        expect(s.symbol).toBe("SRIL");
        expect(s.suspension_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(s.reason).toBeTruthy();
        expect(s.pdf_url).toMatch(/^https?:\/\//);
      }
    });

    it("suspensions universe: mencakup lebih dari satu emiten dan punya paginasi", async () => {
      const p = await buat();
      const page = await p.suspensions();
      const simbol = new Set(page.results.map((s) => s.symbol));
      expect(simbol.has("SRIL")).toBe(true);
      expect(simbol.size).toBeGreaterThan(1);
      expect(page.pagination?.total_count).toBe(page.results.length);
      expect(page.pagination?.has_next).toBe(false);
    });

    it("suspensions dengan rentang tanggal & paginasi limit/offset", async () => {
      const p = await buat();
      const sebelum2022 = await p.suspensions({ symbol: "SRIL", end: "2022-12-31" });
      expect(sebelum2022.results.map((s) => s.suspension_date)).toEqual(["2021-05-18"]);
      const hal2 = await p.suspensions({ symbol: "SRIL", limit: 1, offset: 1 });
      expect(hal2.results).toHaveLength(1);
      expect(hal2.results[0].suspension_date).toBe("2024-11-01");
      expect(hal2.pagination?.has_next).toBe(false);
    });

    it("suspensions BBCA kosong (200, bukan 404)", async () => {
      const p = await buat();
      const page = await p.suspensions({ symbol: "BBCA" });
      expect(page.results).toEqual([]);
    });

    it("quarterlyFinancialDates: dict tahun -> 5 tanggal (nullable)", async () => {
      const p = await buat();
      const sril = await p.quarterlyFinancialDates("SRIL");
      expect(Object.keys(sril)).toEqual(expect.arrayContaining(["2019", "2024"]));
      expect(sril["2019"]).toHaveLength(5);
      expect(sril["2024"].every((d) => d === null)).toBe(true);
      const bbca = await p.quarterlyFinancialDates("bbca.jk"); // normalisasi simbol
      expect(bbca["2024"].every((d) => typeof d === "string")).toBe(true);
    });

    it("filings: SRIL punya 2 penjualan insider; BBCA tidak ada penjualan", async () => {
      const p = await buat();
      const sril = await p.filings("SRIL", { transaction_type: "sell", holder_type: "insider" });
      expect(sril.results).toHaveLength(2);
      expect(sril.results.every((f) => f.transaction_type === "sell")).toBe(true);
      const bbca = await p.filings("BBCA", { transaction_type: "sell" });
      expect(bbca.results).toHaveLength(0);
      const sebelumMaret = await p.filings("SRIL", { end: "2021-02-28" });
      expect(sebelumMaret.results).toHaveLength(1);
    });

    it("corporateActions: SRIL kosong, BBCA punya dividen", async () => {
      const p = await buat();
      const sril = await p.corporateActions("SRIL");
      expect(sril.right_issue).toEqual([]);
      const bbca = await p.corporateActions("BBCA");
      expect(bbca.dividend?.length).toBeGreaterThanOrEqual(2);
    });

    it("quarterlyFinancials: n kuartal terakhir; SRIL ekuitas negatif", async () => {
      const p = await buat();
      const q = await p.quarterlyFinancials("SRIL", 2);
      expect(q).toHaveLength(2);
      expect(q[q.length - 1].report_date).toBe("2021-09-30");
      expect(q[q.length - 1].total_equity).toBeLessThan(0);
      await expect(p.quarterlyFinancials("SRIL", 0)).rejects.toBeInstanceOf(InvalidQueryError);
    });

    it("freeFloat: snapshot universe berisi BBCA", async () => {
      const p = await buat();
      const ff = await p.freeFloat();
      const bbca = ff.find((e) => e.symbol === "BBCA");
      expect(typeof bbca?.free_float).toBe("number");
    });

    it("brokerSummary: rentang <= 14 hari; lebih dari itu ditolak sebelum fetch", async () => {
      const p = await buat();
      const r = await p.brokerSummary("SRIL", "2021-05-10", "2021-05-20");
      const baris = Array.isArray(r) ? r : (r.results ?? []);
      expect(baris.length).toBe(3);
      await expect(p.brokerSummary("SRIL", "2021-05-01", "2021-05-20")).rejects.toBeInstanceOf(
        InvalidQueryError,
      );
    });

    it("listingPerformance: SRIL ada; BBCA (listing < Mei 2005) -> NotFoundError", async () => {
      const p = await buat();
      const lp = await p.listingPerformance("SRIL");
      expect(lp.listing_date).toBe("2013-06-17");
      await expect(p.listingPerformance("BBCA")).rejects.toBeInstanceOf(NotFoundError);
    });

    it("daily: rentang <= 90 hari, terurut naik; > 90 hari ditolak", async () => {
      const p = await buat();
      const d = await p.daily("BBCA", "2024-03-25", "2024-03-27");
      expect(d.map((b) => b.date)).toEqual(["2024-03-25", "2024-03-26", "2024-03-27"]);
      await expect(p.daily("BBCA", "2024-01-01", "2024-04-30")).rejects.toBeInstanceOf(
        InvalidQueryError,
      );
    });

    it("simbol tak dikenal -> NotFoundError; simbol tidak sah -> InvalidQueryError", async () => {
      const p = await buat();
      await expect(p.quarterlyFinancialDates("ZZZZ")).rejects.toBeInstanceOf(NotFoundError);
      await expect(p.corporateActions("TERLALU-PANJANG")).rejects.toBeInstanceOf(InvalidQueryError);
    });
  });
}
