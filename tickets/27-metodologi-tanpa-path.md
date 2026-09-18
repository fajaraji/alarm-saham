# 27: Halaman metodologi tanpa path berkas dan perintah

**What to build:** Halaman cara kami menghitung tidak lagi memuat path berkas repositori maupun perintah baris perintah. Pernyataan kejujuran bahwa angka di halaman ini adalah hasil uji yang kami simpan pada tanggal tertentu, bukan dihitung ulang dari data server yang sedang berjalan, tetap ada dalam kalimat biasa. Pernyataan itu yang membuat halaman ini boleh menampilkan angka universe nyata bahkan di server data contoh, dan tes e2e menjaganya. Rincian teknis tetap tersedia di README. Sumber: feedback gelombang 1, poin 9.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Tidak ada path berkas (docs/, tests/, scripts/, src/) maupun perintah npm/node di teks halaman
- [ ] Pernyataan bahwa angka adalah hasil simpanan, bukan hitungan ulang server ini, tetap ada dan tes klaim sumber tetap lulus di kedua jalur
- [ ] Angka yang tampil tetap dibaca dari snapshot yang dijaga tes
- [ ] `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` exit 0; e2e jalur database dan jalur data contoh lulus
