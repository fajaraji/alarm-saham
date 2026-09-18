# 21: Hasil uji yang langsung menjawab

**What to build:** Setelah Uji ke masa lalu di layar rakit alarm, yang pertama terbaca adalah satu kalimat jawaban: berapa saham kena yang tertangkap, rata-rata berapa bulan lebih awal, dan berapa alarm palsu pada saham sehat. Di bawahnya daftar nama saham yang tertangkap. Grid per kelompok tetap tersedia tetapi terlipat. Keadaan kosong, sedang menguji, galat, dan hasil basi (papan sudah berubah) tetap terbaca. Sumber: feedback gelombang 1, poin 4.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Kalimat jawaban memakai angka dari hasil uji yang sama dengan kotak skor, bukan angka yang dihitung ulang terpisah
- [ ] Daftar saham tertangkap hanya berisi saham kena yang alarmnya berbunyi sebelum kejadian targetnya
- [ ] Grid per kelompok terlipat secara bawaan dan bisa dibuka dengan keyboard
- [ ] Hasil dengan nol saham tertangkap menampilkan kalimat yang masuk akal, bukan daftar kosong
- [ ] `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` exit 0; e2e jalur database dan jalur data contoh lulus
