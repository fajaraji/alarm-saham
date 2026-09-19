# 41: Overlay panduan muat di ponsel 360 px

**What to build:** Overlay panduan kunjungan pertama terpotong di layar 360 px: tombolnya tidak terjangkau. Kartunya dibuat bisa digulir di dalam layar dan tombolnya selalu terjangkau. Sumber: audit hackathon 19–20 Sep 2026, diverifikasi ulang 20 Sep.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Di 360×640 seluruh isi overlay terjangkau (bisa digulir) dan tombol "Saya sudah paham" bisa diklik
- [ ] Tidak ada gulir mendatar
- [ ] `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` exit 0; e2e jalur database dan jalur data contoh lulus
