# 13: Panduan, kamus istilah, disclaimer

**What to build:** Lapisan "untuk orang awam" di seluruh aplikasi: overlay panduan 3 langkah saat kunjungan pertama (bisa dibuka lagi lewat tombol Panduan), tiga petunjuk bernomor di atas tiap layar, tooltip kamus untuk setiap istilah (suspensi, delisting, laporan telat, filing orang dalam, ekuitas negatif, ritel dominan, free float, alarm palsu, papan pemantauan khusus) dengan penjelasan perumpamaan, halaman Kamus, dan disclaimer "Alarm Saham adalah alat informasi, bukan saran investasi" di footer setiap layar dan di setiap pesan keluar.

**Blocked by:** 09 (Layar 2), 10 (Layar 1), 11 (Layar 3)

**Status:** done — diverifikasi 2026-09-07 di worktree t13 (lint/typecheck/test/build exit 0; 328 tes; 22 e2e). Termasuk perbaikan temuan tiket 14: `/api/backtest` & `/api/agent/diagnosis` memakai `getEventSource()` (PGlite/Neon) — e2e membuktikan label "data Sectors nyata", 104 saham, 3 dilewati (MENN, TGRA, WSKT). Audit kata terlarang otomatis (`tests/unit/copy/kata-terlarang.test.ts`).

- [x] Uji end-to-end: kunjungan pertama menampilkan panduan; setelah ditutup tidak muncul lagi; tombol Panduan membukanya kembali
- [x] Setiap istilah dalam daftar punya tooltip/definisi kamus (14 istilah; tes memindai daftar vs komponen)
- [x] Disclaimer ada di footer semua halaman (layout) dan di template pesan in-app/Telegram (tes tiket 11/12)
- [x] `npm run lint`, `npm test`, `npm run build` exit 0
