// Filter slider waktu: kejadian "sudah terjadi" pada tanggal t = bertanggal <= t
// (batas inklusif). Deret tanggal slider = akhir bulan, sama seperti mesin uji.
import { akhirBulan, daftarAkhirBulan, maksTanggal, tambahBulan } from "../engine/dates";
import type { Kejadian } from "./kejadian";

/** Kejadian yang sudah menjadi fakta pada t (inklusif t). */
export function sampaiTanggal<T extends { date: string }>(kejadian: T[], t: string): T[] {
  return kejadian.filter((k) => k.date <= t);
}

/** Kejadian yang belum terjadi pada t (diredupkan di layar). */
export function setelahTanggal<T extends { date: string }>(kejadian: T[], t: string): T[] {
  return kejadian.filter((k) => k.date > t);
}

export interface RentangSlider {
  /** Semua posisi slider (akhir bulan), urut naik, minimal satu. */
  tanggal: string[];
  awal: string;
  akhir: string;
}

/** Awal rentang slider default: 1 bulan sebelum kejadian pertama (biar terlihat "belum ada apa-apa"). */
export const BULAN_SEBELUM_PERTAMA = 1;
/** Bila tidak ada kejadian, tampilkan 24 bulan terakhir. */
export const BULAN_KOSONG = 24;

/**
 * Deret akhir bulan untuk slider, dari sebelum kejadian pertama sampai `today`.
 * `tandaiJuga` (mis. target_event_date) ikut menentukan batas awal/akhir.
 */
export function rentangSlider(kejadian: Kejadian[], today: string, tandaiJuga: string[] = []): RentangSlider {
  const semua = [...kejadian.map((k) => k.date), ...tandaiJuga].sort();
  const pertama = semua[0];
  const awal = pertama
    ? akhirBulan(tambahBulan(pertama, -BULAN_SEBELUM_PERTAMA))
    : akhirBulan(tambahBulan(today, -BULAN_KOSONG));
  const akhir = maksTanggal(akhirBulan(today), semua.at(-1) ?? today);
  const tanggal = daftarAkhirBulan(awal, akhir);
  if (tanggal.length === 0) tanggal.push(akhirBulan(today));
  return { tanggal, awal: tanggal[0], akhir: tanggal[tanggal.length - 1] };
}
