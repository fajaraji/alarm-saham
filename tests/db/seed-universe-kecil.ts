// Isi DB uji (PGlite in-memory) dengan fixture universe-kecil.json — dipakai tes
// integrasi mode jaga & cron harian agar hasil kelas A sama dengan fixture.
import type { Db } from "../../src/lib/db/client";
import { corporateActions, filings, financialsQ, reportDates, suspensions, symbols } from "../../src/lib/db/schema";
import { keDateUtc, UniverseFixtureSchema } from "../../src/lib/engine/events";
import universeKecil from "../../src/lib/engine/fixtures/universe-kecil.json";

export async function seedUniverseKecil(db: Db): Promise<void> {
  const f = UniverseFixtureSchema.parse(universeKecil);
  await db.insert(symbols).values(f.universe.map((u) => ({ symbol: u.symbol, group: u.group, targetEventDate: u.targetEventDate ?? null })));
  for (const [symbol, e] of Object.entries(f.emiten)) {
    if (e.suspensions.length) {
      await db.insert(suspensions).values(e.suspensions.map((s) => ({ symbol, suspensionDate: s.suspension_date, reason: s.reason ?? null })));
    }
    const kuartal = Object.entries(e.quarterly_financial_dates).flatMap(([tahun, daftar]) =>
      daftar.map(([akhir, q]) => ({ symbol, reportDate: akhir, quarter: q, fiscalYear: Number(tahun) })),
    );
    if (kuartal.length) await db.insert(reportDates).values(kuartal);
    if (e.right_issue.length) {
      await db.insert(corporateActions).values(
        e.right_issue.map((r) => ({ symbol, kind: "right_issue" as const, eventDate: r.ex_date, payload: r as Record<string, unknown> })),
      );
    }
    if (e.quarterly_financials.length) {
      await db.insert(financialsQ).values(e.quarterly_financials.map((q) => ({ symbol, reportDate: q.date, totalEquity: q.total_equity ?? null })));
    }
    if (e.filings.length) {
      await db.insert(filings).values(
        e.filings.map((x) => ({
          symbol,
          timestamp: keDateUtc(x.timestamp),
          holderType: x.holder_type ?? null,
          transactionType: x.transaction_type ?? null,
          sharePctBefore: x.share_percentage_before ?? null,
          sharePctAfter: x.share_percentage_after ?? null,
        })),
      );
    }
  }
}
