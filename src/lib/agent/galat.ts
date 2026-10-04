// Penerjemah galat layanan AI (gateway OpenAI-compatible, mis. Kagiro/Command
// Code, atau provider langsung) menjadi status + kode + pesan yang bisa
// ditindaklanjuti pengguna.
//
// Latar belakang (2026-10-04): jawaban "Diagnosis gagal; coba lagi sesaat." yang
// samar pernah menutupi kunci/model yang salah selama berhari-hari. Setiap galat
// layanan kini menyebutkan APA yang harus diperiksa: LLM_BASE_URL (koneksi),
// LLM_API_KEY (kunci), atau LLM_MODEL (nama model di katalog gateway).
//
// Semua pemetaan memakai status 503 karena yang gagal adalah layanan di luar
// aplikasi yang belum siap, bukan permintaan yang salah; jalur 400/429/503
// milik validasi, pagar laju, dan kunci hilang tidak berubah.
//
// Pemeriksaan STRUKTURAL, bukan instanceof: bentuk galat di ujung bisa berupa
// APICallError (@ai-sdk/provider) dengan `statusCode`/`responseBody`/
// `requestBodyValues`, RetryError yang membungkusnya lewat `lastError`,
// TypeError "fetch failed" dari undici dengan `cause`, atau Error biasa yang
// punya `cause`. Karena itu `cause`, `errors`, dan `lastError` ikut ditelusuri.

export interface GalatLayanan {
  /** Selalu 503: layanan di luar aplikasi yang belum siap. */
  status: number;
  kode: string;
  pesan: string;
}

/** Bagian yang berhasil dibaca dari satu galat dalam rantai. */
interface Potongan {
  statusCode?: number;
  pesan?: string;
  nama?: string;
  url?: string;
  /** Nama model dari `requestBodyValues.model` (APICallError) untuk pesan 404. */
  model?: string;
  /** Cuplikan badan respons (string) untuk log server. */
  badan?: string;
}

const PENANDA_JARINGAN =
  /fetch failed|ECONNREFUSED|ECONNRESET|ENOTFOUND|ETIMEDOUT|EAI_AGAIN|UND_ERR|socket hang up|network error|getaddrinfo/i;

function sebagaiRekaman(err: unknown): Record<string, unknown> | null {
  return typeof err === "object" && err !== null ? (err as Record<string, unknown>) : null;
}

function teks(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

function potongan(err: unknown): Potongan {
  const o = sebagaiRekaman(err);
  if (!o) return { pesan: teks((err as { message?: unknown })?.message) ?? String(err) };
  const nilaiStatus = typeof o.statusCode === "number" ? o.statusCode : typeof o.status === "number" ? o.status : undefined;
  const bodyValues = sebagaiRekaman(o.requestBodyValues);
  const badan = teks(o.responseBody) ?? (o.responseBody !== undefined ? JSON.stringify(o.responseBody) : undefined);
  return {
    statusCode: nilaiStatus,
    pesan: err instanceof Error ? err.message : teks(o.message),
    nama: teks(o.name),
    url: teks(o.url),
    model: teks(bodyValues?.model),
    badan: badan ? badan.slice(0, 300) : undefined,
  };
}

/**
 * Kumpulkan potongan dari `err` dan seluruh rantai `cause`/`errors`/`lastError`
 * (dengan penjaga siklus). Urutan: galat luar lebih dulu.
 */
function telusuri(err: unknown, keluar: Potongan[] = [], dikunjungi: Set<unknown> = new Set()): Potongan[] {
  if (err === null || err === undefined || dikunjungi.has(err)) return keluar;
  dikunjungi.add(err);
  keluar.push(potongan(err));
  const o = sebagaiRekaman(err);
  if (o) {
    if (Array.isArray(o.errors)) for (const e of o.errors) telusuri(e, keluar, dikunjungi);
    telusuri(o.lastError, keluar, dikunjungi);
    telusuri(o.cause, keluar, dikunjungi);
  }
  return keluar;
}

/**
 * Galat layanan AI → pesan yang bisa ditindaklanjuti; `null` bila bukan galat
 * layanan (pemanggil memakai jalur fallback 500 miliknya sendiri).
 */
export function petaGalatLayanan(err: unknown): GalatLayanan | null {
  const semua = telusuri(err);

  const http = semua.find((p) => typeof p.statusCode === "number");
  if (http) {
    const s = http.statusCode!;
    const model = http.model ? ` "${http.model}"` : "";
    if (s === 401 || s === 403) {
      return {
        status: 503,
        kode: "AI_KUNCI_DITOLAK",
        pesan: `Layanan AI menolak kunci (HTTP ${s}). Kunci mungkin salah atau sudah tidak berlaku: perbarui LLM_API_KEY di pengaturan server, lalu coba lagi.`,
      };
    }
    if (s === 404) {
      return {
        status: 503,
        kode: "AI_MODEL_TIDAK_DIKENAL",
        pesan: `Model AI${model} tidak dikenal layanan AI (HTTP 404). Nama model gateway bisa berubah: samakan LLM_MODEL dengan katalog gateway, lalu coba lagi.`,
      };
    }
    if (s === 429) {
      return {
        status: 503,
        kode: "AI_PENUH",
        pesan: "Layanan AI sedang penuh (HTTP 429). Coba lagi sesaat; bila berulang, periksa kuota atau saldo kunci di pengaturan server.",
      };
    }
    return {
      status: 503,
      kode: "AI_DITOLAK",
      pesan: `Layanan AI menolak permintaan (HTTP ${s}). Bila berulang, periksa LLM_BASE_URL dan LLM_MODEL di pengaturan server, lalu coba lagi.`,
    };
  }

  const jaringan = semua.find(
    (p) => (p.pesan !== undefined && PENANDA_JARINGAN.test(p.pesan)) || (p.nama !== undefined && PENANDA_JARINGAN.test(p.nama)),
  );
  if (jaringan) {
    return {
      status: 503,
      kode: "AI_TIDAK_BISA_DIHUBUNGI",
      pesan: "Tidak bisa menghubungi layanan AI. Periksa LLM_BASE_URL dan koneksi keluar server, lalu coba lagi.",
    };
  }

  return null;
}

/** Satu baris padat untuk log server: status + url + pesan + cuplikan badan. */
export function ringkasGalatLayanan(err: unknown): string {
  const semua = telusuri(err);
  const http = semua.find((p) => typeof p.statusCode === "number");
  const bagian: string[] = [];
  if (http) bagian.push(`HTTP ${http.statusCode}${http.url ? ` ${http.url}` : ""}`);
  bagian.push(semua.find((p) => p.pesan)?.pesan ?? String(err));
  const badan = semua.find((p) => p.badan)?.badan;
  if (badan) bagian.push(`badan: ${badan}`);
  return bagian.join(" | ");
}
