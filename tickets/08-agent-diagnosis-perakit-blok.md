# 08: Agent diagnosis + perakit blok

**What to build:** Dua kemampuan AI lewat Vercel AI SDK + Claude. (a) **Perakit**: kalimat pengguna dalam Bahasa Indonesia ("aku mau alarm buat saham yang mau pailit") → aturan alarm valid (structured output ke skema tiket 06) + satu kalimat alasan. (b) **Diagnosis** (inti track): diberi aturan + hasil uji, agent menjalankan loop tool-use — tools: baca suspensi, tanggal laporan, filing, aksi korporasi, financials dari DB, dan menjalankan mesin uji pada satu emiten — untuk menjelaskan **kenapa alarm bolong di emiten tertentu** dan mengusulkan blok tambahan; setiap langkah tool tersimpan sebagai trace yang bisa ditampilkan. Endpoint API untuk keduanya. Model: `claude-opus-5` (adaptive thinking) dengan prompt caching untuk system prompt; tes memakai model tiruan sehingga `npm test` tidak butuh kunci dan tidak berbiaya. Disclaimer "bukan saran investasi" menjadi bagian system prompt; agent dilarang memakai kata rekomendasi beli/jual.

**Blocked by:** 01 (`ANTHROPIC_API_KEY`), 06 (Mesin uji)

**Status:** ready-for-agent

- [ ] Tes (model tiruan): perakit menghasilkan aturan valid untuk 3 kalimat contoh; kalimat di luar domain ditolak sopan
- [ ] Tes (model tiruan): diagnosis memanggil ≥2 tool dan mengembalikan usulan blok + trace terstruktur
- [ ] Uji nyata sekali dengan kunci: kasus "alarm laporan-telat saja bolong di TELE" → agent menyebut sebab dari data dan mengusulkan blok; trace tersimpan; biaya token dicatat di `docs/decisions.md`
- [ ] Endpoint API mengembalikan JSON terstruktur untuk kedua kemampuan
- [ ] `npm run lint`, `npm test`, `npm run build` exit 0
