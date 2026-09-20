# 28: Tindak lanjut review gelombang 1

**What to build:** Perbaikan dari code-review ulang gelombang 1 dengan aturan kepadatan teks, ditambah security review seluruh kode. Aturan "jangan terlalu banyak teks" sebelumnya belum tertulis, jadi dicatat dulu di DESIGN.md sebagai patokan, lalu setiap layar diperbaiki mengikuti aturan itu. Sumber: permintaan pemilik 2026-09-19 setelah PR #8, dikerjakan di PR #9.

**Blocked by:** 18–27 (gelombang 1)

**Status:** selesai. Dikerjakan di PR #9; semua pemeriksaan CI hijau. Kata yang terlihat di `<main>` (jalur database, diukur `tests/e2e/kepadatan.spec.ts`): /pasang sesudah cek 498 → 418, /rakit sesudah uji 375 → 362, /putar-ulang SRIL 684 → 668.

- [x] Bagian "Kepadatan teks" (10 aturan) ada di DESIGN.md, dan riwayat revisi yang disetujui tercatat di docs/decisions.md
- [x] /pasang: setiap temuan terbaca sekali tanpa membuka apa pun; rincian dan data terkini terlipat; tanggal dan sumber ditulis untuk dibaca orang
- [x] /rakit: hasil uji satu kalimat dengan angka ringkas terlipat; dialog tautan dua kalimat; fokus kembali ke tombol pembuka dialog
- [x] Jejak AI, /putar-ulang, dan metodologi bebas dari teks internal (nama alat, JSON, endpoint, nomor tiket, nama berkas, tanggal ISO)
- [x] Security review seluruh kode: tanpa temuan berat; tautan rahasia kini selalu minta konfirmasi sebelum kuncinya dipakai
- [x] Tes yang membaca ./.pglite membuka salinannya, sehingga database lokal tidak bisa rusak lagi oleh tes yang berjalan paralel
- [x] `npm run lint`, `npm run typecheck`, `npm test` (748), `npm run build` exit 0; e2e jalur database (71 lulus) dan jalur data contoh (66 lulus)
