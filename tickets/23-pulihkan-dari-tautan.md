# 23: Pulihkan portofolio dari tautan rahasia

**What to build:** Kunci pemilik portofolio bisa dibawa sebagai tautan. Membuka tautan itu di browser lain memunculkan portofolio dan alarm yang tersimpan di server untuk kunci itu. Bila browser itu sudah memegang kunci lain yang berbeda, pengguna ditanya dulu sebelum kuncinya diganti. Kunci tidak ikut terkirim ke server sebagai bagian dari alamat halaman, dan dihapus dari bilah alamat setelah dibaca. Alarm yang hanya tersimpan di browser (server tanpa database) tidak bisa dipulihkan dan hal itu dikatakan terus terang. Sumber: feedback gelombang 1, poin 6.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Membuka tautan di browser tanpa kunci langsung memakai kunci dari tautan
- [ ] Membuka tautan di browser dengan kunci berbeda menampilkan konfirmasi; membatalkan tidak mengubah apa pun
- [ ] Kunci yang tidak valid ditolak dengan pesan, tidak disimpan
- [ ] Setelah dibaca, kunci hilang dari bilah alamat
- [ ] `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` exit 0; e2e jalur database dan jalur data contoh lulus
