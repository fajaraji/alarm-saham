// Klien fetch tipis untuk layar "Pasang". Semua route menjawab
// `{ error: { kode, pesan } }` saat gagal; token pemilik di header x-owner-token.
import type { AlarmKlien } from "./bawaan";
import type { BlokBKind } from "./blok-b";
import type { HasilPortofolio } from "./evaluasi";
import type { Penjelasan } from "./penjelasan";
import { HEADER_PEMILIK, type PortofolioTersimpan } from "./portofolio";
import type { PesanKotakMasuk } from "./simpan";

export interface GalatApi {
  status: number;
  kode: string;
  pesan: string;
}
export type HasilApi<T> = { ok: true; data: T } | { ok: false; galat: GalatApi };

export const KODE_TANPA_DB = "DB_TIDAK_TERSEDIA";

export interface ResponCek {
  today: string;
  sumber: string;
  saham: HasilPortofolio["saham"];
  penjelasan: Penjelasan[];
  kreditTerpakai: number;
  panggilanApi: number;
  cacheHit: number;
  kelasB: boolean;
  runId?: string;
}

export interface AlarmServer {
  id: string;
  name: string;
  rules: unknown[];
  createdAt: string;
}

async function minta<T>(url: string, init: RequestInit & { token: string | null }): Promise<HasilApi<T>> {
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: {
        ...(init.body ? { "content-type": "application/json" } : {}),
        ...(init.token ? { [HEADER_PEMILIK]: init.token } : {}),
        ...(init.headers ?? {}),
      },
    });
  } catch {
    return { ok: false, galat: { status: 0, kode: "JARINGAN", pesan: "Tidak bisa menghubungi server. Periksa koneksi lalu coba lagi." } };
  }
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  if (!res.ok) {
    const e = (json as { error?: { kode?: string; pesan?: string } } | null)?.error;
    return {
      ok: false,
      galat: { status: res.status, kode: e?.kode ?? `HTTP_${res.status}`, pesan: e?.pesan ?? `Server menjawab ${res.status}.` },
    };
  }
  return { ok: true, data: json as T };
}

export function muatPortofolioServer(token: string) {
  return minta<{ portofolio: PortofolioTersimpan | null }>("/api/portofolio", { method: "GET", token });
}

export function simpanPortofolioServer(token: string, body: { symbols: string[]; alarmIds: string[] }) {
  return minta<{ portofolio: PortofolioTersimpan }>("/api/portofolio", { method: "POST", token, body: JSON.stringify(body) });
}

export function daftarAlarmServer(token: string) {
  return minta<{ alarms: AlarmServer[] }>("/api/alarms", { method: "GET", token });
}

export function cekPortofolioServer(
  token: string | null,
  body: { symbols: string[]; alarmIds: string[]; alarms: AlarmKlien[]; kelasB: boolean; blokB?: BlokBKind[]; today?: string },
  signal?: AbortSignal,
) {
  return minta<ResponCek>("/api/portofolio/cek", { method: "POST", token, body: JSON.stringify(body), signal });
}

/** Kotak masuk di server (diisi cron harian, tiket 12); 501 bila server tanpa DB. */
export function muatKotakMasukServer(token: string) {
  return minta<{ pesan: PesanKotakMasuk[]; belumDibaca: number }>("/api/inbox", { method: "GET", token });
}

export function tandaiKotakMasukServer(token: string) {
  return minta<{ dibaca: number }>("/api/inbox", { method: "PATCH", token });
}

/** Apakah kode saham ada di data kami (GET /api/emiten → 404 bila tidak). Nol kredit. */
export async function cekAdaData(kode: string): Promise<boolean | null> {
  try {
    const res = await fetch(`/api/emiten/${encodeURIComponent(kode)}`);
    if (res.status === 404) return false;
    if (res.ok) return true;
    return null;
  } catch {
    return null;
  }
}
