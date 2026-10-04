# Arah desain Alarm Saham

Berkas ini **mencatat** sistem visual yang sudah terpasang dan sudah disetujui pemilik, bukan mengusulkan selera baru. Setiap nilai di bawah ditranskripsi dari kode yang berjalan: `src/app/globals.css` (token), `src/app/layout.tsx` (font), dan `tests/e2e/aksesibilitas.spec.ts` (gerbang kontras). Kalau ada beda antara berkas ini dan kode, kodelah yang benar dan berkas ini yang harus diperbarui.

Pemakaiannya: dibaca sebagai arah sebelum pekerjaan UI, lalu `antislop.md` dipakai sebagai penyaring di atasnya.

## Identitas

Alat informasi untuk investor ritel Indonesia yang ingin membaca tanda resmi bursa (BEI) sebelum sebuah saham bermasalah. Bukan platform trading, bukan pemberi saran. Batas itu bukan sekadar catatan hukum, ia menentukan nada seluruh produk: menampilkan fakta bertanggal dengan sumbernya, dan berhenti di situ.

Konsekuensi desainnya: produk ini harus terasa seperti **alat ukur**, bukan seperti aplikasi trading. Tidak ada grafik harga yang menggoda, tidak ada warna yang memanggil-manggil, tidak ada angka besar yang membanggakan diri.

## Dial (dibaca dari implementasi)

Reading this as: alat informasi keuangan untuk investor ritel awam, bahasa visual tenang dan berbasis dokumen, dial **ENERGY 4 / RHYTHM 2 / MOTION 3**.

Dial ini **dinaikkan atas permintaan pemilik pada 2026-10-03**, dari ENERGY 1 / RHYTHM 1 / MOTION 1. Yang berubah dan yang tidak:

| Dial | Nilai | Buktinya di kode |
|---|---|---|
| ENERGY | 4 | Permukaan kaca berblur, butir halus di tema gelap, hero gelap bergradien, satu aksen emerald. Bukan 8: tidak ada parallax, tidak ada glow, tidak ada gambar stok |
| RHYTHM | 2 | Hero tidak seragam dengan badan halaman (disengaja, mengikuti spec), tetapi setiap halaman setelahnya tetap memakai pola panel yang sama |
| MOTION | 3 | `masuk-naik` 0,8 detik sekali per bagian, `blok-masuk` 0,25 detik, hover skala 105% pada tombol dan kartu. Dimatikan seluruhnya pada `prefers-reduced-motion` |

Batasnya masih dipegang: produk ini tetap **bukan kampanye pemasaran**. Energy 4 dipakai untuk memberi kedalaman, bukan untuk menambah hiasan ke layar data.

Perlakuan permukaan yang berat (kaca, gradien, butir, bento) tinggal di **beranda**. Rute lain membawa token, radius, dan animasi masuk yang sama, tetapi tanpa lapisan permukaan itu. Yang tetap dikecualikan di semua rute: tidak ada teks raksasa, tidak ada parallax, tidak ada gambar.

## Palet

Sistem 2026-10-03 memakai **monokrom zinc + satu aksen**. Yang berubah dari palet lama: netralnya sekarang zinc (bukan biru-abu), dan aksennya emerald (bukan navy). Tiga warna status tetap, karena status bukan dekorasi.

| Peran | Terang | Gelap | Alasan satu baris |
|---|---|---|---|
| Aksen | `#18181b` | `#34d399` | Zinc-900 di tema terang, emerald di tema gelap |
| Latar | `#f4f4f5` | `#000000` | Zinc-100 di terang, hitam murni di gelap (spec) |
| Panel | `#ffffff` | `#0a0a0a` | Bidang tempat data dibaca |
| Tinta | `#18181b` / `#3f3f46` / `#62626b` | `#fafafa` / `rgba(255,255,255,.72)` / `rgba(255,255,255,.56)` | Tiga tingkat: judul, isi, keterangan |
| Kritis | `#b93636` | `#f08a8a` | Status merah alarm, hanya untuk status |
| Peringatan | `#8a5709` | `#f0b664` | Status kuning |
| Aman | `#25794b` | `#86efac` | Status hijau |

**Kenapa aksennya berbeda per tema.** Spec memakai emerald `#34D399`. Di atas hitam ia memberi 10,9:1, tetapi di atas putih hanya **1,75:1** — jauh di bawah 4,5:1, dan akan menggagalkan gerbang axe di tema terang. Karena itu tema terang memakai zinc-900 sebagai aksen (spec sendiri menyebut "Zinc Accent #18181B"), dan emerald hidup di tema gelap serta di atas permukaan gelap mana pun. Batas yang tidak boleh dilanggar: emerald `#34D399` **tidak boleh** dipakai sebagai warna teks atau ikon di atas latar terang. Varian yang lebih gelap, `#059669`, pun hanya memberi 3,77:1 di atas putih, jadi ia juga bukan pengganti yang sah untuk teks di tema terang.

**Hijau status vs hijau aksen.** `--ok` sengaja dijauhkan dari emerald (HSL +40°, lebih kekuningan) supaya label "Aman menurut alarm" tidak pernah terbaca sebagai merek, dan sebaliknya. Di tema gelap `--ok` dinaikkan ke `#86efac` supaya tetap terpisah dari `#34d399`.

**Kenapa `--ink-3` bukan Zinc-500.** Spec menulis `#71717a`. Diukur: ia memberi 4,83:1 di atas putih **tetapi hanya 4,40:1 di atas latar halaman `#f4f4f5`** dan 3,81:1 di atas `--surface-2`. Jadi ia gagal di sebagian besar pemakaian nyatanya, bukan hanya di tepi. Dipakai `#62626b` (Zinc-600 versi lebih gelap) yang lolos di seluruh latar (terendah 4,76:1). Selisihnya tidak terlihat pada ukuran 12 sampai 13px.

Warna blok aturan (`--b-if`, `--b-cond` teal `#1f6f8b`, `--b-then` cokelat `#8a5709`) memisahkan peran gramatikal di papan alarm: KALAU, syarat, MAKA. Warnanya membawa informasi, bukan hiasan. `--b-if` di tema gelap dinaikkan ke `#52525b` supaya tetap terbaca di atas hitam murni.

**Kontras**: setiap pasangan teks/latar di atas sudah diverifikasi >= 4,5:1 (WCAG AA teks normal) di **kedua** tema, ditegakkan tes axe di dua mode (`tests/e2e/aksesibilitas.spec.ts`).

## Tipografi

| Peran | Typeface | Berat | Alasan satu baris |
|---|---|---|---|
| Display | Inter | 500–700 | Satu keluarga untuk judul dan isi (spec) |
| Isi | Inter | 300–400 | Teks padat berangka; potongan latin 48 KB, disimpan di repositori |
| Data | IBM Plex Mono | 400, 500 | Angka dan tanggal berbaris rapi; mono di sini fungsional, bukan kostum "terminal" |

**Perubahan 2026-10-03**: display dan isi dulunya Bricolage Grotesque + IBM Plex Sans, dipilih justru supaya judul tidak terdengar seperti Inter. Spec pemilik meminta Inter, jadi keduanya digantikan. Konsekuensinya diakui: judul sekarang memakai typeface yang sama dengan mayoritas situs. Yang menahan kesan generik tinggal perlakuan hurufnya — tracking `-0.05em`, leading `1.05` (spec), dan skala yang dipakai hemat.

Mono **tidak** dipakai untuk judul (R-06). Ia hanya membungkus nilai data: tanggal, kode emiten, label cakupan data.

## Tema

Terang adalah default. Gelap menyala lewat `prefers-color-scheme` dan bisa dipaksa lewat `data-theme`. Keduanya wajib berfungsi penuh (R-34), dan itu yang dijaga tes axe dua mode.

Gelap di sini bukan pilihan gaya "biar terlihat tech": ia ada karena orang memeriksa portofolio pada jam-jam gelap, dan sistem operasinya sudah menyatakan preferensinya.

**Hero beranda adalah pengecualian yang disengaja.** Ia tetap gelap di KEDUA tema, mengikuti spec yang memindahkan halaman dari hero gelap ke bagian terang. Ini diwujudkan dengan kelas `.gelap` yang menimpa token di subtree-nya, bukan dengan memaku warna gelap di JSX; karena itu isi hero tetap memakai token semantik yang sama dan pasangan kontrasnya sama dengan tema gelap yang sudah dijaga axe.

## Motif identitas

Satu motif, diulang secara sadar: **pita berwarna berlabel peran** (KALAU / MAKA) dengan tipografi display, dipasangkan dengan nilai data bertipe mono. Itu yang membuat papan alarm terlihat seperti kalimat yang bisa dibaca, bukan seperti formulir.

## Radius, bayangan, spasi, permukaan

- Radius: satu himpunan bernama sebagai token `@theme` — `--radius-bagian: 2.5rem` untuk pembungkus bagian besar, `--radius-kartu: 1.5rem` untuk kartu di dalamnya, `--radius-kartu-kecil: 1rem` untuk unsur lebih kecil. Bentuk pil penuh dipakai pada header kaca, chip daftar istilah, label sumber data, badge status, dan tombol aksi bergaya spec ("Interactive Action Button"). Kontrol form tetap bersudut di luar hero.
- Bayangan: satu token `--shadow` dipakai pada panel saja, sebagai penanda elevasi satu tingkat di atas latar. Bukan pada tombol, badge, atau ikon (R-12).
- **Permukaan kaca** (`.kaca`): `background: var(--glass-bg)`, `border: 1px solid var(--glass-line)`, `backdrop-filter: blur(var(--glass-blur))`. Nilainya berbeda antar tema karena latar di belakangnya berbeda: 5% putih di atas hitam, 55% putih di atas `#f4f4f5`. Dipakai pada header mengambang, panel "Lalu biarkan alarm menjaganya", dan kartu angka hero.
- **Butir** (`.butir::after`): lapisan tetap dari SVG `feTurbulence`, `--grain-opacity` 0 di tema terang dan 0,15 di tema gelap. Hanya di beranda dan halaman lain yang memakai latar gelap; tidak di layar kerja.
- **Gradien**: hanya di hero dan paruh atas kartu bento, selalu ke bawah dan selalu dari `transparent` ke hitam. Tidak pernah sebagai perlakuan warna utama pada bidang data.
- Spasi: skala Tailwind bawaan; jarak antar-bagian lebih besar daripada jarak di dalam bagian.

## Animasi

Tiga gerak, tidak lebih:

| Nama | Durasi | Fungsi | Dimatikan |
|---|---|---|---|
| `masuk-naik` (`.masuk`) | 0,8s, `cubic-bezier(0.16,1,0.3,1)` | Geser 20px + pudar saat bagian masuk | `prefers-reduced-motion: reduce` |
| `blok-masuk` | 0,25s | Blok yang baru dipasang di papan | idem |
| Hover | 300ms | Skala 105% pada tombol pil dan kartu bento, transisi `transform` dan warna | idem |

Ketiganya dibungkus `prefers-reduced-motion: no-preference` atau memakai media query yang sama, jadi tidak ada satu pun yang tersisa bagi pengguna yang meminta gerakan dikurangi.

### Di mana `masuk-naik` TIDAK dipasang, dan kenapa

`/rakit` dan `/putar-ulang` sengaja tidak memakainya. Alasannya bukan selera, dan bukan soal aksesibilitas: **animasi `transform` pada wadah merusak koordinat sasaran klik.**

Dua halaman itu mengukur posisi sasaran lewat `boundingBox()` dan menyentuhnya dengan koordinat hasil pengukuran itu. Selama wadahnya masih bergeser 20px menuju tempat akhir, koordinat yang diukur beberapa ratus milidetik lebih awal menunjuk titik yang sudah tidak dihuni sasarannya. Ini bukan kemungkinan teoretis: `/rakit` gagal persis begitu kelasnya dipasang (`tests/e2e/rakit.spec.ts:197`, klik kedua mendarat di tombol yang sudah bergeser).

Aturannya karena itu umum: **jangan menganimasikan wadah yang berisi sasaran seret atau sasaran yang diklik lewat koordinat.** Catatan lengkapnya di `src/components/rakit/sensor.ts`.

## Kepadatan teks

Pemilik dua kali menilai layar "kebanyakan teks, tidak nyaman dipandang" (2026-09-12 dan 2026-09-19). Pengukurannya menunjukkan sebab pokoknya bukan kalimat yang panjang, melainkan **hal yang sama diceritakan berulang kali** di satu layar. Aturan di bawah ditarik dari revisi yang sudah disetujui (antislop 7 temuan, U1–U6, beranda opsi B; lihat `docs/decisions.md`) dan berlaku untuk setiap teks yang dilihat pengguna, termasuk teks yang dibuat mesin (pesan penjelasan, kotak masuk, Telegram, jejak AI).

1. **Satu fakta tampil sekali per layar.** Bila fakta yang sama perlu hadir di dua tempat, tempat kedua terlipat (`<details>`) atau hanya merujuk ke yang pertama. Yang dipangkas adalah pengulangannya, bukan penjelasannya.
2. **Jawaban dulu, rincian terlipat.** Yang pertama terbaca di setiap hasil adalah satu kalimat jawaban. Tabel, grid per saham, daftar panjang, dan rincian teknis berada di balik lipatan.
3. **Petunjuk cara pakai hanya di satu tempat per layar**: baris petunjuk yang bisa dilipat (`PetunjukLayar`) dan overlay panduan. Pembuka halaman dan sub-judul tidak mengulangnya. Kalimat yang menunjuk kontrol yang terlihat tepat di atasnya dibuang.
4. **Teks di setiap halaman (header, footer) dibayar sekali per halaman**: hanya yang wajib (disclaimer, sumber) yang boleh ada di sana.
5. **Batas panjang**: subteks hero paling banyak 20 kata; paling banyak dua kalimat per bagian sebelum lipatan; satu kalimat per temuan; label tombol menyebut tujuannya ("Langkah 2: Rakit alarm", bukan "Lanjut").
6. **Catatan dan peringatan hanya bila berlaku** untuk yang sedang dilihat (emiten, portofolio, sumber data). Catatan umum tempatnya di halaman metodologi, bukan di setiap layar.
7. **Istilah dijelaskan lewat tooltip kamus** (`<Istilah>`), bukan kalimat penjelas di tengah teks.
8. **Tanpa teks internal di layar**: nama mesin (mis. `ritel_dominan`), nama alat agent, JSON, nama tabel, path berkas, perintah CLI, host atau driver database, dan pesan galat mentah. Sumber tetap disebut (PLAN Q5), tetapi di teks utama cukup nama sumbernya; endpoint lengkap hanya di rincian yang terlipat. Pengecualiannya halaman metodologi: di sana sumber lengkap per blok memang yang dicari pembaca.
9. **Tanda baca dan huruf**: nol em dash di teks pengguna (R-02); tanpa huruf kapital semua dengan spasi lebar, kecuali pita KALAU/MAKA dan kode emiten (R-06); tanggal untuk pengguna ditulis "6 Sep 2026", bukan ISO. Tiga pengecualian yang disadari: sel tabel bukti per emiten di `/cara-kami-menghitung` tetap ISO supaya bisa disalin mesin, `title`/atribut `data-*` penyerta mesin boleh ISO walau tampilannya tanggal awam, dan glif `–` dipakai khusus sebagai penanda nilai kosong di tabel (bukan tanda pisah).
10. **Diukur, bukan dikira.** Perubahan teks yang besar mencatat jumlah kata di `<main>` dan jarak sampai alat utama di 375×812, sebelum dan sesudah, di pesan commit.

## Skala lapisan

Satu skala bernama di `:root` (`globals.css`): `--z-lengket: 5`, `--z-overlay: 50`, `--z-lewati: 100`. Dipakai lewat `z-[var(--z-…)]` supaya tidak ada angka ajaib yang tersebar; lapisan baru memilih nama yang ada, bukan angka baru.

## Yang sengaja TIDAK dipakai

Dicatat supaya tidak ada yang menambahkannya nanti dengan niat baik.

**Tetap dilarang setelah 2026-10-03** (spec tidak memintanya, dan tidak ada alasan untuk memasukkannya):

- glow dan bayangan berwarna
- ikon sparkle, robot, atau lightning
- badge kapsul "AI Powered"
- jendela terminal palsu
- angka tanpa sumber
- parallax, sticky-stack, horizontal-pan, dan marquee
- gambar stok atau tangkapan layar palsu: setiap "gambar" di kartu bento dirender dari komponen dan token yang sama dengan halaman tujuannya

**Dicabut dari daftar larangan pada 2026-10-03** (spec memintanya, dan pemilik menyetujui penuh, lalu menegaskan cakupannya ke semua rute pada hari yang sama). Setiap pencabutan disertai batasnya:

| Teknik | Cakupan | Batas yang berlaku sekarang |
|---|---|---|
| Glassmorphism | Semua rute | Hanya `.kaca`, dan hanya pada permukaan mengambang: header, panel ajakan, dan kartu angka hero. Tidak dipakai di dalam tabel, kartu hasil uji, atau papan rakit |
| Gradien | Beranda | Hanya di hero dan paruh atas kartu bento, selalu ke bawah dan selalu ke hitam. Tidak pernah sebagai perlakuan warna utama pada bidang data |
| Butir/grain | Beranda | Hanya pada bagian hero, lewat `.butir` yang dipasang di section-nya (bukan di `<body>`). Opasitas 0 di tema terang |
| Bento grid | Beranda | Hanya tiga kartu di bagian "Lihat buktinya" |
| Radius 2.5rem/1.5rem/1rem | Semua rute | Lewat token, termasuk kenaikan `--radius-lg`/`--radius-xl` Tailwind, jadi tidak ada sisa 8px/12px lama |

Di luar beranda, yang dibawa ke semua rute adalah token, radius, dan animasi masuk; yang tinggal di beranda adalah perlakuan permukaan yang berat (kaca, gradien, butir, bento). Itu pembagian yang diinginkan pemilik, bukan pengecualian teknis.

Satu pengecualian lama yang masih berlaku: `backdrop-blur` pada bilah daftar isi lengket di `/cara-kami-menghitung` (`bg-bg/95` + `backdrop-blur`). Ini fungsional, bukan perlakuan permukaan: bilah itu menempel di atas tabel yang bergulir (kini di bawah header pil yang mengambang), dan tanpa blur labelnya bertabrakan dengan teks di bawahnya.

## Batas yang diakui: animasi masuk dan gerbang kontras

`.masuk` membuat teks mulai pada opasitas 0 dan berakhir pada 1 selama 0,8 detik. Axe mengukur kontras pada keadaan yang sedang tampil, jadi teks sekunder di tengah animasi terukur di bawah 4,5:1. Itu artefak keadaan transisi, bukan cacat produk.

Karena itu `tests/e2e/aksesibilitas.spec.ts` memindai dengan `reducedMotion: "reduce"`, yaitu keadaan akhir yang menetap bagi pembaca. Lubang yang tersisa, dinyatakan terbuka: elemen yang tetap tembus pandang setelah animasinya selesai tidak lagi tertangkap gerbang ini. Yang menutupnya adalah disiplin nilai, dan `.kaca` sengaja dijaga di 55% (terang) dan 5% (gelap), bukan lebih rendah, supaya teks di atasnya tetap lolos saat diukur sendiri.

Ada satu riwayat yang relevan dan sengaja tidak diulang: linimasa bukti di beranda pernah dianimasikan berurutan, dan gerbang axe menolaknya di kedua tema. Yang dikembalikan pada 2026-10-03 bukan animasi per baris itu, melainkan animasi per bagian pada elemen yang berisi teks pekat di atas latar pekat.
