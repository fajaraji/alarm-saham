# 05: Skema database & migrasi (Neon + Drizzle)

**What to build:** Database Postgres (Neon) dengan skema Drizzle untuk `symbols`, `suspensions`, `report_dates`, `filings`, `corporate_actions`, `financials_q`, `alarms`, `portfolios`, `runs`, `api_ledger`; migrasi dapat dijalankan ulang tanpa merusak; buku kredit dan cache dari tiket 03 dipindahkan dari file lokal ke tabel DB (file lokal tetap jadi fallback saat `DATABASE_URL` kosong, agar tes tetap jalan tanpa DB).

**Blocked by:** 01 (`DATABASE_URL`), 02 (Bootstrap repo & CI)

**Status:** ready-for-agent

- [ ] `npm run db:migrate` exit 0 pada database kosong dan idempoten saat dijalankan dua kali
- [ ] Tes integrasi (boleh memakai Postgres lokal via Docker atau Neon branch) membuktikan insert/select tiap tabel
- [ ] `api_ledger` di DB terisi saat `SectorsProvider` dipakai dengan `DATABASE_URL`; tanpa `DATABASE_URL` fallback file tetap bekerja (tes untuk keduanya)
- [ ] `npm run lint`, `npm test`, `npm run build` exit 0
