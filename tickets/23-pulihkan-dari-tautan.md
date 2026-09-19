# 23: Pulihkan portofolio dari tautan rahasia

**What to build:** Kunci pemilik portofolio bisa dibawa sebagai tautan. Membuka tautan itu di browser lain memunculkan portofolio dan alarm yang tersimpan di server untuk kunci itu. Bila browser itu sudah memegang kunci lain yang berbeda, pengguna ditanya dulu sebelum kuncinya diganti. Kunci tidak ikut terkirim ke server sebagai bagian dari alamat halaman, dan dihapus dari bilah alamat setelah dibaca. Alarm yang hanya tersimpan di browser (server tanpa database) tidak bisa dipulihkan dan hal itu dikatakan terus terang. Sumber: feedback gelombang 1, poin 6.

**Blocked by:** None (can start immediately)

**Status:** selesai. Kunci di fragment #kunci= (tidak terkirim ke server), dihapus dari bilah alamat lewat history.replaceState. Tes UI dan e2e tautan.spec.ts: browser tanpa kunci, browser dengan kunci lain (Batal dan Escape tidak mengubah apa pun, Ganti memulihkan), kunci tidak sah, server tanpa database, dan tautan yang ditempel saat /pasang sudah terbuka.

- [x] Membuka tautan di browser tanpa kunci langsung memakai kunci dari tautan
- [x] Membuka tautan di browser dengan kunci berbeda menampilkan konfirmasi; membatalkan tidak mengubah apa pun
- [x] Kunci yang tidak valid ditolak dengan pesan, tidak disimpan
- [x] Setelah dibaca, kunci hilang dari bilah alamat
- [x] `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` exit 0; e2e jalur database dan jalur data contoh lulus
