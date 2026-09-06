# 01: Prasyarat kunci & akun (manual, bukan tiket agent)

**What to build:** Semua kunci dan akun yang dibutuhkan fase berikutnya tersedia di `.env.local` (tidak pernah masuk git) dan CLI sudah login, sehingga tiket-tiket teknis tidak terhenti menunggu manusia.

**Blocked by:** None (can start immediately) — dikerjakan pemilik proyek.

**Status:** manual

- [ ] Kedua anggota tim selesai onboarding sectors.app; tim terdaftar; 1.000 kredit tim diklaim
- [ ] `SECTORS_API_KEY` terisi (wajib sebelum tiket 04)
- [ ] `ANTHROPIC_API_KEY` terisi + batas belanja bulanan dipasang di console (sebelum tiket 08)
- [ ] `DATABASE_URL` Neon Postgres terisi (sebelum tiket 05)
- [ ] `TELEGRAM_BOT_TOKEN` dari @BotFather terisi (opsional; sebelum tiket 12 — jika kosong, fallback in-app)
- [ ] `gh auth status` menunjukkan login (sudah: akun fajaraji)
- [ ] `vercel login` selesai (sebelum tiket 16)
