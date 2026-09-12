// Teks awam layar "Pasang" (satu tempat agar tes & komponen sepakat).
import type { StatusSaham } from "@/lib/jaga/evaluasi";

export const TEKS = {
  eyebrow: "Langkah 3 dari 3",
  judul: "Pasang alarmmu. Sekarang dia yang berjaga.",
  // Lede halaman TIDAK ada di sini: kalimatnya bercabang menurut sumber data
  // server (data Sectors nyata vs data contoh), jadi ia dirakit di
  // src/app/pasang/page.tsx. Salinan tetap di berkas ini dulu mengklaim "data
  // resmi" tanpa syarat dan sudah tidak dipakai siapa pun.
  portofolioJudul: "Saham yang dijaga",
  portofolioSub: "Kode 4 huruf, mis. BBCA. Setiap saham cukup sekali.",
  placeholderKode: "kode",
  tombolTambah: "+ Tambah saham",
  tombolCek: "Cek sekarang",
  tombolHapusSemua: "Kosongkan",
  sedangCek: "Sedang mengecek…",
  belumAdaSaham: "Belum ada saham. Ketik kode 4 huruf di atas, mis. BBCA atau SRIL.",
  belumDicek: "Belum dicek. Klik “Cek sekarang”.",
  alarmJudul: "Alarm aktif",
  alarmSub: "Bawaan + buatanmu dari layar Rakit.",
  kelasBLabel: "Sertakan data terkini (memakai kredit Sectors)",
  kelasBSub: "Broker 14 hari, harga 90 hari: 1 kredit per saham per endpoint, di-cache 24 jam. Saham tersuspensi dilewati otomatis.",
  freeFloatLabel: "termasuk free float (snapshot seluruh bursa, 10 kredit per 24 jam)",
  pesanJudul: "Pesan penjelasan",
  pesanSub: "Untuk setiap saham: syarat mana yang terpenuhi, tanggalnya, dan sumbernya.",
  kotakJudul: "Kotak masuk",
  kotakSub: "Bendera baru sejak cek sebelumnya. Tersimpan di browser ini.",
  kotakKosong: "Belum ada bendera. Setelah cek, saham yang memburuk atau alarm yang baru berbunyi muncul di sini.",
  sumberDb: "data Sectors nyata (DB)",
  sumberFixture: "data contoh (bukan data Sectors nyata)",
  tidakAdaData: "tidak ada data",
  disimpanServer: "tersimpan di server (tautan rahasia)",
  disimpanLokal: "tersimpan di browser ini (server tanpa database)",
} as const;

// "Aman menurut alarmmu" (bukan "Aman"): produk tidak menilai emiten, hanya
// melaporkan apakah alarm yang KAMU rakit berbunyi. Sama dengan kalimat di
// src/lib/jaga/penjelasan.ts.
export const LABEL_STATUS: Record<StatusSaham, string> = {
  hijau: "Aman menurut alarmmu",
  kuning: "1 tanda",
  merah: "Alarm berbunyi",
};

export const KELAS_STATUS: Record<StatusSaham, string> = {
  hijau: "bg-ok-soft text-ok border-ok/30",
  kuning: "bg-warn-soft text-warn border-warn/30",
  merah: "bg-crit-soft text-crit border-crit/30",
};
