// Jawaban perintah /cek <KODE> di Telegram (tiket 43).
//
// Kenapa di Telegram: tip saham datang di Telegram, jadi ceknya paling mungkin
// dipakai di aplikasi yang sama. Orang yang baru dengar satu kode dari grup
// tidak akan membuka situs, membuat portofolio, lalu merakit blok.
//
// Nol kredit Sectors: hanya kelas A (data yang sudah ada di database kami).
// Data terkini kelas B butuh panggilan berbayar per saham, jadi tidak dipakai
// di sini, dan pesannya mengatakan apa adanya lewat kalimat template yang sama
// dengan layar Pasang dan kotak masuk pagi.
import { tanggalTarikData } from "../data/tanggal-tarik";
import { normalKode } from "../putar-ulang/muat";
import { fmtTanggal } from "../putar-ulang/ringkas";
import { ALARM_BAWAAN } from "../jaga/bawaan";
import { cekPortofolio } from "../jaga/evaluasi";
import { templatePenjelasan } from "../jaga/penjelasan";
import { sumberJaga } from "../jaga/penyedia";

export const TEKS_CEK = {
  kosong: "Tulis kode sahamnya, mis. /cek BBCA.",
  kodeSalah: (teks: string) => `“${teks}” bukan kode saham. Kode saham 2 sampai 5 huruf, mis. /cek SRIL.`,
  gagal: "Maaf, pengecekan gagal sesaat. Coba lagi sebentar lagi.",
} as const;

/** Satu pesan Telegram untuk satu kode saham; selalu menyebut tanggal datanya. */
export async function jawabanCek(kodeMasukan: string): Promise<string> {
  const teks = kodeMasukan.trim();
  if (!teks) return TEKS_CEK.kosong;
  const kode = normalKode(teks);
  if (!kode) return TEKS_CEK.kodeSalah(teks.slice(0, 20));

  const sumber = await sumberJaga();
  const hasil = await cekPortofolio({
    symbols: [kode],
    alarms: [...ALARM_BAWAAN],
    opts: {
      kelasB: false,
      source: sumber.source,
      universe: await sumber.universe(),
      sumberContoh: sumber.jenis === "fixture",
    },
  });
  const saham = hasil.saham[0];
  const baris = [templatePenjelasan(saham, hasil.today), ...saham.catatan];
  const dataPer = await tanggalTarikData(sumber.db);
  if (dataPer) baris.push(`Data kami ditarik terakhir ${fmtTanggal(dataPer)}; tanda yang terbit sesudah itu belum masuk.`);
  return baris.join("\n\n");
}
