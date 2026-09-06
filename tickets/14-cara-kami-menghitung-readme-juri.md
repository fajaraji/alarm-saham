# 14: Halaman "Cara kami menghitung" + README untuk juri

**What to build:** Halaman publik yang menjelaskan metodologi dengan jujur: definisi tiap blok dan ambangnya, definisi "berbunyi", "lebih awal", "alarm palsu", universe uji (18/59/30) dan cara memilih kontrol, aturan anti-lookahead, keterbatasan (survivorship, kedalaman data per endpoint dari `docs/data-proof.md`), dan kredit Sectors yang terpakai. README repo untuk juri: masalah & pengguna, arsitektur (diagram alur agent diagnosis dan tool-nya, lapisan data, cache & buku kredit), cara menjalankan, cara mereproduksi skor (`npm run backtest`), dan daftar endpoint Sectors yang dipakai + kenapa. `docs/decisions.md` mencatat keputusan & aturan cadangan yang terpicu.

**Blocked by:** 07 (Penarikan universe), 09 (Layar 2)

**Status:** ready-for-agent

- [ ] Halaman metodologi tayang dan angka di dalamnya sama dengan output `npm run backtest` (tes membandingkan)
- [ ] README memuat perintah yang benar-benar berjalan (diuji dari clone bersih di folder sementara: install → test → backtest)
- [ ] Diagram arsitektur tampil di README (SVG/Mermaid)
- [ ] `npm run lint`, `npm test`, `npm run build` exit 0
