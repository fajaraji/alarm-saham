# 01: Prasyarat kunci & akun (manual, bukan tiket agent)

**What to build:** Semua kunci dan akun yang dibutuhkan fase berikutnya tersedia di `.env.local` (tidak pernah masuk git) dan CLI sudah login, sehingga tiket-tiket teknis tidak terhenti menunggu manusia.

**Blocked by:** None (can start immediately) — dikerjakan pemilik proyek.

**Status:** manual — sebagian. Dicek 2026-09-07 pagi (keberadaan nilai saja, tanpa membaca isinya):

- [x] Kedua anggota tim selesai onboarding sectors.app; tim terdaftar; 1.000 kredit tim diklaim (konfirmasi pemilik)
- [x] `SECTORS_API_KEY` terisi
- [ ] `ANTHROPIC_API_KEY` **KOSONG** → uji nyata tiket 08 dan fitur AI di UI menunggu ini
- [ ] `DATABASE_URL` **KOSONG** → tiket 07 memakai PGlite lokal; **blocker deploy production (tiket 16)**; setelah diisi jalankan `npm run db:migrate` lalu `npm run db:sync -- --from=pglite --to=neon`
- [ ] `TELEGRAM_BOT_TOKEN` **KOSONG** → tiket 12 memakai fallback notifikasi in-app (aturan cadangan §7.5)
- [x] `gh auth status` menunjukkan login (akun fajaraji)
- [ ] `vercel login` belum diverifikasi (sebelum tiket 16)
