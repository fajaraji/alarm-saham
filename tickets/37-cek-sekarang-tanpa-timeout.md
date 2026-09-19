# 37: "Cek sekarang" tidak timeout untuk 6–8 saham

**What to build:** POST /api/portofolio/cek merapikan pesan setiap saham dengan model AI satu per satu (penjelasanPortofolio berurutan), sehingga 6–8 saham melewati maxDuration 60 detik dan pengguna mendapat 504. Rapian AI dijalankan paralel dengan batas waktu per saham dan batas waktu total; saham yang belum selesai memakai template deterministik (yang memang sumber kebenarannya). Sumber: audit hackathon 19–20 Sep 2026, diverifikasi ulang 20 Sep.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Rapian AI berjalan paralel dengan batas waktu per saham; lewat batas = template
- [ ] Tes membuktikan 8 saham dengan model lambat selesai jauh di bawah 60 detik
- [ ] Tanpa kunci AI, perilaku tetap sama (template saja)
- [ ] `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` exit 0; e2e jalur database dan jalur data contoh lulus
