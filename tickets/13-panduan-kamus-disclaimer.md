# 13: Panduan, kamus istilah, disclaimer

**What to build:** Lapisan "untuk orang awam" di seluruh aplikasi: overlay panduan 3 langkah saat kunjungan pertama (bisa dibuka lagi lewat tombol Panduan), tiga petunjuk bernomor di atas tiap layar, tooltip kamus untuk setiap istilah (suspensi, delisting, laporan telat, filing orang dalam, ekuitas negatif, ritel dominan, free float, alarm palsu, papan pemantauan khusus) dengan penjelasan perumpamaan, halaman Kamus, dan disclaimer "Alarm Saham adalah alat informasi, bukan saran investasi" di footer setiap layar dan di setiap pesan keluar.

**Blocked by:** 09 (Layar 2), 10 (Layar 1), 11 (Layar 3)

**Status:** ready-for-agent

- [ ] Uji end-to-end: kunjungan pertama menampilkan panduan; setelah ditutup tidak muncul lagi; tombol Panduan membukanya kembali
- [ ] Setiap istilah dalam daftar punya tooltip (tes: render tiap layar, cari istilah tanpa tooltip → 0)
- [ ] Disclaimer ada di footer semua halaman dan di template pesan Telegram/in-app (tes)
- [ ] `npm run lint`, `npm test`, `npm run build` exit 0
