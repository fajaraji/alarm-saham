# 18: Label sumber data yang bisa dibaca pengguna

**What to build:** Di layar putar ulang, pengguna hanya melihat sumber data dalam kata biasa: "data Sectors" atau "data contoh". Keterangan teknis server (nama driver database, host endpoint) tidak pernah sampai ke layar, baik di label sumber rekaman emiten maupun di pesan "belum ada di data kami". Sumber: feedback pengguna gelombang 1, poin 1; teks `neon (<ep>.c-4.ap-southeast-1.aws.neon.tech)` terbukti tampil di situs live.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Membuka rekaman emiten yang ada di database tidak menampilkan nama driver maupun host database di mana pun di halaman
- [ ] Membuka kode yang tidak ada di data juga tidak menampilkannya
- [ ] Label sumber tetap jujur di kedua jalur: jalur database menyebut Sectors, jalur data contoh menyebut data contoh
- [ ] Ada tes yang gagal bila keterangan teknis sumber muncul lagi di layar
- [ ] `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` exit 0; e2e jalur database dan jalur data contoh lulus
