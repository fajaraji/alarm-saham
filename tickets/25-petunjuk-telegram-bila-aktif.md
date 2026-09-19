# 25: Petunjuk Telegram hanya saat bot aktif

**What to build:** Petunjuk untuk mengirim /mulai ke bot Telegram di kotak masuk layar pasang hanya tampil bila server melaporkan bot benar-benar aktif. Saat bot mati (situs live saat ini melapor rahasia webhook kosong), petunjuk itu tidak ada, jadi pengguna tidak disuruh menghubungi bot yang tidak akan menjawab. Bila bot diaktifkan kemudian, petunjuk muncul tanpa perubahan kode. Sumber: feedback gelombang 1, poin 7.

**Blocked by:** None (can start immediately)

**Status:** selesai. botAktif() di lib/telegram/status.ts (token DAN secret) dibaca di server per permintaan; tes UI merender halaman /pasang dengan token penanda dan memastikan token maupun secret tidak ada di HTML, petunjuk tampil hanya saat aktif. Server e2e berjalan tanpa bot; kotak masuk tidak menyebut Telegram.

- [x] Bot tidak aktif: kotak masuk tidak menyebut Telegram maupun /mulai
- [x] Bot aktif: petunjuk /mulai beserta kode portofolio tampil
- [x] Status bot diperiksa di server, tanpa pernah mengirim token ke browser
- [x] `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` exit 0; e2e jalur database dan jalur data contoh lulus
