# Tindak lanjut audit 001

**Tanggal**: 2026-09-12
**Disetujui pemilik**: nomor **1 sampai 7** (seluruhnya)
**Arah desain**: `DESIGN.md`. Dial **ENERGY 1 / RHYTHM 1 / MOTION 1**, tidak diubah.

Untuk temuan #2 pemilik meminta "perbaiki", bukan "tuliskan alasannya", jadi jalan yang diambil adalah mengubahnya.

---

## Apa yang dikerjakan

### 1. Em dash di teks pengguna `R-02` SELESAI

**87 menjadi 0.** Diganti per kasus, bukan cari-ganti buta, karena tiap posisi menuntut tanda baca yang berbeda:

| Fungsi em dash di kalimat aslinya | Penggantinya | Contoh |
|---|---|---|
| Perumpamaan | koma | "untuk sementara, seperti toko yang disegel petugas" |
| Pertentangan | koma | "data Sectors, bukan hasil hitung ulang" |
| Label lalu nilai | titik dua | "Presisi: kalimat sah yang tidak berubah isinya" |
| Kalimat baru | titik | "laporan masih lengkap sebelumnya. Tanda-tandanya justru banyak setelah target." |
| Sisipan sungguhan | tanda kurung | "sisa kalimatnya (termasuk angka dan tanggalnya) dibiarkan utuh" |
| Daftar sisipan | tanda kurung | "untuk satu saham (suspensi, laporan yang berhenti, ekuitas negatif, rights issue) dengan slider waktu" |

**12 di antaranya ada di `src/lib/agent/instructions.ts`**, yaitu prompt sistem agent. Model menyalin gaya tanda baca dari promptnya, jadi em dash di sana mengajari AI menulis em dash ke dalam jawaban diagnosisnya sendiri. Satu berkas itu menulari setiap jawaban AI yang akan dilihat juri, dan itu sebabnya temuan ini HIGH.

Tiga em dash yang **sengaja dipertahankan**, semuanya sah:

- `HeaderNav.tsx:22` dan `putar-ulang.css:146`: komentar kode, tidak sampai ke pengguna.
- `guard.ts:46`: karakter em dash sebagai **data** di himpunan `TANDA_PISAH`. Menghapusnya justru melumpuhkan normalisasi penjaga frasa, sehingga anjuran yang memakai em dash lolos.

**Satu jebakan yang tesnya sendiri menangkap.** Di `/cara-kami-menghitung` kalimat "Kami tidak mengklaim punya penyensor yang memblokir semua kalimat beranjuran — klaim itu pernah ada di dokumen kami dan tidak benar" saya pecah dengan titik. Tes `cara-kami-menghitung.test.tsx:113` langsung merah: assertion `not.toMatch(/memblokir semua kalimat beranjuran(?![^.]*tidak)/i)` menjaga agar klaim itu **selalu satu kalimat dengan bantahannya**, dan titik memutus jaminan itu. Diganti titik koma, yang membuang em dash tanpa memecah kalimat.

Juga diperbaiki sekalian: judul `/putar-ulang` memakai em dash sebagai pemisah, sementara empat halaman lain sudah memakai titik tengah. Sekarang seragam `Putar ulang · Alarm Saham`.

### 2. Label huruf kapital berjarak `R-06` SELESAI

**14 tempat** kehilangan `uppercase` dan `tracking` lebar; pembedanya sekarang ukuran, berat, dan warna. Kena: eyebrow lima halaman, tiga kepala tabel di `/cara-kami-menghitung`, tiga label kotak skor, judul panel AI, badge "tanpa data", dan tagline header.

Dua yang **tetap huruf kapital, dengan alasan**:

- Pita **KALAU / MAKA** di papan alarm: itu motif identitas produk (`DESIGN.md`), teksnya memang literal, dan ia yang membuat papan terbaca sebagai kalimat.
- Input kode emiten (`PanelPasang.tsx:261`): fungsional, kode saham di BEI memang huruf kapital.

### 3. Hierarki tiga kartu langkah `R-14` SELESAI

Langkah 1 sekarang lebih berat daripada 2 dan 3: kolomnya lebih lebar (`1.35fr` vs `1fr`), ia satu-satunya yang berlatar panel dengan bayangan, lingkaran nomornya terisi aksen (2 dan 3 bergaris), judulnya 20px (2 dan 3 jadi 17px), dan teksnya satu tingkat lebih gelap.

Alasan satu baris: pembaca pertama kali butuh **satu** titik masuk, bukan tiga pintu setara, dan semua orang mulai dari langkah 1.

### 4. Dua deret "1, 2, 3" di satu layar `R-05` SELESAI

Angka di `PetunjukLayar` dibuang. Header menomori tiga **halaman**; petunjuk menomori **tindakan** di dalam satu halaman. Keduanya memakai angka dalam bahasa visual yang sama dan tampil berbarengan, sehingga pembaca yang sedang di "Langkah 2 dari 3" melihat deret 1/2/3 kedua yang artinya lain.

Urutannya tidak hilang: elemennya tetap `<ol>`, jadi pembaca layar tetap mendengar urutan. Tes `panduan.test.tsx` diubah untuk mengunci keputusan ini, bukan dilonggarkan: ia sekarang memeriksa tag `OL` tetap ada DAN tidak ada satu digit pun di teks petunjuk.

### 5. Header di ponsel `C-3` SELESAI

Diukur di viewport 375x812 pada `/rakit`:

| | Sebelum | Sesudah |
|---|---|---|
| Tinggi header | ~460 px | **140 px** |
| Bagian layar pertama | ~57% | **17%** |
| Baris navigasi | 2 baris membungkus + 1 tautan sendiri | 1 baris digeser mendatar |
| Gulir mendatar HALAMAN | tidak ada | **tetap tidak ada** |

Caranya: tagline disembunyikan di bawah `sm`, navigasi `flex-nowrap overflow-x-auto` (kembali `flex-wrap` di `sm` ke atas), chip diberi `shrink-0 whitespace-nowrap` supaya tidak gepeng, dan padding dirapatkan di ponsel. Gulirnya ada DI DALAM nav, bukan di halaman, jadi R-03 tetap lulus dan sudah diverifikasi lewat `document.documentElement.scrollWidth > innerWidth` yang bernilai `false`.

### 6. Tagline tampil dua kali `R-31` SELESAI

Eyebrow beranda dibuang. Kalimat "alarm saham yang bisa kamu rakit sendiri" sudah terpampang di header pada setiap halaman, dan di beranda keduanya tampil berbarengan berjarak sekitar 40px. Tidak ada alasan satu baris yang bisa dituliskan untuk itu.

### 7. Nilai kosong kotak skor `R-27` SELESAI

Glif tanda pisah pada ketiga kotak skor diganti teks **"belum diuji"** yang menyebut keadaannya. Panel sebelahnya sudah benar sejak awal ("Rakit alarm dulu, lalu klik Uji ke masa lalu"), jadi keadaan kosongnya sekarang lengkap: menyebut keadaan DAN tindakan berikutnya.

Sekalian: rentang tanggal "akhir bulan 2020-01-31 – 2026-09-07" jadi "sampai", lebih terbaca untuk pembaca awam yang jadi sasaran produk ini.

---

## Delivery Gate

### Blok 1: Hard Gate (semua harus "tidak")

| Aturan | Hasil | Bukti |
|---|---|---|
| R-02 em dash | **PASS** | Pemindai memisahkan teks pengguna dari komentar: 0 di teks pengguna (dari 87). Tiga sisa = 2 komentar kode + 1 karakter sebagai data di `guard.ts` |
| R-03 mobile | **PASS** | 375x812: `scrollWidth > innerWidth` = `false`; e2e dua varian lulus |
| R-17 angka tanpa sumber | **PASS** | Tidak ada angka baru ditambahkan; semua dari snapshot yang di-commit |
| R-18 testimoni palsu | **PASS** | Tidak ada bagian testimoni |
| R-23 aset tanpa konfirmasi | **PASS** | Tidak ada aset baru dibuat |
| R-24 tautan mati | **PASS** | Navigasi tidak diubah isinya, hanya tata letaknya |
| R-25 kontras | **PASS** | Tes axe terang DAN gelap lulus di kedua varian e2e; warna baru (`text-ink-3` pada kartu 2 dan 3) adalah pasangan yang sudah terverifikasi di `globals.css` |
| R-26 kontrol mati | **PASS** | Tidak ada kontrol ditambah atau dibuang; tautan kartu langkah tetap `href` nyata |
| R-27 keadaan UI | **PASS** | Keadaan kosong kotak skor kini menyebut keadaannya ("belum diuji") + tindakan berikutnya di panel sebelahnya |
| R-28 FAQ generik | **PASS** | Tidak ada FAQ |
| R-32 keyboard | **PASS** | Tidak ada perubahan pada urutan fokus; tes keyboard seret blok tetap lulus |
| R-33 patch lewat skrip | **PASS** | Semua perubahan di kode sumber. Skrip hanya dipakai untuk penggantian teks massal pada berkas sumber, bukan menambal CSS hasil build saat jalan |
| R-34 dua tema | **PASS** | Diperiksa mata di mode gelap (`/rakit`) + axe dua mode lulus |
| R-35 dijalankan sebelum serah | **PASS** | `next start` lokal, klik "Saya sudah paham" (overlay tertutup), beranda dan `/rakit` diperiksa di desktop dan 375x812, mode gelap diperiksa, header diukur lewat JavaScript. 683 tes unit, e2e 53 lulus (database) dan 51 lulus (data contoh), build 0 |
| R-36 klaim karangan | **PASS** | Tidak ada klaim baru |
| R-37 arah desain | **PASS** | `DESIGN.md` ada, ditranskripsi dari sistem terpasang, dial dinyatakan |
| R-38 isi karangan | **PASS** | Tidak ada isi baru; hanya tanda baca, tata letak, dan label |

### Blok 2: Purpose-Gate

Nol teknik baru ditambahkan. Gradien, glass, glow, grid latar, ikon generik, badge kapsul, ilustrasi, dan animasi template tetap **nol**, seperti sebelum audit. R-06 (huruf kapital) sudah **diperbaiki**, bukan dibiarkan dengan alasan. R-14 (kartu seragam) **diperbaiki**. R-08 (panah pada CTA) tetap satu tempat, "Mulai dari langkah 1 →", dan alasannya tertulis: ia penunjuk arah menuju langkah pertama, bukan hiasan di setiap tombol.

### Blok 3: Liveliness (semua harus "ya")

| | Hasil |
|---|---|
| Dial dinyatakan | Ya, ENERGY 1 / RHYTHM 1 / MOTION 1 di `DESIGN.md` |
| Keluaran konsisten dengan dial | Ya. RHYTHM 1 memang seragam dan itu disengaja untuk alat ukur; MOTION 1 dengan satu animasi 0,25s yang hormat pada `prefers-reduced-motion` |
| Satu titik fokus per layar | **Ya, dan ini yang paling membaik.** Beranda kini punya satu titik masuk (langkah 1), bukan tiga kartu sederajat |
| Whitespace struktural | Ya |
| Satu aksen disengaja | Ya, navy `#2c3f9e`; lingkaran terisi kini hanya di langkah 1, bukan ketiganya |
| Motif identitas | Ya, pita KALAU/MAKA, dan sekarang lebih menonjol karena huruf kapital lain sudah dibuang |
| Design Read dinyatakan | Ya, di `DESIGN.md` |

### Blok 4: Craftsmanship & Quality Locks (semua harus "tidak")

Nol pelanggaran. C-1 sampai C-5 lulus; R-05, R-11, R-15, R-16, R-20, R-21, R-29, R-30, R-31 lulus (lihat tabel "sudah diperiksa dan LULUS" di audit 001, yang tidak berubah).

**Gerbang bersih. Tidak ada FAIL.**

---

## Gerbang teknis

| | |
|---|---|
| lint / typecheck / build | 0 / 0 / 0 |
| Tes unit | **683 lulus** (62 berkas) |
| e2e jalur database | 53 lulus / 1 skip |
| e2e jalur data contoh | 51 lulus / 3 skip |

## Tes yang ikut berubah, dan kenapa

Enam berkas tes menyesuaikan diri. Penting dibedakan: **tidak satu pun assertion dilonggarkan untuk membuatnya hijau**, semuanya mengikuti teks atau kontrak yang memang berubah.

| Berkas | Perubahan |
|---|---|
| `tests/ui/panduan.test.tsx` | Diperkuat: dulu memeriksa angka "1a 2b 3c", sekarang memeriksa `<ol>` tetap ada DAN tidak ada digit di petunjuk |
| `tests/ui/cara-kami-menghitung.test.tsx` | Tidak diubah. Ia yang menangkap kesalahan saya (lihat #1) |
| `tests/unit/jaga/penjelasan.test.ts` | Format pesan pagi `SRIL — status:` jadi `SRIL (status):` |
| `tests/unit/jaga/cek-route.test.ts` | Sama |
| `tests/e2e/smoke.spec.ts` | `aria-label` merek, dan label sumber data contoh |
| `tests/e2e/pasang.spec.ts`, `tests/e2e/putar-ulang.spec.ts` | Label sumber data contoh |
