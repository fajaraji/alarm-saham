import type {
  Broker,
  BrokerSummary,
  CorporateActions,
  DailyBar,
  Filing,
  FilingsFilter,
  FreeFloatEntry,
  ListingPerformance,
  Page,
  QuarterlyFinancial,
  QuarterlyFinancialDates,
  Suspension,
  SuspensionsQuery,
} from "./types";

/** Batas rentang tanggal per dokumentasi Sectors. */
export const BATAS_HARI = {
  brokerSummary: 14,
  daily: 90,
} as const;

/**
 * Antarmuka tunggal sumber data. Dua implementasi: `SectorsProvider` (API asli,
 * buku kredit, cache) dan `FixtureProvider` (JSON kecil untuk pengembangan/tes).
 * Semua tanggal berformat `YYYY-MM-DD`; simbol IDX 4 huruf (`.JK` opsional).
 */
export interface DataProvider {
  readonly name: "sectors" | "fixture";

  /** Feed suspensi: seluruh bursa bila `symbol` kosong. 1 kredit per halaman. */
  suspensions(query?: SuspensionsQuery): Promise<Page<Suspension>>;

  /** Tanggal laporan keuangan per tahun/kuartal. 1 kredit. */
  quarterlyFinancialDates(symbol: string): Promise<QuarterlyFinancialDates>;

  /** Filing kepemilikan (insider/institusi). 1 kredit per halaman. */
  filings(symbol: string, filter?: FilingsFilter): Promise<Page<Filing>>;

  /** Aksi korporasi (dividen, rights issue, split, ...). 1 kredit. */
  corporateActions(symbol: string): Promise<CorporateActions>;

  /** Laporan keuangan kuartalan. MAHAL: 1 kredit per kuartal yang dikembalikan. */
  quarterlyFinancials(symbol: string, nQuarters?: number): Promise<QuarterlyFinancial[]>;

  /** Snapshot free float seluruh bursa. 1 kredit per 100 emiten. */
  freeFloat(): Promise<FreeFloatEntry[]>;

  /** Ringkasan broker per simbol; rentang maks 14 hari. 1 kredit. */
  brokerSummary(symbol: string, start: string, end: string): Promise<BrokerSummary>;

  /** Registry broker anggota bursa (kode → cohort retail/mixed/institutional, asing/domestik). 1 kredit. */
  brokers(): Promise<Broker[]>;

  /** Kinerja sejak IPO (hanya listing setelah Mei 2005). 1 kredit. */
  listingPerformance(symbol: string): Promise<ListingPerformance>;

  /** Harga harian; rentang maks 90 hari. 1 kredit. */
  daily(symbol: string, start: string, end: string): Promise<DailyBar[]>;
}

// ---------- Error bertipe ----------

/** Ditolak sebelum memanggil API: sisa kredit di bawah cadangan. */
export class CreditReserveError extends Error {
  readonly sisa: number;
  readonly cadangan: number;
  constructor(sisa: number, cadangan: number) {
    super(
      `Panggilan Sectors ditolak: sisa kredit ${sisa} < cadangan ${cadangan}. ` +
        `Set ALLOW_RESERVE=1 untuk melewati (hanya untuk demo/juri).`,
    );
    this.name = "CreditReserveError";
    this.sisa = sisa;
    this.cadangan = cadangan;
  }
}

/** Respons non-2xx dari Sectors. Pesan tidak pernah memuat kunci API. */
export class SectorsApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly endpoint: string;
  constructor(status: number, endpoint: string, code?: string, detail?: string) {
    super(
      `Sectors ${endpoint} -> HTTP ${status}` +
        (code ? ` (${code})` : "") +
        (detail ? `: ${detail}` : ""),
    );
    this.name = "SectorsApiError";
    this.status = status;
    this.code = code;
    this.endpoint = endpoint;
  }
}

/** Simbol/data tidak ditemukan (404 di Sectors, atau tidak ada di fixture). */
export class NotFoundError extends SectorsApiError {
  constructor(endpoint: string, detail?: string) {
    super(404, endpoint, "not_found", detail);
    this.name = "NotFoundError";
  }
}

/** Parameter tidak sah (mis. rentang tanggal melebihi batas). Dicek sebelum fetch. */
export class InvalidQueryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidQueryError";
  }
}

/** Respons 2xx tetapi tidak cocok skema. Kredit sudah terpakai; body mentah tetap di-cache. */
export class SchemaMismatchError extends Error {
  readonly endpoint: string;
  constructor(endpoint: string, detail: string) {
    super(`Respons ${endpoint} tidak cocok skema: ${detail}`);
    this.name = "SchemaMismatchError";
    this.endpoint = endpoint;
  }
}

// ---------- Utilitas bersama ----------

/** Normalisasi simbol IDX: huruf besar, tanpa akhiran `.JK`. */
export function normalisasiSimbol(symbol: string): string {
  const s = symbol.trim().toUpperCase().replace(/\.JK$/, "");
  if (!/^[A-Z0-9]{4}$/.test(s)) {
    throw new InvalidQueryError(`Simbol IDX tidak sah: "${symbol}" (harus 4 huruf)`);
  }
  return s;
}

const POLA_TANGGAL = /^\d{4}-\d{2}-\d{2}$/;

export function pastikanTanggal(nama: string, nilai: string): string {
  if (!POLA_TANGGAL.test(nilai) || Number.isNaN(Date.parse(nilai))) {
    throw new InvalidQueryError(`Parameter ${nama} harus YYYY-MM-DD, diterima "${nilai}"`);
  }
  return nilai;
}

/** Selisih hari kalender (inklusif kedua ujung) antara dua tanggal ISO. */
export function selisihHari(start: string, end: string): number {
  const a = Date.parse(start);
  const b = Date.parse(end);
  return Math.round((b - a) / 86_400_000) + 1;
}

export function pastikanRentang(
  start: string,
  end: string,
  maksHari: number,
  endpoint: string,
): void {
  pastikanTanggal("start", start);
  pastikanTanggal("end", end);
  if (end < start) {
    throw new InvalidQueryError(`Rentang ${endpoint}: end (${end}) sebelum start (${start})`);
  }
  const hari = selisihHari(start, end);
  if (hari > maksHari) {
    throw new InvalidQueryError(
      `Rentang ${endpoint} maksimal ${maksHari} hari, diminta ${hari} hari (${start}..${end})`,
    );
  }
}
