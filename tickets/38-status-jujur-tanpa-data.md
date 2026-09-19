# 38: Saham tanpa data tidak pernah tampil "aman"

**What to build:** Saham yang tidak ada di data kami (mis. UNVR) mendapat status hijau "Aman menurut alarmmu", karena statusnya hanya menghitung syarat yang terpenuhi. Saham tanpa data diberi status "belum bisa dinilai" (abu-abu) di peta, pesan, kotak masuk, dan Telegram. Saham yang ada di daftar resmi BEI berpotensi delisting (Peng-S-00019/BEI.PLP/06-2026) juga tidak boleh tampil aman walau feed suspensi kami tidak memuat suspensinya (kasus WSKT). Sumber: audit hackathon 19–20 Sep 2026, diverifikasi ulang 20 Sep.

**Blocked by:** 40 (label daftar berpotensi delisting)

**Status:** ready-for-agent

- [ ] Saham tanpa data berstatus "belum bisa dinilai", bukan hijau, di layar dan di pesan
- [ ] Saham di daftar BEI berpotensi delisting minimal berstatus kuning dengan alasan yang menyebut pengumumannya
- [ ] Tes memakai data tiruan, nol kredit
- [ ] `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` exit 0; e2e jalur database dan jalur data contoh lulus
