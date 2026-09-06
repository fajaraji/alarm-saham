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

## Teknologi

Next.js (App Router) · TypeScript · Tailwind CSS v4 · Vitest · GitHub Actions
