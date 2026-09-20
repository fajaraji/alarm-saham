// Klien fetch tipis untuk layar "Rakit alarm": semua route mengembalikan
// `{ error: { kode, pesan } }` saat gagal, jadi satu pembungkus cukup.
// Tidak melempar — komponen membaca `ok` dan menampilkan pesan awam.
import { bacaNdjson, TIPE_BERTAHAP } from "../agent/bertahap";
import type { DiagnosisResult, TraceStep } from "../agent/diagnosis";
import type { HasilRakit } from "../agent/rakit";
import type { Rule } from "../engine/rules";
import type { BacktestResult } from "../engine/score";

export interface GalatApi {
  /** 0 = jaringan/parse gagal (bukan jawaban server). */
  status: number;
  kode: string;
  pesan: string;
}

export type HasilApi<T> = { ok: true; data: T } | { ok: false; galat: GalatApi };

export interface ResponBacktest {
  /** "db" = data Sectors nyata (Neon/Postgres/PGlite); "fixture" = data contoh. */
  sumber: "db" | "fixture";
  /** Jenis sumber persis dari server (neon | postgres | pglite | fixture). */
  jenis?: "neon" | "postgres" | "pglite" | "fixture";
  keterangan: string;
  /** Emiten kena yang dilewati karena tanggal berhentinya diperdagangkan tidak diketahui. */
  dilewati?: string[];
  /** Tanggal data kelas A terakhir ditarik (YYYY-MM-DD); null pada data contoh. */
  dataPer?: string | null;
  hasil: BacktestResult;
}

export type ResponRakit = HasilRakit;

export interface ResponDiagnosis extends DiagnosisResult {
  sumber: string;
  backtest: { hits: number; total: number; falseAlarms: number; controls: number };
}

export interface ResponSimpanAlarm {
  id: string;
  di: "db";
  createdAt: string;
}

export const KODE_AI_NONAKTIF = "AI_TIDAK_TERSEDIA";
export const KODE_DB_NONAKTIF = "DB_TIDAK_TERSEDIA";

/** Teks banner sopan saat kunci AI belum diisi (503). */
export const PESAN_AI_NONAKTIF = "Fitur AI belum aktif: kunci belum diisi. Kamu tetap bisa merakit sendiri.";

export function aiNonaktif(galat: GalatApi): boolean {
  return galat.status === 503 && galat.kode === KODE_AI_NONAKTIF;
}

function galatJaringan(err: unknown): HasilApi<never> {
  const pesan = err instanceof Error && err.name === "AbortError" ? "Permintaan dibatalkan." : "Tidak bisa menghubungi server. Periksa koneksi lalu coba lagi.";
  return { ok: false, galat: { status: 0, kode: "JARINGAN", pesan } };
}

export async function posJson<T>(url: string, body: unknown, init?: { signal?: AbortSignal }): Promise<HasilApi<T>> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: init?.signal,
    });
  } catch (err) {
    return galatJaringan(err);
  }
  return jawabanJson<T>(res);
}

/** Jawaban JSON biasa → HasilApi. Dipakai `posJson` dan jalur cadangan diagnosis. */
async function jawabanJson<T>(res: Response): Promise<HasilApi<T>> {
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
      galat: {
        status: res.status,
        kode: e?.kode ?? `HTTP_${res.status}`,
        pesan: e?.pesan ?? `Server menjawab ${res.status}.`,
      },
    };
  }
  return { ok: true, data: json as T };
}

export function ujiKeMasaLalu(rule: Rule, opsi?: { today?: string; signal?: AbortSignal }) {
  return posJson<ResponBacktest>("/api/backtest", { rule, ...(opsi?.today ? { today: opsi.today } : {}) }, opsi);
}

export function mintaAiRakit(kalimat: string, opsi?: { signal?: AbortSignal }) {
  return posJson<ResponRakit>("/api/agent/rakit", { kalimat }, opsi);
}

/**
 * Minta diagnosis, dengan langkah agent diterima satu per satu (tiket 22).
 *
 * Klien meminta jawaban bertahap lewat header `accept`. Bila server menjawab
 * bertahap, setiap baris `langkah` diteruskan ke `onLangkah` begitu tiba, dan
 * baris `selesai`/`galat` menjadi hasil akhir dalam bentuk yang SAMA dengan
 * jawaban JSON biasa. Bila server menjawab JSON biasa (galat 400/429/503 yang
 * diputuskan sebelum agent mulai, atau server lama), jawabannya dibaca seperti
 * sebelumnya, jadi pengenalan "AI nonaktif" dan "terlalu sering" tidak berubah.
 */
export async function mintaDiagnosis(
  rule: Rule,
  backtest: BacktestResult,
  opsi?: { signal?: AbortSignal; onLangkah?: (langkah: TraceStep[]) => void },
): Promise<HasilApi<ResponDiagnosis>> {
  let res: Response;
  try {
    res = await fetch("/api/agent/diagnosis", {
      method: "POST",
      headers: { "content-type": "application/json", accept: `${TIPE_BERTAHAP}, application/json` },
      body: JSON.stringify({ rule, backtest }),
      signal: opsi?.signal,
    });
  } catch (err) {
    return galatJaringan(err);
  }
  if (!res.ok || !res.body || !(res.headers.get("content-type") ?? "").includes(TIPE_BERTAHAP)) {
    return jawabanJson<ResponDiagnosis>(res);
  }
  let akhir: HasilApi<ResponDiagnosis> | null = null;
  try {
    await bacaNdjson<ResponDiagnosis>(res.body, (b) => {
      if (b.jenis === "langkah") opsi?.onLangkah?.(b.langkah);
      else if (b.jenis === "selesai") akhir = { ok: true, data: b.hasil };
      else akhir = { ok: false, galat: { status: b.status, kode: b.error.kode, pesan: b.error.pesan } };
    });
  } catch (err) {
    return galatJaringan(err);
  }
  // Aliran berakhir tanpa baris penutup (sambungan putus, fungsi dipotong
  // batas waktu): katakan terus terang, jangan biarkan panel menggantung.
  return (
    akhir ?? {
      ok: false,
      galat: { status: 0, kode: "ALIRAN_TERPUTUS", pesan: "Jawaban diagnosis terputus sebelum selesai. Coba lagi." },
    }
  );
}

export function simpanAlarmKeServer(body: {
  owner_token: string;
  name: string;
  rules: Rule[];
  last_score: Record<string, unknown> | null;
}) {
  return posJson<ResponSimpanAlarm>("/api/alarms", body);
}
