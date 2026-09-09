# Log keputusan (bertanggal)

Catatan keputusan teknis dan produk Alarm Saham beserta aturan cadangan (PLAN.md §7) yang terpicu. Sumber tiap butir disebut dalam kurung; angka kredit selalu dari buku kredit (`api_ledger` / `.cache/sectors/ledger.jsonl`), bukan perkiraan.

## Sebelum kode ditulis — PLAN.md (Ronde 1 & 2)

| Keputusan | Pilihan | Alasan |
|---|---|---|
| Inti produk | Langkah 2: rakit alarm + uji ke masa lalu | satu-satunya bagian yang tidak dimiliki BEI/Stockbit/Ajaib (PLAN §1 Q2) |
| Angka hasil uji | hanya angka nyata dari data Sectors | kriteria juri "not faked for the demo" (Q4) |
| Penyebutan emiten nyata | hanya fakta resmi + tautan sumber; tanpa kata "pailit akan", "gorengan", "berbahaya" | bukan saran investasi + risiko hukum (Q5) |
| Kredit API | endpoint universe + cache permanen di DB; per-simbol hanya untuk emiten kunci | 1.000 kredit total (Q6) |
| Otak AI | agent diagnosis (loop tool-use "kenapa alarm bolong di emiten X") sebagai inti; perakit blok sebagai pelengkap | syarat track: custom agent logic (Q7) |
| Drag-and-drop | dnd-kit, bukan Blockly/React Flow | aturan datar (daftar syarat + ATAU/DAN) (Q8) |
| Login | tanpa akun; portofolio per tautan rahasia (UUID) + localStorage | cukup untuk demo, hemat 1–2 hari (§2) |
| Notifikasi | Telegram bot; fallback in-app/email bila token tidak ada | §2, §7.5 |
| Komunitas/bagikan | dipotong menjadi "salin tautan alarm" (tiket 17, backlog) | scope 2 orang (§2) |
| Disclaimer | di footer setiap layar dan setiap pesan keluar | §2 |

## 2026-09-07 — Bootstrap (tiket 02)

- Next.js 16 App Router + TypeScript + Tailwind v4, Vitest, Playwright, husky pre-commit `scripts/check-secrets.mjs`, CI GitHub Actions (lint → typecheck → test → build). Repo publik `fajaraji/alarm-saham` dibuat dalam periode build.

## 2026-09-07 — Klien Sectors, buku kredit, cache (tiket 03)

- Satu antarmuka `DataProvider` dengan dua implementasi: `SectorsProvider` (API + ledger + cache + penolakan bila sisa < cadangan 250, `ALLOW_RESERVE=1` untuk melewati) dan `FixtureProvider`.
- Aturan biaya diikuti dari dokumentasi Sectors: 2xx ditagih (termasuk hasil kosong), 404 ditagih 1, 400/401/403/429/5xx gratis, financials 1/kuartal, free-float 1/100 emiten, feed 1/halaman.

## 2026-09-06 → 07 — Pembuktian data Fase 1 (tiket 04, `docs/data-proof.md`)

- **Kedalaman data**: suspensions universe sejak 2018-12-28 (padat 2020+); quarterly dates & financials sejak 2020 q1; corporate-actions sampai 2016 (WIKA); **filings tidak ada satu pun ≤ 2023** (feed insider mulai 2024); listing-performance 404 untuk 5 dari 6 emiten.
- **Emiten delisting masih mengembalikan data per simbol** → §7.1 **tidak terpicu**. Namun suspensi per simbol hanya 1 baris → sejarah suspensi wajib dari feed universe.
- **§7.2 TERPICU untuk blok "orang dalam menjual"** (kedalaman < 3 tahun): klaim hanya untuk jendela 2024+ dan dalam bulan. Blok lain boleh klaim "sejak 2020".
- **Definisi blok direvisi**: "laporan telat" → "laporan hilang/berhenti" (endpoint tidak memuat tanggal penyampaian); "aksi dilutif" hanya rights issue (reverse split tidak pernah terlihat); "baru IPO & jatuh" → "jatuh dari puncak 90 hari" (listing-performance dihapus).
- **Universe skor utama = 59 pemantauan khusus + 30 kontrol; 18 delisting = studi kasus** (kejadian target 2018–2021, sebelum data laporan tersedia).
- **Kredit**: 68 total (run pertama 53 ≤ batas 60; 12 terbuang karena enam 404 dibayar dua kali sebelum cache-404 diperbaiki). Perbaikan: 404 di-cache 30 hari (`TTL_404_MS`), mode `--dry` wajib sebelum penarikan.
- §7.3 (5xx berulang) tidak pernah terpicu.

## 2026-09-07 — Skema database (tiket 05)

- Drizzle + Postgres; `drizzle.config.ts` jatuh ke **PGlite `./.pglite`** bila `DATABASE_URL` kosong agar `npm run db:migrate` selalu bisa dibuktikan. Tes integrasi memakai PGlite in-memory (Docker bila ada).

## 2026-09-07 — Mesin uji (tiket 06, `docs/mesin-uji.md`)

- Fungsi `fires(rule, events, t)` murni; sumber kejadian tidak memfilter tanggal, pemotongan `≤ t` di satu tempat (anti-lookahead).
- Pindai akhir bulan; rentang emiten kena `max(2020-01-31, target − 6 th)` s.d. `< target`; target `< 2021-01-01` ikut total tetapi tidak ikut rata-rata lead.
- Asumsi "suspensi belum dicabut" (ketat) = tidak ada kuartal laporan baru setelah suspensi — karena feed tidak memuat tanggal pencabutan.

## 2026-09-06 → 07 — Penarikan universe (tiket 07, `docs/universe-pull.md`)

- **`DATABASE_URL` kosong** (tidak ada Neon; agen tidak boleh membuat akun) → semua data, ledger, dan cache di **PGlite berkas `./.pglite`** (tidak di-track git). Jalur ke Neon tanpa kredit: `npm run db:migrate` → `npm run db:sync -- --from=pglite --to=neon`. **Blocker tiket 16.**
- **Kontrol = 30 pertama alfabetis dari 44 anggota LQ45 tanpa suspensi 2019–2026**, bukan peringkat market cap: screener tidak mengembalikan `market_cap` dan menolak `order_by` (HTTP 400). Memilih ulang berarti tarik ulang ±90 kredit — himpunan dikunci.
- **8 emiten 404 di `dates`** (COWL, SUGI, MABA, SKYB, KBRI, NUSA, RIMO, SIMA) dicantumkan eksplisit di `DIKETAHUI_404` agar tidak pernah dipanggil lagi (404 ditagih; cache 404 hanya 30 hari).
- 3 emiten pemantauan tanpa kejadian target (MENN, TGRA, WSKT) diperlakukan "tanpa kejadian" — dilewati mesin, tidak dihitung tertangkap.
- 5 emiten delisting memakai tanggal catatan publik (ENVY, LMAS, MTRA, SBAT, TELE) karena feed tidak memuat suspensinya.
- Rate limit 429 (gratis) ditangani dengan tunggu 20 s + jeda 450 ms antar panggilan berbayar.
- **Kredit tiket 07: 395** (ledger 68 → 463) dari anggaran revisi 433; run ulang 0 kredit (idempoten, dibuktikan). Sisa 537; cadangan juri 250 utuh → **§7.4 (sisa < 300) tidak terpicu**.

## 2026-09-07 — Agent diagnosis & perakit (tiket 08) dan provider LLM (tiket 08b)

- Vercel AI SDK v7: perakit = `generateText` + `Output.object(RuleSchema)` → `parseRule` ulang + sensor kata terlarang; diagnosis = loop tool-use `stopWhen: isStepCount(8)` dengan tools `listMissed`, `getSuspensions`, `getReportDates`, `getFilings`, `getCorporateActions`, `getFinancials`, `runAlarmOn`; `trace` disusun dari `result.steps` (tool call sungguhan), maksimal 2 usulan blok.
- **Pemilik tidak punya langganan Anthropic → DeepSeek jadi provider default** (`LLM_PROVIDER`, otomatis dari kunci yang ada). Alias `deepseek-chat`/`deepseek-reasoner` dipensiunkan DeepSeek 2026-07-24 → `deepseek-v4-flash` (default), `DEEPSEEK_REASONER=1` → `deepseek-v4-pro`. Opsi khusus Anthropic (adaptive thinking, cache prompt) hanya dipasang saat provider Anthropic.
- **Uji nyata dengan kunci belum pernah dijalankan**: `DEEPSEEK_API_KEY` dan `ANTHROPIC_API_KEY` kosong per 2026-09-07. Semua tes memakai model tiruan. Tanpa kunci, `/api/agent/*` menjawab 503 dan UI menampilkan banner.

## 2026-09-07 — Layar 2 & 1 (tiket 09, 10)

- Papan alarm dnd-kit dengan fallback klik/keyboard; `/api/backtest` memakai DB bila `DATABASE_URL` ada, selain itu fixture (belum PGlite).
- `getEventSource()` (Neon → PGlite → fixture) dipakai CLI backtest dan `/putar-ulang`.
- **Skor nyata pertama aturan default (PGlite, `--today=2026-09-07`)**: 26/74 tertangkap (delisting 6/18, pemantauan 20/56), lead rata-rata 9 bln / median 7, alarm palsu 1/30 (AADI), 3 dilewati. Sebab 12/18 delisting terlewat: data laporan mulai 2020 q1 dan 8 emiten 404.

## 2026-09-07 — Halaman metodologi & README juri (tiket 14)

- Snapshot skor di-commit sebagai `docs/skor-nyata.json` (keluaran persis `npm run backtest -- src/lib/engine/fixtures/aturan-default.json --today=2026-09-07 --json`; tanpa nama pemegang saham). Tes `tests/unit/docs/skor-nyata.test.ts` menghitung ulang dari `./.pglite` dan menuntut kesamaan ringkasan **dan** rincian per emiten; di-skip dengan pesan bila folder PGlite tidak ada.
- Halaman `/cara-kami-menghitung` membaca ambang dari konstanta mesin (`evaluate.ts`, `score.ts`) — tidak ada angka ambang yang ditulis tangan.
- Koreksi kecil: `docs/data-proof.md` menulis blok pertama `laporan_hilang` 17; snapshot menghitung **16** (16 + 9 + 1 = 26). Halaman memakai angka hasil hitung dari snapshot.
- Angka "jumlah investor" per emiten sengaja **tidak** ditulis di README karena tidak ada di PLAN/docs repo ini (semua fakta README harus bersumber dari repo).
- **§7.5 TERPICU**: `TELEGRAM_BOT_TOKEN` kosong (tiket 01) → tiket 12 memakai notifikasi in-app sebagai jalur utama; Telegram opsional.
- §7.6 (build Vercel gagal karena dependensi) belum relevan — deploy belum dilakukan.

## 2026-09-07 — Cron harian & notifikasi (tiket 12)

- Vercel Cron `30 23 * * *` (UTC = 06:30 WIB) → `GET /api/cron/jaga` dengan `Authorization: Bearer <CRON_SECRET>`; tanpa `CRON_SECRET` endpoint menjawab 503 (tidak pernah terbuka), header salah 401.
- **Cron hanya kelas A** (nol kredit Sectors) dan **penjelasan template** (tanpa LLM): batas fungsi Vercel Hobby 300 detik dan kredit/biaya tidak boleh terpakai tanpa sepengetahuan pengguna. Tes membuktikan `api_ledger` tidak bertambah selama cron.
- Bendera baru = perbandingan dengan `runs` terakhir pemilik (status memburuk atau alarm baru berbunyi); run baru selalu disimpan sehingga pemanggilan ganda Vercel (best-effort delivery) menghasilkan 0 pesan — idempoten tanpa tabel `sent_at`.
- **§7.5 dijalankan**: tabel baru `inbox` (kotak masuk in-app per `owner_token`, `read_at`) selalu ditulis; `GET/PATCH /api/inbox` dan halaman `/pasang` menggabungkannya dengan kotak masuk browser. Telegram (grammY 1.46, webhook `std/http`, tabel `telegram_links` chat_id → pemilik, perintah `/mulai <kode-portofolio>` & `/berhenti`) hanya aktif bila `TELEGRAM_BOT_TOKEN` **dan** `TELEGRAM_WEBHOOK_SECRET` terisi; tanpa itu webhook menjawab 503 sopan. Email (Resend) dari §7.5 tidak dibangun — in-app sudah memenuhi "tetap ada notifikasi" dan hemat satu dependensi/kunci.
- Kode portofolio untuk `/mulai` = id baris `portfolios` (UUID) — tidak perlu kolom kode pendek baru; ditampilkan di bagian kotak masuk.
- Pesan Telegram dikirim sebagai teks polos (tanpa parse_mode) agar tidak perlu escape; satu pesan per portofolio per pagi, dipecah < 4096 karakter, setiap potongan ditutup disclaimer. 403 (bot diblokir) → tautan dilepas otomatis.

## 2026-09-07 — Panduan, kamus, disclaimer (tiket 13)

- **Perbaikan temuan tiket 14**: `/api/backtest` (dan `/api/agent/diagnosis`) kini memilih sumber lewat `getEventSource()` (Neon → PGlite `./.pglite` → fixture), sama dengan CLI dan `/putar-ulang`; label UI "data Sectors nyata" hanya bila sumber DB/PGlite. Sebelumnya route hanya melihat `DATABASE_URL`, sehingga demo lokal selalu memakai fixture 8 emiten.
- Lapisan awam: overlay 3 langkah kunjungan pertama (localStorage `alarm-saham:panduan-selesai`), tombol Panduan, petunjuk bernomor per layar, tooltip `<Istilah>` buatan sendiri (tanpa dependensi), halaman `/kamus`; header & footer disclaimer dipasang sekali di layout akar (footer per halaman dihapus). Audit kata terlarang jadi tes (`tests/unit/copy/kata-terlarang.test.ts`) dengan pengecualian eksplisit "filing/transaksi/tipe jual".

## 2026-09-09 → 10 — Pengerasan sebelum deploy (tiket 15)

Delapan audit terpisah dijalankan lebih dulu (rahasia di riwayat, env vs kode, akurasi dokumen, kepatuhan aturan lomba, aksesibilitas & mode gelap, kode mati/WIP, CI & gerbang, kesiapan deploy), lalu temuannya dikerjakan. Keputusan yang perlu dicatat:

- **Jalur data contoh tidak boleh menyamar jadi data resmi.** Server tanpa `DATABASE_URL` dan tanpa `./.pglite` — persis kondisi deploy Vercel sekarang, karena `.pglite/` di-gitignore — jatuh ke fixture 8 emiten yang memuat **kode emiten nyata** dengan angka keuangan/filing ilustratif. `/putar-ulang` dulu menampilkannya di bawah kalimat "Semua yang tampil di sini adalah fakta dari data resmi" dan memberi tiap kejadian caption "Sumber: Sectors /v2/…". Sekarang penanda sumber dibawa dari `getEventSource()` sampai UI: pil `data contoh (bukan data Sectors nyata)` (`data-sumber="fixture"`), atribusi berubah menjadi "data contoh — fixture universe-kecil.json", tautan PDF dikosongkan, dan lede halaman mengaku server belum terhubung database. **Nama emiten di fixture sengaja TIDAK diganti** menjadi kode fiktif: tanggal suspensi dan daftar kuartal SRIL/TELE/GOLL mengikuti data nyata tiket 04, dan seluruh gerbang uji (e2e + integrasi `fromDb` vs `fromFixture`) bersandar pada simbol itu; bahaya sebenarnya ada pada atribusi, dan itulah yang ditutup.
- **Penyensor saran investasi memenggal kalimat, bukan kata.** Mengganti kata terlarang saja menyisakan bingkai anjuran utuh ("Sebaiknya [dihapus] sekarang"). Sekarang kalimat yang memuat kata terlarang **dan** kata pembingkai anjuran dibuang seluruhnya; frasa yang dulu hanya dilarang di prompt ("cut loss", "take profit", "saatnya masuk", "layak dikoleksi") kini punya penyaring. Untuk pesan jaga (masuk kotak masuk & Telegram), keluaran model yang tergelincir **tidak dipakai sama sekali** — kembali ke template deterministik.
- **Endpoint publik yang membelanjakan uang diberi pagar.** Cek kelas B wajib membawa tautan rahasia pemilik, maksimum 10 saham, `today` dari klien diabaikan di produksi (dulu bisa dipakai menggeser jendela tanggal demi melewati cache 24 jam dan membeli kredit baru tiap permintaan), dan **kelas B dilewati bila server tanpa database**: tanpa DB, buku kredit jatuh ke berkas, dan di serverless sistem berkasnya hanya-baca sehingga sisa kredit selalu terbaca penuh — pagar `SECTORS_CREDIT_RESERVE` tidak pernah menolak sementara pemakaian tidak tercatat. Pagar laju in-memory (`src/lib/api/pagar.ts`, tanpa dependensi baru) dipasang di route agent, cek portofolio, dan POST `/api/emiten`.
- **Kontras WCAG AA di kedua tema.** Token `--b-text` tidak pernah diredefinisi untuk mode gelap padahal latar bloknya dicerahkan; `text-white` dipakai di atas `--ok`/`--crit` yang berbalik pastel. Token terang `--ink-3` dan `--warn` juga gagal 4,5:1. Dipilih **menggelapkan warna latar** (bukan sekadar mengganti warna teks) karena hanya opsi itu yang sekaligus memperbaiki kegagalan mode terang. Dijaga `tests/e2e/aksesibilitas.spec.ts`: axe-core pada 6 halaman × 2 mode, plus dialog panduan dan tooltip istilah yang sebelumnya tidak pernah terpindai.
- **Gerbang harus bisa gagal.** Assertion e2e `toContainText("data Sectors nyata")` juga lulus pada jalur data contoh, karena teks `data contoh (bukan data Sectors nyata)` memuat substring itu — gerbang yang tidak bisa gagal. Sekarang label membawa atribut mesin `data-sumber="db"|"fixture"`. Tanggal e2e dipaku lewat `ALARM_HARI_INI=2026-09-07` supaya emiten kontrol di fixture tidak berubah hijau → kuning dengan sendirinya pada 2027-01-28.
- **Pemindai rahasia sekarang menutup riwayat, bukan hanya commit berikutnya.** `scripts/pola-rahasia.mjs` menjadi satu sumber pola untuk hook pre-commit dan `npm run scan:history` (nol dependensi: hanya Node + git; membaca semua blob termasuk yang tidak terjangkau ref). Pola bertambah: kunci gaya OpenAI/DeepSeek, AWS `AKIA`, `CRON_SECRET`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `DATABASE_URL` berisi nilai. `.env.example` **tidak lagi dikecualikan** (asumsi "nilainya kosong" sudah tidak benar); berkas contoh kini ditolak bila ada variabel berakhiran KEY/TOKEN/SECRET/PASSWORD/URL yang diberi nilai.
  - Ambang pola Anthropic dinaikkan dari 4 menjadi 20 karakter setelah awalan. Alasannya: riwayat repo ini memuat placeholder `sk-ant-` + empat huruf x di komentar versi lama `scripts/check-secrets.mjs` (commit `9158433`) — sudah diperiksa, isinya huruf x, bukan kunci. Kunci Anthropic sungguhan berbentuk `sk-ant-api03-` + ~95 karakter, jadi ambang 20 masih jauh di bawah kunci terpendek yang mungkin. Catatan jujur: laporan audit menyebut riwayat "nol kecocokan" untuk pola ini — ternyata tidak, dan pemindai barulah yang menemukannya.
  - Pola berbentuk NAMA=nilai kini menuntut nilai minimal 8 karakter dan tidak boleh didahului titik, supaya `process.env.X = y` di kode dan kalimat dokumentasi ("isi `CRON_SECRET=` di .env.local") tidak dianggap kebocoran.
- **CI menjalankan gerbang yang sebelumnya hanya lokal**: job `e2e` (Playwright chromium, jalur data contoh, laporan diunggah bila gagal) dan job `rahasia` (`scan:history` dengan `fetch-depth: 0`). `ALARM_TEST_DB=pglite` dipasang di job utama supaya tes integrasi skema tidak menarik image `postgres:16` dari Docker Hub setiap run. Tidak ada job yang butuh kunci, database, atau `./.pglite`.
- **`.env.example` memuat semua variabel yang dibaca kode**, termasuk enam yang dulu tidak terdokumentasi (`SECTORS_CREDIT_BUDGET`, `ALLOW_RESERVE`, `SECTORS_CACHE_DIR`, `SECTORS_BASE_URL`, `APP_URL`, `TANPA_PGLITE`) dan yang baru dari tiket ini (`ALARM_HARI_INI`, `ALARM_TEST_DB`, `E2E_*`), dengan bagian terpisah "hanya untuk pengembangan/tes — jangan diset di produksi". `SECTORS_CREDIT_BUDGET` paling berdampak: pagar cadangan dihitung dari angka itu (bawaan 1000).
- **README diselaraskan dengan keadaan kode, bukan dengan ingatan.** Audit dokumen menemukan README tertinggal dua tiket: ia menyangkal fitur yang sudah ada ("belum ada: mode pasang, notifikasi, cron") sambil memuat bab lengkap tentang cron di halaman yang sama, dan memuat tiga angka jumlah tes yang saling bertentangan (268 / 340 / "33 berkas, 267 tes"). Semua angka sekarang berasal dari satu run nyata yang dicatat tanggalnya (`npm test` 397 tes di 51 berkas; clone bersih 396 lulus + 1 di-skip; `npm run test:e2e` 44 tes), dan klaim kredit dipisah dengan benar: 395 kredit untuk penarikan universe, 467 total buku kredit (395 + 68 pembuktian data + 4 uji kelas B) — sebelumnya 463 ditulis seolah semuanya untuk penarikan universe, bertabrakan dengan dua tempat lain di README yang sama.
- **Fakta bursa di README sekarang punya tautan sumber.** Tiga angka yang melatarbelakangi produk (18 emiten dihapus efektif 10 November 2026 dengan jendela buyback 11 Mei – 9 November 2026; 59 emiten di Papan Pemantauan Khusus per 30 Juni 2026; 45.866 investor tercatat memegang SRIL saat dinyatakan akan dihapus, termasuk satu pemegang > 1 persen senilai Rp30,56 miliar) dulu ditulis tanpa satu tautan pun. Ditulis sebagai fakta bertanggal + tautan, tanpa kata menuduh dan tanpa penilaian atas emiten mana pun — sejalan dengan aturan (b). Ini menutup tugas yang tiket 14 sengaja gantung ("angka investor SRIL belum masuk README karena tidak ada di dokumen repo").
- **Bab "Deploy ke Vercel" baru**: tabel variabel lingkungan beserta akibat bila kosong, urutan yang benar (isi env → `db:migrate` → `db:sync --from=pglite --to=neon` → `pull-universe --dry` sebagai verifikasi 0 kredit → deploy → daftarkan webhook Telegram), dan peringatan paling penting: `./.pglite` di-gitignore sehingga data **tidak pernah ikut ter-deploy**, jadi server tanpa `DATABASE_URL` berjalan di atas data contoh — kini berlabel jujur, tetapi tetap tidak boleh ditunjukkan ke juri.
- **Risiko yang sengaja ditinggalkan** (dicatat agar tidak mengejutkan saat tiket 16): pagar laju hidup di memori tiap instance serverless, jadi ia meredam pengulangan cepat, bukan kuota global; `/api/agent/*` tetap publik (dibatasi laju, dan tetap 503 tanpa kunci) karena menambah gerbang rahasia akan mengubah perilaku demo juri; `?today=` masih bebas di jalur baca-saja yang nol kredit (dipakai demo dan e2e); dan fixture tetap memuat kode emiten nyata dengan sebagian angka ilustratif — ditutup di lapisan tampilan dan atribusi, bukan di berkas JSON-nya.

## Kunci & akun yang belum ada (status 2026-09-10, cek keberadaan nilai saja)

| Variabel | Status | Dampak |
|---|---|---|
| `SECTORS_API_KEY` | terisi | penarikan data selesai (buku kredit 467: 395 universe + 68 pembuktian data + 4 uji kelas B) |
| `DATABASE_URL` (Neon) | **kosong** | data hanya di PGlite lokal; blocker deploy production (tiket 16) |
| `DEEPSEEK_API_KEY` / `ANTHROPIC_API_KEY` | **kosong** | fitur AI belum diuji nyata; UI jalur 503 |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_WEBHOOK_SECRET` | **kosong** | §7.5: notifikasi in-app; jalur Telegram teruji dengan mock |
| `CRON_SECRET` | diisi saat deploy | tanpa itu `/api/cron/jaga` menjawab 503 |
| `vercel login` | belum diverifikasi | sebelum tiket 16 |
