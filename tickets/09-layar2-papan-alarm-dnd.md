# 09: Layar 2 — papan alarm drag-and-drop + hasil uji

**What to build:** Halaman "Rakit alarm" yang bekerja end-to-end di browser: kotak blok di kiri, papan alarm KALAU…MAKA di tengah dengan **drag-and-drop dnd-kit** (seret dari kotak, urutkan ulang, seret ke area buang; klik juga bisa untuk aksesibilitas), tombol ATAU/DAN di antara blok, klik ambang untuk memperketat, kotak "Minta AI rakit" yang memanggil perakit (tiket 08), tombol "Uji ke masa lalu" yang memanggil mesin uji (tiket 06) pada data DB, panel hasil (tertangkap/lebih awal/alarm palsu + tiga baris kotak per kelompok universe, kotak kasus nyata ditandai), dan panel AI diagnosis dengan tombol "tambahkan blok" yang langsung mengubah papan lalu menguji ulang. Aturan tersimpan per tautan rahasia.

**Blocked by:** 06 (Mesin uji), 08 (Agent diagnosis)

**Status:** ready-for-agent

- [ ] Uji komponen: seret blok masuk/keluar/urut; ATAU↔DAN; ambang; state aturan sesuai skema
- [ ] Uji end-to-end (Playwright): rakit 2 blok → uji → hasil tampil → klik usulan AI (model tiruan) → papan berubah → uji ulang
- [ ] Bekerja dengan keyboard dan sentuh (klik-untuk-tambah sebagai fallback)
- [ ] Mode gelap & terang keduanya terbaca
- [ ] `npm run lint`, `npm test`, `npm run build` exit 0
