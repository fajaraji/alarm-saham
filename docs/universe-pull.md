# Penarikan universe uji ke database (tiket 07)

_Dihasilkan otomatis oleh `npm run pull-universe` pada 2026-09-06T22:44:30.836Z. Sumber angka kredit: tabel `api_ledger` (DB). Nama pemegang saham sengaja tidak dimuat di sini._

## Ringkasan kredit

| Ukuran | Nilai |
|---|---|
| Kredit ledger DB sebelum run | 463 |
| Kredit ledger DB sesudah run | 463 |
| Kredit terpakai run ini | 0 |
| Perkiraan belum ter-cache saat run dimulai | 0 |
| Batas keras per run / sisa minimum | 440 / 260 |
| Total kredit ledger saat laporan ditulis | 463 dari 1000 (sisa 537; cadangan 250) |
| Kredit tiket 07 kumulatif (ledger − 68 kredit tiket 03–04) | 395 dari anggaran 433 |
| Penyimpan ledger/cache | db: pglite (D:\Projects\alarm-saham\.pglite) |
| Berhenti karena anggaran | tidak |

### Per langkah

| Langkah | Anggaran §5 | Kredit run ini | Belum cache (perkiraan) | API | Cache | 404 | Gagal | Dilewati | Penyimpangan |
|---|---|---|---|---|---|---|---|---|---|
| suspensions | 20 | 0 | 0 | 0 | 20 | 0 | 0 | 0 | - |
| free-float | 10 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | - |
| control | 1 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | - |
| dates | 71 | 0 | 0 | 0 | 99 | 8 | 0 | 0 | - |
| corporate-actions | 71 | 0 | 0 | 0 | 99 | 0 | 0 | 8 | - |
| filings | 86 | 0 | 0 | 0 | 92 | 0 | 0 | 0 | - |
| financials | 144 | 0 | 0 | 0 | 14 | 0 | 0 | 4 | - |

## Baris per tabel (DB)

| Tabel | Baris |
|---|---|
| symbols | 107 |
| suspensions | 583 |
| report_dates | 1901 |
| corporate_actions | 963 |
| filings | 248 |
| financials_q | 91 |

## Universe: 107 emiten (delisting 18, pemantauan 59, kontrol 30)

### 30 kontrol terpilih

Kriteria: anggota LQ45 menurut screener `/v2/companies/?where=indices in ['LQ45']`, TIDAK muncul di feed suspensi universe 2019–2026 (583 kejadian di DB), bukan anggota 18/59, lalu 30 pertama menurut urutan API (alfabetis): screener tidak mengembalikan market_cap dan menolak order_by (HTTP 400, gratis), sehingga peringkat market cap tidak tersedia tanpa kredit tambahan.

| Emiten | Nama | Sub-sektor | Catatan |
|---|---|---|---|
| AADI | PT Adaro Andalan Indonesia Tbk | - | LQ45 (screener 2026-09-06, urutan API (alfabetis; screener tanpa market_cap, order_by ditolak 400), peringkat #1); tanpa suspensi 2019–2026 |
| ADMR | PT Alamtri Minerals Indonesia Tbk | - | LQ45 (screener 2026-09-06, urutan API (alfabetis; screener tanpa market_cap, order_by ditolak 400), peringkat #2); tanpa suspensi 2019–2026 |
| ADRO | Alamtri Resources Indonesia Tbk | - | LQ45 (screener 2026-09-06, urutan API (alfabetis; screener tanpa market_cap, order_by ditolak 400), peringkat #3); tanpa suspensi 2019–2026 |
| AKRA | PT AKR Corporindo Tbk. | - | LQ45 (screener 2026-09-06, urutan API (alfabetis; screener tanpa market_cap, order_by ditolak 400), peringkat #4); tanpa suspensi 2019–2026 |
| AMMN | PT Amman Mineral Internasional Tbk. | - | LQ45 (screener 2026-09-06, urutan API (alfabetis; screener tanpa market_cap, order_by ditolak 400), peringkat #5); tanpa suspensi 2019–2026 |
| AMRT | PT Sumber Alfaria Trijaya Tbk. | - | LQ45 (screener 2026-09-06, urutan API (alfabetis; screener tanpa market_cap, order_by ditolak 400), peringkat #6); tanpa suspensi 2019–2026 |
| ANTM | Aneka Tambang Tbk. | - | LQ45 (screener 2026-09-06, urutan API (alfabetis; screener tanpa market_cap, order_by ditolak 400), peringkat #7); tanpa suspensi 2019–2026 |
| ASII | Astra International Tbk | - | LQ45 (screener 2026-09-06, urutan API (alfabetis; screener tanpa market_cap, order_by ditolak 400), peringkat #8); tanpa suspensi 2019–2026 |
| BBCA | PT Bank Central Asia Tbk. | - | LQ45 (screener 2026-09-06, urutan API (alfabetis; screener tanpa market_cap, order_by ditolak 400), peringkat #9); tanpa suspensi 2019–2026 |
| BBNI | PT Bank Negara Indonesia (Persero) Tbk | - | LQ45 (screener 2026-09-06, urutan API (alfabetis; screener tanpa market_cap, order_by ditolak 400), peringkat #10); tanpa suspensi 2019–2026 |
| BBRI | PT Bank Rakyat Indonesia (Persero) Tbk | - | LQ45 (screener 2026-09-06, urutan API (alfabetis; screener tanpa market_cap, order_by ditolak 400), peringkat #11); tanpa suspensi 2019–2026 |
| BBTN | PT Bank Tabungan Negara (Persero) Tbk | - | LQ45 (screener 2026-09-06, urutan API (alfabetis; screener tanpa market_cap, order_by ditolak 400), peringkat #12); tanpa suspensi 2019–2026 |
| BMRI | PT Bank Mandiri (Persero) Tbk | - | LQ45 (screener 2026-09-06, urutan API (alfabetis; screener tanpa market_cap, order_by ditolak 400), peringkat #13); tanpa suspensi 2019–2026 |
| BRPT | Barito Pacific Tbk | - | LQ45 (screener 2026-09-06, urutan API (alfabetis; screener tanpa market_cap, order_by ditolak 400), peringkat #14); tanpa suspensi 2019–2026 |
| BUMI | Bumi Resources Tbk | - | LQ45 (screener 2026-09-06, urutan API (alfabetis; screener tanpa market_cap, order_by ditolak 400), peringkat #15); tanpa suspensi 2019–2026 |
| CPIN | Charoen Pokphand Indonesia Tbk | - | LQ45 (screener 2026-09-06, urutan API (alfabetis; screener tanpa market_cap, order_by ditolak 400), peringkat #16); tanpa suspensi 2019–2026 |
| CUAN | PT Petrindo Jaya Kreasi Tbk | - | LQ45 (screener 2026-09-06, urutan API (alfabetis; screener tanpa market_cap, order_by ditolak 400), peringkat #17); tanpa suspensi 2019–2026 |
| DEWA | Darma Henwa Tbk | - | LQ45 (screener 2026-09-06, urutan API (alfabetis; screener tanpa market_cap, order_by ditolak 400), peringkat #18); tanpa suspensi 2019–2026 |
| EMTK | Elang Mahkota Teknologi Tbk | - | LQ45 (screener 2026-09-06, urutan API (alfabetis; screener tanpa market_cap, order_by ditolak 400), peringkat #19); tanpa suspensi 2019–2026 |
| ESSA | ESSA Industries Indonesia Tbk | - | LQ45 (screener 2026-09-06, urutan API (alfabetis; screener tanpa market_cap, order_by ditolak 400), peringkat #20); tanpa suspensi 2019–2026 |
| EXCL | PT XLSMART Telecom Sejahtera Tbk | - | LQ45 (screener 2026-09-06, urutan API (alfabetis; screener tanpa market_cap, order_by ditolak 400), peringkat #21); tanpa suspensi 2019–2026 |
| GOTO | PT GoTo Gojek Tokopedia Tbk | - | LQ45 (screener 2026-09-06, urutan API (alfabetis; screener tanpa market_cap, order_by ditolak 400), peringkat #22); tanpa suspensi 2019–2026 |
| HRTA | PT Hartadinata Abadi Tbk | - | LQ45 (screener 2026-09-06, urutan API (alfabetis; screener tanpa market_cap, order_by ditolak 400), peringkat #23); tanpa suspensi 2019–2026 |
| ICBP | Indofood CBP Sukses Makmur Tbk | - | LQ45 (screener 2026-09-06, urutan API (alfabetis; screener tanpa market_cap, order_by ditolak 400), peringkat #24); tanpa suspensi 2019–2026 |
| INCO | Vale Indonesia Tbk | - | LQ45 (screener 2026-09-06, urutan API (alfabetis; screener tanpa market_cap, order_by ditolak 400), peringkat #25); tanpa suspensi 2019–2026 |
| INDF | Indofood Sukses Makmur Tbk | - | LQ45 (screener 2026-09-06, urutan API (alfabetis; screener tanpa market_cap, order_by ditolak 400), peringkat #26); tanpa suspensi 2019–2026 |
| INDY | Indika Energy Tbk | - | LQ45 (screener 2026-09-06, urutan API (alfabetis; screener tanpa market_cap, order_by ditolak 400), peringkat #27); tanpa suspensi 2019–2026 |
| INKP | Indah Kiat Pulp & Paper Tbk | - | LQ45 (screener 2026-09-06, urutan API (alfabetis; screener tanpa market_cap, order_by ditolak 400), peringkat #28); tanpa suspensi 2019–2026 |
| ISAT | PT Indosat Tbk | - | LQ45 (screener 2026-09-06, urutan API (alfabetis; screener tanpa market_cap, order_by ditolak 400), peringkat #29); tanpa suspensi 2019–2026 |
| ITMG | Indo Tambangraya Megah Tbk | - | LQ45 (screener 2026-09-06, urutan API (alfabetis; screener tanpa market_cap, order_by ditolak 400), peringkat #30); tanpa suspensi 2019–2026 |

### Tanggal kejadian target — 18 delisting

| Emiten | target_event_date | Catatan |
|---|---|---|
| COWL | 2020-07-13 | delisting efektif 2026-11-10 (pailit); suspensi catatan 2020-07-13; feed: terverifikasi (1 kejadian di feed) |
| DUCK | 2021-08-30 | delisting efektif 2026-11-10 (suspensi>50bln); suspensi catatan 2021-08-30; feed: terverifikasi (1 kejadian di feed) |
| ENVY | 2020-12-01 | delisting efektif 2026-11-10 (suspensi>50bln); suspensi catatan 2020-12-01; feed: TIDAK ada suspensi ≥ catatan−60 hari (0 kejadian di feed) → pakai tanggal catatan |
| GOLL | 2019-01-30 | delisting efektif 2026-11-10 (suspensi>50bln); suspensi catatan 2019-01-30; feed: terverifikasi (1 kejadian di feed) |
| LCGP | 2019-05-02 | delisting efektif 2026-11-10 (suspensi>50bln); suspensi catatan 2019-05-02; feed: terverifikasi (1 kejadian di feed) |
| LMAS | 2023-12-20 | delisting efektif 2026-11-10 (suspensi>50bln); suspensi catatan 2023-12-20; feed: TIDAK ada suspensi ≥ catatan−60 hari (1 kejadian di feed) → pakai tanggal catatan; tanggal catatan janggal (<50 bulan) — verifikasi dengan feed |
| MABA | 2020-02-17 | delisting efektif 2026-11-10 (suspensi>50bln); suspensi catatan 2020-02-17; feed: terverifikasi (1 kejadian di feed) |
| MTRA | 2020-11-17 | delisting efektif 2026-11-10 (pailit); suspensi catatan 2020-11-17; feed: TIDAK ada suspensi ≥ catatan−60 hari (1 kejadian di feed) → pakai tanggal catatan |
| PLAS | 2018-12-28 | delisting efektif 2026-11-10 (suspensi>50bln); suspensi catatan 2018-12-27; feed: terverifikasi (1 kejadian di feed) |
| SBAT | 2024-09-18 | delisting efektif 2026-11-10 (pailit); suspensi catatan 2024-09-18; feed: TIDAK ada suspensi ≥ catatan−60 hari (1 kejadian di feed) → pakai tanggal catatan |
| SKYB | 2020-02-17 | delisting efektif 2026-11-10 (suspensi>50bln); suspensi catatan 2020-02-17; feed: terverifikasi (1 kejadian di feed) |
| SRIL | 2021-05-18 | delisting efektif 2026-11-10 (pailit); suspensi catatan 2021-05-18; feed: terverifikasi (1 kejadian di feed); Bareksa menulis 1 Nov 2024; feed & sumber lain: 18 Mei 2021 |
| SUGI | 2019-07-01 | delisting efektif 2026-11-10 (suspensi>50bln); suspensi catatan 2019-07-01; feed: terverifikasi (1 kejadian di feed) |
| TDPM | 2021-04-27 | delisting efektif 2026-11-10 (pailit); suspensi catatan 2021-04-27; feed: terverifikasi (1 kejadian di feed); awal gagal bayar MTN |
| TELE | 2025-06-06 | delisting efektif 2026-11-10 (pailit); suspensi catatan 2025-06-06; feed: TIDAK ada suspensi ≥ catatan−60 hari (1 kejadian di feed) → pakai tanggal catatan; kini PT Omni Inovasi Indonesia |
| TOYS | 2024-07-02 | delisting efektif 2026-11-10 (pailit); suspensi catatan 2024-07-02; feed: terverifikasi (1 kejadian di feed) |
| TRIL | 2019-05-02 | delisting efektif 2026-11-10 (suspensi>50bln); suspensi catatan 2019-05-02; feed: terverifikasi (1 kejadian di feed) |
| UNIT | 2021-03-01 | delisting efektif 2026-11-10 (suspensi>50bln); suspensi catatan 2021-03-01; feed: terverifikasi (1 kejadian di feed) |

### Tanggal kejadian target — 59 pemantauan khusus (suspensi terakhir ≤ 2026-06-30)

| Emiten | target_event_date | Catatan |
|---|---|---|
| ALMI | 2024-10-30 | papan pemantauan khusus per 2026-06-30; suspensi terakhir ≤ acuan = 2024-10-30 (1 kejadian di feed) |
| ALTO | 2025-06-30 | papan pemantauan khusus per 2026-06-30; suspensi terakhir ≤ acuan = 2025-06-30 (1 kejadian di feed) |
| ARMY | 2019-12-02 | papan pemantauan khusus per 2026-06-30; suspensi terakhir ≤ acuan = 2019-12-02 (1 kejadian di feed) |
| ARTI | 2024-07-02 | papan pemantauan khusus per 2026-06-30; suspensi terakhir ≤ acuan = 2024-07-02 (1 kejadian di feed) |
| BEBS | 2025-02-17 | papan pemantauan khusus per 2026-06-30; suspensi terakhir ≤ acuan = 2025-02-17 (1 kejadian di feed) |
| BIKA | 2024-07-02 | papan pemantauan khusus per 2026-06-30; suspensi terakhir ≤ acuan = 2024-07-02 (1 kejadian di feed) |
| BIMA | 2026-04-09 | papan pemantauan khusus per 2026-06-30; suspensi terakhir ≤ acuan = 2026-04-09 (1 kejadian di feed) |
| BOSS | 2024-02-16 | papan pemantauan khusus per 2026-06-30; suspensi terakhir ≤ acuan = 2024-02-16 (1 kejadian di feed) |
| BTEL | 2019-05-27 | papan pemantauan khusus per 2026-06-30; suspensi terakhir ≤ acuan = 2019-05-27 (1 kejadian di feed) |
| CBMF | 2023-02-16 | papan pemantauan khusus per 2026-06-30; suspensi terakhir ≤ acuan = 2023-02-16 (1 kejadian di feed) |
| CPRI | 2023-07-03 | papan pemantauan khusus per 2026-06-30; suspensi terakhir ≤ acuan = 2023-07-03 (1 kejadian di feed) |
| DEAL | 2024-02-16 | papan pemantauan khusus per 2026-06-30; suspensi terakhir ≤ acuan = 2024-02-16 (1 kejadian di feed) |
| DPNS | 2025-10-31 | papan pemantauan khusus per 2026-06-30; suspensi terakhir ≤ acuan = 2025-10-31 (1 kejadian di feed) |
| ETWA | 2024-02-01 | papan pemantauan khusus per 2026-06-30; suspensi terakhir ≤ acuan = 2024-02-01 (1 kejadian di feed) |
| FASW | 2025-09-30 | papan pemantauan khusus per 2026-06-30; suspensi terakhir ≤ acuan = 2025-09-30 (2 kejadian di feed) |
| FIMP | 2025-08-13 | papan pemantauan khusus per 2026-06-30; suspensi terakhir ≤ acuan = 2025-08-13 (3 kejadian di feed) |
| GAMA | 2023-07-03 | papan pemantauan khusus per 2026-06-30; suspensi terakhir ≤ acuan = 2023-07-03 (1 kejadian di feed) |
| GLOB | 2025-10-27 | papan pemantauan khusus per 2026-06-30; suspensi terakhir ≤ acuan = 2025-10-27 (2 kejadian di feed) |
| HKMU | 2023-07-03 | papan pemantauan khusus per 2026-06-30; suspensi terakhir ≤ acuan = 2023-07-03 (1 kejadian di feed) |
| HOME | 2020-02-03 | papan pemantauan khusus per 2026-06-30; suspensi terakhir ≤ acuan = 2020-02-03 (1 kejadian di feed) |
| HOTL | 2022-08-01 | papan pemantauan khusus per 2026-06-30; suspensi terakhir ≤ acuan = 2022-08-01 (1 kejadian di feed) |
| IIKP | 2020-01-23 | papan pemantauan khusus per 2026-06-30; suspensi terakhir ≤ acuan = 2020-01-23 (1 kejadian di feed) |
| INAF | 2024-07-02 | papan pemantauan khusus per 2026-06-30; suspensi terakhir ≤ acuan = 2024-07-02 (1 kejadian di feed) |
| INRU | 2025-12-17 | papan pemantauan khusus per 2026-06-30; suspensi terakhir ≤ acuan = 2025-12-17 (3 kejadian di feed) |
| IPPE | 2024-09-06 | papan pemantauan khusus per 2026-06-30; suspensi terakhir ≤ acuan = 2024-09-06 (1 kejadian di feed) |
| JSKY | 2022-08-01 | papan pemantauan khusus per 2026-06-30; suspensi terakhir ≤ acuan = 2022-08-01 (1 kejadian di feed) |
| KAYU | 2024-04-18 | papan pemantauan khusus per 2026-06-30; suspensi terakhir ≤ acuan = 2024-04-18 (1 kejadian di feed) |
| KBRI | 2019-04-23 | papan pemantauan khusus per 2026-06-30; suspensi terakhir ≤ acuan = 2019-04-23 (1 kejadian di feed) |
| KIAS | 2025-09-30 | papan pemantauan khusus per 2026-06-30; suspensi terakhir ≤ acuan = 2025-09-30 (2 kejadian di feed) |
| LMSH | 2025-09-30 | papan pemantauan khusus per 2026-06-30; suspensi terakhir ≤ acuan = 2025-09-30 (2 kejadian di feed) |
| MAGP | 2022-07-18 | papan pemantauan khusus per 2026-06-30; suspensi terakhir ≤ acuan = 2022-07-18 (1 kejadian di feed) |
| MENN | - | papan pemantauan khusus per 2026-06-30; TIDAK ada suspensi ≤ acuan di feed (0 kejadian) |
| MFMI | 2025-09-30 | papan pemantauan khusus per 2026-06-30; suspensi terakhir ≤ acuan = 2025-09-30 (2 kejadian di feed) |
| MKNT | 2024-07-02 | papan pemantauan khusus per 2026-06-30; suspensi terakhir ≤ acuan = 2024-07-02 (1 kejadian di feed) |
| MTPS | 2025-11-05 | papan pemantauan khusus per 2026-06-30; suspensi terakhir ≤ acuan = 2025-11-05 (1 kejadian di feed) |
| MTSM | 2025-09-30 | papan pemantauan khusus per 2026-06-30; suspensi terakhir ≤ acuan = 2025-09-30 (3 kejadian di feed) |
| NUSA | 2020-08-31 | papan pemantauan khusus per 2026-06-30; suspensi terakhir ≤ acuan = 2020-08-31 (1 kejadian di feed) |
| PLIN | 2025-09-30 | papan pemantauan khusus per 2026-06-30; suspensi terakhir ≤ acuan = 2025-09-30 (2 kejadian di feed) |
| PMMP | 2025-06-30 | papan pemantauan khusus per 2026-06-30; suspensi terakhir ≤ acuan = 2025-06-30 (1 kejadian di feed) |
| POLL | 2024-07-02 | papan pemantauan khusus per 2026-06-30; suspensi terakhir ≤ acuan = 2024-07-02 (1 kejadian di feed) |
| POOL | 2020-06-10 | papan pemantauan khusus per 2026-06-30; suspensi terakhir ≤ acuan = 2020-06-10 (1 kejadian di feed) |
| POSA | 2020-11-24 | papan pemantauan khusus per 2026-06-30; suspensi terakhir ≤ acuan = 2020-11-24 (1 kejadian di feed) |
| PTMR | 2025-06-26 | papan pemantauan khusus per 2026-06-30; suspensi terakhir ≤ acuan = 2025-06-26 (2 kejadian di feed) |
| PURE | 2022-08-01 | papan pemantauan khusus per 2026-06-30; suspensi terakhir ≤ acuan = 2022-08-01 (1 kejadian di feed) |
| RIMO | 2020-02-11 | papan pemantauan khusus per 2026-06-30; suspensi terakhir ≤ acuan = 2020-02-11 (1 kejadian di feed) |
| SIMA | 2020-02-17 | papan pemantauan khusus per 2026-06-30; suspensi terakhir ≤ acuan = 2020-02-17 (1 kejadian di feed) |
| SMCB | 2025-09-30 | papan pemantauan khusus per 2026-06-30; suspensi terakhir ≤ acuan = 2025-09-30 (2 kejadian di feed) |
| SMRU | 2020-01-23 | papan pemantauan khusus per 2026-06-30; suspensi terakhir ≤ acuan = 2020-01-23 (1 kejadian di feed) |
| SWAT | 2025-06-30 | papan pemantauan khusus per 2026-06-30; suspensi terakhir ≤ acuan = 2025-06-30 (1 kejadian di feed) |
| TECH | 2023-08-07 | papan pemantauan khusus per 2026-06-30; suspensi terakhir ≤ acuan = 2023-08-07 (1 kejadian di feed) |
| TGRA | - | papan pemantauan khusus per 2026-06-30; TIDAK ada suspensi ≤ acuan di feed (0 kejadian) |
| TGUK | 2025-05-26 | papan pemantauan khusus per 2026-06-30; suspensi terakhir ≤ acuan = 2025-05-26 (2 kejadian di feed) |
| TOPS | 2024-07-02 | papan pemantauan khusus per 2026-06-30; suspensi terakhir ≤ acuan = 2024-07-02 (1 kejadian di feed) |
| TRAM | 2020-01-23 | papan pemantauan khusus per 2026-06-30; suspensi terakhir ≤ acuan = 2020-01-23 (1 kejadian di feed) |
| TRIO | 2019-07-17 | papan pemantauan khusus per 2026-06-30; suspensi terakhir ≤ acuan = 2019-07-17 (1 kejadian di feed) |
| WICO | 2025-09-30 | papan pemantauan khusus per 2026-06-30; suspensi terakhir ≤ acuan = 2025-09-30 (2 kejadian di feed) |
| WIKA | 2025-02-18 | papan pemantauan khusus per 2026-06-30; suspensi terakhir ≤ acuan = 2025-02-18 (1 kejadian di feed) |
| WSKT | - | papan pemantauan khusus per 2026-06-30; TIDAK ada suspensi ≤ acuan di feed (0 kejadian) |
| ZBRA | 2026-01-22 | papan pemantauan khusus per 2026-06-30; suspensi terakhir ≤ acuan = 2026-01-22 (3 kejadian di feed) |

## Emiten kosong / 404 / gagal / dilewati (run ini)

- `dates` COWL: 404 — Invalid stock symbol or data does not exist.
- `dates` SUGI: 404 — Invalid stock symbol or data does not exist.
- `dates` MABA: 404 — Invalid stock symbol or data does not exist.
- `dates` SKYB: 404 — Invalid stock symbol or data does not exist.
- `dates` KBRI: 404 — Invalid stock symbol or data does not exist.
- `dates` NUSA: 404 — Invalid stock symbol or data does not exist.
- `dates` RIMO: 404 — Invalid stock symbol or data does not exist.
- `dates` SIMA: 404 — Invalid stock symbol or data does not exist.
- `corporate-actions` COWL: dilewati — dates 404 (simbol tak dikenal API) → tidak dipanggil, hemat 1 kredit
- `corporate-actions` SUGI: dilewati — dates 404 (simbol tak dikenal API) → tidak dipanggil, hemat 1 kredit
- `corporate-actions` MABA: dilewati — dates 404 (simbol tak dikenal API) → tidak dipanggil, hemat 1 kredit
- `corporate-actions` SKYB: dilewati — dates 404 (simbol tak dikenal API) → tidak dipanggil, hemat 1 kredit
- `corporate-actions` KBRI: dilewati — dates 404 (simbol tak dikenal API) → tidak dipanggil, hemat 1 kredit
- `corporate-actions` NUSA: dilewati — dates 404 (simbol tak dikenal API) → tidak dipanggil, hemat 1 kredit
- `corporate-actions` RIMO: dilewati — dates 404 (simbol tak dikenal API) → tidak dipanggil, hemat 1 kredit
- `corporate-actions` SIMA: dilewati — dates 404 (simbol tak dikenal API) → tidak dipanggil, hemat 1 kredit
- `financials` COWL: dilewati — dates 404 (simbol tak dikenal API) → tidak dipanggil
- `financials` SUGI: dilewati — dates 404 (simbol tak dikenal API) → tidak dipanggil
- `financials` MABA: dilewati — dates 404 (simbol tak dikenal API) → tidak dipanggil
- `financials` SKYB: dilewati — dates 404 (simbol tak dikenal API) → tidak dipanggil

### Emiten tanpa baris di tabel data (kondisi DB saat ini)

- `report_dates`: 8 emiten tanpa baris — COWL, MABA, SKYB, SUGI, KBRI, NUSA, RIMO, SIMA
- `corporate_actions`: 12 emiten tanpa baris — COWL, DUCK, MABA, SKYB, SUGI, TRIL, UNIT, KBRI, NUSA, PURE, RIMO, SIMA
- `filings`: 59 emiten tanpa baris — ALMI, ALTO, ARMY, ARTI, BEBS, BIKA, BIMA, BOSS, BTEL, CBMF, CPRI, DEAL, DPNS, ETWA, FASW, FIMP, GAMA, GLOB, HKMU, HOME, HOTL, IIKP, INAF, INRU, IPPE, JSKY, KAYU, KBRI, KIAS, LMSH, MAGP, MENN, MFMI, MKNT, MTPS, NUSA, PLIN, PMMP, POLL, POOL, POSA, PTMR, PURE, RIMO, SIMA, SMCB, SMRU, TECH, TGRA, TGUK, TOPS, TRAM, TRIO, WSKT, ZBRA, CPIN, ICBP, INDF, INDY

## Penyimpangan anggaran

- Tidak ada langkah yang melampaui anggaran §5; total run 0 ≤ batas 440.

## Cara mengulang

```
npm run pull-universe -- --dry     # pra-terbang: harus 0 belum ter-cache setelah penarikan penuh
npm run pull-universe              # idempoten: run kedua 0 kredit (bukti di api_ledger)
npm run pull-universe -- --laporan # tulis ulang laporan ini dari DB
npm run db:sync -- --from=pglite --to=neon   # salin PGlite → Neon tanpa kredit (butuh DATABASE_URL + db:migrate)
```
(tambahkan `--pglite` pada pull-universe bila DATABASE_URL kosong.)

<!-- universe-pull:manual -->

## Catatan manual

_Ditulis 7 Sep 2026 setelah tiga run. Angka dari tabel `api_ledger` (PGlite lokal `./.pglite`); log run di scratchpad agen._

### 1. Riwayat run dan kredit (ledger DB)

| Run | Perintah | Ledger sebelum → sesudah | Kredit run | Keterangan |
|---|---|---|---|---|
| 0 | `npm run cache:migrate-to-db -- --pglite` | 0 → 68 | 0 (migrasi 172 baris ledger + 44 respons dari `.cache/sectors/`) | ledger tiket 03–04 dipindah utuh; run kedua migrasi: 0 disisipkan |
| pra | `npm run pull-universe -- --dry --pglite` | 68 | perkiraan 417 | ≤ anggaran 433 & batas 440 |
| 1 | `npm run pull-universe -- --pglite` | 68 → 114 | **46** | 20 halaman suspensi + 1 screener + 25 dates; **berhenti** karena HTTP 429 (rate limit, gratis) — versi awal skrip menganggap 429 fatal |
| 2 | `npm run pull-universe -- --pglite` (setelah retry 429 & jeda 450 ms) | 114 → 463 | **349** | semua langkah selesai; 19 respons 429 (0 kredit) ditangani dengan tunggu 20 s |
| pasca | `npm run pull-universe -- --dry --pglite` | 463 | perkiraan **0** | 0 langkah belum ter-cache |
| 3 | `npm run pull-universe -- --pglite` | 463 → **463** | **0** | bukti idempoten: 326 panggilan semuanya cache hit |

**Total tiket 07: 395 kredit** (463 − 68) dari anggaran revisi 433 (docs/data-proof.md §5). Sisa 537 dari 1.000; cadangan juri 250 utuh; buffer pengembangan 287 (rencana §5: ~249).

### 2. Rincian per langkah vs anggaran §5

| Langkah | §5 | Nyata | Catatan |
|---|---|---|---|
| Suspensi universe (`limit=30`, `end=2026-09-05`) | 20 | 20 | 583 kejadian, 329 emiten, 2018-12-28 – 2026-09-04; `end` tetap < hari ini UTC → cache permanen |
| Screener LQ45 | 1 | 1 (+1 percobaan `order_by` → 400 gratis) | respons hanya `symbol, company_name` |
| Free-float | 10 | 0 | masih di cache 24 jam dari tiket 04 (nama emiten diambil dari sini) |
| Dates | 71 (77 emiten) | 101 (107 emiten) | +30 kontrol tidak ada di §5 tetapi diminta tiket; 8 × 404 (1 kredit tiap, di-cache 30 hari) |
| Corporate-actions | 71 | 93 | 8 emiten yang `dates`-nya 404 sengaja tidak dipanggil (hemat 8 kredit) |
| Filings (59 + 30) | 86 | 89 | 86 halaman pertama + 3 halaman lanjutan (AKRA, AMMN, BUMI hal. 2; total 248 baris filing, 240 di kontrol); batas langkah 90 |
| Financials 18 delisting | 144 | 91 | 14 emiten × ≤ 8 kuartal sejak 2020 q1 (`n_quarters` dari `dates`: PLAS/UNIT 2, DUCK 3, GOLL/LCGP/LMAS/TRIL 7); 4 emiten 404 dilewati |
| **Total** | **403** (+30 demo broker/daily di luar skrip ini) | **395** | |

Pemangkasan otomatis kuartal (`pasKuartal`) tidak sampai terpicu pada run 2 karena 4 emiten 404 dan kuartal tersedia < 8 pada 6 emiten sudah menekan biaya.

### 3. Penyimpangan & keputusan

1. **DATABASE_URL kosong di `.env.local`** — tidak ada URL Neon di mesin ini (env OS juga kosong, tanpa CLI Neon). Karena agen tidak boleh membuat akun/kredensial, ledger, cache, dan semua tabel data disimpan di **PGlite berkas `./.pglite`** (Postgres asli via WASM, durable, migrasi Drizzle yang sama). `npm run db:migrate` pada mesin ini juga jatuh ke PGlite (drizzle.config.ts) — **bukti migrasi terhadap Neon belum ada**. Jalur pindah ke Neon **tanpa kredit**: `npm run db:sync -- --from=pglite --to=neon` (salin 8 tabel: data + ledger + cache; lihat §5 di bawah). Jalur cadangan bila hanya ledger/cache yang ingin dipindah: `npm run cache:migrate-to-db -- --from-pglite` lalu `npm run pull-universe` (semua respons sudah di cache → 0 kredit, tabel data dibangun ulang).
2. **Kontrol tidak berperingkat market cap.** Screener tidak mengembalikan `market_cap` dan menolak `order_by=market_cap desc` (400). 30 kontrol = 30 pertama secara alfabetis dari 44 anggota LQ45 tanpa suspensi 2019–2026 (45 anggota; hanya 1 yang pernah tersuspensi). Mengulang dengan sintaks `order_by` lain berisiko mengubah himpunan kontrol dan memaksa tarik ulang dates/CA/filings (~90 kredit) — tidak dilakukan. Yang tersisih (alfabetis setelah #30): 14 emiten LQ45 lain.
3. **8 emiten 404 di `dates`** (COWL, SUGI, MABA, SKYB, KBRI, NUSA, RIMO, SIMA — "Invalid stock symbol or data does not exist"): API tidak lagi mengenal simbol lama ini. Untuk mereka hanya feed suspensi yang tersedia; blok "laporan hilang", "dilutif", dan "utang > harta" tidak bisa dihitung. Respons 404 di-cache 30 hari, tetapi 404 DITAGIH 1 kredit — maka 8 emiten ini kini tercantum **eksplisit** di `DIKETAHUI_404.dates` (`src/lib/universe/daftar.ts`): langkah dates, corporate-actions, dan financials melewati mereka tanpa memanggil API, tidak bergantung pada cache 404 yang kedaluwarsa (bukti: `--dry --pglite` mencetak `dilewati … DIKETAHUI_404.dates`, 0 belum ter-cache).
4. **3 emiten pemantauan tanpa `target_event_date`** (MENN, TGRA, WSKT): tidak ada kejadian di feed suspensi ≤ 2026-06-30 (feed jarang sebelum 2020 dan tidak memuat suspensi WSKT 2023). Mesin uji harus memperlakukan mereka sebagai "tanpa kejadian target" (tidak masuk penghitungan lead time).
5. **5 emiten delisting memakai tanggal catatan** (ENVY, LMAS, MTRA, SBAT, TELE): feed memuat 0 kejadian (ENVY) atau 1 kejadian di luar jendela [catatan − 60 hari, ∞) (LMAS, MTRA, SBAT, TELE). PLAS terverifikasi ke 2018-12-28 (catatan 27 Des).
6. **Rate limit Sectors**: 429 muncul setelah ±25–45 panggilan beruntun; gratis. Skrip kini menunggu 20 s dan mengulang (maks 4×) serta memberi jeda 450 ms antar panggilan berbayar.
7. **Kredit terbuang: 0** — tidak ada 404 yang dibayar dua kali; 400/429 tidak ditagih.
8. **Dua cache ber-TTL yang tidak dibayar ulang pada run penuh.** (a) **Free-float** (`/v2/free-float/`, 10 kredit, TTL 24 jam — kedaluwarsa 2026-09-07 ~19:40 UTC): hanya dipakai untuk nama emiten; bila TTL habis tetapi universe (18 + 59 emiten) sudah ada di tabel `symbols`, langkah dilewati (`upsertSimbol` memakai `coalesce`, nama lama dipertahankan). (b) **Screener kontrol LQ45** (`/v2/companies/`, 1 kredit, TTL 30 hari): bila TTL habis tetapi 30 kontrol sudah ada di `symbols`, langkah dilewati agar himpunan kontrol tidak berubah (memilih ulang bisa memaksa tarik ulang dates/CA/filings ≈ 90 kredit). Pagar ini hanya aktif pada run penuh; paksa dengan `--step=free-float` atau `--step=control`. Akibatnya `npm run pull-universe -- --dry --pglite` tetap **0 belum ter-cache** setelah kedua TTL lewat.

### 4. Yang belum (di luar tiket ini)

- `npm run backtest` skor nyata: ditunda sampai tiket 06 (mesin uji) di-merge.
- Broker/daily demo 8 emiten (30 kredit, §5) belum ditarik — bagian mode pasang.

### 5. Menuju Neon (produksi)

Semua data tiket 07 saat ini hanya ada di PGlite lokal `./.pglite` (tidak di-track git). Memindahkannya ke Neon **tidak memakai kredit API** — `db:sync` menyalin baris tabel, bukan memanggil Sectors. Langkah persis setelah `DATABASE_URL` diisi di `.env.local` (URL Neon; jangan pernah dicetak/di-commit):

```
npm run db:migrate                            # terapkan ./drizzle ke Neon (skema identik dengan PGlite)
npm run db:sync -- --from=pglite --to=neon    # salin symbols, suspensions, report_dates, corporate_actions,
                                              # filings, financials_q, api_ledger, api_cache (upsert idempoten per batch 200)
npm run pull-universe -- --dry                # verifikasi: harus 0 belum ter-cache, ledger Neon = 467 kredit
                                              # (463 saat laporan ini ditulis + 4 kredit uji kelas B nyata di tiket 11)
```

Verifikasi hitung baris: `db:sync` mencetak tabel `Sumber | Tujuan | Status` per tabel dan exit 0 hanya bila semua **sama** (exit 2 bila beda, exit 1 bila DB gagal dibuka). Angka yang diharapkan sama dengan tabel "Baris per tabel (DB)" di atas: symbols 107, suspensions 583, report_dates 1901, corporate_actions 963, filings 248, financials_q 91; plus api_ledger dan api_cache. Menjalankan `db:sync` dua kali tidak menggandakan baris (dibuktikan tes PGlite → PGlite `tests/db/sinkron.test.ts`; Neon sendiri belum pernah diuji dari mesin ini).

Perilaku saat `DATABASE_URL` kosong (kondisi mesin ini, 7 Sep 2026): `npm run db:sync -- --from=pglite --to=neon` keluar **exit 1** dengan pesan `GAGAL membuka DB: DATABASE_URL kosong …` — tidak ada yang disalin.

**Blocker tiket 16 (deploy/produksi):** tanpa `DATABASE_URL` Neon, langkah di atas belum bisa dijalankan; aplikasi produksi tidak punya data universe, ledger, maupun cache. Tiket 16 harus dimulai dengan pengisian `DATABASE_URL` lalu ketiga perintah di atas.
