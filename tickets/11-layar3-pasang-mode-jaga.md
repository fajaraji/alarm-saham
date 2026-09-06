# 11: Layar 3 — pasang & mode jaga

**What to build:** Halaman "Pasang": portofolio per tautan rahasia (UUID di URL, tanpa login), tambah/hapus saham, daftar alarm terpasang (dari tiket 09 + alarm bawaan), dan tombol "cek sekarang" yang mengevaluasi setiap saham: blok kelas A dari DB, blok kelas B (ritel dominan, free float kecil, IPO jatuh) dari Sectors **dengan cache 24 jam** dan tunduk pada cadangan kredit. Hasilnya peta portofolio hijau/kuning/merah dan, untuk yang berbunyi, pesan penjelasan (dihasilkan `claude-sonnet-5`, model tiruan di tes) yang menyebut syarat mana yang terpenuhi + sumber + disclaimer.

**Blocked by:** 07 (Penarikan universe), 09 (Layar 2)

**Status:** ready-for-agent

- [ ] Uji: portofolio tersimpan & dimuat ulang lewat tautan; saham ganda ditolak
- [ ] Uji: evaluasi kelas A memakai DB tanpa panggilan API (ledger tidak bertambah)
- [ ] Uji: evaluasi kelas B memakai cache saat dipanggil dua kali dalam 24 jam (ledger bertambah sekali)
- [ ] Pesan penjelasan tidak memuat kata beli/jual/rekomendasi (tes string)
- [ ] `npm run lint`, `npm test`, `npm run build` exit 0
