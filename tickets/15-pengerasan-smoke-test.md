# 15: Pengerasan & smoke test (gerbang sebelum deploy)

**What to build:** Aplikasi siap dinilai: mode gelap/terang konsisten di semua layar, aksesibilitas dasar (fokus keyboard terlihat, label ARIA pada kontrol drag-and-drop, kontras), tes smoke Playwright yang menjalankan alur 1→2→3 dari awal (cari SRIL → rakit 2 blok → uji → pasang ke portofolio → cek sekarang) di build production lokal, pemindaian rahasia di seluruh riwayat git bersih, dan CI menjalankan lint + test + build + smoke.

**Blocked by:** 12 (Cron + Telegram), 13 (Panduan/kamus), 14 (Metodologi/README)

**Status:** done — diverifikasi 2026-09-10 (lint/typecheck/build exit 0; **665 tes unit**; e2e **51 lulus** jalur database + **49 lulus** jalur data contoh; `scan:history` 0 temuan dari 594 blob pada 69 commit).

Dikerjakan dalam 6 putaran: audit 8 lensa (64 temuan), penutupan 7 keberatan serius, 4 keberatan putaran 2, lalu rancang ulang penjaga aturan lomba (b). Temuan paling berharga justru dari pemeriksa adversarial:
- `/putar-ulang` sempat melabeli data contoh sebagai data resmi Sectors → klaim sumber kini bercabang di semua permukaan (footer, panduan, beranda, pasang) dengan penanda mesin, bukan teks.
- CI hanya menguji jalur yang **tidak** akan dideploy → ditambah job `e2e-db` dengan benih data nyata yang di-commit (464 KB), bukan salinan PGlite 57 MB.
- `ALARM_HARI_INI` bisa membekukan waktu di produksi tanpa suara → dipagari `NODE_ENV` + kunci kedua eksplisit + peringatan.
- Endpoint publik tanpa pembatas laju, dan ember-nya sempat dipakai bersama antar-operasi → dipisah per jenis operasi, kunci ditentukan server.
- Penyensor saran investasi terbukti **daftar kata, bukan penilai subjek** (bocor 60/65 sekaligus memakan 41/83 kalimat sah, termasuk `usulanBlok[].alasan`) → diganti tiga lapis: instruksi sistem sebagai kontrol utama, keluaran terstruktur, dan backstop frasa presisi-tinggi yang **menandai** alih-alih menggunting. Presisi **106/106 = 100%** (gerbang keras), recall **56/101 = 55,4%** dilaporkan apa adanya di README, halaman metodologi, dan `docs/penjaga-frasa.json`. Klaim lama bahwa penyaring memblokir semua kalimat beranjuran **dibatalkan**.

- [x] `npm run build` lalu `npm start` + Playwright smoke: lulus (alur /putar-ulang → /rakit → /pasang → metodologi → kamus, 0 `console.error`)
- [x] Pemindaian rahasia pada seluruh riwayat: 0 temuan (`npm run scan:history`; gitleaks tidak tersedia di mesin ini)
- [x] axe pada 6 halaman × mode terang & gelap: 0 pelanggaran serious/critical (kontras token diperbaiki, 24 pasangan ≥ 4,5:1)
- [x] CI: job `verify`, `e2e` (jalur data contoh), `e2e-db` (jalur database), dan pemindai rahasia
- [x] Tidak ada `console.error` saat menjalankan alur smoke
