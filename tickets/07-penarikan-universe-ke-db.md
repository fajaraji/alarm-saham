# 07: Penarikan universe uji ke database

**What to build:** Perintah yang menarik data kelas A untuk seluruh universe uji — 18 emiten delisting Nov 2026, 59 emiten papan pemantauan khusus per 30 Jun 2026, dan 30 emiten kontrol sehat (anggota LQ45 tanpa riwayat suspensi 2019–2026, dipilih dari data suspensi universe) — ke DB, sesuai anggaran PLAN.md §5, **idempoten** (menjalankan dua kali tidak menambah kredit), dengan laporan kredit terpakai sebelum/sesudah dan tanggal kejadian target per emiten kena. Setelah selesai, mesin uji (tiket 06) dijalankan ke data nyata dan skor nyata pertama tercatat di `docs/data-proof.md`.

**Blocked by:** 03 (Klien Sectors), 04 (Pembuktian data), 05 (Skema database)

**Status:** done — diverifikasi 2026-09-07 (lint/typecheck/test/build exit 0; 117 tes; ledger 68→463, tiket 07 = 395 dari anggaran 433; dry-run pasca 0 kredit). **Catatan:** data tersimpan di PGlite lokal karena `DATABASE_URL` kosong; `npm run db:sync -- --from=pglite --to=neon` siap (teruji PGlite→PGlite) — dijalankan saat Neon tersedia (blocker tiket 16). Skor nyata `npm run backtest` dipindah ke tiket 14 (butuh integrasi CLI backtest ↔ PGlite).

- [x] Penarikan selesai dengan total kredit ≤ anggaran yang direvisi tiket 04 (bukti: buku kredit sebelum/sesudah)
- [x] Menjalankan perintah kedua kali: 0 kredit baru (bukti)
- [x] Tabel `symbols` memuat 107 emiten dengan kelompok (delisting/pemantauan/kontrol) dan tanggal kejadian target (3 watchlist tanpa target: MENN, TGRA, WSKT)
- [ ] `npm run backtest` skor nyata → dipindah ke tiket 14
- [x] `npm run lint`, `npm test`, `npm run build` exit 0
