# 26: Hasil "data terkini" yang terlihat

**What to build:** Saat pengguna mencentang "data terkini" di layar pasang, setiap saham menampilkan dua temuan dalam kalimat biasa: apakah pembeli 14 hari terakhir didominasi ritel sementara institusi melepas, dan berapa persen harga penutupan terakhir di bawah harga tertinggi 90 hari. Nama mesin seperti ritel_dominan tidak pernah tampil. Saham yang dilewati (misalnya sedang disuspensi) menyebut alasannya. Opsi free float dibuang dari layar. Sumber: feedback gelombang 1, poin 8.

**Blocked by:** None (can start immediately)

**Status:** selesai. Kalimat disusun dari angka mentah (HasilBlokB.ukuran) di lib/jaga/kalimat-b.ts; dipakai layar Pasang dan template pesan. Tes memakai evaluator murni dan fetch tiruan: nol panggilan Sectors. Free float dibuang dari layar dan dari alarm bawaan.

- [x] Hasil kelas B tampil per saham dalam kalimat biasa berikut angkanya
- [x] Tidak ada nama mesin blok kelas B di teks yang dilihat pengguna
- [x] Opsi free float tidak ada di layar
- [x] Tes memakai data tiruan dan tidak memakai satu kredit Sectors pun
- [x] `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` exit 0; e2e jalur database dan jalur data contoh lulus
