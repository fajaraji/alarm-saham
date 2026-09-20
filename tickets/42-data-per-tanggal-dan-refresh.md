# 42: Tanggal data terlihat, dan data bisa disegarkan

**What to build:** Data kelas A di Neon adalah snapshot sekitar 4–6 Sep 2026 tanpa jalur penyegaran. Pengguna tidak diberi tahu tanggal datanya, dan mulai 28 Okt 2026 blok laporan hilang akan berbunyi palsu untuk emiten yang laporan Q2-nya belum kami tarik. Tampilkan "data per <tanggal>" di layar yang memakai data itu, lalu sediakan jalur penyegaran (feed suspensi seluruh bursa dan daftar kuartal laporan) dengan anggaran kredit yang disetujui pemilik. Sumber: audit hackathon 19–20 Sep 2026, diverifikasi ulang 20 Sep.

**Blocked by:** None (penyegaran butuh persetujuan kredit dari pemilik)

**Status:** selesai. Tanggal penarikan data kini tampil di /putar-ulang, /rakit, dan /pasang, dibaca dari buku kredit (`tanggalTarikData`, `api_ledger`), bukan diketik tangan. Perintah `npm run segarkan` menyegarkan feed suspensi (end = hari ini) dan daftar kuartal (cache permanennya dihapus lebih dulu), mencetak kredit sebelum dan sesudah dari buku kredit, berhenti pada `--maks` atau cadangan provider, dan punya mode `--dry` tanpa panggilan API. Dijalankan 20 Sep 2026 dengan persetujuan pemilik: 98 kredit, 9 baris suspensi baru (data sebelumnya berhenti 4 Sep) dan 9 kuartal baru termasuk BBRI, ANTM, ADRO yang diwanti-wanti audit.

- [x] Tanggal data terakhir tampil di /putar-ulang, /rakit, dan /pasang, dibaca dari database (bukan diketik)
- [x] Ada perintah penyegaran yang melaporkan kredit terpakai sebelum dan sesudah, dan menolak bila melewati cadangan
- [x] Penyegaran dijalankan dengan persetujuan pemilik dan hasilnya tercatat di buku kredit
- [x] `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` exit 0; e2e jalur database dan jalur data contoh lulus
