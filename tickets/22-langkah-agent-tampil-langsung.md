# 22: Langkah agent diagnosis tampil langsung

**What to build:** Setelah pengguna menekan Minta diagnosis AI, panel AI menampilkan setiap alat yang dipanggil agent begitu alat itu selesai (misalnya memeriksa suspensi satu emiten), lalu jawaban akhir diagnosis. Pengguna tidak lagi menatap satu kalimat "sedang memeriksa" selama 60 sampai 240 detik tanpa kabar. Jejak langkah yang tampil langsung tetap berasal dari pemanggilan alat yang sungguhan, sama dengan jejak di jawaban akhir. Jalur dua fase lewat gateway tetap bekerja. Galat di tengah jalan (gateway penuh, tanpa jawaban terstruktur, kunci AI tidak ada, terlalu sering) terbaca sebagai pesan, tidak membuat panel menggantung. Sumber: feedback gelombang 1, poin 5.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Tes dengan model tiruan membuktikan setiap langkah terkirim ke klien sebelum jawaban akhir
- [ ] Jejak langsung dan jejak di jawaban akhir identik
- [ ] Jawaban 503 tanpa kunci AI dan 429 terlalu sering tetap dikenali panel seperti sebelumnya
- [ ] Galat setelah sebagian langkah terkirim ditampilkan sebagai pesan dan panel kembali bisa dipakai
- [ ] Tidak memanggil model sungguhan di tes
- [ ] `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` exit 0; e2e jalur database dan jalur data contoh lulus
