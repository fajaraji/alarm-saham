// Pemformat teks hasil uji-ke-masa-lalu untuk CLI (tanpa dependensi).
import type { Rule } from "./rules";
import { ringkasAturan } from "./rules";
import type { BacktestResult, PerSymbolResult } from "./score";

function pad(s: string, n: number): string {
  return s.length >= n ? s : s + " ".repeat(n - s.length);
}

function angka(x: number | null): string {
  return x == null ? "-" : String(x);
}

function barisEmiten(r: PerSymbolResult): string[] {
  const status =
    r.group === "control"
      ? r.fired
        ? "ALARM PALSU"
        : "bersih"
      : r.fired
        ? "TERTANGKAP"
        : "terlewat";
  const lead = r.leadMonths == null ? "-" : `${r.leadMonths} bln${r.excludedFromLead ? " (x)" : ""}`;
  return [
    r.symbol,
    r.group,
    r.targetEventDate ?? "-",
    r.firstFireDate ?? "-",
    lead,
    status,
    r.reasons.map((x) => `${x.kind}: ${x.detail}`).join("; ") || "-",
  ];
}

export function formatBacktest(rule: Rule, hasil: BacktestResult): string {
  const baris: string[] = [];
  baris.push(`Aturan   : ${hasil.rule}`);
  baris.push(`Blok     : ${ringkasAturan(rule)}`);
  baris.push(`Rentang  : ${hasil.scanStart} .. ${hasil.today} (akhir bulan)`);
  baris.push("");
  baris.push(
    `Tertangkap        : ${hasil.hits}/${hasil.total} emiten kena` +
      (hasil.perGroup.delisting.total
        ? ` (delisting ${hasil.perGroup.delisting.hits}/${hasil.perGroup.delisting.total}`
        : "") +
      (hasil.perGroup.watchlist.total
        ? `${hasil.perGroup.delisting.total ? ", " : " ("}watchlist ${hasil.perGroup.watchlist.hits}/${hasil.perGroup.watchlist.total}`
        : "") +
      (hasil.perGroup.delisting.total || hasil.perGroup.watchlist.total ? ")" : ""),
  );
  baris.push(
    `Lebih awal        : rata-rata ${angka(hasil.leadMonthsAvg)} bln, median ${angka(hasil.leadMonthsMedian)} bln` +
      ` (emiten dengan target < ${hasil.leadCutoff} tidak dihitung, ditandai (x))`,
  );
  baris.push(`Alarm palsu       : ${hasil.falseAlarms}/${hasil.controls} kontrol sehat`);
  baris.push("");

  const kepala = ["Emiten", "Group", "Target", "Bunyi pertama", "Lead", "Status", "Alasan"];
  const rows = hasil.perSymbol.map(barisEmiten);
  const lebar = kepala.map((k, i) =>
    Math.min(60, Math.max(k.length, ...rows.map((r) => r[i].length))),
  );
  const cetak = (r: string[]) =>
    r.map((c, i) => pad(c.length > lebar[i] ? c.slice(0, lebar[i] - 1) + "…" : c, lebar[i])).join("  ");
  baris.push(cetak(kepala));
  baris.push(lebar.map((n) => "-".repeat(n)).join("  "));
  for (const r of rows) baris.push(cetak(r));
  return baris.join("\n");
}
