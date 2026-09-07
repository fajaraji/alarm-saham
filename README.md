# Alarm Saham

[![CI](https://github.com/fajaraji/alarm-saham/actions/workflows/ci.yml/badge.svg)](https://github.com/fajaraji/alarm-saham/actions/workflows/ci.yml)

Alarm Saham adalah web app untuk investor awam: merakit "alarm" peringatan saham dari blok-blok sederhana, mengujinya terhadap data sejarah dari [Sectors Financial API](https://sectors.app), lalu memasangnya untuk menjaga portofolio. Proyek ini dikerjakan untuk Sectors Hackathon 2026.

**Alarm Saham adalah alat informasi dan analisis, bukan saran investasi.**

## Status

Repo ini baru pada tahap bootstrap (kerangka Next.js, lint, tes, dan CI). Fitur produk dikerjakan bertahap sesuai `PLAN.md` dan `tickets/`.

## Menjalankan secara lokal

Prasyarat: Node.js 24 dan npm 11.

```bash
npm install
```

Salin `.env.example` menjadi `.env.local`, lalu isi nilainya. `.env.local` tidak pernah masuk git.

```bash
npm run dev
```

Buka http://localhost:3000.

## Perintah

| Perintah            | Keterangan                          |
| ------------------- | ----------------------------------- |
| `npm run dev`       | Server pengembangan                 |
| `npm run lint`      | ESLint                              |
| `npm run typecheck` | Pemeriksaan tipe TypeScript         |
| `npm test`          | Tes unit (Vitest)                   |
| `npm run build`     | Build produksi                      |

## Keamanan kunci

Pre-commit (husky) menjalankan `scripts/check-secrets.mjs` yang menolak commit bila file yang di-stage mengandung pola API key atau kredensial. Simpan semua rahasia di `.env.local`.

## Otak AI (perakit blok & diagnosis)

Fitur AI memakai Vercel AI SDK dan bisa berjalan di salah satu dari dua provider. Cukup isi **satu** kunci di `.env.local`.

| Provider               | Variabel kunci      | Model bawaan                                                     | Catatan                                   |
| ---------------------- | ------------------- | ---------------------------------------------------------------- | ----------------------------------------- |
| **DeepSeek** (default) | `DEEPSEEK_API_KEY`  | `deepseek-v4-flash`; `DEEPSEEK_REASONER=1` → `deepseek-v4-pro`   | Murah, saldo prabayar, tanpa langganan    |
| Anthropic              | `ANTHROPIC_API_KEY` | `claude-opus-5` (penalaran), `claude-sonnet-5` (ringan)          | Butuh akun & kredit Anthropic             |

Pemilihan provider: `LLM_PROVIDER=deepseek` atau `anthropic`. Bila kosong, otomatis DeepSeek jika `DEEPSEEK_API_KEY` terisi, kalau tidak Anthropic. Tanpa kunci sama sekali, endpoint `/api/agent/*` menjawab 503 dengan pesan yang menyebut kedua opsi, dan `npm run agent:demo` berhenti (exit 2). Model DeepSeek bisa diganti lewat `DEEPSEEK_MODEL` (alias lama `deepseek-chat`/`deepseek-reasoner` sudah dipensiunkan DeepSeek pada 24 Juli 2026 — jangan dipakai).

Demo (memanggil API sungguhan, berbiaya): `npm run agent:demo -- tele` atau `npm run agent:demo -- rakit "aku mau alarm buat saham yang mau pailit"`. Baris pertama keluaran menampilkan provider dan model yang dipakai; baris `Token` menampilkan pemakaian token (termasuk cache hit).

### Cara mendapat kunci DeepSeek

1. Daftar di https://platform.deepseek.com.
2. Menu **Top up**: isi saldo prabayar kecil — US$2–5 sudah cukup untuk ratusan diagnosis. Tidak ada biaya bulanan; saldo hanya berkurang sesuai token yang dipakai.
3. Menu **API keys** → **Create new API key**. Kunci hanya ditampilkan sekali; salin ke `.env.local` sebagai `DEEPSEEK_API_KEY`.

### Perkiraan biaya DeepSeek

Harga resmi per 1 juta token (dicek 7 September 2026 di https://api-docs.deepseek.com/quick_start/pricing), ditulis **jam sibuk / jam lengang**:

| Model               | Input, cache hit | Input, cache miss | Output          |
| ------------------- | ---------------- | ----------------- | --------------- |
| `deepseek-v4-flash` | $0,014 / $0,007  | $0,44 / $0,22     | $1,32 / $0,66   |
| `deepseek-v4-pro`   | $0,044 / $0,022  | $1,32 / $0,66     | $3,96 / $1,98   |

Jam sibuk = 01:00–04:00 dan 06:00–10:00 UTC, Senin–Jumat (08:00–11:00 dan 13:00–17:00 WIB); di luar itu tarif lengang (setengah harga). Cache prefix berjalan otomatis tanpa opsi apa pun.

Perkiraan kasar per pemakaian pada tarif sibuk tanpa cache: satu diagnosis (maksimal 8 langkah tool, kira-kira 30 ribu token input + 3 ribu token output) ≈ **US$0,02** dengan `v4-flash` atau ≈ US$0,05 dengan `v4-pro`; satu perakitan blok (≈3 ribu input + 0,5 ribu output) di bawah US$0,01. Angka token sebenarnya dikembalikan di field `usage` setiap respons API.

## Teknologi

Next.js (App Router) · TypeScript · Tailwind CSS v4 · Vitest · GitHub Actions
