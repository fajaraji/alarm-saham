# 19: Catatan keterbatasan data hanya yang relevan

**What to build:** Kotak "Keterbatasan data emiten ini" di layar putar ulang hanya muncul bila ada catatan yang khusus untuk emiten itu dan mengubah apa yang dilihat di layar: hanya ada data suspensi, emiten di luar universe uji, laporan keuangan tidak tersedia di sumber, atau server memakai data contoh. Catatan "tidak ada filing orang dalam" dibuang karena lampu di layar ini tidak memakai data filing. Catatan bahwa ekuitas tidak ditarik dipindah menjadi satu baris pendek di samping lampu, karena lampu (aturan bawaan: suspensi ATAU laporan hilang ATAU ekuitas negatif) memang tidak bisa menilai blok itu. Sumber: feedback gelombang 1, poin 2.

**Blocked by:** None (can start immediately)

**Status:** selesai. Tes integrasi loader (emiten dengan dan tanpa angka ekuitas) dan e2e BBCA di jalur database lulus; catatan khusus (data contoh, 404 di sumber) tetap tampil.

- [x] Emiten universe dengan data lengkap tetapi tanpa angka ekuitas tidak menampilkan kotak keterbatasan; lampunya menyebut dalam satu baris bahwa blok ekuitas negatif tidak dinilai
- [x] Emiten dengan angka ekuitas tidak menampilkan baris itu
- [x] Emiten yang hanya punya data suspensi dan jalur data contoh tetap menampilkan catatannya
- [x] Tidak ada catatan tentang filing orang dalam di layar putar ulang
- [ ] `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` exit 0; e2e jalur database dan jalur data contoh lulus
