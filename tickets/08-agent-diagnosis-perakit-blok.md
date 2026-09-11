# 08: Agent diagnosis + perakit blok

**What to build:** Dua kemampuan AI lewat Vercel AI SDK + Claude. (a) **Perakit**: kalimat pengguna dalam Bahasa Indonesia ("aku mau alarm buat saham yang mau pailit") → aturan alarm valid (structured output ke skema tiket 06) + satu kalimat alasan. (b) **Diagnosis** (inti track): diberi aturan + hasil uji, agent menjalankan loop tool-use — tools: baca suspensi, tanggal laporan, filing, aksi korporasi, financials dari DB, dan menjalankan mesin uji pada satu emiten — untuk menjelaskan **kenapa alarm bolong di emiten tertentu** dan mengusulkan blok tambahan; setiap langkah tool tersimpan sebagai trace yang bisa ditampilkan. Endpoint API untuk keduanya. Model: `claude-opus-5` (adaptive thinking) dengan prompt caching untuk system prompt; tes memakai model tiruan sehingga `npm test` tidak butuh kunci dan tidak berbiaya. Disclaimer "bukan saran investasi" menjadi bagian system prompt; agent dilarang memakai kata rekomendasi beli/jual.

**Blocked by:** 01 (`ANTHROPIC_API_KEY`), 06 (Mesin uji)

**Status:** done — kode diverifikasi 2026-09-07 (lint/typecheck/test/build exit 0). **Uji nyata SELESAI 2026-09-12** lewat gateway Kagiro (`kagiro/deepseek-v4-pro`): `npm run agent:demo -- tele` menghasilkan diagnosis lengkap dalam 207,4 detik, 4 langkah, 24 tool call sungguhan, 34.669 token (≈US$0,0010), trace tersimpan di Neon `runs.id=0fbf7c4e-4217-463e-be1b-7cfad96652f3`. Angka & isi jawabannya dicatat di docs/decisions.md.

- [x] Tes (model tiruan): perakit menghasilkan aturan valid untuk 3 kalimat contoh; kalimat di luar domain ditolak sopan
- [x] Tes (model tiruan): diagnosis memanggil ≥2 tool dan mengembalikan usulan blok + trace terstruktur
- [ ] Uji nyata sekali dengan kunci → TERTUNDA (kunci Anthropic belum ada)
- [x] Endpoint API mengembalikan JSON terstruktur untuk kedua kemampuan
- [x] `npm run lint`, `npm test`, `npm run build` exit 0
