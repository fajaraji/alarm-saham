# 12: Cron harian + notifikasi Telegram

**What to build:** Pengecekan otomatis setiap pagi 06:30 WIB (Vercel Cron memanggil endpoint terlindungi secret) yang mengevaluasi semua portofolio dengan alarm terpasang (logika tiket 11), mengirim pesan hanya untuk **bendera baru** sejak pengecekan terakhir (bukan mengulang tiap hari), lewat bot Telegram (grammY) ke chat yang dihubungkan pengguna dengan perintah `/mulai <kode-portofolio>`. Jika `TELEGRAM_BOT_TOKEN` kosong: notifikasi tampil di halaman portofolio (in-app inbox) dan cron tetap berjalan — aturan cadangan PLAN.md §7.5.

**Blocked by:** 01 (`TELEGRAM_BOT_TOKEN`, opsional), 11 (Layar 3)

**Status:** ready-for-agent

- [ ] Uji: endpoint cron menolak permintaan tanpa secret; dengan secret memproses semua portofolio
- [ ] Uji: hanya bendera baru yang dikirim; menjalankan dua kali berturut-turut tidak mengirim ulang
- [ ] Uji: tanpa token → pesan masuk inbox in-app; dengan token (mock API Telegram) → pesan terkirim dengan disclaimer
- [ ] Konfigurasi cron terverifikasi di file konfigurasi Vercel
- [ ] `npm run lint`, `npm test`, `npm run build` exit 0
