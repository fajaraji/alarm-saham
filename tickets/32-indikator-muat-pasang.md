# 32: Indikator muat di layar pasang

**What to build:** Saat /pasang memuat portofolio dan saat "Cek sekarang" berjalan, pengguna hanya melihat teks kecil "memuat…" atau tombol yang berubah tulisan. Pengecekan dengan data terkini bisa makan belasan detik. Tambahkan indikator yang jelas: bilah progres tak tentu, teks yang menyebut apa yang sedang dicek, dan lama menunggu dalam detik. Gerak dimatikan pada prefers-reduced-motion. Sumber: feedback gelombang 2 (halaman ketiga, progres loading).

**Blocked by:** None (can start immediately)

**Status:** ditunda (2026-09-20). Pemilik memilih mendahulukan temuan kritis audit produksi (cron, data beku, "Cek sekarang" 504, label keliru) sebelum tenggat 30 Sep; tiket ini dikerjakan bila waktu tersisa.

- [ ] Selama cek berjalan tampil indikator dengan role status yang menyebut jumlah saham dan lama menunggu
- [ ] Selama portofolio dimuat tampil indikator yang sama, dan hilang begitu data tiba
- [ ] Tanpa animasi saat prefers-reduced-motion
- [ ] `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` exit 0; e2e jalur database dan jalur data contoh lulus
