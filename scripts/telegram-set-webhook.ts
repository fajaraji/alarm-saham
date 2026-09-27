// Daftarkan webhook bot Telegram sekali (setelah deploy):
//   npm run telegram:set-webhook -- https://<app>.vercel.app
// Butuh TELEGRAM_BOT_TOKEN dan TELEGRAM_WEBHOOK_SECRET di .env.local / env Vercel.
// Tanpa token skrip berhenti sopan (exit 1) — tidak ada panggilan API apa pun.
import { Api } from "grammy";

const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
const dasar = (process.argv[2] ?? process.env.APP_URL ?? "").trim().replace(/\/+$/, "");

if (!token) {
  console.error("TELEGRAM_BOT_TOKEN kosong. Buat bot di @BotFather, isi .env.local, lalu jalankan lagi. (Tanpa token, notifikasi tetap tampil in-app — PLAN §7.5.)");
  process.exit(1);
}
if (!secret || !/^[A-Za-z0-9_-]{1,256}$/.test(secret)) {
  console.error("TELEGRAM_WEBHOOK_SECRET kosong/tidak valid (1–256 karakter A-Z a-z 0-9 _ -).");
  process.exit(1);
}
if (!/^https:\/\//.test(dasar)) {
  console.error("Beri URL https aplikasi: npm run telegram:set-webhook -- https://<app>.vercel.app");
  process.exit(1);
}

// Dibungkus fungsi, bukan await tingkat atas: tsx mengompilasi berkas .ts di
// paket CommonJS ini ke CJS, dan di sana await tingkat atas adalah galat build
// (ketahuan saat skrip ini pertama kali benar-benar dijalankan, 20 Sep 2026).
async function main(): Promise<void> {
  const url = `${dasar}/api/telegram/webhook`;
  const api = new Api(token as string);
  const hasil = await api.setWebhook(url, { secret_token: secret as string, drop_pending_updates: true, allowed_updates: ["message"] });
  const info = await api.getWebhookInfo();
  console.log(
    JSON.stringify(
      { setWebhook: hasil, url: info.url, pending: info.pending_update_count, lastError: info.last_error_message ?? null },
      null,
      2,
    ),
  );
}

main().catch((err: unknown) => {
  // Pesan galat Telegram bisa memuat token di URL-nya; hanya pesannya dicetak.
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
