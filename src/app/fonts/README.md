# Berkas huruf yang ikut di repositori

Dipakai `src/app/layout.tsx` lewat `next/font/local`, bukan `next/font/google`.

**Kenapa disimpan di sini.** Dengan `next/font/google`, setiap `next build` mengunduh berkas huruf dari `fonts.gstatic.com`. Satu gangguan jaringan sesaat menggagalkan build dengan pesan yang menyesatkan (`Can't resolve '@vercel/turbopack-next/internal/font/google/font'`), padahal kodenya tidak berubah: itu terjadi pada CI run 36595679661 (30 Sep 2026) untuk commit yang lulus dua kali sebelumnya. Yang paling berisiko bukan CI, melainkan deploy produksi Vercel, karena ia menjalankan build yang sama. Sekarang build tidak menyentuh jaringan sama sekali, dan siapa pun bisa menyalin repositori ini lalu membangunnya tanpa internet.

**Isinya** (hanya potongan `latin`, sama seperti `subsets: ["latin"]` sebelumnya):

| Berkas | Keluarga | Ketebalan | Sumber |
|---|---|---|---|
| `bricolage-grotesque-variabel.woff2` | Bricolage Grotesque | 500–800 (huruf variabel, satu berkas) | Google Fonts CSS API v2 |
| `ibm-plex-sans-variabel.woff2` | IBM Plex Sans | 400–600 (huruf variabel, satu berkas) | Google Fonts CSS API v2 |
| `ibm-plex-mono-400.woff2` | IBM Plex Mono | 400 | Google Fonts CSS API v2 |
| `ibm-plex-mono-500.woff2` | IBM Plex Mono | 500 | Google Fonts CSS API v2 |

Bricolage Grotesque dan IBM Plex Sans dilayani Google sebagai satu berkas variabel untuk seluruh rentang ketebalan; permintaan `wght@500;700;800` mengembalikan berkas yang sama tiga kali, jadi yang disimpan satu saja dan rentangnya ditulis di `layout.tsx`.

**Lisensi.** Ketiganya SIL Open Font License 1.1, yang mengizinkan penyertaan dan penyebaran ulang berkasnya. Teks lisensinya ikut di folder ini: `OFL-bricolage-grotesque.txt`, `OFL-ibm-plex-sans.txt`, `OFL-ibm-plex-mono.txt`.

**Kalau perlu memperbarui**, ambil lagi dari `https://fonts.googleapis.com/css2?family=...&display=swap` dengan User-Agent peramban modern (tanpa itu Google mengirim `woff`, bukan `woff2`), lalu simpan berkas dari blok `/* latin */` saja.
