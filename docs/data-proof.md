# Pembuktian data Fase 1 (tiket 04)

Hasil uji API Sectors nyata untuk enam emiten uji dan probe universe. Bagian di antara penanda dihasilkan skrip; bagian **Keputusan** di bawahnya ditulis manual.

## Hasil pengujian

<!-- data-proof:mulai -->
_Dihasilkan otomatis oleh `npm run data-proof` pada 2026-09-06T19:40:54.865Z._

### Ringkasan kredit (dari ledger `.cache/sectors/ledger.jsonl`)

| Ukuran | Nilai |
|---|---|
| Kredit run ini | 0 |
| Kredit rencana ini (lintas run, dari ledger) | 68 |
| Kredit terbuang (404 dibayar ulang) | 12 |
| Batas keras skrip | 60 |
| Total kredit seluruh ledger (semua skrip) | 68 |
| Sisa menurut ledger lokal | 932 dari 1000 (cadangan 250) |
| Panggilan dari API / cache / dilewati / gagal | 0 / 44 / 0 / 0 |

### Tabel endpoint × emiten

Sel: `jumlah baris; tanggal terawal – terakhir yang terlihat; kredit (run terakhir; 0 = dari cache)`. `—` = tidak direncanakan (hemat kredit). Tanggal diambil dari semua string berformat tanggal dalam respons; untuk feed berpaginasi hanya halaman pertama.

| Endpoint | SRIL | GOLL | TELE | WIKA | INAF | BTEL | BBCA |
|---|---|---|---|---|---|---|---|
| suspensions | 1 baris; 2021-05-18 – 2021-05-18; 0 kr | 1 baris; 2019-01-30 – 2019-01-30; 0 kr | 1 baris; 2024-12-27 – 2024-12-27; 0 kr | 1 baris; 2025-02-18 – 2025-02-18; 0 kr | 1 baris; 2024-07-02 – 2024-07-02; 0 kr | 1 baris; 2019-05-27 – 2019-05-27; 0 kr | — |
| dates | 5 baris; 2020-03-31 – 2024-09-30; 0 kr | 2 baris; 2020-03-31 – 2021-09-30; 0 kr | 6 baris; 2020-03-31 – 2025-06-30; 0 kr | 7 baris; 2020-03-31 – 2026-03-31; 0 kr | 7 baris; 2020-03-31 – 2026-06-30; 0 kr | 6 baris; 2020-03-31 – 2025-09-30; 0 kr | — |
| filings | kosong; tanpa tanggal; 0 kr | kosong; tanpa tanggal; 0 kr | kosong; tanpa tanggal; 0 kr | 2 baris; 2026-01-06 – 2026-01-09; 0 kr | kosong; tanpa tanggal; 0 kr | kosong; tanpa tanggal; 0 kr | — |
| corporate-actions | 2 baris; 2020-07-16 – 2024-09-18; 0 kr | 2 baris; 2022-07-29 – 2023-01-27; 0 kr | 2 baris; 2022-05-31 – 2025-08-15; 0 kr | 2 baris; 2016-11-11 – 2026-05-11; 0 kr | 2 baris; 2022-05-31 – 2026-06-25; 0 kr | 2 baris; 2022-11-30 – 2025-11-28; 0 kr | — |
| listing | **404**; 0 kr | 5 baris; tanpa tanggal; 0 kr | **404**; 0 kr | **404**; 0 kr | **404**; 0 kr | **404**; 0 kr | — |
| financials | 2 baris; 2024-06-30 – 2024-09-30; 0 kr | — | 2 baris; 2025-03-31 – 2025-06-30; 0 kr | 2 baris; 2025-12-31 – 2026-03-31; 0 kr | — | — | — |
| broker | — | — | — | kosong; 2026-08-24 – 2026-09-06; 0 kr | — | **404**; 0 kr | 9 baris; 2026-08-24 – 2026-09-06; 0 kr |
| daily | — | — | — | 61 baris; 2026-06-09 – 2026-09-04; 0 kr | — | — | — |

### Probe universe

| Probe | Status | Baris | Terawal | Terakhir | Kredit | Skema | Catatan |
|---|---|---|---|---|---|---|---|
| suspensions tanpa symbol (halaman 1) | 200 | 20 | 2026-08-11 | 2026-09-04 | 0 | lolos | total_count=583 has_next=true |
| suspensions?end=2019-12-31 (probe kedalaman) | 200 | 9 | 2018-12-28 | 2019-12-02 | 0 | lolos | total_count=9 has_next=false |
| suspensions?end=2016-12-31 (probe kedalaman) | 200 | 0 | - | - | 0 | lolos | total_count=0 has_next=false |
| filings tanpa symbol, start=2018-01-01, limit=30 | 200 | 30 | 2025-04-14 | 2026-09-04 | 0 | lolos | total_count=3569 has_next=true |
| filings tanpa symbol, start=2018-01-01, end=2021-12-31 (probe kedalaman) | 200 | 0 | - | - | 0 | lolos | total_count=0 has_next=false |
| filings tanpa symbol, start=2018-01-01, end=2023-12-31 (probe kedalaman) | 200 | 0 | - | - | 0 | lolos | total_count=0 has_next=false |
| free-float seluruh bursa (hanya bila sisa anggaran cukup) | 200 | 961 | - | - | 0 | lolos |  |

### Detail setiap panggilan (run terakhir)

| # | Endpoint | Params | HTTP | Sumber | Baris | Terawal | Terakhir | Kredit | Skema | Catatan |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | /v2/suspensions/ | {"symbol":"SRIL"} | 200 | cache | 1 | 2021-05-18 | 2021-05-18 | 0 | lolos | total_count=1 has_next=false |
| 2 | /v2/company/get_quarterly_financial_dates/SRIL/ | {} | 200 | cache | 5 | 2020-03-31 | 2024-09-30 | 0 | lolos |  |
| 3 | /v2/filings/ | {"symbol":"SRIL"} | 200 | cache | 0 | - | - | 0 | lolos | total_count=0 has_next=false |
| 4 | /v2/company/corporate-actions/SRIL/ | {} | 200 | cache | 2 | 2020-07-16 | 2024-09-18 | 0 | lolos |  |
| 5 | /v2/listing-performance/SRIL/ | {} | 404 | cache | - | - | - | 0 | - | not_found Given stock symbol does not exist for this data. |
| 6 | /v2/suspensions/ | {"symbol":"GOLL"} | 200 | cache | 1 | 2019-01-30 | 2019-01-30 | 0 | lolos | total_count=1 has_next=false |
| 7 | /v2/company/get_quarterly_financial_dates/GOLL/ | {} | 200 | cache | 2 | 2020-03-31 | 2021-09-30 | 0 | lolos |  |
| 8 | /v2/filings/ | {"symbol":"GOLL"} | 200 | cache | 0 | - | - | 0 | lolos | total_count=0 has_next=false |
| 9 | /v2/company/corporate-actions/GOLL/ | {} | 200 | cache | 2 | 2022-07-29 | 2023-01-27 | 0 | lolos |  |
| 10 | /v2/listing-performance/GOLL/ | {} | 200 | cache | 5 | - | - | 0 | lolos |  |
| 11 | /v2/suspensions/ | {"symbol":"TELE"} | 200 | cache | 1 | 2024-12-27 | 2024-12-27 | 0 | lolos | total_count=1 has_next=false |
| 12 | /v2/company/get_quarterly_financial_dates/TELE/ | {} | 200 | cache | 6 | 2020-03-31 | 2025-06-30 | 0 | lolos |  |
| 13 | /v2/filings/ | {"symbol":"TELE"} | 200 | cache | 0 | - | - | 0 | lolos | total_count=0 has_next=false |
| 14 | /v2/company/corporate-actions/TELE/ | {} | 200 | cache | 2 | 2022-05-31 | 2025-08-15 | 0 | lolos |  |
| 15 | /v2/listing-performance/TELE/ | {} | 404 | cache | - | - | - | 0 | - | not_found Given stock symbol does not exist for this data. |
| 16 | /v2/suspensions/ | {"symbol":"WIKA"} | 200 | cache | 1 | 2025-02-18 | 2025-02-18 | 0 | lolos | total_count=1 has_next=false |
| 17 | /v2/company/get_quarterly_financial_dates/WIKA/ | {} | 200 | cache | 7 | 2020-03-31 | 2026-03-31 | 0 | lolos |  |
| 18 | /v2/filings/ | {"symbol":"WIKA"} | 200 | cache | 2 | 2026-01-06 | 2026-01-09 | 0 | lolos | total_count=2 has_next=false |
| 19 | /v2/company/corporate-actions/WIKA/ | {} | 200 | cache | 2 | 2016-11-11 | 2026-05-11 | 0 | lolos |  |
| 20 | /v2/listing-performance/WIKA/ | {} | 404 | cache | - | - | - | 0 | - | not_found Given stock symbol does not exist for this data. |
| 21 | /v2/suspensions/ | {"symbol":"INAF"} | 200 | cache | 1 | 2024-07-02 | 2024-07-02 | 0 | lolos | total_count=1 has_next=false |
| 22 | /v2/company/get_quarterly_financial_dates/INAF/ | {} | 200 | cache | 7 | 2020-03-31 | 2026-06-30 | 0 | lolos |  |
| 23 | /v2/filings/ | {"symbol":"INAF"} | 200 | cache | 0 | - | - | 0 | lolos | total_count=0 has_next=false |
| 24 | /v2/company/corporate-actions/INAF/ | {} | 200 | cache | 2 | 2022-05-31 | 2026-06-25 | 0 | lolos |  |
| 25 | /v2/listing-performance/INAF/ | {} | 404 | cache | - | - | - | 0 | - | not_found Given stock symbol does not exist for this data. |
| 26 | /v2/suspensions/ | {"symbol":"BTEL"} | 200 | cache | 1 | 2019-05-27 | 2019-05-27 | 0 | lolos | total_count=1 has_next=false |
| 27 | /v2/company/get_quarterly_financial_dates/BTEL/ | {} | 200 | cache | 6 | 2020-03-31 | 2025-09-30 | 0 | lolos |  |
| 28 | /v2/filings/ | {"symbol":"BTEL"} | 200 | cache | 0 | - | - | 0 | lolos | total_count=0 has_next=false |
| 29 | /v2/company/corporate-actions/BTEL/ | {} | 200 | cache | 2 | 2022-11-30 | 2025-11-28 | 0 | lolos |  |
| 30 | /v2/listing-performance/BTEL/ | {} | 404 | cache | - | - | - | 0 | - | not_found Given stock symbol does not exist for this data. |
| 31 | /v2/financials/quarterly/SRIL/ | {"n_quarters":"2"} | 200 | cache | 2 | 2024-06-30 | 2024-09-30 | 0 | lolos |  |
| 32 | /v2/financials/quarterly/TELE/ | {"n_quarters":"2"} | 200 | cache | 2 | 2025-03-31 | 2025-06-30 | 0 | lolos |  |
| 33 | /v2/financials/quarterly/WIKA/ | {"n_quarters":"2"} | 200 | cache | 2 | 2025-12-31 | 2026-03-31 | 0 | lolos |  |
| 34 | /v2/broker-summary/WIKA/ | {"start":"2026-08-24","end":"2026-09-06"} | 200 | cache | 0 | 2026-08-24 | 2026-09-06 | 0 | lolos |  |
| 35 | /v2/broker-summary/BTEL/ | {"start":"2026-08-24","end":"2026-09-06"} | 404 | cache | - | - | - | 0 | - | not_found Symbol 'BTEL.JK' not found in broker data. |
| 36 | /v2/broker-summary/BBCA/ | {"start":"2026-08-24","end":"2026-09-06"} | 200 | cache | 9 | 2026-08-24 | 2026-09-06 | 0 | lolos |  |
| 37 | /v2/daily/WIKA/ | {"start":"2026-06-09","end":"2026-09-06"} | 200 | cache | 61 | 2026-06-09 | 2026-09-04 | 0 | lolos |  |
| 38 | /v2/suspensions/ | {} | 200 | cache | 20 | 2026-08-11 | 2026-09-04 | 0 | lolos | total_count=583 has_next=true |
| 39 | /v2/suspensions/ | {"end":"2019-12-31"} | 200 | cache | 9 | 2018-12-28 | 2019-12-02 | 0 | lolos | total_count=9 has_next=false |
| 40 | /v2/suspensions/ | {"end":"2016-12-31"} | 200 | cache | 0 | - | - | 0 | lolos | total_count=0 has_next=false |
| 41 | /v2/filings/ | {"start":"2018-01-01","limit":"30"} | 200 | cache | 30 | 2025-04-14 | 2026-09-04 | 0 | lolos | total_count=3569 has_next=true |
| 42 | /v2/filings/ | {"start":"2018-01-01","end":"2021-12-31","limit":"30"} | 200 | cache | 0 | - | - | 0 | lolos | total_count=0 has_next=false |
| 43 | /v2/filings/ | {"start":"2018-01-01","end":"2023-12-31","limit":"30"} | 200 | cache | 0 | - | - | 0 | lolos | total_count=0 has_next=false |
| 44 | /v2/free-float/ | {} | 200 | cache | 961 | - | - | 0 | lolos |  |

### Jawaban otomatis

**(a) Tanggal terawal yang terlihat per endpoint** (minimum lintas semua panggilan 2xx; feed berpaginasi = halaman pertama saja):

| Endpoint | Terawal | Terakhir | Dari panggilan |
|---|---|---|---|
| suspensions | 2018-12-28 | 2026-09-04 | suspensions:universe:end=2019-12-31 |
| dates | 2020-03-31 | 2026-06-30 | dates:SRIL |
| corporate-actions | 2016-11-11 | 2026-06-25 | corporate-actions:WIKA |
| filings | 2025-04-14 | 2026-09-04 | filings:universe |
| financials | 2024-06-30 | 2026-03-31 | financials:SRIL |
| broker | 2026-08-24 | 2026-09-06 | broker:WIKA |
| daily | 2026-06-09 | 2026-09-04 | daily:WIKA |

**(b) Emiten delisting/tersuspensi masih mengembalikan data per-simbol?**

| Emiten | suspensions | dates | filings | corporate-actions | listing | financials |
|---|---|---|---|---|---|---|
| SRIL | 200, 1 baris | 200, 5 baris | 200 kosong | 200, 2 baris | 404 | 200, 2 baris |
| GOLL | 200, 1 baris | 200, 2 baris | 200 kosong | 200, 2 baris | 200, 5 baris | — |
| TELE | 200, 1 baris | 200, 6 baris | 200 kosong | 200, 2 baris | 404 | 200, 2 baris |

**(c) Kredit terpakai rencana ini (ledger, lintas run):** 68 dari batas 60; run ini 0; terbuang karena 404 dibayar ulang: 12.

**(d) Error / ketidaksesuaian yang ditemui (run terakhir):**

- `listing:SRIL`: HTTP 404, sumber cache, skema -. not_found Given stock symbol does not exist for this data.
- `listing:TELE`: HTTP 404, sumber cache, skema -. not_found Given stock symbol does not exist for this data.
- `listing:WIKA`: HTTP 404, sumber cache, skema -. not_found Given stock symbol does not exist for this data.
- `listing:INAF`: HTTP 404, sumber cache, skema -. not_found Given stock symbol does not exist for this data.
- `listing:BTEL`: HTTP 404, sumber cache, skema -. not_found Given stock symbol does not exist for this data.
- `broker:BTEL`: HTTP 404, sumber cache, skema -. not_found Symbol 'BTEL.JK' not found in broker data.

<!-- data-proof:selesai -->

## Keputusan

_Ditulis manual 7 Sep 2026 setelah membaca hasil di atas. Semua angka kredit dari `.cache/sectors/ledger.jsonl`._

### 1. Jawaban singkat atas empat pertanyaan tiket

| Pertanyaan | Jawaban |
|---|---|
| (1) Tahun/tanggal terawal per endpoint | **suspensions** (universe): 2018-12-28, tetapi hanya 9 kejadian s.d. akhir 2019 — feed baru padat sejak 2020; total 583 kejadian s.d. 2026-09-04. **quarterly financial dates**: 2020 q1 untuk semua 6 emiten (isinya kuartal yang laporannya TERSEDIA, bukan tanggal penyampaian). **corporate-actions**: rights issue s.d. 2016-11-11 (WIKA), dividen 2020, daftar RUPS umumnya 2022+. **financials/quarterly**: 2 kuartal terakhir per emiten (SRIL 2024 q2–q3, TELE 2025 q1–q2, WIKA 2025 q4–2026 q1); kedalaman ke belakang diperkirakan sama dengan `dates` (2020 q1) — belum diverifikasi karena 1 kredit/kuartal. **filings**: **tidak ada satu pun filing ≤ 2023-12-31** (total_count=0), padahal ≥ 2018-01-01 ada 3.569 → feed insider dimulai 2024. **daily/broker-summary**: hanya diuji untuk jendela terkini (90/14 hari) sesuai batas endpoint. **listing-performance**: 404 untuk 5 dari 6 (hanya GOLL), tanpa `listing_date`/`offering_price`. |
| (2) Emiten delisting masih mengembalikan data per-simbol? | **Ya.** SRIL, GOLL, TELE mengembalikan 200 untuk suspensions (1 baris = suspensi terakhir), dates, filings (kosong tetapi 200 dan tetap ditagih), corporate-actions, dan financials (SRIL/TELE). Satu-satunya 404 adalah listing-performance, dan itu juga 404 untuk WIKA/INAF/BTEL yang masih tercatat — jadi bukan efek delisting. Catatan: suspensions **per simbol hanya mengembalikan 1 kejadian** (total_count=1) — sejarah suspensi harus diambil dari feed universe. |
| (3) Kredit terpakai | **68 kredit total di ledger** (semuanya oleh skrip ini). Rinciannya: run pertama 53 (dalam batas 60); 3 probe tambahan (broker BBCA, 2 probe kedalaman filings); **12 kredit terbuang** karena enam respons 404 (5 listing-performance + broker BTEL) dibayar ulang dua kali: (i) provider tiket 03 tidak meng-cache 404 padahal 404 ditagih, (ii) bug kunci anggaran di skrip (field `endpoint` pada rencana bertabrakan struktural dengan `BarisLedger.endpoint`). Keduanya sudah diperbaiki: 404 kini di-cache 30 hari (`TTL_404_MS`), field rencana diganti `jenis`, dan ada mode `--dry` yang wajib dijalankan dulu untuk melihat berapa langkah yang belum di-cache. Kriteria "sekali jalan ≤ 60" terpenuhi (53); kriteria kumulatif terlampaui 8 kredit — dicatat jujur di sini. |
| (4) Error yang ditemui | Hanya 404 (listing-performance ×5, broker-summary BTEL — "Symbol 'BTEL.JK' not found in broker data"). Tidak ada 5xx, 429, atau kegagalan jaringan; retry §7.3 tidak pernah terpicu. Ketidaksesuaian skema (diperbaiki di `src/lib/data/types.ts`, tes dari sampel nyata di `tests/unit/data/skema-sampel-nyata.test.ts`): `symbol` berakhiran `.JK`; `get_quarterly_financial_dates` = dict tahun → `[[akhir_periode, "q1".."q4"], ...]`; financials memakai `date` bukan `report_date` dan urutan turun; corporate-actions terbungkus `corporate_actions` dengan daftar `null`; broker-summary `{symbol,start,end,data:[{date,summary:[...]}]}` dengan `broker_code` (tanpa nama broker) dan `bavg/savg/navg_per_share`; filings memuat `title/body/tags/price_transaction` dan persentase dalam satuan persen (0.91 = 0,91 %); `limit` default feed = 20 (bukan 30). |

### 2. Blok kelas A final (bisa diuji ke masa lalu)

| Blok | Status | Definisi yang dipakai | Kedalaman terbukti |
|---|---|---|---|
| Saham disuspensi | **Tetap kelas A** | kejadian di feed suspensions universe dengan `suspension_date ≤ t` | Des 2018 (jarang) / padat sejak 2020; 583 kejadian = 20 halaman × 30 |
| Laporan keuangan telat → **diganti "laporan keuangan hilang/berhenti"** | **Tetap kelas A, definisi direvisi** | kuartal Q dinyatakan hilang pada t jika `akhir_periode(Q) + N hari ≤ t` dan Q tidak ada di daftar kuartal tersedia (N = 120 longgar / 180 ketat). Bebas lookahead karena daftar hanya bertambah; TIDAK bisa mendeteksi laporan yang telat lalu akhirnya disampaikan (endpoint tidak memuat tanggal penyampaian). | 2020 q1 |
| Aksi korporasi dilutif | **Tetap kelas A** | `right_issue[].ex_date ≤ t`; rasio dilusi = `new_ratio / old_ratio` (WIKA 2024: 521.982.000 : 100.000.000 ≈ 5,2×). Reverse split belum pernah terlihat (`stock_split` null pada 6 emiten) → hanya rights issue. | 2016 (WIKA) |
| Utang lebih besar dari harta | **Tetap kelas A, hanya 18 emiten kunci** | `total_equity < 0` pada kuartal terakhir dengan `date ≤ t` (SRIL 2024 q3: ekuitas −15,46 T terkonfirmasi) | ≥ 2 kuartal terbukti; 1 kredit/kuartal terkonfirmasi |
| Orang dalam menjual | **Turun ke kelas A-terbatas (jendela 2024–sekarang)** | filing `transaction_type=sell`, `holder_type ∈ {insider, institution}` ≤ 180 hari sebelum t | Tidak ada data sebelum 2024; 5 dari 6 emiten uji tanpa filing sama sekali |

### 3. Blok kelas B final (hanya mode pasang)

| Blok | Status | Catatan dari data |
|---|---|---|
| Ritel dominan, institusi menjual | Tetap | broker-summary 14 hari bekerja untuk saham aktif (BBCA: 9 hari bursa × ±60 broker). Saham tersuspensi: WIKA 200 kosong (tetap 1 kredit), BTEL 404 (1 kredit, kini di-cache). Tidak ada nama broker → cohort harus dari `/v2/brokers/` (belum diuji). |
| Free float kecil | Tetap | 961 emiten, 10 kredit, nilai desimal (1 = 100 %). TTL cache 24 jam → tarik ulang saat demo. |
| Baru IPO & jatuh dari puncak → **diganti "jatuh dari puncak 90 hari"** | Direvisi | listing-performance 404 untuk hampir semua emiten dan tanpa tanggal listing; blok memakai `daily` 90 hari saja (drawdown dari tertinggi 90 hari). listing-performance dihapus dari rencana penarikan. |

### 4. Universe uji utama dan aturan cadangan

- **§7.1 TIDAK terpicu** (emiten delisting mengembalikan data per-simbol). Namun karena data `dates`/financials baru mulai 2020 q1 dan kejadian target 18 emiten delisting sebagian besar terjadi 2019–2021 (GOLL Jan 2019, PLAS Des 2018, BTEL/LCGP/TRIL 2019), lead-time yang bisa dibuktikan untuk mereka tipis. **Keputusan: universe skor utama = 59 Papan Pemantauan Khusus** (kejadian target 2024–2025, mis. INAF 2024-07-02, WIKA 2025-02-18, dengan 4–5 tahun data sebelumnya) **+ 30 kontrol sehat**; **18 emiten delisting = studi kasus "putar ulang"** yang tetap memakai data per-simbol (bukan hanya feed suspensi), tetapi tidak masuk penghitungan skor "lebih awal berapa bulan" kecuali kejadian targetnya ≥ 2021.
- **§7.2 TERPICU untuk blok "orang dalam menjual"** (kedalaman < 3 tahun): klaim blok ini dinyatakan dalam bulan dan hanya untuk jendela 2024+. Untuk blok suspensi, laporan hilang, dan aksi korporasi kedalaman ≥ 3 tahun → boleh klaim tahun, dibatasi "sejak 2020".
- Semua keterbatasan di atas masuk halaman "Cara kami menghitung".

### 5. Revisi anggaran kredit tiket 07 (biaya nyata)

| Tahap | PLAN.md §5 | Revisi | Dasar |
|---|---|---|---|
| Suspensi seluruh bursa | 20 | **20** | 583 / 30 per halaman = 20 halaman; **wajib `limit=30`** (default 20 → 30 halaman) |
| Tanggal laporan 77 emiten | 77 | **71** | 1 kredit/emiten terkonfirmasi; 6 sudah di-cache permanen |
| Filing per emiten | 77 | **86** | 59 + 30 kontrol (18 delisting dilewati: feed mulai 2024, semuanya sudah tersuspensi) − 3 ter-cache |
| Aksi korporasi 77 emiten | 77 | **71** | 6 ter-cache |
| Financials 18 × 8 kuartal | 144 | **≤ 144** | 1 kredit/kuartal terkonfirmasi; pakai `dates` untuk memilih `n_quarters` agar tidak membayar kuartal kosong (GOLL hanya sampai 2021 q3) |
| Free float | 10 | **10** | ter-cache 24 jam saja |
| Broker/daily demo (8 emiten) | 30 | **30** | pilih emiten aktif; saham tersuspensi menghasilkan kosong/404 berbayar |
| listing-performance | (termasuk di atas) | **0** | dihapus |
| Screener LQ45 untuk kontrol | — | **1** | `where` = 1 kredit |
| **Subtotal tiket 07** | ~485 | **~433** | |
| Sudah terpakai tiket 04 | 50 | **68** | lihat (3) |
| Sisa setelah tiket 07 (dari 1.000) | | **~499** | cadangan juri 250 tetap utuh; buffer pengembangan ~249 |

### 6. Aturan operasional yang lahir dari tiket ini

1. Jalankan `npm run data-proof -- --dry` (atau pra-terbang serupa di tiket 07) sebelum penarikan apa pun; angka "belum di-cache" adalah biaya maksimal run.
2. 404 ditagih → jangan pernah memanggil endpoint yang diketahui 404 (listing-performance) untuk universe.
3. Untuk cache permanen, `end` pada broker/daily harus < tanggal hari ini **UTC** (skrip ini memakai 2026-09-06 saat UTC masih 06 Sep → TTL 24 jam, entri akan kedaluwarsa).
4. Semua respons enam emiten uji sudah di cache; tiket 07 tidak perlu menarik ulang selama kunci (endpoint+params) sama.
