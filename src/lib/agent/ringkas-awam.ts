// Ringkasan hasil alat agent untuk DIBACA PENGGUNA (jejak di panel AI).
//
// `ringkasHasilTool` di diagnosis.ts tidak bisa dipakai untuk itu: kalimatnya
// ikut dikirim ke fase 2 model sebagai data, jadi ia sengaja padat dan memuat
// nama mesin blok (`laporan_hilang: ...`), tanggal ISO, dan kadang galat
// mentah. Aturan kepadatan teks (DESIGN.md, aturan 8 dan 9) melarang semua
// itu di layar. Fungsi ini membaca keluaran alat yang sama dan menulis satu
// kalimat pendek dalam bahasa pengguna. Murni, tanpa I/O.
import { LABEL_BLOK, type BlockKind } from "../engine/rules";
import { rupiahAwam } from "../jaga/kalimat-b";
import { fmtTanggal } from "../putar-ulang/ringkas";

const POLA_TANGGAL = /^\d{4}-\d{2}-\d{2}/;

function tgl(x: unknown): string {
  return typeof x === "string" && POLA_TANGGAL.test(x) ? fmtTanggal(x) : "";
}

function daftarTanggal(xs: unknown[], maks = 3): string {
  const t = xs.map(tgl).filter(Boolean);
  if (t.length <= maks) return t.join(", ");
  return `${t.slice(-maks).join(", ")}, dan ${t.length - maks} lainnya`;
}

function labelBlok(kind: string): string {
  return (LABEL_BLOK as Record<string, string>)[kind as BlockKind]?.toLowerCase() ?? "syarat lain";
}

/** Satu kalimat awam untuk keluaran satu alat. String kosong bila tidak ada yang layak ditampilkan. */
export function ringkasAwamTool(tool: string, output: unknown): string {
  const o = output && typeof output === "object" ? (output as Record<string, unknown>) : null;
  if (!o) return "";
  switch (tool) {
    case "listMissed": {
      const contoh = ((o.terlewatContoh as { symbol: string }[]) ?? []).map((x) => x.symbol);
      const total = typeof o.jumlahTerlewatSeluruhnya === "number" ? o.jumlahTerlewatSeluruhnya : contoh.length;
      const kena = ((o.tertangkap as unknown[]) ?? []).length;
      if (total === 0) return `Tidak ada yang terlewat; ${kena} saham tertangkap.`;
      return `${total} saham terlewat${contoh.length ? ` (mis. ${contoh.slice(0, 3).join(", ")})` : ""}; ${kena} tertangkap.`;
    }
    case "getSuspensions": {
      const s = ((o.suspensions as { date: string }[]) ?? []).map((x) => x.date);
      return s.length ? `Disuspensi ${s.length} kali: ${daftarTanggal(s)}.` : "Tidak pernah disuspensi menurut data kami.";
    }
    case "getReportDates": {
      const jumlah = typeof o.jumlah === "number" ? o.jumlah : 0;
      const akhir = tgl(o.kuartalTerakhir);
      return jumlah ? `${jumlah} laporan kuartal, yang terakhir untuk periode ${akhir || "tak diketahui"}.` : "Belum ada laporan kuartal di data kami.";
    }
    case "getFilings": {
      const f = (o.filings as { transactionType: string | null }[]) ?? [];
      const jual = f.filter((x) => x.transactionType === "sell").length;
      return f.length ? `${f.length} laporan transaksi orang dalam, ${jual} di antaranya penjualan.` : "Tidak ada laporan transaksi orang dalam.";
    }
    case "getCorporateActions": {
      const r = ((o.rightIssues as { exDate: string }[]) ?? []).map((x) => x.exDate);
      return r.length ? `${r.length} rights issue: ${daftarTanggal(r)}.` : "Tidak ada rights issue.";
    }
    case "getFinancials": {
      const f = (o.financials as { date: string; totalEquity: number | null }[]) ?? [];
      const akhir = f[f.length - 1];
      if (!akhir) return "Tidak ada laporan keuangan di data kami.";
      const e = akhir.totalEquity;
      const ekuitas = e == null ? "tidak tercatat" : e < 0 ? `minus ${rupiahAwam(e)}` : rupiahAwam(e);
      return `Ekuitas per ${tgl(akhir.date) || akhir.date}: ${ekuitas}.`;
    }
    case "runAlarmOn": {
      const alasan = ((o.reasons as { kind: string }[]) ?? []).map((r) => labelBlok(r.kind));
      if (!o.fired) return "Alarm diam pada tanggal itu.";
      return `Alarm berbunyi${alasan.length ? `: ${alasan.join(", ")}` : ""}.`;
    }
    default:
      return "";
  }
}

/** Kalimat untuk alat yang gagal: galat mentah tidak pernah sampai ke layar. */
export const RINGKAS_AWAM_GAGAL = "Data ini gagal dibaca; AI melanjutkan tanpa data itu.";
