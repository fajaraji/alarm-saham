# 02: Bootstrap repo & CI

**What to build:** Proyek Next.js (TypeScript, Tailwind, App Router) berdiri di root folder, punya perintah `lint`, `test` (Vitest), dan `build` yang semuanya hijau, tersimpan di repo GitHub **publik** baru `alarm-saham` yang dibuat dalam periode build, dengan GitHub Actions menjalankan lint + test + build di setiap push, dan pre-commit yang menolak commit berisi pola API key. Hasil scaffold sementara di subfolder dipindahkan ke root lalu subfolder dihapus. README berisi satu paragraf tujuan produk + disclaimer "bukan saran investasi".

**Blocked by:** None (can start immediately)

**Status:** done — diverifikasi 2026-09-07 01:53 WIB (lint/typecheck/test/build exit 0; 2 tes lulus; CI run 34053016505 success; repo publik https://github.com/fajaraji/alarm-saham)

- [x] `npm run lint`, `npm test`, `npm run build` semuanya exit 0 di mesin lokal (bukti output)
- [x] Repo GitHub publik `alarm-saham` ada; `git log` menunjukkan commit pertama bertanggal dalam periode build; remote `origin` terpasang
- [x] Workflow GitHub Actions hijau pada commit pertama (bukti: `gh run list` / `gh run view`)
- [x] Pre-commit menolak commit yang berisi string berpola kunci (uji: coba commit file dummy berisi `sk-ant-...`, harus gagal, lalu dibersihkan)
- [x] `.env.local` tidak ter-track (`git ls-files` tidak memuatnya); `.env.example` ter-track
- [x] Tidak ada folder scaffold sementara yang tersisa
