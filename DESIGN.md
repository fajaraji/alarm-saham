# Arah desain Alarm Saham

Berkas ini **mencatat** sistem visual yang sudah terpasang dan sudah disetujui pemilik, bukan mengusulkan selera baru. Setiap nilai di bawah ditranskripsi dari kode yang berjalan: `src/app/globals.css` (token), `src/app/layout.tsx` (font), dan `tests/e2e/aksesibilitas.spec.ts` (gerbang kontras). Kalau ada beda antara berkas ini dan kode, kodelah yang benar dan berkas ini yang harus diperbarui.

Pemakaiannya: dibaca sebagai arah sebelum pekerjaan UI, lalu `antislop.md` dipakai sebagai penyaring di atasnya.

## Identitas

Alat informasi untuk investor ritel Indonesia yang ingin membaca tanda resmi bursa (BEI) sebelum sebuah saham bermasalah. Bukan platform trading, bukan pemberi saran. Batas itu bukan sekadar catatan hukum, ia menentukan nada seluruh produk: menampilkan fakta bertanggal dengan sumbernya, dan berhenti di situ.

Konsekuensi desainnya: produk ini harus terasa seperti **alat ukur**, bukan seperti aplikasi trading. Tidak ada grafik harga yang menggoda, tidak ada warna yang memanggil-manggil, tidak ada angka besar yang membanggakan diri.

## Dial (dibaca dari implementasi)

Reading this as: alat informasi keuangan untuk investor ritel awam, bahasa visual tenang dan berbasis dokumen, dial **ENERGY 1 / RHYTHM 1 / MOTION 1**.

| Dial | Nilai | Buktinya di kode |
|---|---|---|
| ENERGY | 1 (tenang) | Permukaan rata, garis tipis 1px, satu aksen, nol gradien, nol glass, nol glow |
| RHYTHM | 1 (seragam) | Tiap halaman memakai pola panel yang sama; keseragaman ini disengaja untuk alat, bukan kelalaian |
| MOTION | 1 (hanya hover) | Satu-satunya animasi adalah `blok-masuk` 0,25s saat blok masuk papan, dan ia dimatikan pada `prefers-reduced-motion` |

ENERGY 1 adalah keputusan, bukan kehati-hatian: alat yang memberi peringatan soal uang orang tidak boleh terasa seperti kampanye pemasaran.

## Palet

Dua warna inti (netral biru-abu dan tinta navy) + satu aksen + tiga warna semantik. Netral tidak dihitung sebagai warna inti (R-29).

| Peran | Terang | Gelap | Alasan satu baris |
|---|---|---|---|
| Aksen | `#2c3f9e` | `#8ea0ff` | Navy institusional, sengaja bukan biru-ungu default AI dan bukan hijau/merah yang sudah dipakai untuk status |
| Latar | `#f3f5f9` | `#0f1420` | Biru-abu sangat muda supaya panel putih punya dasar, bukan putih di atas putih |
| Panel | `#ffffff` | `#171d2c` | Bidang tempat data dibaca, satu tingkat di atas latar |
| Tinta | `#151c2b` / `#3f4a5f` / `#5c6880` | `#eef1f7` / `#b9c2d4` / `#8590a6` | Tiga tingkat, bukan abu acak: judul, isi, keterangan |
| Kritis | `#b93636` | `#f08a8a` | Status merah alarm, hanya untuk status, tidak pernah dekorasi |
| Peringatan | `#8a5709` | `#f0b664` | Status kuning |
| Aman | `#25794b` | `#7ad0a0` | Status hijau |

Warna blok aturan (`--b-if` navy, `--b-cond` teal `#1f6f8b`, `--b-then` cokelat `#8a5709`) memisahkan peran gramatikal di papan alarm: KALAU, syarat, MAKA. Warnanya membawa informasi, bukan hiasan.

**Kontras**: setiap pasangan teks/latar di atas sudah diverifikasi >= 4,5:1 (WCAG AA teks normal) di **kedua** tema, ditegakkan tes axe di dua mode (`tests/e2e/aksesibilitas.spec.ts`). `--ok-ink` dan `--crit-ink` ada khusus supaya teks di atas bidang status ikut berbalik saat token latarnya menjadi pastel terang di mode gelap.

## Tipografi

| Peran | Typeface | Berat | Alasan satu baris |
|---|---|---|---|
| Display | Bricolage Grotesque | 500, 700, 800 | Grotesque dengan karakter sedikit ganjil; dipilih supaya judul tidak terdengar seperti Inter/Geist yang jadi default tiap situs AI |
| Isi | IBM Plex Sans | 400, 500, 600 | Dirancang untuk keterbacaan teks padat berangka, cocok untuk halaman yang isinya tanggal dan istilah bursa |
| Data | IBM Plex Mono | 400, 500 | Angka dan tanggal berbaris rapi; mono di sini fungsional, bukan kostum "terminal" |

Mono **tidak** dipakai untuk judul (R-06). Ia hanya membungkus nilai data: tanggal, kode emiten, label cakupan data.

## Tema

Terang adalah default. Gelap menyala lewat `prefers-color-scheme` dan bisa dipaksa lewat `data-theme`. Keduanya wajib berfungsi penuh (R-34), dan itu yang dijaga tes axe dua mode.

Gelap di sini bukan pilihan gaya "biar terlihat tech": ia ada karena orang memeriksa portofolio pada jam-jam gelap, dan sistem operasinya sudah menyatakan preferensinya.

## Motif identitas

Satu motif, diulang secara sadar: **pita berwarna berlabel peran** (KALAU / MAKA) dengan tipografi display, dipasangkan dengan nilai data bertipe mono. Itu yang membuat papan alarm terlihat seperti kalimat yang bisa dibaca, bukan seperti formulir.

## Radius, bayangan, spasi

- Radius: satu himpunan kecil (`8px` kontrol, `10px`-`14px` panel dan kartu). Tidak ada elemen berbentuk pil penuh (R-11).
- Bayangan: satu token `--shadow` dipakai pada panel saja, sebagai penanda elevasi satu tingkat di atas latar. Bukan pada tombol, badge, atau ikon (R-12).
- Spasi: skala Tailwind bawaan; jarak antar-bagian lebih besar daripada jarak di dalam bagian.

## Yang sengaja TIDAK dipakai

Dicatat supaya tidak ada yang menambahkannya nanti dengan niat baik: gradien sebagai perlakuan warna utama, glassmorphism, glow, grid atau blueprint sebagai latar, ikon sparkle/robot/lightning, badge kapsul "AI Powered", jendela terminal palsu, bento grid, dan angka tanpa sumber.
