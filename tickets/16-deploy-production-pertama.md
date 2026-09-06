# 16: Deploy production pertama (titik henti)

**What to build:** Aplikasi hidup di Vercel production dari branch `main`: variabel lingkungan terpasang di Vercel (bukan di repo), cron harian aktif, database Neon production terhubung, smoke test dijalankan terhadap URL hidup, dan hasil (URL, tanggal, commit) dicatat di `docs/decisions.md`.

**TITIK HENTI:** sebelum menjalankan deploy, **berhenti dan minta persetujuan pemilik**. Setelah deploy dan smoke test lulus, **berhenti total** — tidak ada pekerjaan lanjutan (video, post, submit) tanpa instruksi.

**Blocked by:** 01 (`vercel login`), 15 (Pengerasan)

**Status:** ready-for-agent (setelah persetujuan)

- [ ] Persetujuan pemilik tercatat sebelum `vercel --prod`
- [ ] `vercel --prod` exit 0; URL production terbuka
- [ ] Smoke test Playwright terhadap URL production: lulus
- [ ] Cron terdaftar di dashboard Vercel (bukti: `vercel crons ls` atau tangkapan layar)
- [ ] Tidak ada rahasia di repo; semua env ada di Vercel
