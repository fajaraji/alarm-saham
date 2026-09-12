# 16: Deploy production pertama (titik henti)

**What to build:** Aplikasi hidup di Vercel production dari branch `main`: variabel lingkungan terpasang di Vercel (bukan di repo), cron harian aktif, database Neon production terhubung, smoke test dijalankan terhadap URL hidup, dan hasil (URL, tanggal, commit) dicatat di `docs/decisions.md`.

**TITIK HENTI:** sebelum menjalankan deploy, **berhenti dan minta persetujuan pemilik**. Setelah deploy dan smoke test lulus, **berhenti total** — tidak ada pekerjaan lanjutan (video, post, submit) tanpa instruksi.

**Blocked by:** 01 (`vercel login`), 15 (Pengerasan)

**Status:** selesai — live https://alarm-saham.vercel.app (commit 7710083, 2026-09-12), di-deploy manual oleh pemilik lewat dasbor Vercel. Smoke alur penuh terhadap URL produksi lulus 6,9 detik; diagnosis AI produksi HTTP 200 dalam 98,7 detik. Region fungsi dipindah ke sin1 (satu region dengan Neon): uji ke masa lalu 27 s → 2 s. Rincian di docs/decisions.md bagian "Deploy production pertama".

- [x] Persetujuan pemilik tercatat ("gas", 2026-09-12); deploy dijalankan pemilik sendiri lewat dasbor, bukan `vercel --prod`
- [x] URL production terbuka: https://alarm-saham.vercel.app (HTTP 200, `data-sumber="db"`)
- [x] Smoke Playwright terhadap URL production: lulus (6,9 s, nol console.error)
- [x] Cron terdaftar di dashboard Vercel: `/api/cron/jaga` `30 23 * * *` ("At 11:30 PM" UTC = 06:30 WIB), Enabled — tangkapan layar dari pemilik 2026-09-12. Dasbor Vercel sendiri menyatakan "Cron jobs on Hobby have a flexible time window of 1-hour", jadi jalannya 06:30–07:29 WIB.
- [x] Tidak ada rahasia di repo (husky check-secrets lolos tiap commit); 7 env di Vercel
