# Alarm Saham — Rencana Eksekusi (kontrak)

Status: **PERENCANAAN. Belum ada kode.** Kode baru boleh ditulis setelah semua anggota tim selesai onboarding di sectors.app (aturan hackathon §03). Dokumen ini boleh ada sebelum itu (§05: "ideas, research, sketches, designs, and planning are allowed").

Sectors Hackathon 2026 · Track 01 AI Agents & Assistants · deadline submit 30 Sep 2026 23:59 WIB · registrasi tutup 22 Sep.

## 0. Satu kalimat

Alarm Saham membuat investor biasa bisa melihat tanda bahaya struktural yang sudah diterbitkan bursa tapi tak terbaca — dan membiarkan mereka merakit sendiri alarmnya, mengujinya ke kasus nyata di masa lalu, lalu memasangnya untuk menjaga portofolio.

## 1. Keputusan yang sudah dikunci (Ronde 1, didelegasikan ke Claude)

| # | Keputusan | Pilihan | Alasan singkat |
|---|---|---|---|
| Q1 | Tim | 2 orang, AI-assisted dev penuh | Scope harus muat: fitur "komunitas" dipotong jadi *nice-to-have* paling akhir |
| Q2 | Inti produk | **Langkah 2: rakit alarm + uji ke masa lalu** | Satu-satunya bagian yang tidak dimiliki BEI/Stockbit/Ajaib |
| Q3 | Pahlawan cerita | Investor yang pernah "nyangkut" (pembuka: pemula dapat tip dari grup) | Video ditunda; keputusan ini untuk copy UI dan contoh data |
| Q4 | Angka hasil uji | **Hanya angka nyata dari data Sectors** | Kriteria juri: "not faked for the demo" |
| Q5 | Penyebutan emiten nyata | **Hanya fakta resmi + tautan sumber**; tanpa kata "pailit akan", "gorengan", "berbahaya" | Aturan "bukan saran investasi" + risiko hukum |
| Q6 | Kredit API | Endpoint universe + cache permanen di DB; per-simbol hanya untuk emiten kunci | 1.000 kredit total |
| Q7 | Otak AI | **Agent diagnosis** (loop tool-use: kenapa alarm bolong di emiten X) sebagai inti; perakit blok & penjelas harian sebagai pelengkap | Syarat track: custom agent logic |
| Q8 | Drag-and-drop | **dnd-kit** (custom), bukan Blockly/React Flow | Aturan datar (daftar syarat + ATAU/DAN), tidak butuh pohon |

## 2. Keputusan Ronde 2 (diambil Claude; boleh diveto)

- **Nama produk:** Alarm Saham. Domain sementara `*.vercel.app`.
- **Video:** ditunda sampai deploy pertama selesai (permintaan pemilik).
- **Notifikasi:** Telegram bot. Fallback email (Resend) hanya jika token BotFather tidak tersedia saat fase 3.
- **Komunitas/bagikan alarm:** dipotong menjadi "salin tautan alarm (read-only import)". Dikerjakan hanya jika fase 1–4 selesai lebih cepat.
- **Login:** tanpa akun. Portofolio & alarm disimpan per tautan rahasia (UUID) + localStorage. Cukup untuk demo; menghemat 1–2 hari.
- **Bahasa UI:** Bahasa Indonesia, awam. Setiap istilah punya tooltip kamus.
- **Disclaimer:** di footer setiap layar dan di setiap pesan Telegram: "Alarm Saham adalah alat informasi, bukan saran investasi."

## 3. Blok alarm (definisi terukur)

Dua kelas blok. Hanya kelas A yang ikut "uji ke masa lalu"; kelas B hanya untuk mode "pasang" (data historisnya tidak tersedia/mahal di Sectors).

### Kelas A — bisa diuji ke masa lalu
| Blok | Definisi | Sumber Sectors | Ambang (longgar / ketat) |
|---|---|---|---|
| Laporan keuangan telat | Tidak ada `report_date` kuartal baru dalam N hari setelah kuartal berakhir | `/v2/company/get_quarterly_financial_dates/{symbol}/` | 120 hari / 180 hari |
| Saham disuspensi | Ada kejadian suspensi dengan `suspension_date ≤ t` | `/v2/suspensions/` (universe) | pernah 12 bln / masih berlaku > 6 bln |
| Orang dalam menjual | Filing `transaction_type=sell`, `holder_type in (insider, institution)` dalam 180 hari sebelum t | `/v2/filings/?symbol=` | ada / nilai > 1% saham beredar |
| Aksi korporasi dilutif | Rights issue atau reverse split dengan tanggal ≤ t | `/v2/company/corporate-actions/{symbol}/` | ada / rasio dilusi > 50% |
| Utang lebih besar dari harta | `total_equity < 0` pada kuartal terakhir ≤ t | `/v2/financials/quarterly/{symbol}/` (**hanya 18 emiten kunci**, 1 kredit/kuartal) | ekuitas negatif / turun > 50% YoY |

### Kelas B — hanya mode pasang (data terkini)
| Blok | Sumber | Catatan |
|---|---|---|
| Ritel dominan, institusi menjual | `/v2/broker-summary/{symbol}/` + `/v2/brokers/` cohort | jendela maks 14 hari |
| Free float kecil | `/v2/free-float/` | snapshot saja |
| Baru IPO & jatuh dari puncak | `/v2/listing-performance/{symbol}/` + `/v2/daily/` | 90 hari |

### Cara menghitung skor uji (anti-curang)
- **Universe uji:** 18 emiten delisting Nov 2026 (studi kasus) + 59 emiten Papan Pemantauan Khusus per 30 Jun 2026 (universe utama) + 30 kontrol sehat (anggota LQ45 tanpa riwayat suspensi 2019–2026).
- **Kejadian target:** tanggal suspensi terakhir yang berujung delisting (18) atau tanggal masuk suspensi > 6 bulan (59).
- **Alarm "berbunyi"** pada tanggal t jika syarat terpenuhi memakai **hanya data bertanggal ≤ t** (tanpa lookahead).
- **Lebih awal** = kejadian target − tanggal bunyi pertama, dalam bulan.
- **Alarm palsu** = berbunyi pada kontrol sehat kapan pun dalam periode.
- Hasil disimpan dan bisa direproduksi oleh tes otomatis (`npm test`) dari fixture di DB — juri bisa menjalankannya.
- Keterbatasan (survivorship, kedalaman data) ditulis jujur di halaman "Cara kami menghitung".

## 4. Arsitektur

- **Monorepo tunggal Next.js 15 (App Router, TypeScript)**, Tailwind, shadcn/ui, **dnd-kit**, Recharts.
- **AI:** Vercel AI SDK + `@ai-sdk/anthropic`. `claude-opus-5` untuk agent diagnosis & perakit blok (structured output → skema blok Zod). `claude-sonnet-5` untuk penjelasan harian.
- **Agent diagnosis** (inti track): tool-use loop dengan tools `getSuspensions`, `getReportDates`, `getFilings`, `getCorporateActions`, `getFinancials`, `runAlarmOn(symbol, rules)`. Agent memutuskan sendiri tool mana yang dipanggil untuk menjelaskan "kenapa bolong", lalu mengusulkan blok. Trace tool-call ditampilkan di UI.
- **Data layer:** interface `DataProvider` dengan dua implementasi: `SectorsProvider` (API asli + cache DB + penghitung kredit) dan `FixtureProvider` (data dari DB/JSON). **Semua uji-ke-masa-lalu berjalan dari DB, bukan API.**
- **DB:** Neon Postgres + Drizzle. Tabel: `symbols`, `suspensions`, `report_dates`, `filings`, `corporate_actions`, `financials_q`, `alarms`, `portfolios`, `runs`, `api_ledger` (setiap panggilan API dicatat: endpoint, kredit, waktu).
- **Cron:** Vercel Cron 06:30 WIB, mengecek portofolio terhadap alarm, kirim Telegram via grammY.
- **Deploy:** Vercel (preview per PR, production dari `main`).

## 5. Anggaran kredit Sectors (1.000)

| Tahap | Perkiraan kredit |
|---|---|
| Hari 1 pembuktian data (10 emiten × ~5 endpoint) | 50 |
| Suspensi seluruh bursa (paginasi) | 20 |
| Tanggal laporan 77 emiten | 77 |
| Filing 77 emiten | 77 |
| Aksi korporasi 77 emiten | 77 |
| Financials 18 emiten × 8 kuartal | 144 |
| Free float universe | 10 |
| Broker/daily untuk demo mode pasang (8 emiten) | 30 |
| **Subtotal penarikan sekali** | **~485** |
| Cadangan pengembangan & mode harian | 265 |
| **Cadangan wajib untuk video & demo juri (jangan disentuh)** | **250** |

Kode menolak panggilan API jika `api_ledger` menunjukkan sisa < 250, kecuali flag manual `ALLOW_RESERVE=1`.

## 6. Fase eksekusi dan titik henti

| Fase | Isi | Selesai jika | Titik henti? |
|---|---|---|---|
| 0 | Prasyarat manusia (bagian 8) | semua kunci ada di `.env.local` | — |
| 1 | **Pembuktian data**: tarik suspensi universe; uji SRIL, GOLL, TELE, WIKA, INAF, BTEL di tiap endpoint; catat tahun awal data & apakah emiten delisting mengembalikan data | `docs/data-proof.md` terisi; daftar blok kelas A final | Tidak (pakai aturan cadangan §7) |
| 2 | Penarikan 77 emiten + kontrol ke DB; mesin uji; tes otomatis; agent diagnosis | `npm test` hijau; skor uji nyata tercetak | Tidak |
| 3 | UI langkah 1–3, dnd-kit, cron, Telegram | alur end-to-end jalan di lokal | Tidak |
| 4 | Pengerasan: README arsitektur, halaman "Cara kami menghitung", mode gelap, a11y, smoke test | checklist selesai | **YA — minta persetujuan deploy** |
| 5 | Deploy production pertama + smoke test | URL hidup | **YA — berhenti total (permintaan pemilik)** |

Kalender target: mulai begitu onboarding selesai; fase 1–4 ≈ 9–10 hari kerja AI; deploy pertama ≈ 21–23 Sep; sisa waktu untuk video & submit.

## 7. Aturan cadangan (agar Claude tidak berhenti bertanya)

1. Emiten delisting tidak mengembalikan data per-simbol → universe uji utama = 59 pemantauan khusus; 18 tetap tampil di "putar ulang" dari data suspensi universe saja.
2. Kedalaman data < 3 tahun → klaim diubah ke satuan bulan; tidak ada klaim "tahun" tanpa data.
3. Endpoint mengembalikan 5xx berulang → retry 3× dengan backoff, lalu lanjut ke emiten berikutnya, catat di `docs/data-proof.md`.
4. Kredit tersisa < 300 → hentikan semua penarikan baru, kerjakan fitur dari fixture; lapor ke pemilik.
5. Token BotFather tidak ada saat fase 3 → notifikasi via email (Resend) dan tampilan in-app; Telegram jadi opsional.
6. Vercel build gagal karena dependensi → downgrade ke versi stabil terakhir yang diketahui; catat di `docs/decisions.md`.

## 8. Yang harus disiapkan manusia (sebelum fase 1)

- [ ] Kedua anggota selesai onboarding di sectors.app → registrasi hackathon → klaim 1.000 kredit tim (roster terkunci).
- [ ] Sectors API key (Insider) → `SECTORS_API_KEY`
- [ ] Anthropic API key + batas belanja → `ANTHROPIC_API_KEY`
- [ ] Repo GitHub **baru, publik**, dibuat setelah onboarding: `alarm-saham` → `gh auth login` di mesin ini
- [ ] Akun Vercel (login GitHub) → `vercel login`
- [ ] Neon Postgres → `DATABASE_URL`
- [ ] Telegram bot dari @BotFather → `TELEGRAM_BOT_TOKEN` (opsional, lihat §7.5)

**Soal "API key dimasukkan setelah prototype jadi":** arsitektur `DataProvider` memang memungkinkan UI dibangun di atas `FixtureProvider` tanpa kunci. Tapi dua hal tidak bisa ditunda: (a) **kode apa pun tidak boleh ditulis sebelum onboarding selesai** — ini aturan lomba, bukan pilihan teknis; (b) fase 1 (pembuktian data) butuh kunci Sectors karena menentukan blok mana yang sah. Jadi urutan realistis: onboarding → kunci Sectors → fase 1 → baru kunci lain (Anthropic, Neon, Telegram) menyusul saat fase 2–3.

## 9. Kepatuhan aturan lomba (checklist)

- [ ] Repo dibuat dalam periode build dan setelah onboarding; tidak ada kode dari proyek lain.
- [ ] Sectors data adalah inti: tanpa Sectors, uji-ke-masa-lalu dan mode pasang mati.
- [ ] Ada LLM/agent logic buatan sendiri (agent diagnosis + perakit blok).
- [ ] Tidak ada eksekusi order beli/jual; tidak ada blok aksi "beli/jual".
- [ ] Tidak ada bahasa rekomendasi; disclaimer di semua permukaan.
- [ ] Semua API key di `.env*`, `.gitignore`, pre-commit secret scan, dan dihapus sebelum submit.
- [ ] Setelah submit: repo & app **freeze** — tidak ada commit apa pun.
- [ ] Repo tetap publik ≥ 90 hari setelah pengumuman.

## 10. Rujukan riset (ringkas)

- 18 emiten delisting 10 Nov 2026 (Bareksa 13 Apr 2026, Kompas 11 Apr 2026): COWL, MTRA, SRIL, TOYS, SBAT, TDPM, TELE (pailit); LCGP, SUGI, MABA, LMAS, SKYB, ENVY, GOLL, PLAS, TRIL, UNIT, DUCK (suspensi > 50 bln).
- 59 emiten Papan Pemantauan Khusus per 30 Jun 2026 (Peng-S-00019/BEI.PLP/06-2026; Kalderanews, Kontan): ALMI, ALTO, ARMY, ARTI, BEBS, BIKA, BIMA, BOSS, BTEL, CBMF, CPRI, DEAL, DPNS, ETWA, FASW, FIMP, GAMA, GLOB, HKMU, HOME, HOTL, IIKP, INAF, INRU, IPPE, JSKY, KAYU, KBRI, KIAS, LMSH, MAGP, MENN, MFMI, MKNT, MTPS, MTSM, NUSA, PLIN, PMMP, POLL, POOL, POSA, PTMR, PURE, RIMO, SIMA, SMCB, SMRU, SWAT, TECH, TGRA, TGUK, TOPS, TRAM, TRIO, WICO, WIKA, WSKT, ZBRA.
- Konteks pasar 2026: trading halt 28–29 Jan (MSCI freeze), IHSG −33% YTD Jun, 1,2 juta ritel keluar Q1, OJK denda influencer Rp5,35 M, notasi khusus baru (P, X) mulai 3 Agu 2026, FCA revisi Q3 2026.
- Dokumentasi Sectors v2: biaya kredit per endpoint, batas rentang (daily 90 hari, broker 14 hari), universe feeds (suspensions, filings, free-float, quarterly-dates), shareholders sejak 2021, listing-performance sejak Mei 2005. Tahun awal data lain **belum diketahui** → fase 1.
