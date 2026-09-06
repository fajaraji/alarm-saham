#!/usr/bin/env node
// CLI pembuktian klien Sectors:
//   npm run sectors -- <endpoint> [symbol] [--start=YYYY-MM-DD] [--end=YYYY-MM-DD]
//                      [--n=4] [--limit=30] [--offset=0] [--type=sell] [--holder=insider] [--json]
// Panggilan pertama mencatat kredit di .cache/sectors/ledger.jsonl; panggilan
// identik berikutnya terlayani dari cache tanpa kredit. Kunci API tidak pernah dicetak.

import {
  CreditReserveError,
  InvalidQueryError,
  SectorsApiError,
  sectorsProviderDariEnv,
  type SectorsProvider,
} from "../src/lib/data";

const ENDPOINTS = [
  "suspensions",
  "dates",
  "filings",
  "corporate-actions",
  "financials",
  "free-float",
  "broker",
  "listing",
  "daily",
] as const;
type Endpoint = (typeof ENDPOINTS)[number];

function bantuan(): string {
  return [
    "Pemakaian: npm run sectors -- <endpoint> [symbol] [opsi]",
    "",
    "Endpoint:",
    "  suspensions [symbol]   --start --end --limit --offset   (tanpa symbol = seluruh bursa)",
    "  dates <symbol>         tanggal laporan keuangan per kuartal",
    "  filings <symbol>       --start --end --type=buy|sell|others --holder=insider|institution|corporate-investor",
    "  corporate-actions <symbol>",
    "  financials <symbol>    --n=4   (MAHAL: 1 kredit per kuartal)",
    "  free-float             (1 kredit per 100 emiten)",
    "  broker <symbol>        --start --end   (maks 14 hari)",
    "  listing <symbol>",
    "  daily <symbol>         --start --end   (maks 90 hari)",
    "",
    "Opsi umum: --json (cetak respons penuh)",
    "Env: SECTORS_API_KEY (wajib), SECTORS_CREDIT_RESERVE=250, ALLOW_RESERVE=1, SECTORS_CACHE_DIR, SECTORS_BASE_URL (tes lokal)",
  ].join("\n");
}

interface Argumen {
  endpoint?: string;
  symbol?: string;
  opsi: Record<string, string>;
}

function urai(argv: string[]): Argumen {
  const posisi: string[] = [];
  const opsi: Record<string, string> = {};
  for (const a of argv) {
    if (a.startsWith("--")) {
      const [k, ...v] = a.slice(2).split("=");
      opsi[k] = v.length ? v.join("=") : "1";
    } else {
      posisi.push(a);
    }
  }
  return { endpoint: posisi[0], symbol: posisi[1], opsi };
}

function angka(nilai: string | undefined): number | undefined {
  if (nilai === undefined) return undefined;
  const n = Number(nilai);
  if (!Number.isFinite(n)) throw new InvalidQueryError(`Nilai numerik tidak sah: ${nilai}`);
  return n;
}

function wajibSimbol(symbol: string | undefined, endpoint: string): string {
  if (!symbol) throw new InvalidQueryError(`Endpoint ${endpoint} membutuhkan <symbol>`);
  return symbol;
}

function wajibRentang(opsi: Record<string, string>, endpoint: string): [string, string] {
  if (!opsi.start || !opsi.end) {
    throw new InvalidQueryError(`Endpoint ${endpoint} membutuhkan --start dan --end`);
  }
  return [opsi.start, opsi.end];
}

async function jalankan(p: SectorsProvider, arg: Argumen): Promise<unknown> {
  const { symbol, opsi } = arg;
  const endpoint = arg.endpoint as Endpoint;
  switch (endpoint) {
    case "suspensions":
      return p.suspensions({
        symbol,
        start: opsi.start,
        end: opsi.end,
        limit: angka(opsi.limit),
        offset: angka(opsi.offset),
      });
    case "dates":
      return p.quarterlyFinancialDates(wajibSimbol(symbol, endpoint));
    case "filings":
      return p.filings(wajibSimbol(symbol, endpoint), {
        start: opsi.start,
        end: opsi.end,
        transaction_type: opsi.type as "buy" | "sell" | "others" | undefined,
        holder_type: opsi.holder as "insider" | "institution" | "corporate-investor" | undefined,
        limit: angka(opsi.limit),
        offset: angka(opsi.offset),
      });
    case "corporate-actions":
      return p.corporateActions(wajibSimbol(symbol, endpoint));
    case "financials":
      return p.quarterlyFinancials(wajibSimbol(symbol, endpoint), angka(opsi.n) ?? 4);
    case "free-float":
      return p.freeFloat();
    case "broker": {
      const [s, e] = wajibRentang(opsi, endpoint);
      return p.brokerSummary(wajibSimbol(symbol, endpoint), s, e);
    }
    case "listing":
      return p.listingPerformance(wajibSimbol(symbol, endpoint));
    case "daily": {
      const [s, e] = wajibRentang(opsi, endpoint);
      return p.daily(wajibSimbol(symbol, endpoint), s, e);
    }
  }
}

function ringkas(data: unknown): string {
  const potong = (x: unknown) => {
    const s = JSON.stringify(x);
    return s.length > 160 ? s.slice(0, 157) + "..." : s;
  };
  if (Array.isArray(data)) {
    return [`array ${data.length} item`, ...data.slice(0, 3).map((x) => "  " + potong(x))].join("\n");
  }
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.results)) {
      const pg = (obj.pagination ?? {}) as Record<string, unknown>;
      return [
        `halaman: showing=${pg.showing ?? obj.results.length} total_count=${pg.total_count ?? "?"} has_next=${pg.has_next ?? "?"} next_offset=${pg.next_offset ?? "-"}`,
        ...obj.results.slice(0, 3).map((x) => "  " + potong(x)),
      ].join("\n");
    }
    return [`objek dengan kunci: ${Object.keys(obj).join(", ")}`, "  " + potong(obj)].join("\n");
  }
  return String(data);
}

async function main(): Promise<number> {
  const arg = urai(process.argv.slice(2));
  if (!arg.endpoint || arg.opsi.help || !ENDPOINTS.includes(arg.endpoint as Endpoint)) {
    console.error(bantuan());
    return arg.opsi.help ? 0 : 1;
  }

  const provider = sectorsProviderDariEnv(process.env);
  if (!provider) {
    console.error(
      "SECTORS_API_KEY tidak ditemukan. Isi di .env.local (lihat .env.example) atau set variabel lingkungan, lalu ulangi.",
    );
    return 1;
  }

  const sebelum = (await provider.ledger.semua()).length;
  try {
    const data = await jalankan(provider, arg);
    const baris = (await provider.ledger.semua()).slice(sebelum);
    const terakhir = baris[baris.length - 1];
    console.log(`endpoint : ${terakhir?.endpoint ?? arg.endpoint}`);
    console.log(`params   : ${JSON.stringify(terakhir?.params ?? {})}`);
    console.log(`sumber   : ${terakhir?.cacheHit ? "CACHE (0 kredit)" : `API (HTTP ${terakhir?.status})`}`);
    console.log(`kredit   : ${baris.reduce((a, b) => a + b.credits, 0)} dipakai panggilan ini`);
    console.log(`sisa     : ${await provider.sisaKredit()} dari ${provider.anggaran} (cadangan ${provider.cadangan})`);
    console.log("");
    console.log(arg.opsi.json ? JSON.stringify(data, null, 2) : ringkas(data));
    return 0;
  } catch (err) {
    if (err instanceof CreditReserveError) {
      console.error(`DITOLAK: ${err.message}`);
      return 2;
    }
    if (err instanceof InvalidQueryError) {
      console.error(`PARAMETER SALAH: ${err.message}`);
      return 1;
    }
    if (err instanceof SectorsApiError) {
      console.error(`GAGAL: ${err.message}`);
      console.error(`sisa     : ${await provider.sisaKredit()} dari ${provider.anggaran}`);
      return 3;
    }
    console.error(`GAGAL: ${err instanceof Error ? err.message : String(err)}`);
    return 3;
  }
}

main().then(
  (kode) => process.exit(kode),
  (err) => {
    console.error(`GAGAL: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(3);
  },
);
