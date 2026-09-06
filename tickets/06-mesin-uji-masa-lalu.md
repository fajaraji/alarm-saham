# 06: Mesin uji-ke-masa-lalu

**What to build:** Inti produk. Sebuah skema aturan alarm (daftar blok kelas A dengan ambang longgar/ketat, digabung ATAU/DAN) dan mesin yang, untuk satu emiten dan satu tanggal `t`, menjawab "apakah alarm berbunyi pada `t`" memakai **hanya data bertanggal ≤ t**. Di atasnya, fungsi skor yang menjalankan aturan ke universe uji (emiten "kena" dengan tanggal kejadian target + emiten kontrol sehat) dan mengembalikan: jumlah tertangkap, rata-rata bulan lebih awal (kejadian − bunyi pertama), jumlah alarm palsu, serta rincian per emiten. Semua dari data di DB/fixture, nol panggilan API. Tes otomatis memakai fixture kecil (≥3 emiten kena, ≥3 kontrol) yang membuktikan tidak ada lookahead: menggeser tanggal kejadian ke belakang harus mengubah hasil secara deterministik.

Blok kelas A mengikuti keputusan tiket 04 (default PLAN.md §3: laporan telat, suspensi, orang dalam menjual, aksi korporasi dilutif, utang > harta).

**Blocked by:** 04 (Pembuktian data — daftar blok final), 05 (Skema database)

**Status:** ready-for-agent

- [ ] Skema aturan divalidasi Zod; aturan tidak valid ditolak dengan pesan jelas
- [ ] Tes: tiap blok terpicu/tidak sesuai fixture; ATAU vs DAN; ambang longgar vs ketat; anti-lookahead
- [ ] Tes reproduktif: skor untuk aturan contoh pada fixture selalu identik (snapshot)
- [ ] CLI `npm run backtest -- <file-aturan.json>` mencetak skor + rincian per emiten dari DB atau fixture
- [ ] `npm run lint`, `npm test`, `npm run build` exit 0
