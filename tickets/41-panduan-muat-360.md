# 41: Overlay panduan muat di ponsel 360 px

**What to build:** Overlay panduan kunjungan pertama terpotong di layar 360 px: tombolnya tidak terjangkau. Kartunya dibuat bisa digulir di dalam layar dan tombolnya selalu terjangkau. Sumber: audit hackathon 19–20 Sep 2026, diverifikasi ulang 20 Sep.

**Blocked by:** None (can start immediately)

**Status:** selesai. Lapisan overlay (dan `Dialog` yang polanya sama) kini `overflow-y-auto` dengan kartu `my-auto`: di tengah bila muat, mulai dari atas dan bisa digulir bila lebih tinggi dari layar. Padding dan judul lebih kecil di bawah `sm`. Uji e2e 360×640 di `tests/e2e/ponsel.spec.ts`.

- [x] Di 360×640 seluruh isi overlay terjangkau (bisa digulir) dan tombol "Saya sudah paham" bisa diklik
- [x] Tidak ada gulir mendatar
- [x] `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` exit 0; e2e jalur database dan jalur data contoh lulus
