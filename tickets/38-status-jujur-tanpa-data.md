# 38: Saham tanpa data tidak pernah tampil "aman"

**What to build:** Saham yang tidak ada di data kami (mis. UNVR) mendapat status hijau "Aman menurut alarmmu", karena statusnya hanya menghitung syarat yang terpenuhi. Saham tanpa data diberi status "belum bisa dinilai" (abu-abu) di peta, pesan, kotak masuk, dan Telegram. Saham yang ada di daftar resmi BEI berpotensi delisting (Peng-S-00019/BEI.PLP/06-2026) juga tidak boleh tampil aman walau feed suspensi kami tidak memuat suspensinya (kasus WSKT). Sumber: audit hackathon 19–20 Sep 2026, diverifikasi ulang 20 Sep.

**Blocked by:** 40 (label daftar berpotensi delisting)

**Status:** selesai. Status baru `abu` ("Belum bisa dinilai") untuk saham tanpa data dan tanpa tanda, di peta, pesan, kotak masuk, dan Telegram (⚪); tidak memicu bendera. Fakta resmi BEI (18 emiten dihapus dari bursa, 59 berpotensi delisting) dihitung sebagai satu tanda bersumber, hanya sesudah tanggal pengumumannya. WSKT kini kuning dengan alasan pengumuman BEI. Tes: evaluasi (WSKT, batas tanggal, ZZZZ abu), template abu, e2e /pasang lulus.

- [x] Saham tanpa data berstatus "belum bisa dinilai", bukan hijau, di layar dan di pesan
- [x] Saham di daftar BEI berpotensi delisting minimal berstatus kuning dengan alasan yang menyebut pengumumannya
- [x] Tes memakai data tiruan, nol kredit
- [x] `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` exit 0; e2e jalur database dan jalur data contoh lulus
