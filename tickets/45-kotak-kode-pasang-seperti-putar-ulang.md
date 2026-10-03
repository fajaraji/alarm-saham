# 45: Kotak kode /pasang seperti kotak cari /putar-ulang

**What to build:** Kotak kode saham di layar "Pasang" disamakan dengan kotak cari di layar "Putar ulang": satu kotak menyatu (prefix `IDX` + input huruf mono + tombol di dalam kotak), dengan saran ketik `<datalist>` dari emiten yang benar-benar bisa dicari di server. Sebelumnya kotak di /pasang adalah input telanjang dengan tombol "Tambah saham" di luarnya, dan tidak ada satu pun saran ketik, sehingga pengguna hanya bisa menebak kode yang ada di data server. Sumber: permintaan pemilik 2026-10-02.

**Blocked by:** None

**Status:** selesai. Daftar saran datang lewat prop `opsi` dari halaman server (`/pasang/page.tsx` memanggil `daftarBisaDicari()` atas sumber yang sama dengan /putar-ulang), bukan dibuka sendiri oleh komponen klien; jumlahnya karena itu ikut jujur di jalur data contoh (hanya emiten fixture). Tombol tambah tetap berbunyi "+ Tambah saham" dan bergaya sekunder supaya aksen tetap milik "Cek sekarang". Penanda fokus digambar di wadah kotak, bukan di input.

- [x] Kotak kode /pasang menyatu: prefix IDX, input, dan tombol tambah dalam satu wadah berpenanda fokus
- [x] Saran ketik `<datalist>` dari emiten yang benar-benar ada di server; placeholder menyebut jumlahnya, dan tanpa saran placeholder tidak menjanjikan angka
- [x] Nilai yang sudah diterima (huruf kecil, akhiran `.JK`, tolak ganda) tidak berubah
- [x] Tes: UI kotak kode (5), fokus keyboard /pasang (e2e), saran ketik /pasang (e2e)
- [x] `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` exit 0; e2e jalur database dan jalur data contoh lulus
