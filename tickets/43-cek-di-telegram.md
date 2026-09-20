# 43: Cek satu saham langsung di Telegram

**What to build:** Tip saham datang di grup Telegram, jadi ceknya paling mungkin dipakai di aplikasi yang sama. Orang yang baru dengar satu kode tidak akan membuka situs, membuat portofolio, lalu merakit blok. Perintah `/cek <KODE>` menjawab satu saham langsung di chat dengan bahasa awam, nol kredit Sectors (hanya data kelas A yang sudah ada di database), dan selalu menyebut tanggal data. Sumber: saran pemilik 20 Sep 2026 sesudah audit.

**Blocked by:** None

**Status:** selesai. `jawabanCek` memakai template penjelasan yang sama dengan layar Pasang dan kotak masuk pagi, ditambah kalimat tanggal penarikan data. Penjawabnya disuntik ke `buatBot`, jadi tes bot tidak menarik mesin evaluasi maupun database.

- [x] `/cek BBCA` menjawab status, syarat yang terpenuhi, tanggal, dan sumbernya
- [x] Kode ngawur dan kode kosong dijawab sopan, tanpa menjalankan evaluasi
- [x] Saham di luar data kami dijawab "belum bisa dinilai", bukan "aman"
- [x] Nol kredit Sectors: kelas B tidak dipanggil
- [x] `npm run lint`, `npm run typecheck`, `npm test` exit 0
