# 39: Suspensi karena gerak harga tidak dihitung sebagai tanda bermasalah

**What to build:** 43% suspensi di data (252 dari 583; 146 dari 294 dalam 12 bulan terakhir) adalah suspensi sementara karena gerak harga ("cooling down", "peningkatan harga kumulatif yang signifikan"), bukan tanda perusahaan bermasalah. Sekarang semuanya memicu blok suspensi dan status merah di bawah alarm bawaan "Saham mau pailit". Suspensi gerak harga dipisahkan (ditampilkan sebagai informasi, tidak memicu blok), nama alarm bawaan diganti yang tidak menuduh, dan snapshot skor uji dihitung ulang dari database lokal (nol kredit) beserta angka di README dan halaman metodologi. Sumber: audit hackathon 19–20 Sep 2026, diverifikasi ulang 20 Sep.

**Blocked by:** None (can start immediately)

**Status:** selesai. Suspensi gerak harga (460 dari 583 baris) disaring di `suspensiMasalah()`; kejadian target diukur ke suspensi masalah PALING AWAL (`targetTerukur`) plus tabel `SUSPENSI_PUBLIK` untuk penghentian yang belum ada di feed (TELE 10 Jun 2020, BIMA 19 Nov 2025); emiten yang tanggal berhentinya tidak diketahui dilewati lewat `engine/universe-uji.ts`. Alarm bawaan kini "Waspada suspensi". Skor: 26/74 median 7 bln → **16/71 median 2 bln**, alarm palsu tetap 1/30, dilewati 3 → 6. Data contoh ditambah ZBRA (data nyata) supaya mode contoh menunjukkan pola yang benar.

- [x] Suspensi karena gerak harga tidak memicu blok suspensi, di uji ke masa lalu maupun di cek portofolio
- [x] Alarm bawaan tidak lagi bernama "Saham mau pailit"
- [x] docs/skor-nyata.json dihitung ulang; README dan halaman metodologi memakai angka baru, dan tes snapshot lulus
- [x] `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` exit 0; e2e jalur database dan jalur data contoh lulus
