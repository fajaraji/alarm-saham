// Korpus penyensor saran investasi — tabel yang bisa dibaca manusia.
//
// Penyensor sudah tiga putaran berayun antara terlalu longgar (perintah
// telanjang "kurangi bobotnya" lolos utuh) dan terlalu rakus (usulan blok
// "ambang seharusnya dilonggarkan" ikut dimakan). Tabel di bawah adalah
// definisi operasional aturannya: satu baris = satu kalimat + keputusan +
// alasan, sehingga setiap perubahan pola di masa depan harus lulus keduanya.
//
// Aturannya berdasar SUBJEK klausa, bukan ada-tidaknya kata bingkai:
//   harusDibuang: true  → subjeknya efek/posisi/uang PENGGUNA (aturan lomba (b))
//   harusDibuang: false → subjeknya konfigurasi alarm, langkah pemeriksaan,
//                         atau fakta dari data (keluaran sah agent diagnosis)
import { describe, expect, it } from "vitest";

import { PENGGANTI_KALIMAT, nilaiKlausa, sensorObjek, sensorTeks } from "../../../src/lib/agent/guard";
import { INSTRUKSI_DASAR, INSTRUKSI_DIAGNOSIS, INSTRUKSI_PERAKIT } from "../../../src/lib/agent/instructions";

// Diekspor supaya korpus yang sama bisa dijalankan pada SALINAN penyensor versi
// lama (mis. `git show 0745f44:src/lib/agent/guard.ts`) saat memeriksa apakah
// tabel ini benar-benar menggigit. Itu cara bukti putaran 4 dikumpulkan.
export interface BarisKorpus {
  /** Satu klausa (tanpa . ! ? ; di tengah) supaya keputusannya tidak kabur. */
  kalimat: string;
  harusDibuang: boolean;
  alasan: string;
}

export const KORPUS: readonly BarisKorpus[] = [
  // =====================================================================
  // A. WAJIB DIBUANG — subjeknya efek/posisi/uang pengguna.
  // =====================================================================

  // A1. Imperatif telanjang: tanpa satu pun kata bingkai ("sebaiknya",
  //     "saran", "kamu harus"). Inilah bentuk yang lolos utuh di putaran 3.
  {
    kalimat: "Lepas saja selagi bisa",
    harusDibuang: true,
    alasan: "imperatif telanjang; verba pelepasan efek tanpa objek pun sudah anjuran",
  },
  {
    kalimat: "Kurangi bobotnya di portofolio kamu",
    harusDibuang: true,
    alasan: "imperatif telanjang; objeknya bobot portofolio pengguna",
  },
  {
    kalimat: "Keluar dulu dari posisi ini",
    harusDibuang: true,
    alasan: "imperatif telanjang; keluar dari posisi = waktu bertransaksi",
  },
  {
    kalimat: "Alihkan dananya ke yang lain",
    harusDibuang: true,
    alasan: "imperatif telanjang; pengalihan dana pengguna",
  },
  {
    kalimat: "Tahan sampai pulih saja, tidak usah panik",
    harusDibuang: true,
    alasan: "imperatif telanjang; menahan efek sampai kondisi harga tertentu",
  },
  {
    kalimat: "Pindahkan dana kamu ke emiten yang laporannya tertib",
    harusDibuang: true,
    alasan: "imperatif telanjang; alokasi dana pengguna dipindah antar-emiten",
  },
  {
    kalimat: "Amankan cuan kamu selagi bisa",
    harusDibuang: true,
    alasan: "imperatif telanjang; merealisasikan hasil transaksi",
  },
  {
    kalimat: "Serok pelan-pelan mumpung murah",
    harusDibuang: true,
    alasan: "imperatif telanjang; mengakumulasi efek pada harga tertentu",
  },
  {
    kalimat: "Jangan tambah posisi di emiten ini",
    harusDibuang: true,
    alasan: "perintah negatif; menambah posisi",
  },
  {
    kalimat: "Potong separuh porsimu sekarang",
    harusDibuang: true,
    alasan: "imperatif telanjang; mengurangi porsi kepemilikan pengguna",
  },
  {
    kalimat: "Masuk sekarang selagi harganya masih rendah",
    harusDibuang: true,
    alasan: "imperatif telanjang; waktu bertransaksi dikaitkan ke harga",
  },
  {
    kalimat: "Lepas seluruh kepemilikanmu di SRIL",
    harusDibuang: true,
    alasan: "imperatif telanjang; melepas kepemilikan pengguna",
  },

  // A2. Sesudah pengingkar (tiga bentuk berbeda) — pengingkar hanya
  //     melindungi dirinya sendiri, tidak pernah sisa klausanya.
  {
    kalimat: "Bukan ajakan, tapi kurangi bobotnya di portofolio kamu",
    harusDibuang: true,
    alasan: "pengingkar bentuk 'bukan ajakan' tidak menyelamatkan perintah sesudahnya",
  },
  {
    kalimat: "Ini bukan saran investasi, namun keluar dulu dari TELE minggu ini",
    harusDibuang: true,
    alasan: "pengingkar bentuk 'bukan saran investasi' + perintah keluar posisi",
  },
  {
    kalimat: "Saya tidak memberikan nasihat investasi, cuma menurut saya tahan sampai pulih",
    harusDibuang: true,
    alasan: "pengingkar bentuk 'tidak memberikan nasihat' + anjuran menahan efek",
  },
  {
    kalimat: "Tanpa anjuran apa pun, alihkan dananya ke emiten yang lebih sehat",
    harusDibuang: true,
    alasan: "pengingkar bentuk 'tanpa anjuran' + pengalihan dana",
  },
  {
    kalimat: "Bukan rekomendasi, melainkan sekadar catatan: porsimu terlalu besar, potong separuh",
    harusDibuang: true,
    alasan: "pengingkar + penilaian porsi pengguna dan perintah memotongnya",
  },

  // A3. Kalimat majemuk panjang — fakta dipakai sebagai pengantar anjuran.
  {
    kalimat:
      "Karena tiga blok berbunyi berturut-turut dan laporan kuartal 2 tidak pernah terbit sejak 31 Juli 2024, menurut saya porsimu di TELE terlalu besar untuk ditahan",
    harusDibuang: true,
    alasan: "kalimat majemuk panjang; ujungnya menilai porsi kepemilikan pengguna",
  },
  {
    kalimat:
      "Meski data orang dalam baru tersedia sejak 2024 dan alarmnya belum berbunyi sekali pun, keluar dulu dari saham ini sebelum laporan kuartal berikutnya",
    harusDibuang: true,
    alasan: "menyebut pelaku data, tapi ujungnya perintah keluar posisi — pengecualian fakta batal",
  },
  {
    kalimat:
      "Kalau kamu tanya saya, mending pindah ke saham lain yang laporannya tertib dan tidak pernah disuspensi",
    harusDibuang: true,
    alasan: "kalimat majemuk; inti klausanya berpindah ke efek lain",
  },
  {
    kalimat:
      "Sambil menunggu laporan kuartal 3 terbit, tahan dulu posisinya dan jangan tambah lot baru",
    harusDibuang: true,
    alasan: "kalimat majemuk; dua perintah posisi sekaligus",
  },

  // A4. Daftar berpoin — satu butir pun harus kena.
  {
    kalimat: "- Lepas TELE pelan-pelan sebelum akhir bulan",
    harusDibuang: true,
    alasan: "butir daftar berpoin; perintah melepas efek",
  },
  {
    kalimat: "2) Kurangi porsimu di SRIL jadi separuh",
    harusDibuang: true,
    alasan: "butir daftar bernomor; mengurangi porsi pengguna",
  },
  {
    kalimat: "• Alihkan dana ke deposito dulu",
    harusDibuang: true,
    alasan: "butir daftar berpoin; pengalihan dana pengguna",
  },

  // A5. Bentuk lain: pertanyaan retoris, istilah transaksi, penilaian layak.
  {
    kalimat: "Masih mau tahan sampai kapan kalau ekuitasnya sudah minus",
    harusDibuang: true,
    alasan: "pertanyaan retoris yang isinya anjuran menahan efek",
  },
  {
    kalimat: "Sebaiknya average down di harga sekarang",
    harusDibuang: true,
    alasan: "istilah transaksi (average down) tidak punya makna lain di luar pasar",
  },
  {
    kalimat: "Switching ke emiten lain lebih masuk akal sekarang",
    harusDibuang: true,
    alasan: "istilah transaksi (switching) + perpindahan antar-emiten",
  },
  {
    kalimat: "Saham ini sudah tidak layak dipertahankan menurut data kami",
    harusDibuang: true,
    alasan: "penilaian layak/tidak layak dipegang sebagai investasi",
  },
  {
    kalimat: "Uangmu lebih aman di deposito daripada di saham ini",
    harusDibuang: true,
    alasan: "mengarahkan uang pengguna ke instrumen lain",
  },
  {
    kalimat: "Hindari SRIL sampai laporannya terbit",
    harusDibuang: true,
    alasan: "menghindari efek tertentu = anjuran tidak membeli/memegang",
  },
  {
    kalimat: "Kalau saya jadi kamu, aku lepas pelan-pelan",
    harusDibuang: true,
    alasan: "'kalau saya jadi kamu' selalu tentang keputusan posisi pengguna",
  },
  {
    kalimat: "Menurut kami harga wajarnya 120 rupiah dan sekarang masih di bawah itu",
    harusDibuang: true,
    alasan: "harga wajar dipakai sebagai ajakan bertransaksi",
  },

  // A6. Fraseologi lain yang ditemukan saat memprobe pola putaran 4 — semuanya
  //     sempat lolos sebelum polanya dirapikan, jadi dikunci di sini.
  {
    kalimat: "Buang saja saham ini dari portofoliomu",
    harusDibuang: true,
    alasan: "perintah membuang efek dari portofolio pengguna",
  },
  {
    kalimat: "Sebaiknya kamu tidak menaruh uang di emiten seperti ini",
    harusDibuang: true,
    alasan: "menempatkan uang pengguna pada suatu emiten = alokasi dana",
  },
  {
    kalimat: "Pindahkan saja ke saham bank yang lebih aman",
    harusDibuang: true,
    alasan: "perpindahan ke efek lain dengan penilaian 'lebih aman'",
  },
  {
    kalimat: "Simpan saja dulu, jangan dilepas",
    harusDibuang: true,
    alasan: "dua perintah posisi sekaligus: menahan dan larangan melepas",
  },
  {
    kalimat: "Ambil untungnya sekarang mumpung masih hijau",
    harusDibuang: true,
    alasan: "merealisasikan hasil transaksi pada waktu tertentu",
  },
  {
    kalimat: "Cut loss saja daripada nyangkut lebih dalam",
    harusDibuang: true,
    alasan: "istilah transaksi cut loss; juga ada di KATA_TERLARANG",
  },
  {
    kalimat: "Sebaiknya kamu tidak menambah SRIL lagi",
    harusDibuang: true,
    alasan: "objek terdekat sesudah 'menambah' adalah kode emiten, bukan istilah alarm",
  },
  {
    kalimat: "Sebaiknya kamu tidak lagi memegang SRIL",
    harusDibuang: true,
    alasan: "memegang efek = menahan posisi",
  },

  // A7. Campur konfigurasi alarm + posisi → klausa itu saja yang dibuang.
  {
    kalimat: "Tambahkan blok suspensi ke alarmmu dan sekalian kurangi posisimu di SRIL",
    harusDibuang: true,
    alasan: "klausa campur: usulan blok ditempeli perintah mengurangi posisi",
  },
  {
    kalimat: "Perketat ambang laporan_hilang jadi 120 hari, lalu lepas sisanya kalau masih merah",
    harusDibuang: true,
    alasan: "klausa campur: usulan ambang ditempeli perintah melepas efek",
  },
  {
    kalimat: "Periksa laporan kuartalnya dulu, baru tentukan mau tahan sampai pulih atau tidak",
    harusDibuang: true,
    alasan: "klausa campur: langkah pemeriksaan ditempeli anjuran menahan efek",
  },

  // =====================================================================
  // B. WAJIB DIPERTAHANKAN UTUH.
  // =====================================================================

  // B1. Usulan blok dalam berbagai fraseologi — keluaran INTI agent
  //     diagnosis (INSTRUKSI_DIAGNOSIS menyuruh "usulkan perbaikan").
  {
    kalimat: "Sebaiknya tambahkan blok suspensi ke aturan ini",
    harusDibuang: false,
    alasan: "subjeknya konfigurasi alarm; bingkai 'sebaiknya' tidak lagi menggugurkan",
  },
  {
    kalimat: "Saya sarankan perketat ambang laporan_hilang jadi 120 hari",
    harusDibuang: false,
    alasan: "subjeknya ambang blok, bukan posisi pengguna",
  },
  {
    kalimat: "Rekomendasi saya: jalankan uji ke masa lalu lagi setelah bloknya ditambah",
    harusDibuang: false,
    alasan: "subjeknya langkah pemeriksaan; kata 'rekomendasi' saja bukan bukti",
  },
  {
    kalimat: "Ambang ekuitas negatif seharusnya dilonggarkan agar TELE tertangkap",
    harusDibuang: false,
    alasan: "subjeknya ambang; 'seharusnya' telanjang pernah memakan kalimat ini",
  },
  {
    kalimat: "Blok laporan_hilang disarankan memakai ambang 120 hari, bukan 180 hari",
    harusDibuang: false,
    alasan: "subjeknya blok; 'disarankan' telanjang pernah memakan kalimat ini",
  },
  {
    kalimat: "Usulan perbaikan: tambahkan blok aksi_dilutif dengan ambang ketat",
    harusDibuang: false,
    alasan: "fraseologi usulan blok yang lain; subjeknya tetap konfigurasi alarm",
  },
  {
    kalimat: "Kombinasi any dengan tiga blok akan menangkap TELE empat bulan lebih awal",
    harusDibuang: false,
    alasan: "menjelaskan efek aturan pada uji ke masa lalu, bukan meramal harga",
  },
  {
    kalimat: "- Tambahkan blok suspensi (ambang longgar)",
    harusDibuang: false,
    alasan: "usulan blok di dalam daftar berpoin tetap selamat",
  },
  {
    kalimat: "2) Perketat ambang ekuitas_negatif jadi ketat",
    harusDibuang: false,
    alasan: "usulan pengetatan di dalam daftar bernomor tetap selamat",
  },
  {
    kalimat: "Hapus blok ritel_dominan karena tidak pernah berbunyi di data 2020-2024",
    harusDibuang: false,
    alasan: "menghapus blok = konfigurasi alarm, bukan melepas efek",
  },

  // B2. Langkah pemeriksaan.
  {
    kalimat: "Jalankan backtest ulang setelah aturannya diubah",
    harusDibuang: false,
    alasan: "langkah pemeriksaan; verba 'jalankan' bukan verba transaksi",
  },
  {
    kalimat: "Periksa TELE dengan blok laporan hilang ambang ketat",
    harusDibuang: false,
    alasan: "langkah pemeriksaan atas satu emiten",
  },
  {
    kalimat: "Baca pengumuman resmi bursa untuk memastikan tanggal suspensinya",
    harusDibuang: false,
    alasan: "langkah membaca dokumen sumber",
  },
  {
    kalimat: "Kami sarankan membaca pengumuman resmi bursa untuk tanggal suspensinya",
    harusDibuang: false,
    alasan: "anjuran membaca sumber — bingkai anjuran dengan subjek pemeriksaan",
  },
  {
    kalimat: "Nyalakan pemantauan harian untuk emiten yang pernah disuspensi",
    harusDibuang: false,
    alasan: "menyalakan pemantauan = konfigurasi alat, bukan transaksi",
  },
  {
    kalimat: "Cari emiten pembanding di sektor yang sama sebelum menyimpulkan",
    harusDibuang: false,
    alasan: "langkah pemeriksaan; 'cari emiten' tanpa 'lain' bukan perpindahan posisi",
  },

  // B3. Kalimat fakta yang memuat kata jual/beli.
  {
    kalimat: "Ada 2 filing jual oleh orang dalam pada 2024-12-27",
    harusDibuang: false,
    alasan: "fakta data: frasa 'filing jual' + pelaku pihak ketiga",
  },
  {
    kalimat: "Asing menjual bersih 12 miliar rupiah sepanjang Desember 2024",
    harusDibuang: false,
    alasan: "fakta data: pelakunya investor asing, bukan pengguna",
  },
  {
    kalimat: "Broker ritel membeli 3 juta lot pada hari yang sama",
    harusDibuang: false,
    alasan: "fakta data: pelakunya broker ritel, bukan pengguna",
  },
  {
    kalimat: "Transaksi jual tercatat dua kali di data filing kami",
    harusDibuang: false,
    alasan: "fakta data: frasa mesin 'transaksi jual'",
  },
  {
    kalimat: "Orang dalam melepas sahamnya sejak Juli 2024, tercatat di blok insider_jual",
    harusDibuang: false,
    alasan: "fakta data: pelaku orang dalam + nama blok insider_jual",
  },
  {
    kalimat: "Ritel dominan, institusi melepas 3 poin persen kepemilikan",
    harusDibuang: false,
    alasan: "fakta data: pelakunya institusi; label blok apa adanya",
  },
  {
    kalimat: "Tipe jual pada filing itu adalah pelepasan oleh institusi",
    harusDibuang: false,
    alasan: "fakta data: frasa mesin 'tipe jual' + pelaku institusi",
  },

  // B4. Fakta dan kalimat wajib lain.
  {
    kalimat: "Laporan keuangan kuartal 2 seharusnya terbit 31 Juli 2024, tetapi sampai 10 September belum ada",
    harusDibuang: false,
    alasan: "'seharusnya' di sini kewajiban pelaporan, bukan anjuran ke pengguna",
  },
  {
    kalimat: "Emiten seharusnya menyampaikan laporan keuangan paling lambat 3 bulan setelah tutup buku",
    harusDibuang: false,
    alasan: "aturan bursa; subjeknya emiten, bukan posisi pengguna",
  },
  {
    kalimat: "Suspensi dicabut setelah emiten memenuhi rekomendasi otoritas bursa",
    harusDibuang: false,
    alasan: "fakta; kata 'rekomendasi' milik otoritas bursa, bukan ajakan transaksi",
  },
  {
    kalimat: "Ekuitas TELE negatif sejak kuartal 3 2023 menurut data laporan keuangan",
    harusDibuang: false,
    alasan: "fakta angka laporan keuangan",
  },
  {
    kalimat: "Alarm Saham adalah alat informasi, bukan saran investasi",
    harusDibuang: false,
    alasan: "disclaimer wajib PLAN §2 — tidak boleh tersensor oleh polanya sendiri",
  },
  {
    kalimat: "Saham ini masih tersuspensi menurut data kami sejak 18 Mei 2021",
    harusDibuang: false,
    alasan: "fakta status suspensi walau menyebut kata 'saham'",
  },
  {
    kalimat: "Alarm bolong di TELE karena blok suspensi baru berbunyi di bulan kejadian",
    harusDibuang: false,
    alasan: "inti diagnosis: sebab alarm tidak berbunyi",
  },
  {
    kalimat: "Data orang dalam hanya tersedia mulai 2024, jadi blok insider_jual tidak bisa menolong untuk kejadian 2021",
    harusDibuang: false,
    alasan: "keterbatasan data — INSTRUKSI_DASAR butir 4 justru mewajibkannya",
  },

  // B5. Jebakan kata: bentuk yang MIRIP anjuran tetapi subjeknya dokumen,
  //     aturan alarm, atau tindakan bursa. Semua pernah nyaris ikut termakan
  //     saat pola putaran 4 disusun, jadi dikunci di sini.
  {
    kalimat: "Setelah blok laporan_hilang ditambah, TELE tertangkap 4 bulan lebih awal",
    harusDibuang: false,
    alasan: "'ditambah' bentuk pasif untuk blok — subjeknya aturan, bukan posisi",
  },
  {
    kalimat: "Tambah satu blok lagi untuk TELE supaya alarmnya tidak bolong",
    harusDibuang: false,
    alasan: "'tambah' + kode emiten tanpa objek milik pengguna = usulan blok",
  },
  {
    kalimat: "Laporan kuartal 2 baru keluar sekarang setelah telat lima bulan",
    harusDibuang: false,
    alasan: "'keluar sekarang' yang subjeknya laporan, bukan posisi pengguna",
  },
  {
    kalimat: "Kami menunggu sampai laporan kuartal 3 terbit sebelum menilai ulang aturannya",
    harusDibuang: false,
    alasan: "'menunggu sampai' soal jadwal laporan, bukan menunggu di luar pasar",
  },
  {
    kalimat: "Perdagangan sahamnya ditahan bursa sampai pengumuman resmi terbit",
    harusDibuang: false,
    alasan: "'ditahan' oleh bursa = fakta tindakan otoritas, bukan menahan posisi",
  },
  {
    kalimat: "Emiten ini berisiko delisting menurut kombinasi tiga blok di aturanmu",
    harusDibuang: false,
    alasan: "peringatan risiko delisting adalah pesan inti alat ini, bukan penilaian investasi",
  },
  {
    kalimat: "Kalau kamu menambah blok suspensi, TELE tertangkap empat bulan lebih awal",
    harusDibuang: false,
    alasan: "pasangan lawan dari 'menambah SRIL': objek terdekatnya blok, jadi usulan aturan",
  },
  {
    kalimat: "Kamu bisa menambahkan blok baru lewat halaman Rakit kalau mau alarmnya lebih peka",
    harusDibuang: false,
    alasan: "ajakan memakai fitur alat, subjeknya konfigurasi alarm",
  },
];

const DIBUANG = KORPUS.filter((b) => b.harusDibuang);
const DIPERTAHANKAN = KORPUS.filter((b) => !b.harusDibuang);

/** Tambahkan titik bila barisnya belum berakhiran tanda baca kalimat. */
function utuh(kalimat: string): string {
  return /[.!?]$/.test(kalimat) ? kalimat : `${kalimat}.`;
}
function tandaAkhir(kalimat: string): string {
  return /[.!?]$/.exec(kalimat)?.[0] ?? ".";
}

const SEBELUM = "Ekuitas negatif sejak 2023-09-30.";
const SESUDAH = "Suspensi masih aktif.";

describe("korpus penyensor", () => {
  it("cukup besar untuk mengunci aturannya (>= 24 baris tiap sisi)", () => {
    expect(DIBUANG.length).toBeGreaterThanOrEqual(24);
    expect(DIPERTAHANKAN.length).toBeGreaterThanOrEqual(24);
    // Tidak ada baris yang menyelundup dua pemenggal — satu baris = satu klausa,
    // supaya kegagalan menunjuk ke satu keputusan, bukan ke campuran.
    for (const b of KORPUS) expect(b.kalimat.replace(/[.!?]$/, ""), b.kalimat).not.toMatch(/[.!?;\n]/);
    for (const b of KORPUS) expect(b.alasan.length, b.kalimat).toBeGreaterThan(10);
  });

  describe("A. wajib dibuang (subjek efek/posisi/uang pengguna)", () => {
    it.each(DIBUANG)("$kalimat", ({ kalimat }) => {
      const r = sensorTeks(utuh(kalimat));
      expect(r.kalimatDibuang).toBe(1);
      expect(r.teks).toBe(`${PENGGANTI_KALIMAT}${tandaAkhir(utuh(kalimat))}`);
    });

    it.each(DIBUANG)("tanpa menyeret tetangganya: $kalimat", ({ kalimat }) => {
      const r = sensorTeks(`${SEBELUM}\n${utuh(kalimat)}\n${SESUDAH}`);
      expect(r.kalimatDibuang).toBe(1);
      expect(r.teks).toBe(
        `${SEBELUM}\n${PENGGANTI_KALIMAT}${tandaAkhir(utuh(kalimat))}\n${SESUDAH}`,
      );
    });
  });

  describe("B. wajib dipertahankan utuh (subjek alarm/pemeriksaan/fakta)", () => {
    it.each(DIPERTAHANKAN)("$kalimat", ({ kalimat }) => {
      const teks = utuh(kalimat);
      const r = sensorTeks(teks);
      expect(r.teks).toBe(teks);
      expect(r.kalimatDibuang).toBe(0);
      expect(r.kata).toEqual([]);
    });
  });
});

describe("bentuk keluaran nyata", () => {
  it("daftar berpoin: butir anjuran hilang, butir usulan blok selamat", () => {
    const teks = [
      "Alarm bolong di TELE karena blok suspensi baru berbunyi di bulan kejadian.",
      "- Tambahkan blok laporan_hilang dengan ambang longgar.",
      "- Lepas TELE pelan-pelan sebelum akhir bulan.",
      "- Jalankan uji ke masa lalu lagi sesudahnya.",
    ].join("\n");
    const r = sensorTeks(teks);
    expect(r.kalimatDibuang).toBe(1);
    expect(r.teks).toBe(
      [
        "Alarm bolong di TELE karena blok suspensi baru berbunyi di bulan kejadian.",
        "- Tambahkan blok laporan_hilang dengan ambang longgar.",
        `${PENGGANTI_KALIMAT}.`,
        "- Jalankan uji ke masa lalu lagi sesudahnya.",
      ].join("\n"),
    );
  });

  it("paragraf diagnosis nyata: fakta + usulan selamat, anjuran posisi hilang", () => {
    const teks =
      "Alarm bolong di TELE karena blok suspensi baru berbunyi di bulan kejadian. " +
      "Laporan kuartal 2 seharusnya terbit 31 Juli 2024, tetapi tidak pernah muncul. " +
      "Ambang laporan_hilang seharusnya dilonggarkan ke 120 hari. " +
      "Ini bukan saran investasi, namun keluar dulu dari TELE minggu ini. " +
      "Alarm Saham adalah alat informasi, bukan saran investasi.";
    const r = sensorTeks(teks);
    expect(r.kalimatDibuang).toBe(1);
    expect(r.teks).toContain("Ambang laporan_hilang seharusnya dilonggarkan ke 120 hari.");
    expect(r.teks).toContain("Alarm Saham adalah alat informasi, bukan saran investasi.");
    expect(r.teks).not.toMatch(/keluar dulu/i);
    expect(r.teks).toContain(PENGGANTI_KALIMAT);
  });

  it("pengingkar tetap selamat sebagai kalimat mandiri, tapi tidak menyelamatkan tetangganya", () => {
    for (const pengingkar of [
      "Ini bukan saran investasi",
      "Kami tidak memberikan nasihat investasi",
      "Tanpa anjuran apa pun",
    ]) {
      const r = sensorTeks(`${pengingkar}. Kurangi bobotnya di portofolio kamu.`);
      expect(r.teks, pengingkar).toBe(`${pengingkar}. ${PENGGANTI_KALIMAT}.`);
      expect(r.kalimatDibuang, pengingkar).toBe(1);
    }
  });
});

describe("usulanBlok — data terstruktur tidak pernah lewat penyensor kalimat", () => {
  const LEWATI = ["kind", "threshold", "symbol", "buktiTanggal"];

  it("kind/threshold/symbol/tanggal kembali persis, apa pun isinya", () => {
    const masukan = {
      emitenDibahas: [{ symbol: "SRIL", sebab: "ekuitas negatif sejak 2023-09-30", buktiTanggal: ["2024-12-27"] }],
      usulanBlok: [
        { kind: "insider_jual", threshold: "ketat", alasan: "orang dalam melepas sahamnya sejak Juli 2024" },
        { kind: "laporan_hilang", threshold: "longgar", alasan: "Ambang 180 hari disarankan diturunkan ke 120 hari" },
      ],
    };
    const r = sensorObjek(masukan, LEWATI);
    expect(r.hasil).toEqual(masukan);
    expect(r.perluTinjau).toBe(false);
    expect(r.kalimatDibuang).toBe(0);
    expect(r.kataDisensor).toEqual([]);
  });

  it("alasan usulan blok dalam berbagai fraseologi selamat utuh", () => {
    for (const alasan of [
      "Sebaiknya tambahkan blok suspensi ke aturan ini",
      "Saya sarankan perketat ambang laporan_hilang jadi 120 hari",
      "Rekomendasi saya: jalankan uji ke masa lalu lagi setelah bloknya ditambah",
      "Ambang ekuitas negatif seharusnya dilonggarkan agar TELE tertangkap",
    ]) {
      const r = sensorObjek({ usulanBlok: [{ kind: "suspensi", threshold: "longgar", alasan }] }, LEWATI);
      expect(r.hasil.usulanBlok[0].alasan, alasan).toBe(alasan);
      expect(r.perluTinjau, alasan).toBe(false);
    }
  });

  it("anjuran posisi yang diselundupkan ke alasan tetap dibuang dan ditandai", () => {
    const r = sensorObjek(
      { usulanBlok: [{ kind: "suspensi", threshold: "longgar", alasan: "Kurangi posisimu di SRIL sebelum akhir bulan" }] },
      LEWATI,
    );
    expect(r.hasil.usulanBlok[0].alasan).toBe(`${PENGGANTI_KALIMAT}`);
    expect(r.perluTinjau).toBe(true);
  });
});

describe("instruksi sistem tetap menyuruh model mengusulkan blok", () => {
  it("INSTRUKSI_DIAGNOSIS masih meminta usulan blok + pengetatan", () => {
    expect(INSTRUKSI_DIAGNOSIS).toMatch(/usulkan perbaikan/i);
    expect(INSTRUKSI_DIAGNOSIS).toMatch(/Usulkan MAKSIMAL 2 blok tambahan atau pengetatan/i);
    expect(INSTRUKSI_DIAGNOSIS).toContain("usulanBlok");
  });

  it("INSTRUKSI_PERAKIT masih meminta model menyusun blok", () => {
    expect(INSTRUKSI_PERAKIT).toMatch(/PERAKIT BLOK/);
    expect(INSTRUKSI_PERAKIT).toContain("blocks: [{ kind, threshold }]");
  });

  it("INSTRUKSI_DASAR memisahkan yang dilarang dari yang justru boleh diusulkan", () => {
    // Tanpa butir 1b, penyensor dan instruksi saling bertentangan: model diminta
    // mengusulkan perbaikan alarm sambil dilarang membingkai kalimat sebagai
    // anjuran. 1b menyatakan batasnya = SUBJEK anjurannya.
    expect(INSTRUKSI_DASAR).toMatch(/ATURAN ALARM/);
    expect(INSTRUKSI_DASAR).toMatch(/LANGKAH PEMERIKSAAN/);
    expect(INSTRUKSI_DASAR).toMatch(/subjeknya posisi, porsi, alokasi dana, harga, atau waktu transaksi/i);
  });
});

describe("klausa ragu — dipertahankan tapi ditandai (aturan 6)", () => {
  it("anjuran ke pengguna tanpa subjek pasar yang jelas: teks utuh, perluTinjau true", () => {
    const teks = "Sebaiknya kamu segera menghubungi brokermu.";
    const r = sensorTeks(teks);
    expect(r.teks).toBe(teks);
    expect(r.kalimatDibuang).toBe(0);
    expect(r.kalimatRagu).toBe(1);
    expect(sensorObjek({ ringkasan: teks }).perluTinjau).toBe(true);
  });

  it("usulan blok berorang kedua tidak ikut ditandai ragu (fitur inti tidak berisik)", () => {
    const n = nilaiKlausa("Sebaiknya kamu tambahkan blok suspensi ke alarmmu");
    expect(n.alarm).toBe(true);
    expect(n.pasar).toBe(false);
    expect(n.ragu).toBe(false);
  });
});
