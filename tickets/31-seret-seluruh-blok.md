# 31: Seret blok dari seluruh area blok

**What to build:** Blok di papan /rakit sekarang hanya bisa diseret dari pegangan kecil di kirinya. Seluruh badan blok bisa diseret, kecuali kontrol di dalamnya (dropdown ambang, tombol buang) yang tetap bisa diklik. Pegangan tetap ada untuk keyboard. Sumber: feedback gelombang 2 (halaman kedua, drag seluruh area blok).

**Blocked by:** 30 (Ambang blok dipilih lewat dropdown)

**Status:** ready-for-agent

- [ ] Menyeret dari badan blok (bukan pegangan) mengurutkan ulang atau membuang blok
- [ ] Mengklik dropdown ambang dan tombol buang tidak memulai seret
- [ ] Seret dengan keyboard lewat pegangan tetap berfungsi
- [ ] `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` exit 0; e2e jalur database dan jalur data contoh lulus
