// Runtime bot untuk Route Handler: satu instance `Bot` per proses (di-cache di
// globalThis agar dipakai ulang antar invocation serverless/hot-reload). Tes
// me-mock modul ini untuk menyuntikkan bot dengan botInfo & fetch tiruan.
import type { Bot } from "grammy";

import { dbJaga } from "../jaga/penyedia";
import { buatBot } from "./bot";
import { secretWebhook, tokenBot } from "./status";

export { botAktif, secretWebhook, tokenBot } from "./status";

export interface RuntimeBot {
  bot: Bot;
  secret: string;
}

export type AlasanTanpaBot = "TOKEN_KOSONG" | "SECRET_KOSONG";

const KUNCI = "__alarmSahamBot" as const;

/** Bot siap pakai, atau alasan mengapa tidak ada (tanpa token/secret). */
export async function botRuntime(): Promise<RuntimeBot | AlasanTanpaBot> {
  const token = tokenBot();
  if (!token) return "TOKEN_KOSONG";
  const secret = secretWebhook();
  if (!secret) return "SECRET_KOSONG";
  const g = globalThis as unknown as Record<string, { token: string; bot: Bot } | undefined>;
  if (!g[KUNCI] || g[KUNCI].token !== token) {
    g[KUNCI] = { token, bot: buatBot(token, { db: await dbJaga() }) };
  }
  return { bot: g[KUNCI].bot, secret };
}
