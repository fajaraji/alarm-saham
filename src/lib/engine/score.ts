// Skor uji-ke-masa-lalu: jalankan aturan ke universe uji, hitung tertangkap,
// lebih-awal (bulan), dan alarm palsu. Deterministik: hasil hanya bergantung
// pada aturan, universe, kejadian, dan `opts.today`.
import { daftarAkhirBulan, hariIni, maksTanggal, pastikanTanggal, selisihBulan, tambahTahun } from "./dates";
import { fires, type Reason } from "./evaluate";
import type { EventSource, Group, UniverseEntry } from "./events";
import type { Rule } from "./rules";

export interface BacktestOptions {
  /** Batas akhir pemindaian kontrol (default: hari ini UTC). */
  today?: string;
  /** Awal data yang dipercaya (default 2020-01-31, kedalaman feed Sectors). */
  scanStart?: string;
  /** Emiten kena dengan target sebelum tanggal ini tidak ikut rata-rata lead. */
  leadCutoff?: string;
  /** Berapa tahun sebelum target pemindaian dimulai (default 6). */
  lookbackYears?: number;
}

export interface PerSymbolResult {
  symbol: string;
  group: Group;
  targetEventDate: string | null;
  /** Rentang t yang dipindai (akhir bulan); null bila kosong. */
  scanFrom: string | null;
  scanTo: string | null;
  fired: boolean;
  firstFireDate: string | null;
  /** Bulan antara bunyi pertama dan kejadian target (hanya emiten kena). */
  leadMonths: number | null;
  reasons: Reason[];
  excludedFromLead: boolean;
}

export interface ScoreSummary {
  /** Emiten kena yang alarmnya berbunyi sebelum kejadian target. */
  hits: number;
  /** Jumlah emiten kena (delisting + watchlist). */
  total: number;
  leadMonthsAvg: number | null;
  leadMonthsMedian: number | null;
  /** Kontrol sehat yang alarmnya pernah berbunyi. */
  falseAlarms: number;
  controls: number;
}

export interface GroupResult extends ScoreSummary {
  group: Group;
  perSymbol: PerSymbolResult[];
}

export interface BacktestResult extends ScoreSummary {
  rule: string;
  scanStart: string;
  today: string;
  leadCutoff: string;
  perGroup: Record<Group, GroupResult>;
  perSymbol: PerSymbolResult[];
}

export const SCAN_START_DEFAULT = "2020-01-31";
export const LEAD_CUTOFF_DEFAULT = "2021-01-01";
export const LOOKBACK_YEARS_DEFAULT = 6;

function bulatkan(x: number): number {
  return Math.round(x * 100) / 100;
}

function rataRata(xs: number[]): number | null {
  if (xs.length === 0) return null;
  return bulatkan(xs.reduce((a, b) => a + b, 0) / xs.length);
}

function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : bulatkan((s[mid - 1] + s[mid]) / 2);
}

function ringkas(rows: PerSymbolResult[]): ScoreSummary {
  const kena = rows.filter((r) => r.group !== "control");
  const kontrol = rows.filter((r) => r.group === "control");
  const lead = kena
    .filter((r) => r.fired && !r.excludedFromLead && r.leadMonths != null)
    .map((r) => r.leadMonths as number);
  return {
    hits: kena.filter((r) => r.fired).length,
    total: kena.length,
    leadMonthsAvg: rataRata(lead),
    leadMonthsMedian: median(lead),
    falseAlarms: kontrol.filter((r) => r.fired).length,
    controls: kontrol.length,
  };
}

/** Pindai akhir bulan berurutan; kembalikan bunyi pertama. */
function pindai(rule: Rule, events: Awaited<ReturnType<EventSource["events"]>>, tanggal: string[]) {
  for (const t of tanggal) {
    const r = fires(rule, events, t);
    if (r.fired) return { firstFireDate: t, reasons: r.reasons };
  }
  return null;
}

export async function runBacktest(
  rule: Rule,
  universe: UniverseEntry[],
  source: EventSource,
  opts: BacktestOptions = {},
): Promise<BacktestResult> {
  const today = pastikanTanggal("today", opts.today ?? hariIni());
  const scanStart = pastikanTanggal("scanStart", opts.scanStart ?? SCAN_START_DEFAULT);
  const leadCutoff = pastikanTanggal("leadCutoff", opts.leadCutoff ?? LEAD_CUTOFF_DEFAULT);
  const lookback = opts.lookbackYears ?? LOOKBACK_YEARS_DEFAULT;

  const perSymbol: PerSymbolResult[] = [];
  // Urutan tetap (menurut simbol) agar keluaran deterministik apa pun urutan input.
  const urut = [...universe].sort((a, b) => a.symbol.localeCompare(b.symbol));

  for (const u of urut) {
    const events = await source.events(u.symbol);
    let tanggal: string[];
    let target: string | null = null;

    if (u.group === "control") {
      tanggal = daftarAkhirBulan(scanStart, today);
    } else {
      if (!u.targetEventDate) {
        throw new Error(
          `Emiten ${u.symbol} (group ${u.group}) wajib punya targetEventDate untuk dihitung lead-nya`,
        );
      }
      target = pastikanTanggal(`targetEventDate ${u.symbol}`, u.targetEventDate);
      const mulai = maksTanggal(scanStart, tambahTahun(target, -lookback));
      // Bunyi harus TERJADI SEBELUM kejadian target: hanya t < target.
      tanggal = daftarAkhirBulan(mulai, target).filter((t) => t < target!);
    }

    const bunyi = pindai(rule, events, tanggal);
    const excludedFromLead = target !== null && target < leadCutoff;
    perSymbol.push({
      symbol: u.symbol,
      group: u.group,
      targetEventDate: target,
      scanFrom: tanggal[0] ?? null,
      scanTo: tanggal[tanggal.length - 1] ?? null,
      fired: bunyi !== null,
      firstFireDate: bunyi?.firstFireDate ?? null,
      leadMonths: bunyi && target ? selisihBulan(bunyi.firstFireDate, target) : null,
      reasons: bunyi?.reasons ?? [],
      excludedFromLead,
    });
  }

  const perGroup = Object.fromEntries(
    (["delisting", "watchlist", "control"] as Group[]).map((g) => {
      const rows = perSymbol.filter((r) => r.group === g);
      return [g, { group: g, ...ringkas(rows), perSymbol: rows }];
    }),
  ) as Record<Group, GroupResult>;

  return {
    rule: rule.name,
    scanStart,
    today,
    leadCutoff,
    ...ringkas(perSymbol),
    perGroup,
    perSymbol,
  };
}
