# 12: Cron harian + notifikasi Telegram

**What to build:** Pengecekan otomatis setiap pagi 06:30 WIB (Vercel Cron memanggil endpoint terlindungi secret) yang mengevaluasi semua portofolio dengan alarm terpasang (logika tiket 11), mengirim pesan hanya untuk **bendera baru** sejak pengecekan terakhir (bukan mengulang tiap hari), lewat bot Telegram (grammY) ke chat yang dihubungkan pengguna dengan perintah `/mulai <kode-portofolio>`. Jika `TELEGRAM_BOT_TOKEN` kosong: notifikasi tampil di halaman portofolio (in-app inbox) dan cron tetap berjalan — aturan cadangan PLAN.md §7.5.

**Blocked by:** 01 (`TELEGRAM_BOT_TOKEN`, opsional), 11 (Layar 3)

**Status:** done — diverifikasi 2026-09-07 di worktree t12 (lint/typecheck/test/build exit 0; 340 tes; 14 e2e). Jalur utama = kotak masuk in-app (§7.5) karena `TELEGRAM_BOT_TOKEN` kosong; jalur Telegram teruji dengan mock. Cron kelas A saja (tanpa kredit Sectors, tanpa LLM). Perbaikan koordinator: batas waktu Vitest dinaikkan (testTimeout 30 s, hookTimeout 60 s) karena PGlite + impor route berat flaky saat suite paralel.

- [x] Uji: endpoint cron menolak permintaan tanpa secret (401; 503 bila secret belum diatur); dengan secret memproses semua portofolio
- [x] Uji: hanya bendera baru yang dikirim; menjalankan dua kali berturut-turut tidak mengirim ulang
- [x] Uji: tanpa token → pesan masuk inbox in-app; dengan token (mock API Telegram) → pesan terkirim dengan disclaimer
- [x] Konfigurasi cron terverifikasi di `vercel.json` (`30 23 * * *`)
- [x] `npm run lint`, `npm test`, `npm run build` exit 0
