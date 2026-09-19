# 29: Bahasa layar putar ulang yang tidak kaku

**What to build:** Rekan tim menilai bahasa di halaman pertama kaku. Salinan di /putar-ulang (judul, pembuka, lampu, ringkasan, kejadian, keadaan kosong) ditulis ulang dengan skill antislop-copywriting supaya terdengar seperti orang menjelaskan ke teman, tanpa mengubah fakta, angka, atau sumber, dan tetap mematuhi aturan Kepadatan teks di DESIGN.md. Sumber: feedback gelombang 2 (halaman pertama, bahasa kaku).

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Setiap kalimat yang diubah tetap memuat fakta, tanggal, dan sumber yang sama
- [ ] Tidak ada kata penilaian (berbahaya, gorengan, akan pailit) maupun anjuran; nol em dash
- [ ] Jumlah kata terlihat di /putar-ulang tidak bertambah (diukur tests/e2e/kepadatan.spec.ts)
- [ ] `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` exit 0; e2e jalur database dan jalur data contoh lulus
