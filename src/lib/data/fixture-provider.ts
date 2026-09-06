import bbca from "./fixtures/BBCA.json";
import sril from "./fixtures/SRIL.json";
import universe from "./fixtures/universe.json";
import {
  BATAS_HARI,
  InvalidQueryError,
  NotFoundError,
  normalisasiSimbol,
  pastikanRentang,
  pastikanTanggal,
  type DataProvider,
} from "./provider";
import type {
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

/** Isi fixture satu emiten (file `fixtures/<SIMBOL>.json`). */
export interface FixtureEmiten {
  quarterly_financial_dates: QuarterlyFinancialDates;
  filings: Filing[];
  corporate_actions: CorporateActions;
  quarterly_financials: QuarterlyFinancial[];
  broker_summary: BrokerSummary;
  /** null = tidak tersedia (listing sebelum Mei 2005) → NotFoundError. */
  listing_performance: ListingPerformance | null;
  daily: DailyBar[];
}

export interface FixtureUniverse {
  suspensions: Suspension[];
  free_float: FreeFloatEntry[];
}

export interface KumpulanFixture {
  universe: FixtureUniverse;
  emiten: Record<string, FixtureEmiten>;
}

export const FIXTURE_BAWAAN: KumpulanFixture = {
  universe: universe as unknown as FixtureUniverse,
  emiten: {
    SRIL: sril as unknown as FixtureEmiten,
    BBCA: bbca as unknown as FixtureEmiten,
  },
};

const LIMIT_DEFAULT = 30;
const LIMIT_MAKS = 30;

function paginasi<T>(semua: T[], limit?: number, offset?: number): Page<T> {
  const lim = Math.min(Math.max(1, limit ?? LIMIT_DEFAULT), LIMIT_MAKS);
  const off = Math.max(0, offset ?? 0);
  const results = semua.slice(off, off + lim);
  const hasNext = off + results.length < semua.length;
  return {
    results,
    pagination: {
      total_count: semua.length,
      showing: results.length,
      limit: lim,
      offset: off,
      has_next: hasNext,
      next_offset: hasNext ? off + lim : null,
    },
  };
}

/**
 * Provider tanpa kunci API: membaca fixture JSON kecil. Perilaku meniru Sectors
 * (paginasi, batas rentang, 404 untuk simbol tak dikenal) agar tes kontrak
 * yang sama dapat dijalankan untuk kedua provider.
 */
export class FixtureProvider implements DataProvider {
  readonly name = "fixture" as const;

  constructor(private readonly fixture: KumpulanFixture = FIXTURE_BAWAAN) {}

  /** Simbol yang tersedia di fixture. */
  simbolTersedia(): string[] {
    return Object.keys(this.fixture.emiten);
  }

  private emiten(symbol: string, endpoint: string): FixtureEmiten {
    const s = normalisasiSimbol(symbol);
    const e = this.fixture.emiten[s];
    if (!e) throw new NotFoundError(endpoint, `simbol ${s} tidak ada di fixture`);
    return e;
  }

  async suspensions(query: SuspensionsQuery = {}): Promise<Page<Suspension>> {
    const symbol = query.symbol ? normalisasiSimbol(query.symbol) : undefined;
    const start = query.start ? pastikanTanggal("start", query.start) : undefined;
    const end = query.end ? pastikanTanggal("end", query.end) : undefined;
    const semua = this.fixture.universe.suspensions
      .filter((s) => !symbol || s.symbol === symbol)
      .filter((s) => !start || s.suspension_date >= start)
      .filter((s) => !end || s.suspension_date <= end)
      .sort((a, b) => a.suspension_date.localeCompare(b.suspension_date));
    return paginasi(semua, query.limit, query.offset);
  }

  async quarterlyFinancialDates(symbol: string): Promise<QuarterlyFinancialDates> {
    return this.emiten(symbol, "quarterly-financial-dates").quarterly_financial_dates;
  }

  async filings(symbol: string, filter: FilingsFilter = {}): Promise<Page<Filing>> {
    const s = normalisasiSimbol(symbol);
    const start = filter.start ? pastikanTanggal("start", filter.start) : undefined;
    const end = filter.end ? pastikanTanggal("end", filter.end) : undefined;
    const e = this.fixture.emiten[s];
    // Feed universe: simbol tak dikenal → hasil kosong (200), bukan 404.
    const semua = (e?.filings ?? [])
      .filter((f) => !filter.transaction_type || f.transaction_type === filter.transaction_type)
      .filter((f) => !filter.holder_type || f.holder_type === filter.holder_type)
      .filter((f) => !start || f.timestamp.slice(0, 10) >= start)
      .filter((f) => !end || f.timestamp.slice(0, 10) <= end)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    return paginasi(semua, filter.limit, filter.offset);
  }

  async corporateActions(symbol: string): Promise<CorporateActions> {
    return this.emiten(symbol, "corporate-actions").corporate_actions;
  }

  async quarterlyFinancials(symbol: string, nQuarters = 4): Promise<QuarterlyFinancial[]> {
    if (!Number.isInteger(nQuarters) || nQuarters < 1) {
      throw new InvalidQueryError(`nQuarters harus bilangan bulat >= 1, diterima ${nQuarters}`);
    }
    const semua = [...this.emiten(symbol, "financials/quarterly").quarterly_financials].sort((a, b) =>
      a.report_date.localeCompare(b.report_date),
    );
    // n kuartal TERAKHIR, urut naik menurut report_date.
    return semua.slice(-nQuarters);
  }

  async freeFloat(): Promise<FreeFloatEntry[]> {
    return this.fixture.universe.free_float;
  }

  async brokerSummary(symbol: string, start: string, end: string): Promise<BrokerSummary> {
    pastikanRentang(start, end, BATAS_HARI.brokerSummary, "broker-summary");
    const ringkas = this.emiten(symbol, "broker-summary").broker_summary;
    const dalamRentang = (r: { date?: string | null }) =>
      !r.date || (r.date >= start && r.date <= end);
    if (Array.isArray(ringkas)) return ringkas.filter(dalamRentang);
    return { ...ringkas, results: (ringkas.results ?? []).filter(dalamRentang) };
  }

  async listingPerformance(symbol: string): Promise<ListingPerformance> {
    const lp = this.emiten(symbol, "listing-performance").listing_performance;
    if (!lp) {
      throw new NotFoundError(
        "listing-performance",
        `${normalisasiSimbol(symbol)} tidak punya data listing performance (listing sebelum Mei 2005)`,
      );
    }
    return lp;
  }

  async daily(symbol: string, start: string, end: string): Promise<DailyBar[]> {
    pastikanRentang(start, end, BATAS_HARI.daily, "daily");
    return this.emiten(symbol, "daily")
      .daily.filter((d) => d.date >= start && d.date <= end)
      .sort((a, b) => a.date.localeCompare(b.date));
  }
}
