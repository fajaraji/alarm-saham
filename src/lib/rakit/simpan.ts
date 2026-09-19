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

// ----- Tautan rahasia (tiket 23) -----------------------------------------
//
// Token pemilik adalah satu-satunya kunci portofolio di server. Supaya bisa
// dibawa ke perangkat lain, ia ditaruh di tautan `/pasang#kunci=<token>`.
// Sengaja di FRAGMENT (#), bukan query (?): fragment tidak pernah dikirim
// browser ke server, jadi kunci tidak masuk log akses, tidak ikut header
// Referer, dan tidak tersimpan di cache perantara.

export const PARAM_KUNCI = "kunci";

/**
 * Batas yang sama dengan `TokenSchema` di server (16–128 karakter), dipersempit
 * ke karakter yang aman di header HTTP dan di alamat. UUID lolos.
 */
const POLA_KUNCI = /^[A-Za-z0-9_-]{16,128}$/;

export function kunciSah(k: string): boolean {
  return POLA_KUNCI.test(k);
}

/** Token pemilik yang sudah ada di browser ini, TANPA membuat yang baru. */
export function tokenPemilikAda(): string | null {
  try {
    const ada = storage()?.getItem(KUNCI_PEMILIK) ?? null;
    return ada && ada.length >= 16 ? ada : null;
  } catch {
    return null;
  }
}

/** Pakai kunci dari tautan sebagai token pemilik. `false` bila ditolak atau tidak bisa ditulis. */
export function pasangTokenPemilik(k: string): boolean {
  if (!kunciSah(k)) return false;
  const s = storage();
  if (!s) return false;
  try {
    s.setItem(KUNCI_PEMILIK, k);
    return true;
  } catch {
    return false;
  }
}

/**
 * Ganti pemilik browser ini dengan kunci dari tautan. Salinan alarm yang
 * tersimpan di server milik pemilik lama ikut dibuang dari browser (tetap ada
 * di server, terbuka lewat tautan lamanya). Alarm yang HANYA ada di browser ini
 * tidak disentuh: tidak ada salinan lain yang bisa memulihkannya.
 */
export function gantiTokenPemilik(k: string): boolean {
  if (!pasangTokenPemilik(k)) return false;
  const sisa = daftarAlarmLokal().filter((a) => a.di !== "db");
  try {
    storage()?.setItem(KUNCI_ALARM, JSON.stringify(sisa));
  } catch {
    // abaikan: paling buruk alarm lama masih tampil sampai dibersihkan
  }
  return true;
}

/** Tautan yang membuka portofolio pemilik `token` di browser mana pun. */
export function tautanPemilik(origin: string, token: string): string {
  return `${origin}/pasang#${PARAM_KUNCI}=${encodeURIComponent(token)}`;
}

export type KunciTautan = { jenis: "tidak-ada" } | { jenis: "tidak-sah" } | { jenis: "sah"; kunci: string };

/** Baca kunci dari `location.hash` (mis. `#kunci=...`). */
export function bacaKunciTautan(hash: string): KunciTautan {
  const p = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
  if (!p.has(PARAM_KUNCI)) return { jenis: "tidak-ada" };
  const k = (p.get(PARAM_KUNCI) ?? "").trim();
  return kunciSah(k) ? { jenis: "sah", kunci: k } : { jenis: "tidak-sah" };
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

/** Buang satu alarm dari salinan browser (tiket 33). */
export function hapusAlarmLokal(id: string): AlarmTersimpan[] {
  const sisa = daftarAlarmLokal().filter((a) => a.id !== id);
  try {
    storage()?.setItem(KUNCI_ALARM, JSON.stringify(sisa));
  } catch {
    // kuota / mode privat: abaikan, daftar di memori halaman tetap diperbarui
  }
  return sisa;
}

export { uuid as buatId };
