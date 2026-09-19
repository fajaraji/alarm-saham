// Status bot Telegram yang ringan: hanya membaca env, tanpa memuat grammY atau
// database, supaya halaman server (/pasang) bisa memeriksanya di setiap
// permintaan. Yang keluar ke browser hanya boolean `botAktif()`; token dan
// secret tidak pernah meninggalkan server (tiket 25).

export function tokenBot(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const t = env.TELEGRAM_BOT_TOKEN?.trim();
  return t ? t : undefined;
}

export function secretWebhook(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const s = env.TELEGRAM_WEBHOOK_SECRET?.trim();
  return s ? s : undefined;
}

/**
 * Bot bisa menjawab /mulai: token DAN secret webhook terisi. Syaratnya sama
 * dengan `botRuntime()` dan GET /api/telegram/webhook, jadi ketiganya selalu
 * sepakat. Mengisi kedua env lalu deploy ulang cukup untuk memunculkan
 * petunjuk Telegram di layar Pasang; tidak ada kode yang perlu diubah.
 */
export function botAktif(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(tokenBot(env) && secretWebhook(env));
}
