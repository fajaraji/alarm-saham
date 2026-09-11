# 08c: Kunci LLM dari gateway mana pun (OpenAI-compatible)

**What to build:** Pemilik memakai kunci dari gateway pihak ketiga ([Kagiro](https://kagiro.net) — prepaid, bayar QRIS, endpoint `https://api.kagiro.net/v1`, model bernama `kagiro/deepseek-v4-flash` dan `kagiro/deepseek-v4-pro`), bukan kunci DeepSeek langsung. Kode saat ini memakai `@ai-sdk/deepseek` yang mengunci endpoint ke DeepSeek, sehingga kunci gateway tidak bisa dipakai.

Ganti menjadi provider **OpenAI-compatible** dengan base URL yang bisa diatur, sehingga satu jalur kode melayani: Kagiro, DeepSeek langsung, atau gateway OpenAI-compatible lain — cukup ganti URL dan nama model, tanpa ubah kode. Provider Anthropic tetap ada sebagai pilihan.

**Blocked by:** 08b (Provider LLM dapat dipilih)

**Status:** ready-for-agent

- [ ] `.env.example` memuat `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`, `LLM_MODEL_RINGAN` dengan komentar awam + contoh nilai Kagiro
- [ ] Kunci lama (`DEEPSEEK_API_KEY`, `ANTHROPIC_API_KEY`) tetap bekerja; pemilihan provider terdokumentasi dan diuji untuk semua kombinasi
- [ ] Tes (model tiruan): base URL & nama model yang dipakai sesuai env; tanpa kunci → `AiKeyMissingError` menyebut ketiga opsi
- [ ] `npm run agent:demo -- tele` dengan kunci gateway nyata mencetak provider, model, usulan blok, trace, dan token (dijalankan pemilik setelah kunci ada)
- [ ] README & `docs/decisions.md` menjelaskan cara memakai gateway + perkiraan biaya
- [ ] `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` exit 0
