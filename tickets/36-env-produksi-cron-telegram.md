# 36: Cron dan bot Telegram hidup di produksi

**What to build:** Di produksi, /api/cron/jaga menjawab 503 (CRON_SECRET kosong) sehingga pengecekan pagi tidak pernah jalan, dan GET /api/telegram/webhook melapor {"aktif":false,"alasan":"SECRET_KOSONG"}. Keduanya butuh nilai rahasia di env Vercel yang hanya bisa diisi pemilik. Pemilik mengisi CRON_SECRET dan TELEGRAM_WEBHOOK_SECRET (Production), deploy ulang, lalu mendaftarkan webhook dengan `npm run telegram:set-webhook -- https://alarm-saham.vercel.app`. Sumber: audit hackathon 19–20 Sep 2026, diverifikasi ulang 20 Sep.

**Blocked by:** None (butuh tindakan pemilik di dasbor Vercel)

**Status:** ready-for-agent

- [ ] GET /api/cron/jaga tanpa header menjawab 401 (bukan 503): CRON_SECRET terisi
- [ ] GET /api/telegram/webhook menjawab {"aktif":true}
- [ ] /mulai <kode portofolio> ke bot dijawab
