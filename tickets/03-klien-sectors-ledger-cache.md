# 03: Klien Sectors + buku kredit + cache + FixtureProvider

**What to build:** Satu antarmuka `DataProvider` dengan dua implementasi: `SectorsProvider` (memanggil Sectors API v2 IDX dengan header `Authorization`, mencatat setiap panggilan ke buku kredit — endpoint, kredit, waktu, status — dan **menolak** panggilan baru bila sisa kredit di bawah `SECTORS_CREDIT_RESERVE`; respons sukses disimpan ke cache lokal ter-gitignore sehingga panggilan identik tidak pernah menghabiskan kredit dua kali) dan `FixtureProvider` (membaca data dari fixture JSON kecil untuk pengembangan/tes tanpa kunci). Sebuah perintah CLI memperlihatkan: panggilan pertama ke satu endpoint mencatat kredit, panggilan kedua identik terlayani dari cache tanpa kredit.

Endpoint minimum yang didukung: suspensions (universe & per simbol), quarterly financial dates (per simbol), filings (per simbol), corporate actions (per simbol), quarterly financials (per simbol, n kuartal), free-float (universe), broker summary (per simbol, ≤14 hari), listing performance (per simbol), daily (per simbol, ≤90 hari). Biaya kredit per endpoint mengikuti dokumentasi (financials = 1 per kuartal dikembalikan; free-float = 1 per 100 emiten; feed berpaginasi = 1 per halaman).

**Blocked by:** 02 (Bootstrap repo & CI)

**Status:** done — diverifikasi 2026-09-07 02:16 WIB di worktree t03 (lint/typecheck/test/build exit 0; 52 tes lulus; CLI tanpa kunci exit 1 dengan pesan jelas). Catatan: bentuk respons `quarterly_financial_dates` dan pembungkus broker-summary masih asumsi dari dokumentasi — dicek terhadap data nyata di tiket 04.

- [x] Tes unit (mock HTTP): ledger bertambah sesuai biaya per endpoint; penolakan saat sisa < cadangan; cache hit tidak menambah ledger; 404 dicatat 1 kredit; 400/429/5xx tidak dicatat
- [x] `FixtureProvider` memenuhi antarmuka yang sama dan dipakai oleh tes
- [x] CLI `npm run sectors -- <endpoint> <symbol>` berjalan; tanpa `SECTORS_API_KEY` berhenti dengan pesan jelas (exit ≠ 0), bukan crash
- [x] Kunci tidak pernah dicetak ke log/output
- [x] `npm run lint`, `npm test`, `npm run build` exit 0
