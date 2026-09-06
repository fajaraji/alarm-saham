#!/usr/bin/env node
// Pembuktian data Fase 1 (tiket 04): memanggil API Sectors SUNGGUHAN untuk
// enam emiten uji + probe universe, dengan anggaran keras ANGGARAN_SKRIP kredit.
// Semua respons (termasuk 404, yang juga ditagih) masuk cache `.cache/sectors/`
// sehingga tiket 07 tidak menarik ulang emiten ini; menjalankan ulang skrip ini
// terlayani dari cache (0 kredit).
//
//   npm run data-proof -- --dry   -> cetak rencana + status cache/ledger, TANPA panggilan
//   npm run data-proof            -> jalankan & tulis docs/data-proof.md
//
// Bagian docs/data-proof.md di antara penanda <!-- data-proof:mulai --> dan
// <!-- data-proof:selesai --> ditimpa; teks di luar penanda (KEPUTUSAN manual)
// dipertahankan. Kunci API tidak pernah dicetak.
//
// Anggaran dihitung dari LEDGER, lintas run: jumlah kredit semua baris ledger
// yang kuncinya (endpointPath+params) ada dalam rencana ini. Karena itu setiap
// langkah mendeklarasikan endpointPath & params persis seperti yang dicatat provider.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  CacheRespons,
  CreditReserveError,
  DIR_CACHE_DEFAULT,
  FilingsPageSchema,
  InvalidQueryError,
  Ledger,
  SchemaMismatchError,
  SectorsApiError,
  TTL_404_MS,
  sectorsProviderDariEnv,
  type BarisLedger,
  type SectorsProvider,
} from "../src/lib/data";

// ---------- Rencana ----------

/** Batas keras kredit yang boleh dipakai skrip ini (lintas run, dihitung dari ledger). */
export const ANGGARAN_SKRIP = 60;

export const EMITEN_DELISTING = ["SRIL", "GOLL", "TELE"] as const;
export const EMITEN_PEMANTAUAN = ["WIKA", "INAF", "BTEL"] as const;
export const EMITEN = [...EMITEN_DELISTING, ...EMITEN_PEMANTAUAN];

const FINANCIALS_EMITEN = ["SRIL", "TELE", "WIKA"];
const FINANCIALS_N = 2;
// BBCA = kontrol sehat & likuid: WIKA/BTEL tersuspensi sehingga baris broker kosong;
// tanpa satu emiten aktif bentuk baris broker-summary tidak pernah terlihat.
const BROKER_EMITEN = ["WIKA", "BTEL", "BBCA"];
const DAILY_EMITEN = ["WIKA"];
// Rentang tetap (berakhir kemarin, 2026-09-06) agar cache permanen & run ulang deterministik.
const BROKER_RENTANG: [string, string] = ["2026-08-24", "2026-09-06"]; // 14 hari
const DAILY_RENTANG: [string, string] = ["2026-06-09", "2026-09-06"]; // 90 hari
const FILINGS_UNIVERSE_START = "2018-01-01";
// Feed filings terurut turun menurut timestamp; probe `end` mengungkap kedalaman
// lewat total_count tanpa harus menggulir ke halaman terakhir.
const PROBE_FILINGS_END = ["2021-12-31", "2023-12-31"];
const PROBE_SUSPENSI_END = ["2019-12-31", "2016-12-31"];
const PERKIRAAN_FREE_FLOAT = 10;

const FILE_LAPORAN = "docs/data-proof.md";
const PENANDA_MULAI = "<!-- data-proof:mulai -->";
const PENANDA_SELESAI = "<!-- data-proof:selesai -->";

type Jenis =
  | "suspensions"
  | "dates"
  | "filings"
  | "corporate-actions"
  | "listing"
  | "financials"
  | "broker"
  | "daily"
  | "free-float";

interface Langkah {
  id: string;
  kelompok: "emiten" | "universe";
  jenis: Jenis;
  symbol?: string;
  keterangan: string;
  perkiraanKredit: number;
  /** Path & params PERSIS seperti yang dicatat provider di ledger (kunci anggaran & cache). */
  endpointPath: string;
  params: Record<string, string>;
  jalankan: (p: SectorsProvider) => Promise<unknown>;
}

function susunRencana(): Langkah[] {
  const rencana: Langkah[] = [];
  for (const s of EMITEN) {
    rencana.push(
      {
        id: `suspensions:${s}`,
        kelompok: "emiten",
        jenis: "suspensions",
        symbol: s,
        keterangan: "suspensions?symbol= (halaman 1)",
        perkiraanKredit: 1,
        endpointPath: "/v2/suspensions/",
        params: { symbol: s },
        jalankan: (p) => p.suspensions({ symbol: s }),
      },
      {
        id: `dates:${s}`,
        kelompok: "emiten",
        jenis: "dates",
        symbol: s,
        keterangan: "get_quarterly_financial_dates",
        perkiraanKredit: 1,
        endpointPath: `/v2/company/get_quarterly_financial_dates/${s}/`,
        params: {},
        jalankan: (p) => p.quarterlyFinancialDates(s),
      },
      {
        id: `filings:${s}`,
        kelompok: "emiten",
        jenis: "filings",
        symbol: s,
        keterangan: "filings?symbol= (halaman 1)",
        perkiraanKredit: 1,
        endpointPath: "/v2/filings/",
        params: { symbol: s },
        jalankan: (p) => p.filings(s),
      },
      {
        id: `corporate-actions:${s}`,
        kelompok: "emiten",
        jenis: "corporate-actions",
        symbol: s,
        keterangan: "corporate-actions",
        perkiraanKredit: 1,
        endpointPath: `/v2/company/corporate-actions/${s}/`,
        params: {},
        jalankan: (p) => p.corporateActions(s),
      },
      {
        id: `listing:${s}`,
        kelompok: "emiten",
        jenis: "listing",
        symbol: s,
        keterangan: "listing-performance",
        perkiraanKredit: 1,
        endpointPath: `/v2/listing-performance/${s}/`,
        params: {},
        jalankan: (p) => p.listingPerformance(s),
      },
    );
  }
  for (const s of FINANCIALS_EMITEN) {
    rencana.push({
      id: `financials:${s}`,
      kelompok: "emiten",
      jenis: "financials",
      symbol: s,
      keterangan: `financials/quarterly n_quarters=${FINANCIALS_N}`,
      perkiraanKredit: FINANCIALS_N,
      endpointPath: `/v2/financials/quarterly/${s}/`,
      params: { n_quarters: String(FINANCIALS_N) },
      jalankan: (p) => p.quarterlyFinancials(s, FINANCIALS_N),
    });
  }
  for (const s of BROKER_EMITEN) {
    rencana.push({
      id: `broker:${s}`,
      kelompok: "emiten",
      jenis: "broker",
      symbol: s,
      keterangan: `broker-summary ${BROKER_RENTANG[0]}..${BROKER_RENTANG[1]}`,
      perkiraanKredit: 1,
      endpointPath: `/v2/broker-summary/${s}/`,
      params: { start: BROKER_RENTANG[0], end: BROKER_RENTANG[1] },
      jalankan: (p) => p.brokerSummary(s, ...BROKER_RENTANG),
    });
  }
  for (const s of DAILY_EMITEN) {
    rencana.push({
      id: `daily:${s}`,
      kelompok: "emiten",
      jenis: "daily",
      symbol: s,
      keterangan: `daily ${DAILY_RENTANG[0]}..${DAILY_RENTANG[1]}`,
      perkiraanKredit: 1,
      endpointPath: `/v2/daily/${s}/`,
      params: { start: DAILY_RENTANG[0], end: DAILY_RENTANG[1] },
      jalankan: (p) => p.daily(s, ...DAILY_RENTANG),
    });
  }
  rencana.push({
    id: "suspensions:universe",
    kelompok: "universe",
    jenis: "suspensions",
    keterangan: "suspensions tanpa symbol (halaman 1)",
    perkiraanKredit: 1,
    endpointPath: "/v2/suspensions/",
    params: {},
    jalankan: (p) => p.suspensions(),
  });
  for (const end of PROBE_SUSPENSI_END) {
    rencana.push({
      id: `suspensions:universe:end=${end}`,
      kelompok: "universe",
      jenis: "suspensions",
      keterangan: `suspensions?end=${end} (probe kedalaman)`,
      perkiraanKredit: 1,
      endpointPath: "/v2/suspensions/",
      params: { end },
      jalankan: (p) => p.suspensions({ end }),
    });
  }
  // DataProvider.filings mewajibkan symbol; probe universe memakai panggil() langsung.
  const filingsUniverse = (params: Record<string, string>) => (p: SectorsProvider) =>
    p.panggil({
      endpoint: "/v2/filings/",
      params,
      aturan: "per-request",
      ttlMs: null,
      schema: FilingsPageSchema,
    });
  const paramsUniverse = { start: FILINGS_UNIVERSE_START, limit: "30" };
  rencana.push({
    id: "filings:universe",
    kelompok: "universe",
    jenis: "filings",
    keterangan: `filings tanpa symbol, start=${FILINGS_UNIVERSE_START}, limit=30`,
    perkiraanKredit: 1,
    endpointPath: "/v2/filings/",
    params: paramsUniverse,
    jalankan: filingsUniverse(paramsUniverse),
  });
  for (const end of PROBE_FILINGS_END) {
    const params = { start: FILINGS_UNIVERSE_START, end, limit: "30" };
    rencana.push({
      id: `filings:universe:end=${end}`,
      kelompok: "universe",
      jenis: "filings",
      keterangan: `filings tanpa symbol, start=${FILINGS_UNIVERSE_START}, end=${end} (probe kedalaman)`,
      perkiraanKredit: 1,
      endpointPath: "/v2/filings/",
      params,
      jalankan: filingsUniverse(params),
    });
  }
  rencana.push({
    id: "free-float:universe",
    kelompok: "universe",
    jenis: "free-float",
    keterangan: "free-float seluruh bursa (hanya bila sisa anggaran cukup)",
    perkiraanKredit: PERKIRAAN_FREE_FLOAT,
    endpointPath: "/v2/free-float/",
    params: {},
    jalankan: (p) => p.freeFloat(),
  });
  return rencana;
}

// ---------- Statistik respons mentah ----------

const POLA_TANGGAL = /^\d{4}-\d{2}-\d{2}/;

/** Kumpulkan semua string bertanggal (YYYY-MM-DD...) di mana pun dalam body. */
export function kumpulkanTanggal(body: unknown, hasil: string[] = []): string[] {
  if (typeof body === "string") {
    if (POLA_TANGGAL.test(body)) hasil.push(body.slice(0, 10));
  } else if (Array.isArray(body)) {
    for (const x of body) kumpulkanTanggal(x, hasil);
  } else if (body && typeof body === "object") {
    for (const v of Object.values(body as Record<string, unknown>)) kumpulkanTanggal(v, hasil);
  }
  return hasil;
}

/** Jumlah "baris": panjang array, panjang `results`/`data`, atau jumlah kunci objek. */
export function jumlahBaris(body: unknown): number {
  if (Array.isArray(body)) return body.length;
  if (body && typeof body === "object") {
    const o = body as { results?: unknown; data?: unknown };
    if (Array.isArray(o.results)) return o.results.length;
    if (Array.isArray(o.data)) return o.data.length;
    return Object.keys(body as object).length;
  }
  return body === null || body === undefined ? 0 : 1;
}

function infoPaginasi(body: unknown): string {
  if (!body || typeof body !== "object") return "";
  const pg = (body as { pagination?: Record<string, unknown> }).pagination;
  if (!pg) return "";
  return `total_count=${pg.total_count ?? "?"} has_next=${pg.has_next ?? "?"}`;
}

/** Kunci anggaran = path endpoint + params terurut. */
export function kunciDari(endpointPath: string, params: Record<string, string>): string {
  const urut = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return `${endpointPath}?${urut}`;
}
const kunciBaris = (b: BarisLedger) => kunciDari(b.endpoint, b.params);
const kunciLangkah = (l: Langkah) => kunciDari(l.endpointPath, l.params);

// ---------- Eksekusi ----------

export interface HasilLangkah {
  id: string;
  kelompok: "emiten" | "universe";
  jenis: Jenis;
  symbol?: string;
  keterangan: string;
  endpointPath: string;
  params: Record<string, string>;
  status: number | null;
  /** api = dipanggil ke Sectors (ditagih); cache = 0 kredit; dilewati = anggaran; gagal = jaringan/param. */
  sumber: "api" | "cache" | "dilewati" | "gagal";
  credits: number;
  baris: number | null;
  terawal: string | null;
  terakhir: string | null;
  skema: "lolos" | "gagal" | "-";
  catatan: string;
}

const tidur = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function hasilKosong(l: Langkah): HasilLangkah {
  return {
    id: l.id,
    kelompok: l.kelompok,
    jenis: l.jenis,
    symbol: l.symbol,
    keterangan: l.keterangan,
    endpointPath: l.endpointPath,
    params: l.params,
    status: null,
    sumber: "gagal",
    credits: 0,
    baris: null,
    terawal: null,
    terakhir: null,
    skema: "-",
    catatan: "",
  };
}

async function jalankanLangkah(p: SectorsProvider, l: Langkah): Promise<HasilLangkah> {
  const hasil = hasilKosong(l);
  const sebelum = (await p.ledger.semua()).length;
  let errSkema: SchemaMismatchError | undefined;
  try {
    await l.jalankan(p);
    hasil.skema = "lolos";
  } catch (err) {
    if (err instanceof SchemaMismatchError) {
      errSkema = err;
      hasil.skema = "gagal";
    } else if (err instanceof SectorsApiError) {
      hasil.catatan = `${err.code ?? ""} ${err.message.split(": ").slice(1).join(": ")}`.trim();
    } else if (err instanceof CreditReserveError || err instanceof InvalidQueryError) {
      hasil.catatan = err.message;
    } else {
      hasil.catatan = err instanceof Error ? err.message : String(err);
    }
  }

  const baru = (await p.ledger.semua()).slice(sebelum);
  const terakhir = baru[baru.length - 1];
  hasil.credits = baru.reduce((a, b) => a + b.credits, 0);
  if (!terakhir) return hasil; // gagal sebelum fetch (param/cadangan)

  if (kunciBaris(terakhir) !== kunciLangkah(l)) {
    hasil.catatan = `KUNCI BEDA: ledger ${kunciBaris(terakhir)} ≠ rencana ${kunciLangkah(l)}. ${hasil.catatan}`.trim();
  }
  hasil.status = terakhir.status;
  hasil.sumber = terakhir.status === null ? "gagal" : terakhir.cacheHit ? "cache" : "api";
  if (baru.length > 1) hasil.catatan = `${baru.length} percobaan; ${hasil.catatan}`.trim();

  if (terakhir.status !== null && terakhir.status >= 200 && terakhir.status < 300) {
    const entri = await p.cache.baca(terakhir.endpoint, terakhir.params);
    const body = entri?.body;
    hasil.baris = jumlahBaris(body);
    const tanggal = kumpulkanTanggal(body).sort();
    hasil.terawal = tanggal[0] ?? null;
    hasil.terakhir = tanggal[tanggal.length - 1] ?? null;
    const pg = infoPaginasi(body);
    if (pg) hasil.catatan = `${pg} ${hasil.catatan}`.trim();
    if (errSkema) {
      hasil.catatan = `SKEMA: ${errSkema.message.replace(/^Respons \S+ tidak cocok skema: /, "")} ${hasil.catatan}`.trim();
    }
  }
  return hasil;
}

/** Kredit lintas run yang dapat diatribusikan ke rencana ini (dari ledger). */
async function kreditRencana(ledger: Ledger, kunci: Set<string>): Promise<number> {
  const semua = await ledger.semua();
  return semua.filter((b) => kunci.has(kunciBaris(b))).reduce((a, b) => a + b.credits, 0);
}

/** Kredit yang terbuang karena 404 yang sama dibayar lebih dari sekali. */
async function kreditTerbuang404(ledger: Ledger, kunci: Set<string>): Promise<number> {
  const hitung = new Map<string, number>();
  for (const b of await ledger.semua()) {
    const k = kunciBaris(b);
    if (b.status === 404 && b.credits > 0 && kunci.has(k)) hitung.set(k, (hitung.get(k) ?? 0) + b.credits);
  }
  let terbuang = 0;
  for (const n of hitung.values()) terbuang += Math.max(0, n - 1);
  return terbuang;
}

/**
 * 404 yang tercatat di ledger sebelum cache-404 diaktifkan (tiket 04) tidak punya
 * entri cache; semai entri sintetis agar tidak pernah dibayar ulang.
 */
async function semaiCache404DariLedger(cache: CacheRespons, ledger: Ledger, rencana: Langkah[]): Promise<number> {
  const semua = await ledger.semua();
  let n = 0;
  for (const l of rencana) {
    if (await cache.baca(l.endpointPath, l.params)) continue;
    const k = kunciLangkah(l);
    const baris404 = semua.find((b) => b.status === 404 && kunciBaris(b) === k);
    if (!baris404) continue;
    await cache.tulis(
      l.endpointPath,
      l.params,
      404,
      { code: "not_found", message: `404 disemai dari ledger ${baris404.ts} (body asli tidak tersimpan)` },
      TTL_404_MS,
    );
    n += 1;
  }
  return n;
}

// ---------- Laporan ----------

const td = (s: unknown) => String(s ?? "-").replace(/\|/g, "\\|").replace(/\r?\n/g, " ");

function selEmiten(h: HasilLangkah | undefined): string {
  if (!h) return "—";
  if (h.sumber === "dilewati") return "dilewati";
  if (h.status === 404) return `**404**; ${h.credits} kr`;
  if (h.status === null || h.status >= 300) return `**HTTP ${h.status ?? "gagal"}**`;
  const rentang = h.terawal ? `${h.terawal} – ${h.terakhir}` : "tanpa tanggal";
  const skema = h.skema === "gagal" ? " ⚠skema" : "";
  return `${h.baris === 0 ? "kosong" : `${h.baris} baris`}; ${rentang}; ${h.credits} kr${skema}`;
}

export function susunLaporan(hasil: HasilLangkah[], ringkasan: Record<string, string | number>): string {
  const baris: string[] = [];
  baris.push(`_Dihasilkan otomatis oleh \`npm run data-proof\` pada ${ringkasan.waktu}._`, "");
  baris.push("### Ringkasan kredit (dari ledger `.cache/sectors/ledger.jsonl`)", "");
  baris.push("| Ukuran | Nilai |", "|---|---|");
  for (const [k, v] of Object.entries(ringkasan)) if (k !== "waktu") baris.push(`| ${td(k)} | ${td(v)} |`);
  baris.push("");

  const jenisEmiten: Jenis[] = [
    "suspensions",
    "dates",
    "filings",
    "corporate-actions",
    "listing",
    "financials",
    "broker",
    "daily",
  ];
  const kolom = [...EMITEN, ...BROKER_EMITEN.filter((s) => !EMITEN.includes(s as (typeof EMITEN)[number]))];
  baris.push("### Tabel endpoint × emiten", "");
  baris.push(
    "Sel: `jumlah baris; tanggal terawal – terakhir yang terlihat; kredit (run terakhir; 0 = dari cache)`. `—` = tidak direncanakan (hemat kredit). Tanggal diambil dari semua string berformat tanggal dalam respons; untuk feed berpaginasi hanya halaman pertama.",
    "",
  );
  baris.push(`| Endpoint | ${kolom.join(" | ")} |`, `|---|${kolom.map(() => "---").join("|")}|`);
  for (const e of jenisEmiten) {
    const sel = kolom.map((s) => selEmiten(hasil.find((h) => h.jenis === e && h.symbol === s)));
    baris.push(`| ${e} | ${sel.join(" | ")} |`);
  }
  baris.push("");

  baris.push("### Probe universe", "");
  baris.push("| Probe | Status | Baris | Terawal | Terakhir | Kredit | Skema | Catatan |", "|---|---|---|---|---|---|---|---|");
  for (const h of hasil.filter((x) => x.kelompok === "universe")) {
    baris.push(
      `| ${td(h.keterangan)} | ${td(h.sumber === "dilewati" ? "dilewati" : h.status)} | ${td(h.baris)} | ${td(h.terawal)} | ${td(h.terakhir)} | ${h.credits} | ${h.skema} | ${td(h.catatan)} |`,
    );
  }
  baris.push("");

  baris.push("### Detail setiap panggilan (run terakhir)", "");
  baris.push("| # | Endpoint | Params | HTTP | Sumber | Baris | Terawal | Terakhir | Kredit | Skema | Catatan |", "|---|---|---|---|---|---|---|---|---|---|---|");
  hasil.forEach((h, i) => {
    baris.push(
      `| ${i + 1} | ${td(h.endpointPath)} | ${td(JSON.stringify(h.params))} | ${td(h.status)} | ${h.sumber} | ${td(h.baris)} | ${td(h.terawal)} | ${td(h.terakhir)} | ${h.credits} | ${h.skema} | ${td(h.catatan)} |`,
    );
  });
  baris.push("");

  baris.push("### Jawaban otomatis", "");
  baris.push("**(a) Tanggal terawal yang terlihat per endpoint** (minimum lintas semua panggilan 2xx; feed berpaginasi = halaman pertama saja):", "");
  baris.push("| Endpoint | Terawal | Terakhir | Dari panggilan |", "|---|---|---|---|");
  const perJenis = new Map<Jenis, HasilLangkah[]>();
  for (const h of hasil) if (h.terawal) perJenis.set(h.jenis, [...(perJenis.get(h.jenis) ?? []), h]);
  for (const [e, hs] of perJenis) {
    const min = hs.reduce((a, b) => (b.terawal! < a.terawal! ? b : a));
    const maks = hs.reduce((a, b) => (b.terakhir! > a.terakhir! ? b : a));
    baris.push(`| ${e} | ${min.terawal} | ${maks.terakhir} | ${td(min.id)} |`);
  }
  baris.push("");
  baris.push("**(b) Emiten delisting/tersuspensi masih mengembalikan data per-simbol?**", "");
  baris.push("| Emiten | suspensions | dates | filings | corporate-actions | listing | financials |", "|---|---|---|---|---|---|---|");
  for (const s of EMITEN_DELISTING) {
    const sel = (["suspensions", "dates", "filings", "corporate-actions", "listing", "financials"] as Jenis[]).map((e) => {
      const h = hasil.find((x) => x.jenis === e && x.symbol === s);
      if (!h) return "—";
      if (h.status === 404) return "404";
      if (h.status === null || h.status >= 300) return `HTTP ${h.status ?? "gagal"}`;
      return h.baris === 0 ? "200 kosong" : `200, ${h.baris} baris`;
    });
    baris.push(`| ${s} | ${sel.join(" | ")} |`);
  }
  baris.push("");
  baris.push(
    `**(c) Kredit terpakai rencana ini (ledger, lintas run):** ${ringkasan["Kredit rencana ini (lintas run, dari ledger)"]} dari batas ${ANGGARAN_SKRIP}; run ini ${ringkasan["Kredit run ini"]}; terbuang karena 404 dibayar ulang: ${ringkasan["Kredit terbuang (404 dibayar ulang)"]}.`,
    "",
  );
  const galat = hasil.filter((h) => h.sumber === "gagal" || h.skema === "gagal" || h.status === 404 || h.sumber === "dilewati");
  baris.push("**(d) Error / ketidaksesuaian yang ditemui (run terakhir):**", "");
  if (galat.length === 0) baris.push("- Tidak ada.");
  for (const h of galat) baris.push(`- \`${h.id}\`: HTTP ${h.status ?? "-"}, sumber ${h.sumber}, skema ${h.skema}. ${td(h.catatan)}`);
  baris.push("");
  return baris.join("\n");
}

async function tulisLaporan(isiBaru: string): Promise<void> {
  const file = path.resolve(FILE_LAPORAN);
  await mkdir(path.dirname(file), { recursive: true });
  let lama = "";
  try {
    lama = await readFile(file, "utf8");
  } catch {
    lama = "";
  }
  const blok = `${PENANDA_MULAI}\n${isiBaru}\n${PENANDA_SELESAI}`;
  const i = lama.indexOf(PENANDA_MULAI);
  const j = lama.indexOf(PENANDA_SELESAI);
  let hasil: string;
  if (i >= 0 && j > i) {
    hasil = lama.slice(0, i) + blok + lama.slice(j + PENANDA_SELESAI.length);
  } else {
    hasil =
      "# Pembuktian data Fase 1 (tiket 04)\n\n" +
      "Hasil uji API Sectors nyata untuk enam emiten uji dan probe universe. Bagian di antara penanda dihasilkan skrip; bagian **Keputusan** di bawahnya ditulis manual.\n\n" +
      "## Hasil pengujian\n\n" +
      blok +
      "\n\n## Keputusan\n\n_(belum ditulis)_\n";
  }
  await writeFile(file, hasil, "utf8");
}

// ---------- Main ----------

/** Pra-terbang tanpa API: status cache & ledger tiap langkah, perkiraan biaya run berikutnya. */
async function praTerbang(rencana: Langkah[], cache: CacheRespons, ledger: Ledger): Promise<{ belumCache: Langkah[]; terpakai: number }> {
  const kunci = new Set(rencana.map(kunciLangkah));
  const terpakai = await kreditRencana(ledger, kunci);
  const belumCache: Langkah[] = [];
  for (const l of rencana) {
    const ada = await cache.baca(l.endpointPath, l.params);
    if (!ada) belumCache.push(l);
    console.log(`  ${l.id.padEnd(36)} ~${String(l.perkiraanKredit).padStart(2)} kr  cache=${ada ? `ada (HTTP ${ada.status})` : "TIDAK"}  ${kunciLangkah(l)}`);
  }
  const biaya = belumCache.reduce((a, l) => a + l.perkiraanKredit, 0);
  console.log("");
  console.log(`Kredit rencana ini menurut ledger : ${terpakai} (batas ${ANGGARAN_SKRIP})`);
  console.log(`Belum di-cache                    : ${belumCache.length} langkah, perkiraan ${biaya} kredit bila dijalankan`);
  if (terpakai + biaya > ANGGARAN_SKRIP) {
    console.log(`Langkah berbayar yang akan DILEWATI karena batas: ${belumCache.filter((l) => terpakai + l.perkiraanKredit > ANGGARAN_SKRIP).map((l) => l.id).join(", ") || "-"}`);
  }
  return { belumCache, terpakai };
}

async function main(): Promise<number> {
  const dry = process.argv.includes("--dry");
  const rencana = susunRencana();
  const totalPerkiraan = rencana.reduce((a, l) => a + l.perkiraanKredit, 0);
  console.log(`Rencana: ${rencana.length} panggilan, perkiraan ${totalPerkiraan} kredit (batas ${ANGGARAN_SKRIP}; free-float opsional).`);

  const dirCache = process.env.SECTORS_CACHE_DIR || DIR_CACHE_DEFAULT;
  const cacheAwal = new CacheRespons(dirCache);
  const ledgerAwal = new Ledger(dirCache);
  const disemai = await semaiCache404DariLedger(cacheAwal, ledgerAwal, rencana);
  if (disemai) console.log(`Cache 404 disemai dari ledger: ${disemai} entri (tidak akan dibayar ulang).`);
  await praTerbang(rencana, cacheAwal, ledgerAwal);
  if (dry) return 0;

  const provider = sectorsProviderDariEnv(process.env);
  if (!provider) {
    console.error("SECTORS_API_KEY tidak ditemukan di .env.local / lingkungan.");
    return 1;
  }

  const kunciRencana = new Set(rencana.map(kunciLangkah));
  const barisAwal = (await provider.ledger.semua()).length;
  const hasil: HasilLangkah[] = [];
  console.log("");

  for (const l of rencana) {
    const diCache = Boolean(await provider.cache.baca(l.endpointPath, l.params));
    const terpakai = await kreditRencana(provider.ledger, kunciRencana);
    // Batas keras: jangan mulai panggilan berbayar yang bisa menembus anggaran skrip.
    if (!diCache && terpakai + l.perkiraanKredit > ANGGARAN_SKRIP) {
      const h = hasilKosong(l);
      h.sumber = "dilewati";
      h.catatan = `dilewati: terpakai ${terpakai} + perkiraan ${l.perkiraanKredit} > ${ANGGARAN_SKRIP}`;
      hasil.push(h);
      console.log(`  LEWATI ${l.id} (terpakai ${terpakai} + ~${l.perkiraanKredit} > ${ANGGARAN_SKRIP})`);
      continue;
    }
    const h = await jalankanLangkah(provider, l);
    hasil.push(h);
    console.log(
      `  ${h.id.padEnd(36)} HTTP ${String(h.status ?? "-").padEnd(4)} ${h.sumber.padEnd(6)} ${String(h.baris ?? "-").padStart(4)} baris  ${h.terawal ?? "-"}..${h.terakhir ?? "-"}  ${h.credits} kr  skema=${h.skema} ${h.catatan}`,
    );
    if (h.sumber === "api") await tidur(200);
  }

  const semuaLedger = await provider.ledger.semua();
  const kreditRunIni = semuaLedger.slice(barisAwal).reduce((a, b) => a + b.credits, 0);
  const kreditSkrip = await kreditRencana(provider.ledger, kunciRencana);
  const terbuang = await kreditTerbuang404(provider.ledger, kunciRencana);
  const totalLedger = semuaLedger.reduce((a, b) => a + b.credits, 0);
  const ringkasan: Record<string, string | number> = {
    waktu: new Date().toISOString(),
    "Kredit run ini": kreditRunIni,
    "Kredit rencana ini (lintas run, dari ledger)": kreditSkrip,
    "Kredit terbuang (404 dibayar ulang)": terbuang,
    "Batas keras skrip": ANGGARAN_SKRIP,
    "Total kredit seluruh ledger (semua skrip)": totalLedger,
    "Sisa menurut ledger lokal": `${provider.anggaran - totalLedger} dari ${provider.anggaran} (cadangan ${provider.cadangan})`,
    "Panggilan dari API / cache / dilewati / gagal": [
      hasil.filter((h) => h.sumber === "api").length,
      hasil.filter((h) => h.sumber === "cache").length,
      hasil.filter((h) => h.sumber === "dilewati").length,
      hasil.filter((h) => h.sumber === "gagal").length,
    ].join(" / "),
  };

  await tulisLaporan(susunLaporan(hasil, ringkasan));
  await writeFile(
    path.join(provider.cache.dir, "data-proof-hasil.json"),
    JSON.stringify({ ringkasan, hasil }, null, 2),
    "utf8",
  );

  console.log("");
  for (const [k, v] of Object.entries(ringkasan)) console.log(`${k.padEnd(48)}: ${v}`);
  console.log(`Laporan: ${FILE_LAPORAN}`);
  if (kreditSkrip > ANGGARAN_SKRIP) {
    console.error(`PERINGATAN: kredit rencana ${kreditSkrip} melebihi batas ${ANGGARAN_SKRIP}.`);
    return 2;
  }
  return 0;
}

main().then(
  (kode) => process.exit(kode),
  (err) => {
    console.error(`GAGAL: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(3);
  },
);
