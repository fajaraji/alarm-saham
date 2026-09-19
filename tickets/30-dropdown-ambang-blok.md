# 30: Ambang blok dipilih lewat dropdown

**What to build:** Di /rakit, ambang tiap blok (longgar atau ketat) sekarang berupa chip yang berganti saat diklik, sehingga pengguna tidak tahu pilihan lainnya sebelum mengklik. Chip diganti dropdown yang menampilkan kedua pilihan beserta artinya. Sumber: feedback gelombang 2 (halaman kedua, dropdown parameter blok).

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Setiap blok di papan punya dropdown ambang berlabel yang menampilkan kedua pilihan
- [ ] Memilih ambang mengubah aturan dan menandai hasil uji lama sebagai basi, seperti chip sebelumnya
- [ ] Dropdown bisa dipakai dengan keyboard dan lolos axe di tema terang dan gelap
- [ ] `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` exit 0; e2e jalur database dan jalur data contoh lulus
