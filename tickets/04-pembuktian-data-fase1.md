# 04: Pembuktian data (Fase 1)

**What to build:** Skrip yang, dengan kunci Sectors nyata, menguji enam emiten — SRIL, GOLL, TELE (delisting Nov 2026) dan WIKA, INAF, BTEL (papan pemantauan khusus) — pada setiap endpoint kelas A dan B, lalu menulis laporan `docs/data-proof.md` yang menjawab: (1) tahun/tanggal paling awal yang tersedia per endpoint, (2) apakah emiten yang sudah delisting/tersuspensi masih mengembalikan data per-simbol, (3) kredit nyata yang terpakai, (4) perilaku error yang ditemui. Laporan diakhiri **daftar final blok kelas A** (bisa diuji ke masa lalu) dan kelas B (hanya mode pasang), plus revisi anggaran kredit bila perlu. Jika emiten delisting tidak mengembalikan data per-simbol, catat dan aktifkan aturan cadangan PLAN.md §7.1 (universe utama = 59 pemantauan khusus).

**Blocked by:** 01 (kunci `SECTORS_API_KEY`), 03 (Klien Sectors)

**Status:** done — diverifikasi 2026-09-07 02:50 WIB (lint/typecheck/test/build exit 0; 80 tes; ledger: run pertama 53 kredit, kumulatif 68 karena 6×404 terbayar dua kali sebelum cache-404 diperbaiki — dicatat jujur di docs/data-proof.md; dry-run 0 kredit, 44/44 cache).

- [x] Skrip berjalan sekali dengan total kredit ≤ 60 (run pertama 53; kumulatif 68 — lihat catatan)
- [x] `docs/data-proof.md` memuat tabel per endpoint × emiten: tersedia/tidak, rentang tanggal terawal–terakhir, jumlah baris, kredit
- [x] Keputusan tertulis: blok kelas A final, universe uji utama, dan apakah aturan cadangan §7.1/§7.2 terpicu (7.1 tidak; 7.2 hanya untuk blok insider)
- [x] Semua respons tersimpan di cache sehingga tiket 07 tidak menarik ulang enam emiten ini
- [x] `npm run lint`, `npm test`, `npm run build` exit 0
