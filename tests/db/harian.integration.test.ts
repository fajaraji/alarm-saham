// Cron harian (tiket 12) di atas PGlite in-memory (fixture universe-kecil):
// - hanya portofolio dengan saham & alarm kelas A aktif yang diproses;
// - run pertama: bendera SRIL masuk `inbox`; run kedua: 0 bendera (idempoten);
// - ledger Sectors tidak bertambah (kelas A saja);
// - Telegram (tiruan api.telegram.org): sendMessage ke chat yang tertaut, teks
//   memuat disclaimer; 403 → tautan dilepas.
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { DISCLAIMER } from "../../src/lib/agent/instructions";
import { LedgerDb } from "../../src/lib/data";
import { portfolios } from "../../src/lib/db/schema";
import { fromDb, universeFromDb, type EventSource, type UniverseEntry } from "../../src/lib/engine/events";
import { ID_ALARM_JEBAKAN, ID_ALARM_PAILIT } from "../../src/lib/jaga/bawaan";
import { jalankanPengecekanHarian } from "../../src/lib/jaga/harian";
import { muatKotakMasuk } from "../../src/lib/jaga/inbox";
import { PengirimInApp, PengirimTelegram } from "../../src/lib/jaga/pengirim";
import { chatUntukPemilik, tautkanChat } from "../../src/lib/telegram/tautan";
import { fetchTelegramTiruan, TOKEN_UJI } from "../unit/telegram/mock-telegram";
import { seedUniverseKecil } from "./seed-universe-kecil";
import { makeTestDb, type TestDb } from "./test-db";

const adaPglite = await import("@electric-sql/pglite").then(
  () => true,
  () => false,
);
if (!adaPglite) console.warn("[harian] Tes cron DI-SKIP: @electric-sql/pglite tidak terpasang.");

const TODAY = "2026-09-07";
const OWNER_A = "aaaaaaaa-0000-4000-8000-00000000000a";
const OWNER_B = "bbbbbbbb-0000-4000-8000-00000000000b";
const OWNER_C = "cccccccc-0000-4000-8000-00000000000c";
const OWNER_D = "dddddddd-0000-4000-8000-00000000000d";

describe.skipIf(!adaPglite)("jalankanPengecekanHarian (PGlite in-memory)", () => {
  let t: TestDb;
  let source: EventSource;
  let universe: UniverseEntry[];

  beforeAll(async () => {
    t = await makeTestDb("pglite");
    await seedUniverseKecil(t.db);
    source = fromDb(t.db);
    universe = await universeFromDb(t.db);
    await t.db.insert(portfolios).values([
      { ownerToken: OWNER_A, symbols: ["SRIL", "BBCA"], alarmIds: [ID_ALARM_PAILIT] },
      { ownerToken: OWNER_B, symbols: ["BBCA"], alarmIds: [] }, // tanpa alarm → dilewati
      { ownerToken: OWNER_C, symbols: ["SRIL"], alarmIds: [ID_ALARM_JEBAKAN] }, // hanya kelas B → dilewati, nol kredit
    ]);
  });
  afterAll(() => t.close());

  const jalankan = (pengirim: PengirimInApp | PengirimTelegram, ...lain: (PengirimInApp | PengirimTelegram)[]) =>
    jalankanPengecekanHarian({ db: t.db, source, universe, keteranganSumber: "pglite uji", pengirim: [pengirim, ...lain], today: TODAY });

  it("run 1: SRIL merah → 1 bendera ke inbox pemilik A; B & C dilewati; ledger tetap", async () => {
    const ledger = new LedgerDb(t.db);
    const sebelum = (await ledger.semua()).length;

    const r = await jalankan(new PengirimInApp(t.db));
    expect(r.today).toBe(TODAY);
    expect(r.portofolio).toBe(1);
    expect(r.dilewati).toBe(2);
    expect(r.benderaBaru).toBe(1);
    expect(r.terkirim).toEqual({ inapp: 1, telegram: 0 });
    expect(r.galat).toEqual([]);

    const kotak = await muatKotakMasuk(t.db, OWNER_A);
    expect(kotak).toHaveLength(1);
    expect(kotak[0].symbol).toBe("SRIL");
    expect(kotak[0].status).toBe("merah");
    expect(kotak[0].judul).toContain("Saham mau pailit");
    expect(kotak[0].teks).toContain(DISCLAIMER);
    expect(kotak[0].teks).toContain("2024-11-01");
    expect(kotak[0].baru).toBe(true);
    expect(await muatKotakMasuk(t.db, OWNER_B)).toEqual([]);
    expect(await muatKotakMasuk(t.db, OWNER_C)).toEqual([]);

    expect((await ledger.semua()).length).toBe(sebelum);
  });

  it("run 2 (hari yang sama, pemanggilan ganda Vercel): 0 bendera baru, 0 pesan", async () => {
    const r = await jalankan(new PengirimInApp(t.db));
    expect(r.portofolio).toBe(1);
    expect(r.benderaBaru).toBe(0);
    expect(r.terkirim).toEqual({ inapp: 0, telegram: 0 });
    expect(await muatKotakMasuk(t.db, OWNER_A)).toHaveLength(1);
  });

  it("saham baru memburuk → hanya saham itu yang jadi bendera (bukan mengulang SRIL)", async () => {
    await t.db.update(portfolios).set({ symbols: ["SRIL", "BBCA", "GOLL"] });
    const r = await jalankan(new PengirimInApp(t.db));
    const kotak = await muatKotakMasuk(t.db, OWNER_A);
    // GOLL di fixture juga bermasalah; apa pun statusnya, SRIL tidak boleh diulang.
    expect(r.benderaBaru).toBe(kotak.length - 1);
    expect(kotak.filter((p) => p.symbol === "SRIL")).toHaveLength(1);
    await t.db.update(portfolios).set({ symbols: ["SRIL", "BBCA"] });
  });

  it("Telegram: chat tertaut menerima sendMessage (tiruan api.telegram.org) dengan disclaimer; tanpa tautan → 0", async () => {
    const [p] = await t.db
      .insert(portfolios)
      .values({ ownerToken: OWNER_D, symbols: ["SRIL"], alarmIds: [ID_ALARM_PAILIT] })
      .returning({ id: portfolios.id });
    await tautkanChat(t.db, 777, OWNER_D, p.id);

    const tiruan = fetchTelegramTiruan();
    const tg = new PengirimTelegram({ db: t.db, token: TOKEN_UJI, fetch: tiruan.fetch });
    const r = await jalankan(new PengirimInApp(t.db), tg);
    expect(r.portofolio).toBe(2);
    expect(r.benderaBaru).toBe(1); // hanya D (A sudah punya run)
    expect(r.terkirim).toEqual({ inapp: 1, telegram: 1 });

    expect(tiruan.panggilan).toHaveLength(1);
    const [k] = tiruan.panggilan;
    expect(k.url).toBe(`https://api.telegram.org/bot${TOKEN_UJI}/sendMessage`);
    expect(k.body.chat_id).toBe("777");
    const teks = String(k.body.text);
    expect(teks).toContain("SRIL");
    expect(teks).toContain("Saham mau pailit");
    expect(teks).toContain(DISCLAIMER);
    expect(teks).not.toMatch(/\b(beli|jual|rekomendasi)\b/i);

    // Inbox pemilik D juga terisi (in-app selalu ditulis, bukan hanya fallback).
    expect(await muatKotakMasuk(t.db, OWNER_D)).toHaveLength(1);
  });

  it("Telegram 403 (bot diblokir) → tautan dilepas; run tidak gagal", async () => {
    const [p] = await t.db
      .insert(portfolios)
      .values({ ownerToken: "eeeeeeee-0000-4000-8000-00000000000e", symbols: ["SRIL"], alarmIds: [ID_ALARM_PAILIT] })
      .returning({ id: portfolios.id });
    await tautkanChat(t.db, 888, "eeeeeeee-0000-4000-8000-00000000000e", p.id);
    const tiruan = fetchTelegramTiruan({ galat: { sendMessage: { error_code: 403, description: "Forbidden: bot was blocked by the user" } } });
    const r = await jalankan(new PengirimInApp(t.db), new PengirimTelegram({ db: t.db, token: TOKEN_UJI, fetch: tiruan.fetch }));
    expect(r.galat).toEqual([]);
    expect(r.terkirim.telegram).toBe(0);
    expect(r.terkirim.inapp).toBe(1);
    expect(await chatUntukPemilik(t.db, "eeeeeeee-0000-4000-8000-00000000000e")).toEqual([]);
  });
});
