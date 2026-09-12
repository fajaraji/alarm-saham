// cekPortofolio di atas PGlite in-memory (fixture universe-kecil dimasukkan ke
// tabel tiket 05) dengan ledger & cache Sectors di DB yang sama:
// - kelas A: nol panggilan API, ledger tidak bertambah;
// - kelas B (fetch tiruan): panggilan kedua dalam 24 jam = cache, ledger bertambah sekali;
// - saham tersuspensi tidak pernah dipanggil ke kelas B;
// - CreditReserveError → blok "dilewati: cadangan kredit", tanpa fetch.
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { CacheDb, LedgerDb, SectorsProvider } from "../../src/lib/data";
import { corporateActions, filings, financialsQ, reportDates, suspensions, symbols } from "../../src/lib/db/schema";
import { fromDb, keDateUtc, universeFromDb, UniverseFixtureSchema, type EventSource, type UniverseEntry } from "../../src/lib/engine/events";
import universeKecil from "../../src/lib/engine/fixtures/universe-kecil.json";
import { ALARM_BAWAAN } from "../../src/lib/jaga/bawaan";
import { cekPortofolio } from "../../src/lib/jaga/evaluasi";
import { buatFetchFixture, dirSementara } from "../unit/data/mock-sectors";
import { makeTestDb, type TestDb } from "./test-db";

const adaPglite = await import("@electric-sql/pglite").then(
  () => true,
  () => false,
);
if (!adaPglite) console.warn("[jaga] Tes evaluasi DI-SKIP: @electric-sql/pglite tidak terpasang.");

const TODAY = "2026-09-07";

describe.skipIf(!adaPglite)("cekPortofolio (PGlite in-memory)", () => {
  let t: TestDb;
  let source: EventSource;
  let universe: UniverseEntry[];

  beforeAll(async () => {
    t = await makeTestDb("pglite");
    const f = UniverseFixtureSchema.parse(universeKecil);
    await t.db.insert(symbols).values(f.universe.map((u) => ({ symbol: u.symbol, group: u.group, targetEventDate: u.targetEventDate ?? null })));
    for (const [symbol, e] of Object.entries(f.emiten)) {
      if (e.suspensions.length) {
        await t.db.insert(suspensions).values(e.suspensions.map((s) => ({ symbol, suspensionDate: s.suspension_date, reason: s.reason ?? null })));
      }
      const kuartal = Object.entries(e.quarterly_financial_dates).flatMap(([tahun, daftar]) =>
        daftar.map(([akhir, q]) => ({ symbol, reportDate: akhir, quarter: q, fiscalYear: Number(tahun) })),
      );
      if (kuartal.length) await t.db.insert(reportDates).values(kuartal);
      if (e.right_issue.length) {
        await t.db.insert(corporateActions).values(
          e.right_issue.map((r) => ({ symbol, kind: "right_issue" as const, eventDate: r.ex_date, payload: r as Record<string, unknown> })),
        );
      }
      if (e.quarterly_financials.length) {
        await t.db.insert(financialsQ).values(e.quarterly_financials.map((q) => ({ symbol, reportDate: q.date, totalEquity: q.total_equity ?? null })));
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
    source = fromDb(t.db);
    universe = await universeFromDb(t.db);
  });
  afterAll(() => t.close());

  function providerDb() {
    const tiruan = buatFetchFixture();
    const provider = new SectorsProvider({
      apiKey: "kunci-uji",
      ledger: new LedgerDb(t.db),
      cache: new CacheDb(t.db),
      fetch: tiruan.fetch,
      retryBaseMs: 0,
    });
    return { provider, panggilan: tiruan.panggilan };
  }

  it("kelas A: SRIL merah (suspensi aktif, laporan hilang, ekuitas negatif), BBCA hijau; ledger tidak bertambah", async () => {
    const { provider, panggilan } = providerDb();
    const sebelum = await provider.ledger.totalKredit();
    const barisSebelum = (await provider.ledger.semua()).length;

    const hasil = await cekPortofolio({
      symbols: ["SRIL", "bbca", "BBCA"],
      alarms: [...ALARM_BAWAAN],
      opts: { kelasB: false, today: TODAY, source, universe, provider },
    });

    expect(hasil.saham.map((s) => s.symbol)).toEqual(["SRIL", "BBCA"]); // ganda dilipat
    const sril = hasil.saham[0];
    expect(sril.status).toBe("merah");
    expect(sril.suspensiAktif).toBe("2024-11-01");
    expect(sril.alasan.map((a) => a.kind).sort()).toEqual(["ekuitas_negatif", "laporan_hilang", "suspensi"]);
    expect(sril.alarmBerbunyi).toEqual([{ id: ALARM_BAWAAN[0].id, name: "Saham mau pailit" }]);
    expect(sril.alasan.every((a) => a.sumber.startsWith("Sectors /v2/"))).toBe(true);
    expect(sril.kelasB.status).toBe("nonaktif");
    const bbca = hasil.saham[1];
    expect(bbca.status).toBe("hijau");
    expect(bbca.alasan).toEqual([]);

    expect(panggilan).toHaveLength(0);
    expect(await provider.ledger.totalKredit()).toBe(sebelum);
    expect((await provider.ledger.semua()).length).toBe(barisSebelum);
    expect(hasil.kreditTerpakai).toBe(0);
    expect(hasil.panggilanApi).toBe(0);
  });

  it("kelas B: panggilan pertama membayar, panggilan kedua dalam 24 jam dari cache (ledger bertambah sekali); saham tersuspensi dilewati", async () => {
    const { provider, panggilan } = providerDb();
    const sebelum = await provider.ledger.totalKredit();

    const pertama = await cekPortofolio({
      symbols: ["BBCA", "SRIL"],
      alarms: [...ALARM_BAWAAN],
      opts: { kelasB: true, today: TODAY, source, universe, provider },
    });
    const bbca1 = pertama.saham[0];
    expect(bbca1.kelasB.status).toBe("dijalankan");
    expect(bbca1.kelasB.blok.map((b) => b.kind).sort()).toEqual(["free_float_kecil", "jatuh_dari_puncak", "ritel_dominan"]);
    expect(bbca1.kelasB.blok.every((b) => !b.detail.startsWith("dilewati") && !b.detail.startsWith("gagal"))).toBe(true);
    // brokers + broker-summary + free-float + daily = 4 panggilan, 4 kredit (fixture per-request/per-100).
    expect(panggilan).toHaveLength(4);
    expect(pertama.kreditTerpakai).toBe(4);
    expect(pertama.panggilanApi).toBe(4);
    expect(pertama.cacheHit).toBe(0);
    const setelahPertama = await provider.ledger.totalKredit();
    expect(setelahPertama - sebelum).toBe(4);
    // SRIL: suspensi aktif → tidak ada satu pun URL SRIL yang dipanggil.
    expect(pertama.saham[1].kelasB.status).toBe("dilewati");
    expect(pertama.saham[1].kelasB.keterangan).toMatch(/tersuspensi sejak 2024-11-01/);
    expect(panggilan.some((p) => p.url.includes("SRIL"))).toBe(false);

    const kedua = await cekPortofolio({
      symbols: ["BBCA", "SRIL"],
      alarms: [...ALARM_BAWAAN],
      opts: { kelasB: true, today: TODAY, source, universe, provider },
    });
    expect(panggilan).toHaveLength(4); // tidak ada fetch baru
    expect(kedua.kreditTerpakai).toBe(0);
    expect(kedua.panggilanApi).toBe(0);
    expect(kedua.cacheHit).toBe(4);
    expect(await provider.ledger.totalKredit()).toBe(setelahPertama);
    expect(kedua.saham[0].kelasB.blok).toEqual(bbca1.kelasB.blok);
  });

  it("blokB membatasi blok yang dijalankan (tanpa free float → tidak memanggil /v2/free-float/)", async () => {
    const { provider, panggilan } = providerDb();
    const hasil = await cekPortofolio({
      symbols: ["TLKM"],
      alarms: [...ALARM_BAWAAN],
      opts: { kelasB: true, blokB: ["ritel_dominan", "jatuh_dari_puncak"], today: TODAY, source, universe, provider },
    });
    expect(hasil.saham[0].kelasB.blok.map((b) => b.kind)).toEqual(["ritel_dominan", "jatuh_dari_puncak"]);
    expect(panggilan.some((p) => p.url.includes("/v2/free-float/"))).toBe(false);
    // TLKM tidak ada di fixture Sectors → 404 ditagih sekali dan dicatat jujur di detail.
    expect(hasil.saham[0].kelasB.blok.every((b) => /404|tidak ada/.test(b.detail))).toBe(true);
    expect(hasil.saham[0].status).toBe("hijau");
  });

  it("CreditReserveError → blok 'dilewati: cadangan kredit', tanpa fetch, status tetap dari kelas A", async () => {
    const tiruan = buatFetchFixture();
    const provider = new SectorsProvider({
      apiKey: "kunci-uji",
      cacheDir: await dirSementara(),
      fetch: tiruan.fetch,
      anggaran: 100,
      cadangan: 250,
      retryBaseMs: 0,
    });
    const hasil = await cekPortofolio({
      symbols: ["BBCA"],
      alarms: [...ALARM_BAWAAN],
      opts: { kelasB: true, today: TODAY, source, universe, provider },
    });
    const b = hasil.saham[0];
    expect(b.kelasB.status).toBe("dijalankan");
    expect(b.kelasB.keterangan).toBe("dilewati: cadangan kredit");
    expect(b.kelasB.blok.every((x) => x.detail === "dilewati: cadangan kredit" && !x.terpenuhi)).toBe(true);
    expect(tiruan.panggilan).toHaveLength(0);
    expect(hasil.kreditTerpakai).toBe(0);
    expect(b.status).toBe("hijau");
  });
});
