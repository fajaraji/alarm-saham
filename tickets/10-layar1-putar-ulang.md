# 10: Layar 1 — putar ulang emiten

**What to build:** Halaman "Putar ulang": kotak cari kode saham (4 huruf, apa pun), chip kasus nyata (mis. SRIL, TELE, WIKA, INAF), lalu untuk emiten yang ada di DB: garis waktu kejadian dari data nyata (suspensi + alasan resmi + tautan PDF BEI, tanggal laporan/keterlambatan, filing orang dalam, aksi korporasi), slider waktu yang meredupkan kejadian setelah tanggal terpilih, lampu hijau/kuning/merah, dan ringkasan "sampai tanggal ini sudah ada N tanda". Untuk emiten yang tidak ada di DB: pesan jujur "belum ada di data kami" + tombol "minta ditarik" (dicatat, tidak otomatis memanggil API). Semua kalimat memakai fakta resmi dan bahasa awam; tidak ada kata "berbahaya/gorengan/akan pailit".

**Blocked by:** 07 (Penarikan universe)

**Status:** done — diverifikasi 2026-09-07 di checkout utama (lint/typecheck/test/build exit 0; 217 tes; 6 e2e Playwright dengan data PGlite nyata). Termasuk integrasi `getEventSource()` (Neon → PGlite → fixture) dan **skor nyata aturan default**: 26/74 tertangkap (delisting 6/18, pemantauan 20/56), lead rata-rata 9 bln, alarm palsu 1/30 — dicatat di docs/data-proof.md.

- [x] Uji komponen: slider mengubah set kejadian "sudah terjadi" secara benar (batas tanggal inklusif)
- [x] Uji end-to-end: cari SRIL → garis waktu dari DB; cari kode tak dikenal → pesan jujur; COWL → hanya suspensi + catatan 404
- [x] Setiap kejadian menampilkan sumber (endpoint/BEI) dan tautan bila ada
- [x] `npm run lint`, `npm test`, `npm run build` exit 0
