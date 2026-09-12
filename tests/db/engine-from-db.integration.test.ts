// fromDb vs fromFixture: fixture universe-kecil dimasukkan ke tabel tiket 05 di
// PGlite, lalu kejadian ternormalisasi dan skor uji-ke-masa-lalu harus identik.
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  corporateActions,
  filings,
  financialsQ,
  reportDates,
  suspensions,
  symbols,
} from "../../src/lib/db/schema";
import {
  fromDb,
  fromFixture,
  keDateUtc,
  universeFromDb,
  UniverseFixtureSchema,
  type EventSource,
} from "../../src/lib/engine/events";
import aturanDefault from "../../src/lib/engine/fixtures/aturan-default.json";
import universeKecil from "../../src/lib/engine/fixtures/universe-kecil.json";
import { parseRule } from "../../src/lib/engine/rules";
import { runBacktest } from "../../src/lib/engine/score";
import { makeTestDb, type TestDb } from "./test-db";

const adaPglite = await import("@electric-sql/pglite").then(
  () => true,
  () => false,
);
if (!adaPglite) console.warn("[engine] Tes fromDb DI-SKIP: @electric-sql/pglite tidak terpasang.");

const TODAY = "2026-09-07";

describe.skipIf(!adaPglite)("fromDb (PGlite) identik dengan fromFixture", () => {
  let t: TestDb;
  let dariDb: EventSource;
  const dariFixture = fromFixture(universeKecil);

  beforeAll(async () => {
    t = await makeTestDb("pglite");
    const f = UniverseFixtureSchema.parse(universeKecil);

    await t.db.insert(symbols).values(
      f.universe.map((u) => ({
        symbol: u.symbol,
        group: u.group,
        targetEventDate: u.targetEventDate ?? null,
      })),
    );
    for (const [symbol, e] of Object.entries(f.emiten)) {
      if (e.suspensions.length) {
        await t.db.insert(suspensions).values(
          e.suspensions.map((s) => ({ symbol, suspensionDate: s.suspension_date, reason: s.reason ?? null })),
        );
      }
      const kuartal = Object.entries(e.quarterly_financial_dates).flatMap(([tahun, daftar]) =>
        daftar.map(([akhir, q]) => ({
          symbol,
          reportDate: akhir,
          quarter: q,
          fiscalYear: Number(tahun),
        })),
      );
      if (kuartal.length) await t.db.insert(reportDates).values(kuartal);
      if (e.right_issue.length) {
        await t.db.insert(corporateActions).values(
          e.right_issue.map((r) => ({
            symbol,
            kind: "right_issue" as const,
            eventDate: r.ex_date,
            payload: r as Record<string, unknown>,
          })),
        );
      }
      // Aksi non-dilutif ikut dimasukkan untuk memastikan fromDb menyaring kind.
      await t.db.insert(corporateActions).values({
        symbol,
        kind: "dividend",
        eventDate: "2023-06-15",
        payload: { ex_date: "2023-06-15", new_ratio: 99, old_ratio: 1 },
      });
      if (e.quarterly_financials.length) {
        await t.db.insert(financialsQ).values(
          e.quarterly_financials.map((q) => ({
            symbol,
            reportDate: q.date,
            totalEquity: q.total_equity ?? null,
          })),
        );
      }
      if (e.filings.length) {
        await t.db.insert(filings).values(
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
    dariDb = fromDb(t.db);
  }, 120_000);

  afterAll(async () => {
    await t?.close();
  });

  it("universeFromDb sama dengan universe fixture", async () => {
    const u = await universeFromDb(t.db);
    const urut = [...dariFixture.universe].sort((a, b) => a.symbol.localeCompare(b.symbol));
    expect(u).toEqual(urut);
  });

  it("kejadian ternormalisasi per emiten identik", async () => {
    for (const { symbol } of dariFixture.universe) {
      const a = await dariFixture.events(symbol);
      const b = await dariDb.events(symbol);
      expect(b, symbol).toEqual(a);
    }
    expect(await dariDb.events("XXXX")).toEqual(await dariFixture.events("XXXX"));
  });

  it("skor aturan default dan aturan insider ketat identik", async () => {
    const universe = await universeFromDb(t.db);
    for (const rule of [
      parseRule(aturanDefault),
      parseRule({ name: "insider", combine: "any", blocks: [{ kind: "insider_jual", threshold: "ketat" }] }),
    ]) {
      const a = await runBacktest(rule, universe, dariFixture, { today: TODAY });
      const b = await runBacktest(rule, universe, dariDb, { today: TODAY });
      expect(b, rule.name).toEqual(a);
    }
    const h = await runBacktest(parseRule(aturanDefault), universe, dariDb, { today: TODAY });
    expect(h).toMatchObject({ hits: 2, total: 4, leadMonthsAvg: 23, falseAlarms: 0, controls: 4 });
  });
});
