// Penyimpanan sisi browser untuk mode jaga: salinan portofolio (fallback bila
// server tidak punya DB → 501), hasil cek terakhir, dan kotak masuk (in-app).
// Token pemilik memakai `tokenPemilik()` tiket 09 (UUID di localStorage).
//
// Semua fungsi aman di server (mengembalikan null/[] bila `window` tidak ada).
import type { HasilPortofolio, StatusSaham } from "./evaluasi";
import type { Penjelasan } from "./penjelasan";

export const KUNCI_PORTOFOLIO = "alarm-saham.portofolio";
export const KUNCI_HASIL_TERAKHIR = "alarm-saham.jaga.terakhir";
export const KUNCI_KOTAK_MASUK = "alarm-saham.kotak-masuk";
export const MAKS_KOTAK_MASUK = 50;

export interface PortofolioLokal {
  symbols: string[];
  alarmIds: string[];
  disimpanPada: string;
}

export interface HasilTerakhir {
  today: string;
  dicekPada: string;
  hasil: HasilPortofolio;
  penjelasan: Penjelasan[];
}

export interface PesanKotakMasuk {
  id: string;
  waktu: string;
  symbol: string;
  status: StatusSaham;
  judul: string;
  teks: string;
  baru: boolean;
}

function storage(): Storage | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

function baca<T>(kunci: string): T | null {
  const s = storage();
  if (!s) return null;
  try {
    const raw = s.getItem(kunci);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function tulis(kunci: string, nilai: unknown): void {
  try {
    storage()?.setItem(kunci, JSON.stringify(nilai));
  } catch {
    // kuota penuh / mode privat: abaikan
  }
}

export function portofolioLokal(): PortofolioLokal | null {
  const p = baca<PortofolioLokal>(KUNCI_PORTOFOLIO);
  return p && Array.isArray(p.symbols) ? p : null;
}

export function simpanPortofolioLokal(symbols: string[], alarmIds: string[]): PortofolioLokal {
  const p: PortofolioLokal = { symbols, alarmIds, disimpanPada: new Date().toISOString() };
  tulis(KUNCI_PORTOFOLIO, p);
  return p;
}

export function hasilTerakhirLokal(): HasilTerakhir | null {
  return baca<HasilTerakhir>(KUNCI_HASIL_TERAKHIR);
}

export function simpanHasilTerakhir(h: HasilTerakhir): void {
  tulis(KUNCI_HASIL_TERAKHIR, h);
}

export function kotakMasukLokal(): PesanKotakMasuk[] {
  const d = baca<PesanKotakMasuk[]>(KUNCI_KOTAK_MASUK);
  return Array.isArray(d) ? d : [];
}

export function simpanKotakMasuk(daftar: PesanKotakMasuk[]): PesanKotakMasuk[] {
  const potong = daftar.slice(0, MAKS_KOTAK_MASUK);
  tulis(KUNCI_KOTAK_MASUK, potong);
  return potong;
}

const URUTAN: Record<StatusSaham, number> = { hijau: 0, kuning: 1, merah: 2 };

/**
 * Bendera baru = saham yang statusnya memburuk dibanding cek sebelumnya, atau
 * alarm yang baru berbunyi. Cek pertama: semua saham kuning/merah jadi bendera.
 * Murni — dipakai klien sekarang dan bisa dipakai cron (tiket 12).
 */
export function turunkanBendera(
  sebelum: HasilPortofolio | null,
  sesudah: HasilPortofolio,
  penjelasan: Penjelasan[],
  waktu: string = new Date().toISOString(),
): PesanKotakMasuk[] {
  const lama = new Map((sebelum?.saham ?? []).map((s) => [s.symbol, s]));
  const bendera: PesanKotakMasuk[] = [];
  for (const s of sesudah.saham) {
    const l = lama.get(s.symbol);
    const alarmLama = new Set((l?.alarmBerbunyi ?? []).map((a) => a.id));
    const alarmBaru = s.alarmBerbunyi.filter((a) => !alarmLama.has(a.id));
    const memburuk = l ? URUTAN[s.status] > URUTAN[l.status] : s.status !== "hijau";
    if (!memburuk && alarmBaru.length === 0) continue;
    const judul = alarmBaru.length
      ? `${s.symbol}: alarm ${alarmBaru.map((a) => `“${a.name}”`).join(", ")} berbunyi`
      : `${s.symbol}: status ${l ? `${l.status} → ` : ""}${s.status}`;
    bendera.push({
      id: `${waktu}-${s.symbol}`,
      waktu,
      symbol: s.symbol,
      status: s.status,
      judul,
      teks: penjelasan.find((p) => p.symbol === s.symbol)?.teks ?? "",
      baru: true,
    });
  }
  return bendera;
}
