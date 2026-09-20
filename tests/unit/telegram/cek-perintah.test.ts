// Perintah /cek <KODE> di bot Telegram (tiket 43): jawabannya disuntik, jadi
// tes ini hanya soal perilaku bot — kode diteruskan apa adanya, kegagalan
// dijawab sopan, dan bantuan menyebut perintahnya.
import { describe, expect, it, vi } from "vitest";

import { buatBot, TEKS_BOT } from "../../../src/lib/telegram/bot";
import { BOT_INFO, fetchTelegramTiruan, TOKEN_UJI, updateTeks } from "./mock-telegram";

function bot(cek?: (kode: string) => Promise<string>) {
  const tiruan = fetchTelegramTiruan();
  return {
    bot: buatBot(TOKEN_UJI, { db: null, botInfo: BOT_INFO, fetch: tiruan.fetch, cek }),
    balasan: () => String(tiruan.panggilan.at(-1)?.body.text ?? ""),
  };
}

describe("/cek di bot Telegram", () => {
  it("meneruskan kode ke penjawab dan mengirim jawabannya apa adanya", async () => {
    const cek = vi.fn(async (kode: string) => `jawaban untuk ${kode.trim().toUpperCase()}`);
    const b = bot(cek);
    await b.bot.handleUpdate(updateTeks(11, "/cek sril"));
    expect(cek).toHaveBeenCalledWith("sril");
    expect(b.balasan()).toBe("jawaban untuk SRIL");
  });

  it("kode kosong tetap diteruskan: penjawablah yang memutuskan kalimatnya", async () => {
    const cek = vi.fn(async () => "Tulis kode sahamnya, mis. /cek BBCA.");
    const b = bot(cek);
    await b.bot.handleUpdate(updateTeks(11, "/cek"));
    expect(cek).toHaveBeenCalledWith("");
    expect(b.balasan()).toMatch(/Tulis kode sahamnya/);
  });

  it("penjawab gagal → pesan sopan, bukan diam atau jejak galat", async () => {
    const b = bot(async () => {
      throw new Error("database mati");
    });
    await b.bot.handleUpdate(updateTeks(11, "/cek BBCA"));
    expect(b.balasan()).toBe(TEKS_BOT.cekGagal);
  });

  it("tanpa penjawab terpasang, bot mengatakannya alih-alih menjanjikan hasil", async () => {
    const b = bot(undefined);
    await b.bot.handleUpdate(updateTeks(11, "/cek BBCA"));
    expect(b.balasan()).toBe(TEKS_BOT.cekTidakAda);
  });

  it("bantuan menyebut /cek lebih dulu: itu pintu masuk tanpa portofolio", async () => {
    const b = bot(async () => "x");
    await b.bot.handleUpdate(updateTeks(11, "/help"));
    expect(b.balasan()).toMatch(/\/cek <KODE>/);
    expect(b.balasan().indexOf("/cek")).toBeLessThan(b.balasan().indexOf("/mulai"));
  });
});
