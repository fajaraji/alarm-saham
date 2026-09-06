# 07: Penarikan universe uji ke database

**What to build:** Perintah yang menarik data kelas A untuk seluruh universe uji — 18 emiten delisting Nov 2026, 59 emiten papan pemantauan khusus per 30 Jun 2026, dan 30 emiten kontrol sehat (anggota LQ45 tanpa riwayat suspensi 2019–2026, dipilih dari data suspensi universe) — ke DB, sesuai anggaran PLAN.md §5, **idempoten** (menjalankan dua kali tidak menambah kredit), dengan laporan kredit terpakai sebelum/sesudah dan tanggal kejadian target per emiten kena. Setelah selesai, mesin uji (tiket 06) dijalankan ke data nyata dan skor nyata pertama tercatat di `docs/data-proof.md`.

**Blocked by:** 03 (Klien Sectors), 04 (Pembuktian data), 05 (Skema database)

**Status:** ready-for-agent

- [ ] Penarikan selesai dengan total kredit ≤ anggaran yang direvisi tiket 04 (bukti: buku kredit sebelum/sesudah)
- [ ] Menjalankan perintah kedua kali: 0 kredit baru (bukti)
- [ ] Tabel `symbols` memuat 107 emiten dengan kelompok (delisting/pemantauan/kontrol) dan tanggal kejadian target
- [ ] `npm run backtest` dengan aturan default menghasilkan skor nyata; angkanya dicatat di `docs/data-proof.md`
- [ ] `npm run lint`, `npm test`, `npm run build` exit 0
