import type { z } from "zod";
import { CacheRespons, TTL_SEHARI_MS } from "./cache";
import {
  ANGGARAN_KREDIT_DEFAULT,
  CADANGAN_KREDIT_DEFAULT,
  hitungKredit,
  type AturanKredit,
} from "./credits";
import { Ledger } from "./ledger";
import {
  BATAS_HARI,
  CreditReserveError,
  InvalidQueryError,
  NotFoundError,
  SchemaMismatchError,
  SectorsApiError,
  normalisasiSimbol,
  pastikanRentang,
  pastikanTanggal,
  type DataProvider,
} from "./provider";
import {
  BrokerSummarySchema,
  CorporateActionsSchema,
  DailySchema,
  FilingsPageSchema,
  FreeFloatSchema,
  ListingPerformanceSchema,
  QuarterlyFinancialDatesSchema,
  QuarterlyFinancialsSchema,
  SuspensionsPageSchema,
  type FilingsFilter,
  type SuspensionsQuery,
} from "./types";

export const SECTORS_BASE_URL = "https://api.sectors.app";
export const DIR_CACHE_DEFAULT = ".cache/sectors";
/**
 * 404 (simbol tidak punya data) DITAGIH 1 kredit dan deterministik, maka di-cache
 * 30 hari agar run ulang tidak membayar lagi (pelajaran tiket 04: 6 kredit hilang).
 */
export const TTL_404_MS = 30 * TTL_SEHARI_MS;

export interface OpsiSectorsProvider {
  apiKey: string;
  /** Folder cache & ledger. Default `.cache/sectors` relatif cwd. */
  cacheDir?: string;
  /** Total kredit tim. Default 1000. */
  anggaran?: number;
  /** Sisa minimum yang dijaga. Default 250 (SECTORS_CREDIT_RESERVE). */
  cadangan?: number;
  /** Lewati penolakan cadangan (ALLOW_RESERVE=1). */
  izinkanCadangan?: boolean;
  /** Jam untuk TTL/penentuan "hari ini" — dapat diganti di tes. */
  now?: () => Date;
  /** Jumlah retry untuk 503/service_unavailable. Default 3. */
  retry?: number;
  /** Basis backoff (ms); tes memakai 0. Default 250. */
  retryBaseMs?: number;
  baseUrl?: string;
  /** fetch kustom; default membaca globalThis.fetch saat dipanggil (agar mock global bekerja). */
  fetch?: typeof fetch;
}

interface SpesifikasiPanggilan<S extends z.ZodType> {
  endpoint: string;
  params: Record<string, string>;
  aturan: AturanKredit;
  /** null = cache permanen; angka = ms. */
  ttlMs: number | null;
  schema: S;
}

export interface HasilPanggilan<T> {
  data: T;
  cacheHit: boolean;
  credits: number;
}

const tidur = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Klien Sectors API v2 dengan buku kredit (ledger.jsonl), cache respons berkas,
 * penolakan bila sisa kredit < cadangan, dan retry untuk 503.
 * Kunci API tidak pernah masuk log, error, ledger, maupun cache.
 */
export class SectorsProvider implements DataProvider {
  readonly name = "sectors" as const;
  readonly ledger: Ledger;
  readonly cache: CacheRespons;
  readonly anggaran: number;
  readonly cadangan: number;
  readonly izinkanCadangan: boolean;
  private readonly apiKey: string;
  private readonly now: () => Date;
  private readonly retry: number;
  private readonly retryBaseMs: number;
  private readonly baseUrl: string;
  private readonly fetchKustom?: typeof fetch;

  constructor(opsi: OpsiSectorsProvider) {
    if (!opsi.apiKey) throw new Error("SectorsProvider membutuhkan apiKey");
    this.apiKey = opsi.apiKey;
    const dir = opsi.cacheDir ?? DIR_CACHE_DEFAULT;
    this.now = opsi.now ?? (() => new Date());
    this.ledger = new Ledger(dir);
    this.cache = new CacheRespons(dir, this.now);
    this.anggaran = opsi.anggaran ?? ANGGARAN_KREDIT_DEFAULT;
    this.cadangan = opsi.cadangan ?? CADANGAN_KREDIT_DEFAULT;
    this.izinkanCadangan = opsi.izinkanCadangan ?? false;
    this.retry = opsi.retry ?? 3;
    this.retryBaseMs = opsi.retryBaseMs ?? 250;
    this.baseUrl = (opsi.baseUrl ?? SECTORS_BASE_URL).replace(/\/$/, "");
    this.fetchKustom = opsi.fetch;
  }

  /** Sisa kredit menurut ledger lokal (bukan dari server). */
  async sisaKredit(): Promise<number> {
    return this.anggaran - (await this.ledger.totalKredit());
  }

  // ---------- Metode DataProvider ----------

  async suspensions(query: SuspensionsQuery = {}) {
    const params: Record<string, string> = {};
    if (query.symbol) params.symbol = normalisasiSimbol(query.symbol);
    if (query.start) params.start = pastikanTanggal("start", query.start);
    if (query.end) params.end = pastikanTanggal("end", query.end);
    if (query.limit !== undefined) params.limit = String(query.limit);
    if (query.offset !== undefined) params.offset = String(query.offset);
    const r = await this.panggil({
      endpoint: "/v2/suspensions/",
      params,
      aturan: "per-request",
      ttlMs: this.ttlUntukRentang(query.end),
      schema: SuspensionsPageSchema,
    });
    return r.data;
  }

  async quarterlyFinancialDates(symbol: string) {
    const r = await this.panggil({
      endpoint: `/v2/company/get_quarterly_financial_dates/${normalisasiSimbol(symbol)}/`,
      params: {},
      aturan: "per-request",
      ttlMs: null,
      schema: QuarterlyFinancialDatesSchema,
    });
    return r.data;
  }

  async filings(symbol: string, filter: FilingsFilter = {}) {
    const params: Record<string, string> = { symbol: normalisasiSimbol(symbol) };
    if (filter.start) params.start = pastikanTanggal("start", filter.start);
    if (filter.end) params.end = pastikanTanggal("end", filter.end);
    if (filter.transaction_type) params.transaction_type = filter.transaction_type;
    if (filter.holder_type) params.holder_type = filter.holder_type;
    if (filter.limit !== undefined) params.limit = String(filter.limit);
    if (filter.offset !== undefined) params.offset = String(filter.offset);
    const r = await this.panggil({
      endpoint: "/v2/filings/",
      params,
      aturan: "per-request",
      ttlMs: null,
      schema: FilingsPageSchema,
    });
    return r.data;
  }

  async corporateActions(symbol: string) {
    const r = await this.panggil({
      endpoint: `/v2/company/corporate-actions/${normalisasiSimbol(symbol)}/`,
      params: {},
      aturan: "per-request",
      ttlMs: null,
      schema: CorporateActionsSchema,
    });
    return r.data;
  }

  async quarterlyFinancials(symbol: string, nQuarters = 4) {
    if (!Number.isInteger(nQuarters) || nQuarters < 1) {
      throw new InvalidQueryError(`nQuarters harus bilangan bulat >= 1, diterima ${nQuarters}`);
    }
    const r = await this.panggil({
      endpoint: `/v2/financials/quarterly/${normalisasiSimbol(symbol)}/`,
      params: { n_quarters: String(nQuarters) },
      aturan: "per-kuartal",
      ttlMs: null,
      schema: QuarterlyFinancialsSchema,
    });
    return r.data;
  }

  async freeFloat() {
    const r = await this.panggil({
      endpoint: "/v2/free-float/",
      params: {},
      aturan: "per-100-emiten",
      ttlMs: TTL_SEHARI_MS,
      schema: FreeFloatSchema,
    });
    return r.data;
  }

  async brokerSummary(symbol: string, start: string, end: string) {
    const s = normalisasiSimbol(symbol);
    pastikanRentang(start, end, BATAS_HARI.brokerSummary, "broker-summary");
    const r = await this.panggil({
      endpoint: `/v2/broker-summary/${s}/`,
      params: { start, end },
      aturan: "per-request",
      ttlMs: this.ttlUntukRentang(end),
      schema: BrokerSummarySchema,
    });
    return r.data;
  }

  async listingPerformance(symbol: string) {
    const r = await this.panggil({
      endpoint: `/v2/listing-performance/${normalisasiSimbol(symbol)}/`,
      params: {},
      aturan: "per-request",
      ttlMs: null,
      schema: ListingPerformanceSchema,
    });
    return r.data;
  }

  async daily(symbol: string, start: string, end: string) {
    const s = normalisasiSimbol(symbol);
    pastikanRentang(start, end, BATAS_HARI.daily, "daily");
    const r = await this.panggil({
      endpoint: `/v2/daily/${s}/`,
      params: { start, end },
      aturan: "per-request",
      ttlMs: this.ttlUntukRentang(end),
      schema: DailySchema,
    });
    return r.data;
  }

  // ---------- Inti ----------

  /** Tanggal hari ini (UTC) dalam YYYY-MM-DD. */
  private hariIni(): string {
    return this.now().toISOString().slice(0, 10);
  }

  /** Rentang yang berakhir di masa lalu = historis (permanen); selain itu 24 jam. */
  private ttlUntukRentang(end?: string): number | null {
    return end && end < this.hariIni() ? null : TTL_SEHARI_MS;
  }

  /** Ganti kemunculan kunci di teks apa pun dengan penanda. Pertahanan berlapis. */
  private redaksi(teks: string): string {
    return this.apiKey ? teks.split(this.apiKey).join("[KUNCI-DIREDAKSI]") : teks;
  }

  private async pastikanCadangan(): Promise<void> {
    if (this.izinkanCadangan) return;
    const sisa = await this.sisaKredit();
    if (sisa < this.cadangan) throw new CreditReserveError(sisa, this.cadangan);
  }

  private async ambil(url: string): Promise<Response> {
    const f = this.fetchKustom ?? globalThis.fetch;
    return f(url, {
      method: "GET",
      headers: { Authorization: this.apiKey, Accept: "application/json" },
    });
  }

  /**
   * Alur satu panggilan: cache → cek cadangan → fetch (retry 503) → hitung kredit
   * → catat ledger → simpan cache (2xx) → validasi skema.
   */
  async panggil<S extends z.ZodType>(spec: SpesifikasiPanggilan<S>): Promise<HasilPanggilan<z.infer<S>>> {
    const { endpoint, params } = spec;

    const tersimpan = await this.cache.baca(endpoint, params);
    if (tersimpan) {
      await this.ledger.catat({
        ts: this.now().toISOString(),
        endpoint,
        params,
        status: tersimpan.status,
        credits: 0,
        cacheHit: true,
      });
      if (tersimpan.status === 404) {
        throw new NotFoundError(endpoint, this.redaksi(pesanError(tersimpan.body)));
      }
      return { data: this.validasi(spec, tersimpan.body), cacheHit: true, credits: 0 };
    }

    await this.pastikanCadangan();

    const url = new URL(this.baseUrl + endpoint);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

    let percobaan = 0;
    for (;;) {
      percobaan += 1;
      let res: Response;
      try {
        res = await this.ambil(url.toString());
      } catch (err) {
        const pesan = this.redaksi(err instanceof Error ? err.message : String(err));
        await this.ledger.catat({
          ts: this.now().toISOString(),
          endpoint,
          params,
          status: null,
          credits: 0,
          cacheHit: false,
          note: `gagal jaringan: ${pesan}`,
        });
        if (percobaan <= this.retry) {
          await tidur(this.retryBaseMs * 2 ** (percobaan - 1));
          continue;
        }
        throw new SectorsApiError(0, endpoint, "network_error", pesan);
      }

      const status = res.status;
      const teksBody = await res.text();
      let body: unknown = null;
      try {
        body = teksBody ? JSON.parse(teksBody) : null;
      } catch {
        body = { raw: this.redaksi(teksBody).slice(0, 500) };
      }
      const kode = kodeError(body);
      const credits = hitungKredit(spec.aturan, status, body);

      await this.ledger.catat({
        ts: this.now().toISOString(),
        endpoint,
        params,
        status,
        credits,
        cacheHit: false,
        ...(kode ? { note: kode } : {}),
      });

      if (status >= 200 && status < 300) {
        await this.cache.tulis(endpoint, params, status, body, spec.ttlMs);
        return { data: this.validasi(spec, body), cacheHit: false, credits };
      }

      const detail = this.redaksi(pesanError(body));
      if (status === 404) {
        await this.cache.tulis(endpoint, params, status, body, TTL_404_MS);
        throw new NotFoundError(endpoint, detail);
      }

      const bolehUlang = status === 503 || kode === "service_unavailable";
      if (bolehUlang && percobaan <= this.retry) {
        await tidur(this.retryBaseMs * 2 ** (percobaan - 1));
        continue;
      }

      throw new SectorsApiError(status, endpoint, kode, detail);
    }
  }

  private validasi<S extends z.ZodType>(spec: SpesifikasiPanggilan<S>, body: unknown): z.infer<S> {
    const hasil = spec.schema.safeParse(body);
    if (!hasil.success) {
      const ringkas = hasil.error.issues
        .slice(0, 3)
        .map((i) => `${i.path.join(".") || "<root>"}: ${i.message}`)
        .join("; ");
      throw new SchemaMismatchError(spec.endpoint, this.redaksi(ringkas));
    }
    return hasil.data;
  }
}

function kodeError(body: unknown): string | undefined {
  if (body && typeof body === "object") {
    const c = (body as { code?: unknown }).code;
    if (typeof c === "string") return c;
    const e = (body as { error?: { code?: unknown } }).error;
    if (e && typeof e === "object" && typeof e.code === "string") return e.code;
  }
  return undefined;
}

function pesanError(body: unknown): string {
  if (body && typeof body === "object") {
    const m = (body as { message?: unknown; detail?: unknown; error?: unknown }).message;
    if (typeof m === "string") return m;
    const d = (body as { detail?: unknown }).detail;
    if (typeof d === "string") return d;
    const e = (body as { error?: unknown }).error;
    if (typeof e === "string") return e;
  }
  return "";
}

/** Sumber variabel lingkungan (process.env atau objek uji). */
export type EnvSumber = Record<string, string | undefined>;

/** Bangun provider dari variabel lingkungan. `undefined` bila SECTORS_API_KEY kosong. */
export function sectorsProviderDariEnv(
  env: EnvSumber = process.env,
  tambahan: Partial<OpsiSectorsProvider> = {},
): SectorsProvider | undefined {
  const apiKey = env.SECTORS_API_KEY?.trim();
  if (!apiKey) return undefined;
  const cadangan = Number(env.SECTORS_CREDIT_RESERVE);
  const anggaran = Number(env.SECTORS_CREDIT_BUDGET);
  return new SectorsProvider({
    apiKey,
    cadangan: Number.isFinite(cadangan) && env.SECTORS_CREDIT_RESERVE ? cadangan : undefined,
    anggaran: Number.isFinite(anggaran) && env.SECTORS_CREDIT_BUDGET ? anggaran : undefined,
    izinkanCadangan: env.ALLOW_RESERVE === "1" || env.ALLOW_RESERVE === "true",
    cacheDir: env.SECTORS_CACHE_DIR || undefined,
    // Hanya untuk tes/demo lokal (server tiruan); jangan set di produksi.
    baseUrl: env.SECTORS_BASE_URL || undefined,
    ...tambahan,
  });
}
