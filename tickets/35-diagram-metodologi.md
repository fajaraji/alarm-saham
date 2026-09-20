# 35: Diagram cara uji ke masa lalu

**What to build:** Halaman /cara-kami-menghitung menjelaskan cara menguji alarm ke masa lalu hanya dengan teks. Tambahkan satu diagram linimasa (SVG di halaman, mengikuti token warna di kedua tema) yang menunjukkan pemeriksaan tiap akhir bulan, data yang boleh dipakai sampai tanggal t, bunyi pertama, kejadian target, dan jarak "lebih awal". Diagram punya teks alternatif yang setara. Sumber: feedback gelombang 2 (cara kami menghitung, tambah diagram).

**Blocked by:** None (can start immediately)

**Status:** ditunda (2026-09-20). Pemilik memilih mendahulukan temuan kritis audit produksi (cron, data beku, "Cek sekarang" 504, label keliru) sebelum tenggat 30 Sep; tiket ini dikerjakan bila waktu tersisa.

- [ ] Diagram tampil di bagian "Apa yang sebenarnya dihitung" dan terbaca di tema terang dan gelap
- [ ] Diagram punya judul dan deskripsi yang bisa dibaca pembaca layar
- [ ] Tidak ada gulir mendatar di lebar 375 px
- [ ] `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` exit 0; e2e jalur database dan jalur data contoh lulus
