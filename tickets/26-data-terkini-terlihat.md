# 26: Hasil "data terkini" yang terlihat

**What to build:** Saat pengguna mencentang "data terkini" di layar pasang, setiap saham menampilkan dua temuan dalam kalimat biasa: apakah pembeli 14 hari terakhir didominasi ritel sementara institusi melepas, dan berapa persen harga penutupan terakhir di bawah harga tertinggi 90 hari. Nama mesin seperti ritel_dominan tidak pernah tampil. Saham yang dilewati (misalnya sedang disuspensi) menyebut alasannya. Opsi free float dibuang dari layar. Sumber: feedback gelombang 1, poin 8.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Hasil kelas B tampil per saham dalam kalimat biasa berikut angkanya
- [ ] Tidak ada nama mesin blok kelas B di teks yang dilihat pengguna
- [ ] Opsi free float tidak ada di layar
- [ ] Tes memakai data tiruan dan tidak memakai satu kredit Sectors pun
- [ ] `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` exit 0; e2e jalur database dan jalur data contoh lulus
