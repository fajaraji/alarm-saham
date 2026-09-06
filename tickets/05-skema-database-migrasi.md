# 05: Skema database & migrasi (Neon + Drizzle)

**What to build:** Database Postgres (Neon) dengan skema Drizzle untuk `symbols`, `suspensions`, `report_dates`, `filings`, `corporate_actions`, `financials_q`, `alarms`, `portfolios`, `runs`, `api_ledger`; migrasi dapat dijalankan ulang tanpa merusak; buku kredit dan cache dari tiket 03 dipindahkan dari file lokal ke tabel DB (file lokal tetap jadi fallback saat `DATABASE_URL` kosong, agar tes tetap jalan tanpa DB).

**Blocked by:** 01 (`DATABASE_URL`), 02 (Bootstrap repo & CI)

**Status:** done — diverifikasi 2026-09-07 02:10 WIB di worktree t05 (lint/typecheck/test/build exit 0; 19 tes lulus di PGlite; `db:migrate` 2× exit 0). Butir penyambungan `api_ledger` ke `SectorsProvider` dipindah ke tiket 07 (integrasi setelah merge dengan tiket 03).

- [x] `npm run db:migrate` exit 0 pada database kosong dan idempoten saat dijalankan dua kali
- [x] Tes integrasi (PGlite; jalur Docker tersedia tapi belum terbukti di mesin ini) membuktikan insert/select tiap tabel
- [ ] `api_ledger` di DB terisi saat `SectorsProvider` dipakai dengan `DATABASE_URL` → dipindah ke tiket 07
- [x] `npm run lint`, `npm test`, `npm run build` exit 0
