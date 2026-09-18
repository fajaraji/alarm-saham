# 20: Tombol Sebelumnya / Berikutnya antar langkah

**What to build:** Di bawah halaman Putar ulang, Rakit alarm, dan Pasang ada tombol untuk pindah ke langkah sebelumnya dan berikutnya, menyebut nama langkah tujuannya. Langkah pertama tidak punya tombol sebelumnya, langkah terakhir tidak punya tombol berikutnya. Urutan dan nama langkah diambil dari sumber yang sama dengan navigasi header, supaya keduanya tidak bisa berbeda. Sumber: feedback gelombang 1, poin 3.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Ketiga halaman langkah menampilkan tombol yang benar dan tombolnya membawa ke halaman yang disebut
- [ ] Tombol bisa dipakai dengan keyboard dan punya fokus yang terlihat, lolos axe di tema terang dan gelap
- [ ] Tidak ada gulir mendatar di ponsel 375px
- [ ] `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` exit 0; e2e jalur database dan jalur data contoh lulus
