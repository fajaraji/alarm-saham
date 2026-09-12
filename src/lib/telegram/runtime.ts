// Runtime bot untuk Route Handler: satu instance `Bot` per proses (di-cache di
// globalThis agar dipakai ulang antar invocation serverless/hot-reload). Tes
// me-mock modul ini untuk menyuntikkan bot dengan botInfo & fetch tiruan.
import type { Bot } from "grammy";

import { dbJaga } from "../jaga/penyedia";
import { buatBot } from "./bot";

export interface RuntimeBot {
  bot: Bot;
  secret: string;
}

export type AlasanTanpaBot = "TOKEN_KOSONG" | "SECRET_KOSONG";

export function tokenBot(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const t = env.TELEGRAM_BOT_TOKEN?.trim();
  return t ? t : undefined;
}

export function secretWebhook(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const s = env.TELEGRAM_WEBHOOK_SECRET?.trim();
  return s ? s : undefined;
}

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
