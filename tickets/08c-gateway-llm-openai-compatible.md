# 08c: Kunci LLM dari gateway mana pun (OpenAI-compatible)

**What to build:** Pemilik memakai kunci dari gateway pihak ketiga ([Kagiro](https://kagiro.net) — prepaid, bayar QRIS, endpoint `https://api.kagiro.net/v1`, model bernama `kagiro/deepseek-v4-flash` dan `kagiro/deepseek-v4-pro`), bukan kunci DeepSeek langsung. Kode saat ini memakai `@ai-sdk/deepseek` yang mengunci endpoint ke DeepSeek, sehingga kunci gateway tidak bisa dipakai.

Ganti menjadi provider **OpenAI-compatible** dengan base URL yang bisa diatur, sehingga satu jalur kode melayani: Kagiro, DeepSeek langsung, atau gateway OpenAI-compatible lain — cukup ganti URL dan nama model, tanpa ubah kode. Provider Anthropic tetap ada sebagai pilihan.

**Blocked by:** 08b (Provider LLM dapat dipilih)

**Status:** done — diverifikasi 2026-09-12. `createDeepSeek` menerima `baseURL`, jadi cukup mengarahkan endpoint + memakai nama model gateway (commit 7a8ea57). Gateway ternyata tidak bisa menegakkan skema JSON bersamaan dengan loop tool (mode kompatibilitas menyuntikkan skema ke pesan sistem) → `jalankanModel` dipecah dua fase untuk jalur gateway; uji nyata lolos, lihat docs/decisions.md.

- [ ] `.env.example` memuat `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`, `LLM_MODEL_RINGAN` dengan komentar awam + contoh nilai Kagiro
- [ ] Kunci lama (`DEEPSEEK_API_KEY`, `ANTHROPIC_API_KEY`) tetap bekerja; pemilihan provider terdokumentasi dan diuji untuk semua kombinasi
- [ ] Tes (model tiruan): base URL & nama model yang dipakai sesuai env; tanpa kunci → `AiKeyMissingError` menyebut ketiga opsi
- [ ] `npm run agent:demo -- tele` dengan kunci gateway nyata mencetak provider, model, usulan blok, trace, dan token (dijalankan pemilik setelah kunci ada)
- [ ] README & `docs/decisions.md` menjelaskan cara memakai gateway + perkiraan biaya
- [ ] `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` exit 0
