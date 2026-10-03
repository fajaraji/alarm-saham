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

/**
 * Terjemahkan satu string `detail` mesin jadi bahasa layar: tanggal dibaca
 * orang, istilah mesin (>=, <, =, →, vs, YoY, q4) jadi kata biasa.
 *
 * `detail` diproduksi mesin dalam bentuk padat-ISO lalu dibekukan di
 * docs/skor-nyata.json (bukti reproduksi) dan dibaca regex untuk menarik
 * tanggal, jadi bentuknya tidak boleh diubah di mesin. Pengubahan ke bentuk
 * baca orang terjadi di sini, saat tampil (DESIGN.md aturan 8 dan 9). Ini
 * menyusul jejak `kalimatBlokB` dan `sumberSingkat` yang juga menerjemahkan
 * keluaran mesin di lapis tampilan. Murni, tanpa I/O.
 */
export function detailAwam(d: string): string {
  return d
    // Rentang tanggal "2026-08-24–2026-09-06" → "24 Agu 2026 sampai 6 Sep 2026".
    .replace(/(\d{4}-\d{2}-\d{2})\s*[–—]\s*(\d{4}-\d{2}-\d{2})/g, (_, a, b) => `${fmtTanggal(a)} sampai ${fmtTanggal(b)}`)
    // Tanggal ISO tunggal → "6 Sep 2026".
    .replace(/\d{4}-\d{2}-\d{2}/g, (m) => fmtTanggal(m))
    // Istilah mesin → kata biasa.
    .replace(/\bYoY\b/g, "dibanding setahun sebelumnya")
    .replace(/\s*→\s*/g, " menjadi ")
    .replace(/>=/g, "sekurang-kurangnya")
    .replace(/<\s*(?=\d)/g, "di bawah ")
    .replace(/\s*=\s*/g, " sebesar ")
    .replace(/\bvs\b/g, "dibanding")
    .replace(/\bq([1-4])\b/gi, "kuartal $1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export const LABEL_GROUP: Record<Group, string> = {
  delisting: "dihapus dari bursa (delisting efektif 10 Nov 2026)",
  watchlist: "berpotensi delisting (disuspensi lebih dari 6 bulan)",
  control: "kontrol sehat (anggota LQ45 tanpa suspensi 2019 sampai 2026)",
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
          `Itu ${bulan} bulan sebelum ${fmtTanggal(target)}, hari sahamnya berhenti diperdagangkan${k.group ? ` (kelompok: ${LABEL_GROUP[k.group]})` : ""}.`,
        );
      } else if (pertama.date === target) {
        baris.push(
          `Tanggal itu sama dengan hari sahamnya berhenti diperdagangkan (${fmtTanggal(target)}); di data ini tidak ada tanda yang lebih awal.`,
        );
      } else {
        baris.push(
          `Sahamnya sudah berhenti diperdagangkan ${fmtTanggal(target)}, ${-bulan} bulan lebih dulu; di data ini tidak ada tanda sebelum tanggal itu.`,
        );
      }
    }
    const jenis = new Set(tanda.map((x) => x.jenis));
    baris.push(`Total ${tanda.length} tanda dari ${jenis.size} jenis sumber data.`);
  }
  baris.push("Data laporan dan keuangan tersedia sejak kuartal 1 2020; filing orang dalam sejak 2024.");
  return baris;
}
