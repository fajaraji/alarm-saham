# Berkas huruf yang ikut di repositori

Dipakai `src/app/layout.tsx` lewat `next/font/local`, bukan `next/font/google`.

**Kenapa disimpan di sini.** Dengan `next/font/google`, setiap `next build` mengunduh berkas huruf dari `fonts.gstatic.com`. Satu gangguan jaringan sesaat menggagalkan build dengan pesan yang menyesatkan (`Can't resolve '@vercel/turbopack-next/internal/font/google/font'`), padahal kodenya tidak berubah: itu terjadi pada CI run 36595679661 (30 Sep 2026) untuk commit yang lulus dua kali sebelumnya. Yang paling berisiko bukan CI, melainkan deploy produksi Vercel, karena ia menjalankan build yang sama. Sekarang build tidak menyentuh jaringan sama sekali, dan siapa pun bisa menyalin repositori ini lalu membangunnya tanpa internet.

**Isinya** (hanya potongan `latin`, sama seperti `subsets: ["latin"]` sebelumnya):

| Berkas | Keluarga | Ketebalan | Sumber |
|---|---|---|---|
| `inter-variabel.woff2` | Inter | 100–900 (huruf variabel, satu berkas) | Google Fonts CSS API v2 |
| `ibm-plex-mono-400.woff2` | IBM Plex Mono | 400 | Google Fonts CSS API v2 |
| `ibm-plex-mono-500.woff2` | IBM Plex Mono | 500 | Google Fonts CSS API v2 |

Inter dan IBM Plex Mono dilayani Google sebagai satu berkas variabel untuk seluruh rentang ketebalan; permintaan `wght@100;900` mengembalikan berkas yang sama, jadi yang disimpan satu saja dan rentangnya ditulis di `layout.tsx`.

**Riwayat keluarga huruf.** Sebelum 2026-10-03 folder ini juga memuat `bricolage-grotesque-variabel.woff2` (display) dan `ibm-plex-sans-variabel.woff2` (isi). Keduanya dipensiunkan ketika sistem visual memilih Inter untuk display dan isi sekaligus; berkasnya dihapus dari repositori supaya tidak ada huruf mati yang ikut terkirim atau dikira masih dipakai. Mono tetap Plex Mono karena angka dan tanggal berbaris lebih rapi di mono, dan itu alasan fungsional, bukan gaya.

**Lisensi.** Ketiganya SIL Open Font License 1.1, yang mengizinkan penyertaan dan penyebaran ulang berkasnya. Teks lisensinya ikut di folder ini: `OFL-inter.txt`, `OFL-ibm-plex-mono.txt`. Lisensi Bricolage Grotesque dan IBM Plex Sans ikut dihapus bersama berkasnya; keduanya masih tersedia di riwayat git bila diperlukan.

**Kalau perlu memperbarui**, ambil lagi dari `https://fonts.googleapis.com/css2?family=...&display=swap` dengan User-Agent peramban modern (tanpa itu Google mengirim `woff`, bukan `woff2`), lalu simpan berkas dari blok `/* latin */` saja.
