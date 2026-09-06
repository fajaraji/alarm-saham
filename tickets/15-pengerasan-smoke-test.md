# 15: Pengerasan & smoke test (gerbang sebelum deploy)

**What to build:** Aplikasi siap dinilai: mode gelap/terang konsisten di semua layar, aksesibilitas dasar (fokus keyboard terlihat, label ARIA pada kontrol drag-and-drop, kontras), tes smoke Playwright yang menjalankan alur 1→2→3 dari awal (cari SRIL → rakit 2 blok → uji → pasang ke portofolio → cek sekarang) di build production lokal, pemindaian rahasia di seluruh riwayat git bersih, dan CI menjalankan lint + test + build + smoke.

**Blocked by:** 12 (Cron + Telegram), 13 (Panduan/kamus), 14 (Metodologi/README)

**Status:** ready-for-agent

- [ ] `npm run build` lalu `npm start` + Playwright smoke: lulus (bukti output)
- [ ] Pemindaian rahasia (mis. gitleaks) pada seluruh riwayat: 0 temuan
- [ ] Lighthouse/axe dasar pada tiga layar: tidak ada pelanggaran kontras/label kritis
- [ ] CI hijau di commit terakhir (`gh run view`)
- [ ] Tidak ada `console.error` saat menjalankan alur smoke
