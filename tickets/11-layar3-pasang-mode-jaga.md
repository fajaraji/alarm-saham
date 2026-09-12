# 11: Layar 3 — pasang & mode jaga

**What to build:** Halaman "Pasang": portofolio per tautan rahasia (UUID di URL, tanpa login), tambah/hapus saham, daftar alarm terpasang (dari tiket 09 + alarm bawaan), dan tombol "cek sekarang" yang mengevaluasi setiap saham: blok kelas A dari DB, blok kelas B (ritel dominan, free float kecil, IPO jatuh) dari Sectors **dengan cache 24 jam** dan tunduk pada cadangan kredit. Hasilnya peta portofolio hijau/kuning/merah dan, untuk yang berbunyi, pesan penjelasan (dihasilkan `claude-sonnet-5`, model tiruan di tes) yang menyebut syarat mana yang terpenuhi + sumber + disclaimer.

**Blocked by:** 07 (Penarikan universe), 09 (Layar 2)

**Status:** done — diverifikasi 2026-09-07 di worktree t11 (lint/typecheck/test/build exit 0; 299 tes; 11 e2e). Uji nyata kelas B sekali (BBCA, ASII): ledger 463→467 (4 kredit), pengulangan 0 kredit (cache). Free float memakai sub-toggle terpisah (10 kredit/24 jam), default mati.

- [x] Uji: portofolio tersimpan & dimuat ulang lewat tautan; saham ganda ditolak
- [x] Uji: evaluasi kelas A memakai DB tanpa panggilan API (ledger tidak bertambah)
- [x] Uji: evaluasi kelas B memakai cache saat dipanggil dua kali dalam 24 jam (ledger bertambah sekali)
- [x] Pesan penjelasan tidak memuat kata beli/jual/rekomendasi (tes string)
- [x] `npm run lint`, `npm test`, `npm run build` exit 0
