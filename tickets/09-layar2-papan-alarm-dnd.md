# 09: Layar 2 — papan alarm drag-and-drop + hasil uji

**What to build:** Halaman "Rakit alarm" yang bekerja end-to-end di browser: kotak blok di kiri, papan alarm KALAU…MAKA di tengah dengan **drag-and-drop dnd-kit** (seret dari kotak, urutkan ulang, seret ke area buang; klik juga bisa untuk aksesibilitas), tombol ATAU/DAN di antara blok, klik ambang untuk memperketat, kotak "Minta AI rakit" yang memanggil perakit (tiket 08), tombol "Uji ke masa lalu" yang memanggil mesin uji (tiket 06) pada data DB, panel hasil (tertangkap/lebih awal/alarm palsu + tiga baris kotak per kelompok universe, kotak kasus nyata ditandai), dan panel AI diagnosis dengan tombol "tambahkan blok" yang langsung mengubah papan lalu menguji ulang. Aturan tersimpan per tautan rahasia.

**Blocked by:** 06 (Mesin uji), 08 (Agent diagnosis)

**Status:** done — diverifikasi 2026-09-07 di worktree t09 (lint/typecheck/test/build exit 0; 173 tes unit; 3 e2e Playwright lulus; route /rakit, /api/backtest, /api/alarms). Panel AI teruji dengan banner 503 (belum ada kunci LLM); alur "usulan AI → papan → uji ulang" teruji dengan mock.

- [x] Uji komponen: seret blok masuk/keluar/urut; ATAU↔DAN; ambang; state aturan sesuai skema
- [x] Uji end-to-end (Playwright): rakit 2 blok → buang → ATAU→DAN → uji → hasil tampil → panel AI (503 tanpa kunci)
- [x] Bekerja dengan keyboard dan sentuh (klik-untuk-tambah sebagai fallback)
- [x] Mode gelap & terang keduanya terbaca (screenshot Playwright)
- [x] `npm run lint`, `npm test`, `npm run build` exit 0
