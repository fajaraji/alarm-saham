# 31: Seret blok dari seluruh area blok

**What to build:** Blok di papan /rakit sekarang hanya bisa diseret dari pegangan kecil di kirinya. Seluruh badan blok bisa diseret, kecuali kontrol di dalamnya (dropdown ambang, tombol buang) yang tetap bisa diklik. Pegangan tetap ada untuk keyboard. Sumber: feedback gelombang 2 (halaman kedua, drag seluruh area blok).

**Blocked by:** 30 (Ambang blok dipilih lewat dropdown)

**Status:** selesai. Listener seret pindah dari pegangan ke seluruh `<li>` blok; dropdown ambang dan tombol buang bertanda `data-tanpa-seret`, dan SensorPenunjuk/SensorSentuh menolak memulai seret dari elemen bertanda itu. Keyboard tetap lewat pegangan (KeyboardSensor dnd-kit menolak tombol di luar activator node). Tes: activator sensor (UI) dan e2e seret dari label ke posisi lain dan ke area buang, lulus di kedua jalur.

- [x] Menyeret dari badan blok (bukan pegangan) mengurutkan ulang atau membuang blok
- [x] Mengklik dropdown ambang dan tombol buang tidak memulai seret
- [x] Seret dengan keyboard lewat pegangan tetap berfungsi
- [x] `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` exit 0; e2e jalur database dan jalur data contoh lulus
