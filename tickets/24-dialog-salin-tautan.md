# 24: Dialog salin tautan rahasia

**What to build:** Setelah menyimpan alarm di layar rakit dan setelah portofolio tersimpan di layar pasang, muncul dialog berisi tautan dari tiket 23 dengan tombol Salin dan penjelasan singkat bahwa tautan itu satu-satunya cara membuka portofolio yang sama di perangkat lain. Kalimat lama "tautan rahasiamu tersimpan otomatis" diganti karena menjanjikan tautan yang tidak pernah ditunjukkan. Dialog bisa ditutup dengan Escape dan tombol tutup, fokus kembali ke tombol yang membukanya. Sumber: feedback gelombang 1, poin 6.

**Blocked by:** 23 (Pulihkan portofolio dari tautan rahasia)

**Status:** ready-for-agent

- [ ] Menyimpan alarm di jalur database menampilkan dialog berisi tautan yang, bila dibuka, memulihkan portofolio (tiket 23)
- [ ] Tombol Salin menaruh tautan di clipboard dan memberi umpan balik yang terlihat
- [ ] Di server tanpa database dialog menyatakan bahwa alarm hanya tersimpan di browser ini
- [ ] Dialog lolos axe dan bisa dipakai dengan keyboard
- [ ] `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` exit 0; e2e jalur database dan jalur data contoh lulus
