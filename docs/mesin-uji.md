# Mesin uji-ke-masa-lalu (tiket 06)

Kode: `src/lib/engine/`. CLI: `npm run backtest -- <aturan.json> [--fixture] [--json] [--today=YYYY-MM-DD]`.
Nol panggilan API: data dari DB (`DATABASE_URL`) atau fixture `src/lib/engine/fixtures/universe-kecil.json`.

## Alur

1. `rules.ts` — aturan `{ name, combine: 'any'|'all', blocks: [{ kind, threshold }] }` divalidasi Zod (pesan Bahasa Indonesia; blok ganda dan kunci asing ditolak).
2. `events.ts` — kejadian ternormalisasi per emiten. `fromFixture(json)` dan `fromDb(db)` mengembalikan **semua** baris; tidak ada filter tanggal di sumber.
3. `evaluate.ts` — `fires(rule, events, t)`: fungsi murni, hanya memakai baris bertanggal `<= t`.
4. `score.ts` — `runBacktest(rule, universe, source, opts)`: pindai akhir bulan, hitung tertangkap / lebih-awal / alarm palsu.

## Definisi blok (mengikuti docs/data-proof.md §2)

| Blok | Longgar | Ketat |
|---|---|---|
| `suspensi` | ada suspensi dalam 12 bulan sebelum t (inklusif t) | ada suspensi berumur >= 6 bulan pada t yang "belum dicabut" |
| `laporan_hilang` | kuartal Q hilang bila `akhir(Q) + 120 hari <= t` dan Q tidak tersedia | sama, 180 hari |
| `aksi_dilutif` | ada `right_issue` dengan `ex_date <= t` | rasio `new_ratio/old_ratio >= 0,5` |
| `ekuitas_negatif` | `total_equity < 0` pada kuartal terakhir `<= t` | ekuitas turun >= 50 % YoY |
| `insider_jual` | filing `sell` oleh `insider`/`institution` dalam 180 hari sebelum t | total `(before - after) >= 1` poin persen |

## Asumsi yang didokumentasikan

- **Pencabutan suspensi (ketat).** Feed suspensions tidak memuat tanggal pencabutan. Suspensi dianggap masih berlaku selama **tidak ada kuartal laporan baru** (akhir periode > tanggal suspensi dan `<= t`). Emiten yang tetap tersuspensi tetapi masih melapor (mis. SRIL 2021–2024) tidak memicu blok ketat.
- **Kuartal yang diharapkan.** Semua akhir kuartal kalender (31 Mar/30 Jun/30 Sep/31 Des) sejak kuartal pertama yang tersedia sampai t. Emiten tanpa satu pun kuartal `<= t` tidak dinilai (tidak bisa dibedakan "belum tercatat" dari "berhenti melapor").
- **Anti-lookahead daftar kuartal.** Kuartal dianggap "diketahui" pada t bila akhir periodenya `<= t`, sesuai keputusan tiket 04 (endpoint tidak memuat tanggal penyampaian).
- **Ekuitas YoY (ketat).** Pembanding = kuartal bertanggal **tepat satu tahun** sebelumnya dengan ekuitas positif; tanpa pembanding, blok tidak berbunyi (ekuitas yang sudah negatif dua tahun berturut tidak memicu ketat, hanya longgar).
- **Rights issue tanpa rasio** tidak dihitung pada ambang ketat.
- **Timestamp filing** tanpa zona (`2026-01-09T00:00:00`) diperlakukan sebagai UTC (`keDateUtc`) agar tanggal kalendernya tidak bergeser menurut zona mesin; pakai helper yang sama saat memasukkan ke DB.
- **Granularitas bulanan.** t = akhir bulan. Bunyi dihitung hanya pada `t < targetEventDate`; kejadian yang terjadi di bulan yang sama dengan target tidak sempat "terdengar" (mis. WIKA, suspensi pada tanggal target).
- **Rentang pindai.** Emiten kena: `max(2020-01-31, target - 6 tahun)` s.d. `< target`. Kontrol: `2020-01-31` s.d. `opts.today` (default hari ini UTC). Emiten kena dengan `target < 2021-01-01` ikut `total` tetapi **tidak** ikut rata-rata/median lead (`excludedFromLead: true`).
- **leadMonths** = bulan utuh antara bunyi pertama dan target (`2021-05-31 → 2024-11-01` = 41).
- **Insider (kelas A-terbatas).** Data Sectors nyata baru mulai 2024; fixture sengaja memuat filing 2021 untuk menguji logika. Klaim produk untuk blok ini hanya untuk jendela 2024+.

## Fixture `universe-kecil.json`

4 emiten kena (SRIL, TELE, GOLL delisting; WIKA watchlist) + 4 kontrol (BBCA, TLKM, ASII, UNVR). Tanggal suspensi dan daftar kuartal SRIL/TELE/GOLL mengikuti data nyata tiket 04; angka keuangan, rasio rights issue, dan filing ilustratif. UNVR sengaja memicu alarm palsu untuk `insider_jual` ketat.

Skor aturan default (`aturan-default.json`, `--today=2026-09-07`): tertangkap 2/4 (SRIL lead 41 bln, TELE 5 bln; GOLL dikecualikan; WIKA terlewat), rata-rata/median lead 23 bln, alarm palsu 0/4.
