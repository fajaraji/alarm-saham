// Bot Telegram (tiket 12) di atas PGlite in-memory dengan tiruan api.telegram.org:
// /mulai <kode> menautkan chat ↔ pemilik; kode salah ditolak; /berhenti melepas;
// route webhook: 503 tanpa token, 401 secret salah, 200 memproses update.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { DISCLAIMER } from "../../src/lib/agent/instructions";
import type { Db } from "../../src/lib/db/client";
import { portfolios } from "../../src/lib/db/schema";
import { buatBot, TEKS_BOT } from "../../src/lib/telegram/bot";
import type { AlasanTanpaBot, RuntimeBot } from "../../src/lib/telegram/runtime";
import { chatUntukPemilik, tautanUntukChat } from "../../src/lib/telegram/tautan";
import { BOT_INFO, fetchTelegramTiruan, TOKEN_UJI, updateTeks } from "../unit/telegram/mock-telegram";
import { makeTestDb, type TestDb } from "./test-db";

let runtime: RuntimeBot | AlasanTanpaBot = "TOKEN_KOSONG";
vi.mock("../../src/lib/telegram/runtime", () => ({ botRuntime: async () => runtime }));
const { GET, POST } = await import("../../src/app/api/telegram/webhook/route");

const adaPglite = await import("@electric-sql/pglite").then(
  () => true,
  () => false,
);
if (!adaPglite) console.warn("[telegram] Tes bot DI-SKIP: @electric-sql/pglite tidak terpasang.");

const OWNER = "aaaaaaaa-0000-4000-8000-00000000000a";
const SECRET = "rahasia-webhook-uji";

describe.skipIf(!adaPglite)("bot Telegram (PGlite in-memory, api.telegram.org tiruan)", () => {
  let t: TestDb;
  let db: Db;
  let kode: string;
  const tiruan = fetchTelegramTiruan();
  const balasanTerakhir = () => String(tiruan.panggilan.at(-1)?.body.text ?? "");

  beforeAll(async () => {
    t = await makeTestDb("pglite");
    db = t.db;
    const [p] = await db.insert(portfolios).values({ ownerToken: OWNER, symbols: ["SRIL", "BBCA"], alarmIds: [] }).returning({ id: portfolios.id });
    kode = p.id;
  });
  afterAll(() => t.close());

  it("/mulai <kode> menautkan chat ke pemilik portofolio; balasan memuat disclaimer", async () => {
    const bot = buatBot(TOKEN_UJI, { db, botInfo: BOT_INFO, fetch: tiruan.fetch });
    await bot.handleUpdate(updateTeks(4242, `/mulai ${kode}`));
    expect(tiruan.panggilan.at(-1)?.metode).toBe("sendMessage");
    expect(tiruan.panggilan.at(-1)?.body.chat_id).toBe(4242);
    expect(balasanTerakhir()).toBe(TEKS_BOT.tertaut(2));
    expect(balasanTerakhir()).toContain(DISCLAIMER);
    const tautan = await tautanUntukChat(db, 4242);
    expect(tautan?.owner).toBe(OWNER);
    expect(tautan?.portfolioId).toBe(kode);
    expect((await chatUntukPemilik(db, OWNER)).map((x) => x.chatId)).toEqual(["4242"]);
    // Tidak ada panggilan selain sendMessage (tanpa getMe: botInfo disuntik).
    expect(tiruan.panggilan.every((p) => p.metode === "sendMessage")).toBe(true);
  });

  it("/mulai tanpa kode / kode bukan UUID / kode tidak ada → ditolak sopan, tidak menautkan", async () => {
    const bot = buatBot(TOKEN_UJI, { db, botInfo: BOT_INFO, fetch: tiruan.fetch });
    await bot.handleUpdate(updateTeks(5151, "/mulai"));
    expect(balasanTerakhir()).toBe(TEKS_BOT.kodeKosong);
    await bot.handleUpdate(updateTeks(5151, "/mulai bukan-kode"));
    expect(balasanTerakhir()).toBe(TEKS_BOT.kodeSalah);
    await bot.handleUpdate(updateTeks(5151, "/mulai 00000000-0000-4000-8000-000000000000"));
    expect(balasanTerakhir()).toBe(TEKS_BOT.kodeSalah);
    expect(await tautanUntukChat(db, 5151)).toBeNull();
    // /start dengan payload deep-link = /mulai; tanpa payload = bantuan
    await bot.handleUpdate(updateTeks(5151, "/start"));
    expect(balasanTerakhir()).toBe(TEKS_BOT.bantuan);
    await bot.handleUpdate(updateTeks(5151, "halo"));
    expect(balasanTerakhir()).toBe(TEKS_BOT.bantuan);
  });

  it("/berhenti melepas tautan; ulang → 'belum tertaut'", async () => {
    const bot = buatBot(TOKEN_UJI, { db, botInfo: BOT_INFO, fetch: tiruan.fetch });
    await bot.handleUpdate(updateTeks(4242, "/berhenti"));
    expect(balasanTerakhir()).toBe(TEKS_BOT.dilepas);
    expect(await tautanUntukChat(db, 4242)).toBeNull();
    await bot.handleUpdate(updateTeks(4242, "/berhenti"));
    expect(balasanTerakhir()).toBe(TEKS_BOT.belumTertaut);
  });

  it("tanpa DB bot menjawab sopan, tidak melempar", async () => {
    const bot = buatBot(TOKEN_UJI, { db: null, botInfo: BOT_INFO, fetch: tiruan.fetch });
    await bot.handleUpdate(updateTeks(6161, `/mulai ${kode}`));
    expect(balasanTerakhir()).toBe(TEKS_BOT.tanpaDb);
  });

  describe("route /api/telegram/webhook", () => {
    const kirim = (update: unknown, secret?: string) =>
      POST(
        new Request("http://localhost/api/telegram/webhook", {
          method: "POST",
          headers: { "content-type": "application/json", ...(secret ? { "X-Telegram-Bot-Api-Secret-Token": secret } : {}) },
          body: JSON.stringify(update),
        }),
      );

    it("503 sopan bila TELEGRAM_BOT_TOKEN kosong (§7.5) atau secret webhook kosong; GET melaporkan aktif=false", async () => {
      runtime = "TOKEN_KOSONG";
      const res = await kirim(updateTeks(1, "/mulai x"), SECRET);
      expect(res.status).toBe(503);
      const json = await res.json();
      expect(json.error.kode).toBe("TELEGRAM_TOKEN_KOSONG");
      expect(json.error.pesan).toMatch(/kotak masuk/i);
      expect(await (await GET()).json()).toEqual({ aktif: false, alasan: "TOKEN_KOSONG" });

      runtime = "SECRET_KOSONG";
      expect((await kirim(updateTeks(1, "/mulai x"), SECRET)).status).toBe(503);
    });

    it("401 bila header secret salah/tidak ada; 200 & memproses update bila cocok", async () => {
      const bot = buatBot(TOKEN_UJI, { db, botInfo: BOT_INFO, fetch: tiruan.fetch });
      runtime = { bot, secret: SECRET };
      expect((await kirim(updateTeks(7171, `/mulai ${kode}`))).status).toBe(401);
      expect((await kirim(updateTeks(7171, `/mulai ${kode}`), "salah")).status).toBe(401);
      expect(await tautanUntukChat(db, 7171)).toBeNull();

      const sebelum = tiruan.panggilan.length;
      const res = await kirim(updateTeks(7171, `/mulai ${kode}`), SECRET);
      expect(res.status).toBe(200);
      expect((await tautanUntukChat(db, 7171))?.owner).toBe(OWNER);
      // Balasan bisa lewat webhook reply (body respons) atau sendMessage; salah satu harus memuat teks tertaut.
      const lewatApi = tiruan.panggilan.length > sebelum ? balasanTerakhir() : "";
      const lewatRespons = await res.text();
      expect(`${lewatApi}\n${lewatRespons}`).toContain("Chat ini tertaut");
      expect(await (await GET()).json()).toEqual({ aktif: true });
    });
  });
});
