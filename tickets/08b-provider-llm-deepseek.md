# 08b: Provider LLM dapat dipilih — DeepSeek sebagai default

**What to build:** Pemilik tidak punya langganan Anthropic. Semua fitur AI (perakit blok, agent diagnosis, penjelasan harian) harus bisa berjalan dengan **DeepSeek** lewat provider Vercel AI SDK, tanpa mengubah logika agent. Provider dipilih lewat env `LLM_PROVIDER` (`deepseek` | `anthropic`); bila kosong, otomatis DeepSeek jika `DEEPSEEK_API_KEY` ada, Anthropic jika `ANTHROPIC_API_KEY` ada, dan error `AiKeyMissingError` bila keduanya kosong. Opsi khusus Anthropic (adaptive thinking, cache prompt) hanya dipasang saat provider Anthropic. Model DeepSeek: `deepseek-chat` untuk perakit & diagnosis (tool-calling + JSON), `deepseek-reasoner` opsional untuk diagnosis bila diaktifkan env.

**Blocked by:** 08 (Agent diagnosis + perakit blok)

**Status:** done — kode diverifikasi 2026-09-07 di worktree t08b (lint/typecheck/test/build exit 0; 169 tes). Temuan: alias `deepseek-chat`/`deepseek-reasoner` dipensiunkan DeepSeek 2026-07-24 → default `deepseek-v4-flash`, `DEEPSEEK_REASONER=1` → `deepseek-v4-pro`. Uji nyata model DeepSeek dijalankan lewat jalur gateway (tiket 08c) karena kunci DeepSeek langsung tidak dibeli; lihat tiket 08.

- [x] `.env.example` memuat `LLM_PROVIDER`, `DEEPSEEK_API_KEY`, `DEEPSEEK_MODEL` (default deepseek-v4-flash) dengan komentar awam
- [x] Tes (model tiruan): pemilihan provider sesuai env untuk 4 kombinasi
- [x] Tes: structured output & tool-calling agent tetap lulus dengan provider DeepSeek (mock) — tanpa opsi Anthropic di providerOptions
- [ ] `npm run agent:demo -- tele` dengan `DEEPSEEK_API_KEY` nyata → TERTUNDA (kunci belum ada)
- [x] README/docs mencatat cara mendapatkan kunci DeepSeek dan perkiraan biaya (≈US$0,02 per diagnosis, harga dicek 2026-09-07)
- [x] `npm run lint`, `npm test`, `npm run build` exit 0
