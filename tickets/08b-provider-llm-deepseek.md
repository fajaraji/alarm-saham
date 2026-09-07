# 08b: Provider LLM dapat dipilih — DeepSeek sebagai default

**What to build:** Pemilik tidak punya langganan Anthropic. Semua fitur AI (perakit blok, agent diagnosis, penjelasan harian) harus bisa berjalan dengan **DeepSeek** lewat provider Vercel AI SDK, tanpa mengubah logika agent. Provider dipilih lewat env `LLM_PROVIDER` (`deepseek` | `anthropic`); bila kosong, otomatis DeepSeek jika `DEEPSEEK_API_KEY` ada, Anthropic jika `ANTHROPIC_API_KEY` ada, dan error `AiKeyMissingError` bila keduanya kosong. Opsi khusus Anthropic (adaptive thinking, cache prompt) hanya dipasang saat provider Anthropic. Model DeepSeek: `deepseek-chat` untuk perakit & diagnosis (tool-calling + JSON), `deepseek-reasoner` opsional untuk diagnosis bila diaktifkan env.

**Blocked by:** 08 (Agent diagnosis + perakit blok)

**Status:** ready-for-agent

- [ ] `.env.example` memuat `LLM_PROVIDER`, `DEEPSEEK_API_KEY`, `DEEPSEEK_MODEL` (default deepseek-chat) dengan komentar awam
- [ ] Tes (model tiruan): pemilihan provider sesuai env untuk 4 kombinasi (deepseek saja, anthropic saja, keduanya + LLM_PROVIDER, tidak ada → error)
- [ ] Tes: structured output & tool-calling agent tetap lulus dengan provider DeepSeek (mock) — tanpa opsi Anthropic di providerOptions
- [ ] `npm run agent:demo -- tele` dengan `DEEPSEEK_API_KEY` nyata (dijalankan koordinator setelah kunci ada) mencetak usulan blok + trace + token
- [ ] README/docs mencatat cara mendapatkan kunci DeepSeek dan perkiraan biaya
- [ ] `npm run lint`, `npm test`, `npm run build` exit 0
