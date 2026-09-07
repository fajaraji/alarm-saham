# 14: Halaman "Cara kami menghitung" + README untuk juri

**What to build:** Halaman publik yang menjelaskan metodologi dengan jujur: definisi tiap blok dan ambangnya, definisi "berbunyi", "lebih awal", "alarm palsu", universe uji (18/59/30) dan cara memilih kontrol, aturan anti-lookahead, keterbatasan (survivorship, kedalaman data per endpoint dari `docs/data-proof.md`), dan kredit Sectors yang terpakai. README repo untuk juri: masalah & pengguna, arsitektur (diagram alur agent diagnosis dan tool-nya, lapisan data, cache & buku kredit), cara menjalankan, cara mereproduksi skor (`npm run backtest`), dan daftar endpoint Sectors yang dipakai + kenapa. `docs/decisions.md` mencatat keputusan & aturan cadangan yang terpicu.

**Blocked by:** 07 (Penarikan universe), 09 (Layar 2)

**Status:** done — diverifikasi 2026-09-07 di worktree t14 (lint/typecheck/test/build exit 0; 268 tes termasuk hitung-ulang snapshot dari PGlite; 11 e2e; uji clone bersih lulus). Catatan agen: `/rakit` "Uji ke masa lalu" masih memakai fixture saat `DATABASE_URL` kosong (`/api/backtest` belum memakai `getEventSource()`) → diperbaiki di tiket 13. Angka "45.866 investor SRIL" belum masuk README karena tidak ada di dokumen repo → tambahkan dengan sumber di tiket 15.

- [x] Halaman metodologi tayang dan angka di dalamnya sama dengan output `npm run backtest` (tes membandingkan snapshot docs/skor-nyata.json vs hitung ulang PGlite)
- [x] README memuat perintah yang benar-benar berjalan (diuji dari clone bersih: npm ci → test 267 lulus + 1 skip → backtest fixture)
- [x] Diagram arsitektur tampil di README (Mermaid)
- [x] `npm run lint`, `npm test`, `npm run build` exit 0
