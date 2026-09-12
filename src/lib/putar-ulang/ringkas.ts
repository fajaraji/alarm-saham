// Ringkasan & "pelajaran" berbasis fakta untuk layar putar ulang.
// Tidak ada penilaian ("berbahaya", "gorengan", "akan pailit") — hanya tanggal,
// jumlah, dan selisih bulan yang bisa dicek ke sumbernya.
import { selisihBulan } from "../engine/dates";
import type { Group } from "../engine/events";
import { sampaiTanggal } from "./filter";
import { hanyaTanda, type Kejadian } from "./kejadian";

export const BULAN_ID = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

/** "2021-05-18" → "18 Mei 2021". */
export function fmtTanggal(d: string): string {
  const y = d.slice(0, 4);
  const m = Number(d.slice(5, 7));
  const hari = Number(d.slice(8, 10));
  return `${hari} ${BULAN_ID[m - 1] ?? d.slice(5, 7)} ${y}`;
}

export const LABEL_GROUP: Record<Group, string> = {
  delisting: "dihapus dari bursa (delisting efektif 10 Nov 2026)",
  watchlist: "papan pemantauan khusus",
  control: "kontrol sehat (anggota LQ45 tanpa suspensi 2019–2026)",
};

/** "Sampai <tanggal>, sudah ada N tanda." */
export function ringkasSampai(kejadian: Kejadian[], t: string): { jumlah: number; teks: string } {
  const jumlah = hanyaTanda(sampaiTanggal(kejadian, t)).length;
  const teks =
    jumlah === 0
      ? `Sampai ${fmtTanggal(t)}, belum ada tanda di data kami.`
      : `Sampai ${fmtTanggal(t)}, sudah ada ${jumlah} tanda.`;
  return { jumlah, teks };
}

export interface KonteksPelajaran {
  symbol: string;
  group: Group | null;
  targetEventDate: string | null;
  kejadian: Kejadian[];
}

/**
 * Kotak "pelajaran": tanda pertama vs tanggal kejadian target. Semua kalimat
 * berupa fakta yang bisa dihitung ulang dari garis waktu.
 */
export function pelajaran(k: KonteksPelajaran): string[] {
  const tanda = hanyaTanda(k.kejadian);
  const baris: string[] = [];
  if (tanda.length === 0) {
    baris.push(`Tidak ada tanda untuk ${k.symbol} di data kami; yang tercatat hanya daftar laporan yang tersedia.`);
  } else {
    const pertama = tanda[0];
    baris.push(`Tanda pertama muncul ${fmtTanggal(pertama.date)}: ${pertama.judul.toLowerCase()}.`);
    if (k.targetEventDate) {
      const target = k.targetEventDate;
      const bulan = selisihBulan(pertama.date, target);
      if (pertama.date < target) {
        baris.push(
          `Itu ${bulan} bulan sebelum ${fmtTanggal(target)}, tanggal kejadian target yang kami catat${k.group ? ` (kelompok: ${LABEL_GROUP[k.group]})` : ""}.`,
        );
      } else if (pertama.date === target) {
        baris.push(
          `Tanggal itu sama dengan tanggal kejadian target yang kami catat (${fmtTanggal(target)}); di data ini tidak ada tanda yang lebih awal.`,
        );
      } else {
        baris.push(
          `Tanggal kejadian target yang kami catat adalah ${fmtTanggal(target)}, ${-bulan} bulan lebih awal; di data ini tidak ada tanda sebelum tanggal itu.`,
        );
      }
    }
    const jenis = new Set(tanda.map((x) => x.jenis));
    baris.push(`Total ${tanda.length} tanda dari ${jenis.size} jenis sumber data.`);
  }
  baris.push("Data laporan dan keuangan tersedia sejak kuartal 1 2020; filing orang dalam sejak 2024.");
  return baris;
}
