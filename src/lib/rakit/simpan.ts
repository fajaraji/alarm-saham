// Penyimpanan tanpa login (PLAN §2): token pemilik = UUID di localStorage,
// dibuat saat pertama kali. Alarm juga disalin ke localStorage agar tetap ada
// walau server tidak punya DATABASE_URL.
//
// Semua fungsi aman dipanggil di server (mengembalikan null/[] bila `window`
// tidak ada) supaya komponen klien tidak perlu penjagaan tambahan.
import type { Rule } from "../engine/rules";

export const KUNCI_PEMILIK = "alarm-saham.pemilik";
export const KUNCI_ALARM = "alarm-saham.alarm";

export interface AlarmTersimpan {
  id: string;
  name: string;
  rule: Rule;
  lastScore: Record<string, unknown> | null;
  disimpanPada: string;
  /** Di mana salinan utama tersimpan. */
  di: "db" | "lokal";
}

function storage(): Storage | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  // Fallback sangat lama (browser tanpa randomUUID): cukup unik untuk token anonim.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/** Ambil token pemilik; buat bila belum ada. `null` di server. */
export function tokenPemilik(): string | null {
  const s = storage();
  if (!s) return null;
  try {
    const ada = s.getItem(KUNCI_PEMILIK);
    if (ada && ada.length >= 16) return ada;
    const baru = uuid();
    s.setItem(KUNCI_PEMILIK, baru);
    return baru;
  } catch {
    return null;
  }
}

export function daftarAlarmLokal(): AlarmTersimpan[] {
  const s = storage();
  if (!s) return [];
  try {
    const raw = s.getItem(KUNCI_ALARM);
    if (!raw) return [];
    const data = JSON.parse(raw);
    return Array.isArray(data) ? (data as AlarmTersimpan[]) : [];
  } catch {
    return [];
  }
}

export function simpanAlarmLokal(alarm: AlarmTersimpan): AlarmTersimpan[] {
  const s = storage();
  const daftar = daftarAlarmLokal().filter((a) => a.id !== alarm.id);
  daftar.unshift(alarm);
  try {
    s?.setItem(KUNCI_ALARM, JSON.stringify(daftar));
  } catch {
    // kuota penuh / mode privat: abaikan, alarm tetap ada di memori halaman
  }
  return daftar;
}

export { uuid as buatId };
