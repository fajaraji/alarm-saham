#!/usr/bin/env node
// Penarikan universe uji ke database (tiket 07).
//
//   npm run pull-universe -- --dry                 pra-terbang: rencana + status cache, TANPA panggilan API
//   npm run pull-universe                          jalankan semua langkah, tulis docs/universe-pull.md
//   npm run pull-universe -- --step=dates,filings  hanya langkah tertentu
//   npm run pull-universe -- --group=watchlist     hanya kelompok emiten tertentu (langkah per emiten)
//   npm run pull-universe -- --laporan             tulis ulang laporan dari DB + hasil run terakhir
//   npm run pull-universe -- --pglite[=DIR]        DATABASE_URL kosong → PGlite lokal (./.pglite), durable
//
// Disiplin anggaran (docs/data-proof.md §5–§6):
// - Ledger & cache WAJIB di DB (api_ledger/api_cache: Neon bila DATABASE_URL, atau PGlite
//   lokal dengan --pglite); run kedua = 0 kredit. Pindah PGlite → Neon tanpa kredit:
//   `npm run cache:migrate-to-db -- --from-pglite` lalu `npm run pull-universe` (semua dari cache).
// - Batas keras: berhenti bila perkiraan + terpakai run ini > BATAS_KREDIT_RUN, atau
//   sisa menurut ledger (anggaran − total) − perkiraan < SISA_MINIMUM.
// - Suspensi universe `limit=30` dengan `end` TETAP (< hari ini UTC) agar cache permanen.
// - Filings hanya 59 pemantauan + 30 kontrol; financials hanya 18 delisting dengan
//   n_quarters dari `dates`; listing-performance dan emiten yang diketahui 404 tidak dipanggil.
// Kunci API/DATABASE_URL tidak pernah dicetak. Nama pemegang saham hanya masuk DB, tidak ke laporan.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { and, asc, count, eq, gte, inArray, lte, sql } from "drizzle-orm";
import {
  CacheDb,
  CreditReserveError,
  DIR_CACHE_DEFAULT,
  FreeFloatSchema,
  LedgerDb,
  NotFoundError,
  QuarterlyFinancialDatesSchema,
  SchemaMismatchError,
  SectorsApiError,
  SuspensionsPageSchema,
  kunciCache,
  sectorsProviderDariEnv,
  type Company,
  type Filing,
  type QuarterlyFinancialDates,
  type SectorsProvider,
} from "../src/lib/data";
import type { Db } from "../src/lib/db";
import { DIR_PGLITE_DEFAULT, bukaDb, type DbTerbuka } from "../src/lib/db/buka";
import {
  corporateActions,
  filings,
  financialsQ,
  reportDates,
  suspensions,
  symbols,
} from "../src/lib/db/schema";
import {
  barisAksiKorporasi,
  barisFiling,
  barisFinancial,
  barisReportDates,
  jumlahHalaman,
  nQuartersTersedia,
  pasKuartal,
  pilihKontrol,
  targetDelisting,
  targetPemantauan,
} from "../src/lib/universe/aturan";
import {
  EMITEN_DELISTING,
  EMITEN_PEMANTAUAN,
  JUMLAH_KONTROL,
  TANGGAL_ACUAN_PEMANTAUAN,
} from "../src/lib/universe/daftar";

// ---------- Konstanta anggaran ----------

/** Batas keras kredit yang boleh dibayar dalam SATU run skrip ini. */
export const BATAS_KREDIT_RUN = 440;
/** Anggaran total tiket 07 yang direvisi (docs/data-proof.md §5); financials dipangkas agar total run ≤ ini. */
export const ANGGARAN_TOTAL_TIKET = 433;
/** Sisa ledger minimum yang harus tetap utuh setelah run (cadangan juri 250 + buffer). */
export const SISA_MINIMUM = 260;
/**
 * `end` tetap dan HARUS < hari ini UTC saat run (provider: end < hariIni → cache permanen).
 * 2026-09-05 (Sabtu) — run pertama 7 Sep WIB masih 6 Sep UTC, jadi 2026-09-06 akan kena TTL 24 jam.
 */
export const SUSPENSI_END = "2026-09-05";
export const SUSPENSI_LIMIT = 30;
export const SUSPENSI_MAKS_HALAMAN = 25;
export const FILINGS_MAKS_HALAMAN = 3;
/** Batas kredit langkah filings (anggaran revisi 86 untuk halaman pertama + sedikit lanjutan). */
export const FILINGS_BATAS_KREDIT = 90;
export const FINANCIALS_SEJAK = "2020-01-01";
export const FINANCIALS_MAKS_KUARTAL = 8;
/** Jendela financials yang sudah ter-cache diterima (0 kredit) hanya bila ≥ ini; n=2 tiket 04 terlalu pendek. */
export const FINANCIALS_MIN_KUARTAL_DITERIMA = 3;
export const SCREENER_WHERE = "indices in ['LQ45']";
export const SCREENER_LIMIT = 60;
/**
 * Screener hanya mengembalikan symbol+company_name (tanpa market_cap) dan menolak
 * `order_by=market_cap desc` dengan HTTP 400 (gratis; dicoba 7 Sep 2026). Karena itu
 * kontrol = 30 pertama menurut urutan API (alfabetis) dari anggota LQ45 tanpa suspensi.
 */
export const SCREENER_ORDER_BY: string | undefined = undefined;
/** Kredit yang sudah terpakai SEBELUM tiket 07 (ledger tiket 03–04); anggaran tiket dihitung kumulatif dari sini. */
export const KREDIT_SEBELUM_TIKET = 68;
/** 429 (rate limit; GRATIS) → tunggu lalu ulangi, maks sekian kali. */
export const RETRY_429 = 4;
export const JEDA_429_MS = 20_000;
/** Jeda antar panggilan API berbayar (rate limit Sectors). */
export const JEDA_API_MS = 450;
/** Anggaran per langkah menurut docs/data-proof.md §5 (untuk laporan penyimpangan). */
export const ANGGARAN_LANGKAH: Record<Langkah, number> = {
  suspensions: 20,
  "free-float": 10,
  control: 1,
  symbols: 0,
  dates: 71,
  "corporate-actions": 71,
  filings: 86,
  financials: 144,
};

const FILE_LAPORAN = "docs/universe-pull.md";
const NAMA_HASIL = "universe-pull-hasil.json";

type Langkah =
  | "suspensions"
  | "free-float"
  | "control"
  | "symbols"
  | "dates"
  | "corporate-actions"
  | "filings"
  | "financials";
const URUTAN: readonly Langkah[] = [
  "suspensions",
  "free-float",
  "control",
  "symbols",
  "dates",
  "corporate-actions",
  "filings",
  "financials",
];
type Kelompok = "delisting" | "watchlist" | "control";
const SEMUA_KELOMPOK: readonly Kelompok[] = ["delisting", "watchlist", "control"];

// ---------- Argumen ----------

interface Argumen {
  dry: boolean;
  laporanSaja: boolean;
  langkah: Set<Langkah>;
  kelompok: Set<Kelompok>;
  /** Folder PGlite bila DATABASE_URL kosong; undefined = wajib DATABASE_URL. */
  pgliteDir?: string;
}

function uraiArgumen(argv: string[]): Argumen {
  const arg: Argumen = { dry: false, laporanSaja: false, langkah: new Set(URUTAN), kelompok: new Set(SEMUA_KELOMPOK) };
  for (const a of argv) {
    if (a === "--dry") arg.dry = true;
    else if (a === "--laporan") arg.laporanSaja = true;
    else if (a === "--pglite") arg.pgliteDir = DIR_PGLITE_DEFAULT;
    else if (a.startsWith("--pglite=")) arg.pgliteDir = a.slice(9) || DIR_PGLITE_DEFAULT;
    else if (a.startsWith("--step=")) {
      const daftar = a.slice(7).split(",").map((s) => s.trim()) as Langkah[];
      for (const l of daftar) if (!URUTAN.includes(l)) throw new Error(`Langkah tidak dikenal: ${l} (pilihan: ${URUTAN.join(", ")})`);
      arg.langkah = new Set(daftar);
    } else if (a.startsWith("--group=")) {
      const daftar = a.slice(8).split(",").map((s) => s.trim()) as Kelompok[];
      for (const k of daftar) if (!SEMUA_KELOMPOK.includes(k)) throw new Error(`Kelompok tidak dikenal: ${k}`);
      arg.kelompok = new Set(daftar);
    } else throw new Error(`Argumen tidak dikenal: ${a}`);
  }
  return arg;
}

// ---------- Konteks run & penghitung ----------

interface CatatanPanggilan {
  langkah: Langkah;
  id: string;
  endpoint: string;
  params: Record<string, string>;
  sumber: "api" | "cache" | "dry" | "404" | "gagal" | "dilewati";
  credits: number;
  perkiraan: number;
  catatan?: string;
}

interface StatistikLangkah {
  api: number;
  cache: number;
  e404: number;
  gagal: number;
  dilewati: number;
  kredit: number;
  perkiraanBelumCache: number;
}

class BerhentiAnggaran extends Error {
  constructor(pesan: string) {
    super(pesan);
    this.name = "BerhentiAnggaran";
  }
}

class Konteks {
  readonly catatan: CatatanPanggilan[] = [];
  readonly statistik = new Map<Langkah, StatistikLangkah>();
  terpakaiRun = 0;
  perkiraanRun = 0;
  private kunciCacheBerlaku!: Set<string>;

  constructor(
    readonly provider: SectorsProvider,
    readonly db: Db,
    readonly arg: Argumen,
  ) {}

  async siapkan(): Promise<void> {
    this.kunciCacheBerlaku = await this.provider.cache.kunciBerlaku();
  }

  diCache(endpoint: string, params: Record<string, string>): boolean {
    return this.kunciCacheBerlaku.has(kunciCache(endpoint, params));
  }

  stat(l: Langkah): StatistikLangkah {
    let s = this.statistik.get(l);
    if (!s) {
      s = { api: 0, cache: 0, e404: 0, gagal: 0, dilewati: 0, kredit: 0, perkiraanBelumCache: 0 };
      this.statistik.set(l, s);
    }
    return s;
  }

  /** Apakah dates untuk simbol ini tercatat 404 di cache (simbol tidak dikenal API). */
  async dates404(symbol: string): Promise<boolean> {
    const entri = await this.provider.cache.baca(`/v2/company/get_quarterly_financial_dates/${symbol}/`, {});
    return entri?.status === 404;
  }

  /** Baca entri cache (untuk perkiraan dry-run); null bila tidak ada/kedaluwarsa. */
  async bacaCache<T>(endpoint: string, params: Record<string, string>, parse: (body: unknown) => T | null): Promise<T | null> {
    const entri = await this.provider.cache.baca(endpoint, params);
    if (!entri || entri.status !== 200) return null;
    return parse(entri.body);
  }

  /**
   * Jalankan satu panggilan berbayar dengan pagar anggaran. Mengembalikan hasil
   * `fn`, atau null bila dry-run / 404 / gagal non-fatal. Melempar BerhentiAnggaran
   * bila batas run atau sisa minimum akan terlanggar.
   */
  async panggil<T>(
    langkah: Langkah,
    id: string,
    endpoint: string,
    params: Record<string, string>,
    perkiraan: number,
    fn: () => Promise<T>,
  ): Promise<T | null> {
    const s = this.stat(langkah);
    const cached = this.diCache(endpoint, params);
    const cat: CatatanPanggilan = { langkah, id, endpoint, params, sumber: "cache", credits: 0, perkiraan: cached ? 0 : perkiraan };

    if (!cached) {
      s.perkiraanBelumCache += perkiraan;
      this.perkiraanRun += perkiraan;
      if (this.terpakaiRun + perkiraan > BATAS_KREDIT_RUN) {
        throw new BerhentiAnggaran(`terpakai run ${this.terpakaiRun} + perkiraan ${perkiraan} > batas ${BATAS_KREDIT_RUN} (${id})`);
      }
      if (this.arg.dry) {
        cat.sumber = "dry";
        this.catatan.push(cat);
        this.cetak(cat);
        return null;
      }
      const sisa = await this.provider.sisaKredit();
      if (sisa - perkiraan < SISA_MINIMUM) {
        throw new BerhentiAnggaran(`sisa ledger ${sisa} − perkiraan ${perkiraan} < minimum ${SISA_MINIMUM} (${id})`);
      }
    } else if (this.arg.dry) {
      // Dry-run: terlayani cache → tetap laporkan sebagai cache tanpa membaca isi.
      this.catatan.push(cat);
      s.cache += 1;
      this.cetak(cat);
      return null;
    }

    const sebelum = await this.provider.ledger.totalKredit();
    let hasil: T | null = null;
    try {
      for (let percobaan = 0; ; percobaan += 1) {
        try {
          hasil = await fn();
          break;
        } catch (err) {
          // 429 tanpa kode "monthly_limit_exceeded" = rate limit sesaat; GRATIS → tunggu & ulangi.
          const rateLimit = err instanceof SectorsApiError && err.status === 429 && err.code !== "monthly_limit_exceeded";
          if (!rateLimit || percobaan >= RETRY_429) throw err;
          console.log(`  ... HTTP 429 (rate limit) pada ${id}; menunggu ${JEDA_429_MS / 1000}s lalu mengulang (${percobaan + 1}/${RETRY_429})`);
          await new Promise((r) => setTimeout(r, JEDA_429_MS));
        }
      }
      cat.sumber = cached ? "cache" : "api";
    } catch (err) {
      if (err instanceof NotFoundError) {
        cat.sumber = "404";
        cat.catatan = err.message.split(": ").slice(1).join(": ");
      } else if (err instanceof SchemaMismatchError) {
        cat.sumber = "gagal";
        cat.catatan = `skema: ${err.message}`;
      } else if (err instanceof CreditReserveError) {
        throw new BerhentiAnggaran(err.message);
      } else if (err instanceof SectorsApiError) {
        cat.sumber = "gagal";
        cat.catatan = `HTTP ${err.status} ${err.code ?? ""}`.trim();
        if ([401, 403, 429].includes(err.status) || err.code === "insufficient_credits" || err.code === "monthly_limit_exceeded" || err.code === "subscription_not_active") {
          this.catatan.push(cat);
          this.cetak(cat);
          throw new BerhentiAnggaran(`API menolak: ${cat.catatan} (${id})`);
        }
      } else throw err;
    }
    const sesudah = await this.provider.ledger.totalKredit();
    cat.credits = sesudah - sebelum;
    this.terpakaiRun += cat.credits;
    s.kredit += cat.credits;
    if (cat.sumber === "api") s.api += 1;
    else if (cat.sumber === "cache") s.cache += 1;
    else if (cat.sumber === "404") s.e404 += 1;
    else s.gagal += 1;
    if (cat.sumber !== "gagal") this.kunciCacheBerlaku.add(kunciCache(endpoint, params));
    this.catatan.push(cat);
    this.cetak(cat);
    if (cat.sumber === "api") await new Promise((r) => setTimeout(r, JEDA_API_MS));
    return hasil;
  }

  /** Dry-run: tambahkan perkiraan untuk panggilan yang belum bisa dienumerasi (kontrol belum terpilih). */
  perkiraanTambahan(langkah: Langkah, kredit: number, alasan: string): void {
    const s = this.stat(langkah);
    s.perkiraanBelumCache += kredit;
    this.perkiraanRun += kredit;
    const cat: CatatanPanggilan = { langkah, id: "(perkiraan)", endpoint: "-", params: {}, sumber: "dry", credits: 0, perkiraan: kredit, catatan: alasan };
    this.catatan.push(cat);
    this.cetak(cat);
  }

  lewati(langkah: Langkah, id: string, alasan: string): void {
    const s = this.stat(langkah);
    s.dilewati += 1;
    const cat: CatatanPanggilan = { langkah, id, endpoint: "-", params: {}, sumber: "dilewati", credits: 0, perkiraan: 0, catatan: alasan };
    this.catatan.push(cat);
    this.cetak(cat);
  }

  private cetak(c: CatatanPanggilan): void {
    const kr = c.sumber === "dry" ? `~${c.perkiraan}` : String(c.credits);
    console.log(`  ${c.langkah.padEnd(17)} ${c.id.padEnd(30)} ${c.sumber.padEnd(8)} ${kr.padStart(4)} kr ${c.catatan ?? ""}`);
  }
}

// ---------- Akses DB bantu ----------

async function petaSuspensi(db: Db): Promise<Map<string, string[]>> {
  const rows = await db.select({ s: suspensions.symbol, d: suspensions.suspensionDate }).from(suspensions);
  const peta = new Map<string, string[]>();
  for (const r of rows) peta.set(r.s, [...(peta.get(r.s) ?? []), r.d]);
  return peta;
}

async function simbolKelompok(db: Db, kelompok: Kelompok): Promise<string[]> {
  const rows = await db.select({ s: symbols.symbol }).from(symbols).where(eq(symbols.group, kelompok)).orderBy(asc(symbols.symbol));
  return rows.map((r) => r.s);
}

/** Emiten per kelompok untuk langkah per-emiten. Delisting & pemantauan dari daftar statis; kontrol dari DB. */
async function universePerKelompok(k: Konteks, langkah: Langkah): Promise<Array<{ symbol: string; kelompok: Kelompok }>> {
  const { db, arg } = k;
  const hasil: Array<{ symbol: string; kelompok: Kelompok }> = [];
  if (arg.kelompok.has("delisting")) for (const e of EMITEN_DELISTING) hasil.push({ symbol: e.symbol, kelompok: "delisting" });
  if (arg.kelompok.has("watchlist")) for (const s of EMITEN_PEMANTAUAN) hasil.push({ symbol: s, kelompok: "watchlist" });
  if (arg.kelompok.has("control")) {
    const kontrol = await simbolKelompok(db, "control");
    if (kontrol.length === 0 && arg.dry) k.perkiraanTambahan(langkah, JUMLAH_KONTROL, `${JUMLAH_KONTROL} kontrol belum terpilih (screener belum dijalankan)`);
    for (const s of kontrol) hasil.push({ symbol: s, kelompok: "control" });
  }
  return hasil;
}

// ---------- Langkah ----------

async function langkahSuspensions(k: Konteks): Promise<void> {
  const params0 = { end: SUSPENSI_END, limit: String(SUSPENSI_LIMIT), offset: "0" };
  // Perkiraan jumlah halaman: dari halaman 1 yang ter-cache, atau anggaran (20).
  const hal1 = await k.bacaCache("/v2/suspensions/", params0, (b) => {
    const p = SuspensionsPageSchema.safeParse(b);
    return p.success ? p.data : null;
  });
  let totalHalaman = hal1?.pagination?.total_count ? jumlahHalaman(hal1.pagination.total_count, SUSPENSI_LIMIT) : ANGGARAN_LANGKAH.suspensions;
  let offset = 0;
  for (let i = 0; i < Math.min(totalHalaman, SUSPENSI_MAKS_HALAMAN); i += 1) {
    const params = { end: SUSPENSI_END, limit: String(SUSPENSI_LIMIT), offset: String(offset) };
    const page = await k.panggil("suspensions", `universe offset=${offset}`, "/v2/suspensions/", params, 1, () =>
      k.provider.suspensions({ end: SUSPENSI_END, limit: SUSPENSI_LIMIT, offset }),
    );
    if (!page) {
      if (k.arg.dry) {
        offset += SUSPENSI_LIMIT;
        continue;
      }
      break;
    }
    if (page.results.length > 0) {
      await k.db
        .insert(suspensions)
        .values(page.results.map((r) => ({ symbol: r.symbol, suspensionDate: r.suspension_date, reason: r.reason ?? null, pdfUrl: r.pdf_url ?? null })))
        .onConflictDoNothing();
    }
    if (page.pagination?.total_count) totalHalaman = jumlahHalaman(page.pagination.total_count, SUSPENSI_LIMIT);
    if (!page.pagination?.has_next) break;
    offset = page.pagination.next_offset ?? offset + SUSPENSI_LIMIT;
  }
}

async function langkahFreeFloat(k: Konteks): Promise<Map<string, string>> {
  const nama = new Map<string, string>();
  const data =
    (await k.panggil("free-float", "universe", "/v2/free-float/", {}, ANGGARAN_LANGKAH["free-float"], () => k.provider.freeFloat())) ??
    (await k.bacaCache("/v2/free-float/", {}, (b) => {
      const p = FreeFloatSchema.safeParse(b);
      return p.success ? p.data : null;
    }));
  for (const e of data ?? []) if (e.company_name) nama.set(e.symbol, e.company_name);
  return nama;
}

async function langkahControl(k: Konteks): Promise<void> {
  const params: Record<string, string> = { where: SCREENER_WHERE, limit: String(SCREENER_LIMIT) };
  if (SCREENER_ORDER_BY) params.order_by = SCREENER_ORDER_BY;
  const page = await k.panggil("control", "screener LQ45", "/v2/companies/", params, 1, () =>
    k.provider.companies({ where: SCREENER_WHERE, order_by: SCREENER_ORDER_BY, limit: SCREENER_LIMIT }),
  );
  const urutan = SCREENER_ORDER_BY ? `order_by=${SCREENER_ORDER_BY}` : "urutan API (alfabetis; screener tanpa market_cap, order_by ditolak 400)";
  if (!page) return;
  const peta = await petaSuspensi(k.db);
  const pernahSuspensi = new Set<string>();
  for (const [s, tgl] of peta) if (tgl.some((t) => t >= "2019-01-01" && t <= "2026-12-31")) pernahSuspensi.add(s);
  const kecuali = new Set<string>([...EMITEN_DELISTING.map((e) => e.symbol), ...EMITEN_PEMANTAUAN]);
  const kontrol = pilihKontrol(page.results as Company[], pernahSuspensi, kecuali, JUMLAH_KONTROL);
  const adaMarketCap = kontrol.some((c) => c.marketCap !== null);
  console.log(`  kandidat LQ45 ${page.results.length}; tanpa suspensi & bukan universe ${page.results.filter((c) => !pernahSuspensi.has(c.symbol) && !kecuali.has(c.symbol)).length}; terpilih ${kontrol.length}${adaMarketCap ? "" : " (market_cap tidak ada di respons → urut simbol)"}`);
  // Ganti seluruh kelompok kontrol agar pilihan deterministik dari data terbaru.
  const lama = await simbolKelompok(k.db, "control");
  const baru = new Set(kontrol.map((c) => c.symbol));
  const dibuang = lama.filter((s) => !baru.has(s));
  if (dibuang.length) await k.db.delete(symbols).where(inArray(symbols.symbol, dibuang));
  for (const c of kontrol) {
    const notes = `LQ45 (screener ${new Date().toISOString().slice(0, 10)}, ${urutan}, peringkat #${kontrol.indexOf(c) + 1}); tanpa suspensi 2019–2026${c.marketCap != null ? `; market_cap=${c.marketCap}` : ""}`;
    await k.db
      .insert(symbols)
      .values({ symbol: c.symbol, companyName: c.companyName, subSector: c.subSector, group: "control", targetEventDate: null, notes })
      .onConflictDoUpdate({ target: symbols.symbol, set: { companyName: c.companyName, subSector: c.subSector, group: "control", targetEventDate: null, notes } });
  }
}

async function langkahSymbols(k: Konteks, namaEmiten: Map<string, string>): Promise<void> {
  const peta = await petaSuspensi(k.db);
  let n = 0;
  for (const e of EMITEN_DELISTING) {
    const tgl = peta.get(e.symbol) ?? [];
    const t = targetDelisting(tgl, e.suspensiCatatan);
    const notes = [
      `delisting efektif 2026-11-10 (${e.alasan})`,
      `suspensi catatan ${e.suspensiCatatan}`,
      t.terverifikasi ? `feed: terverifikasi (${tgl.length} kejadian di feed)` : `feed: TIDAK ada suspensi ≥ catatan−60 hari (${tgl.length} kejadian di feed) → pakai tanggal catatan`,
      e.catatan ?? "",
    ]
      .filter(Boolean)
      .join("; ");
    await upsertSimbol(k.db, { symbol: e.symbol, companyName: namaEmiten.get(e.symbol) ?? null, group: "delisting", targetEventDate: t.tanggal, notes });
    n += 1;
  }
  for (const s of EMITEN_PEMANTAUAN) {
    const tgl = peta.get(s) ?? [];
    const target = targetPemantauan(tgl, TANGGAL_ACUAN_PEMANTAUAN);
    const notes = `papan pemantauan khusus per ${TANGGAL_ACUAN_PEMANTAUAN}; ${target ? `suspensi terakhir ≤ acuan = ${target} (${tgl.length} kejadian di feed)` : `TIDAK ada suspensi ≤ acuan di feed (${tgl.length} kejadian)`}`;
    await upsertSimbol(k.db, { symbol: s, companyName: namaEmiten.get(s) ?? null, group: "watchlist", targetEventDate: target, notes });
    n += 1;
  }
  // Lengkapi nama kontrol yang kosong dari free-float.
  for (const s of await simbolKelompok(k.db, "control")) {
    const nama = namaEmiten.get(s);
    if (nama) await k.db.update(symbols).set({ companyName: sql`coalesce(${symbols.companyName}, ${nama})` }).where(eq(symbols.symbol, s));
  }
  console.log(`  symbols: ${n} delisting+watchlist di-upsert; kontrol ${(await simbolKelompok(k.db, "control")).length}`);
}

async function upsertSimbol(db: Db, row: typeof symbols.$inferInsert): Promise<void> {
  await db
    .insert(symbols)
    .values(row)
    .onConflictDoUpdate({
      target: symbols.symbol,
      set: { companyName: sql`coalesce(${row.companyName ?? null}, ${symbols.companyName})`, group: row.group, targetEventDate: row.targetEventDate ?? null, notes: row.notes ?? null },
    });
}

async function langkahDates(k: Konteks): Promise<void> {
  for (const { symbol } of await universePerKelompok(k, "dates")) {
    const endpoint = `/v2/company/get_quarterly_financial_dates/${symbol}/`;
    const dates = await k.panggil("dates", symbol, endpoint, {}, 1, () => k.provider.quarterlyFinancialDates(symbol));
    if (!dates) continue;
    const rows = barisReportDates(symbol, dates);
    if (rows.length) await k.db.insert(reportDates).values(rows).onConflictDoNothing();
  }
}

async function langkahCorporateActions(k: Konteks): Promise<void> {
  for (const { symbol } of await universePerKelompok(k, "corporate-actions")) {
    if (await k.dates404(symbol)) {
      k.lewati("corporate-actions", symbol, "dates 404 (simbol tak dikenal API) → tidak dipanggil, hemat 1 kredit");
      continue;
    }
    const endpoint = `/v2/company/corporate-actions/${symbol}/`;
    const aksi = await k.panggil("corporate-actions", symbol, endpoint, {}, 1, () => k.provider.corporateActions(symbol));
    if (!aksi) continue;
    const rows = barisAksiKorporasi(symbol, aksi);
    await k.db.delete(corporateActions).where(eq(corporateActions.symbol, symbol));
    if (rows.length) await k.db.insert(corporateActions).values(rows);
  }
}

async function langkahFilings(k: Konteks): Promise<void> {
  // Hanya pemantauan + kontrol (feed filings mulai 2024; 18 delisting sudah lama tersuspensi).
  const emiten = (await universePerKelompok(k, "filings")).filter((e) => e.kelompok !== "delisting");
  const halaman = new Map<string, Filing[]>();
  const lanjutan: Array<{ symbol: string; offset: number }> = [];
  // Pass 1: halaman pertama semua emiten (prioritas), params persis seperti tiket 04 ({symbol}).
  for (const { symbol } of emiten) {
    const page = await k.panggil("filings", `${symbol} hal.1`, "/v2/filings/", { symbol }, 1, () => k.provider.filings(symbol));
    if (!page) continue;
    halaman.set(symbol, [...page.results]);
    if (page.pagination?.has_next && page.pagination.next_offset != null) lanjutan.push({ symbol, offset: page.pagination.next_offset });
  }
  // Pass 2: lanjutan maks FILINGS_MAKS_HALAMAN per emiten selama kredit langkah < batas.
  const antre = [...lanjutan];
  while (antre.length) {
    const { symbol, offset } = antre.shift()!;
    const s = k.stat("filings");
    const nomor = Math.floor(offset / 20) + 1;
    if (nomor > FILINGS_MAKS_HALAMAN) {
      k.lewati("filings", `${symbol} hal.${nomor}`, `melebihi ${FILINGS_MAKS_HALAMAN} halaman`);
      continue;
    }
    const params = { symbol, offset: String(offset) };
    if (!k.diCache("/v2/filings/", params) && s.kredit + s.perkiraanBelumCache * (k.arg.dry ? 1 : 0) + 1 > FILINGS_BATAS_KREDIT) {
      k.lewati("filings", `${symbol} hal.${nomor}`, `batas kredit langkah ${FILINGS_BATAS_KREDIT}`);
      continue;
    }
    const page = await k.panggil("filings", `${symbol} hal.${nomor}`, "/v2/filings/", params, 1, () => k.provider.filings(symbol, { offset }));
    if (!page) continue;
    halaman.set(symbol, [...(halaman.get(symbol) ?? []), ...page.results]);
    if (page.pagination?.has_next && page.pagination.next_offset != null) antre.push({ symbol, offset: page.pagination.next_offset });
  }
  if (k.arg.dry) return;
  for (const [symbol, daftar] of halaman) {
    const rows = daftar.map((f) => barisFiling(symbol, f)).filter((r): r is NonNullable<typeof r> => r !== null);
    await k.db.delete(filings).where(eq(filings.symbol, symbol));
    for (let i = 0; i < rows.length; i += 100) await k.db.insert(filings).values(rows.slice(i, i + 100));
  }
}

async function langkahFinancials(k: Konteks): Promise<void> {
  if (!k.arg.kelompok.has("delisting")) return;
  // Kuartal tersedia per emiten: dari report_dates (DB) atau cache dates; tanpa data → maks (dry) / lewati (nyata).
  const tersedia = new Map<string, number>();
  for (const e of EMITEN_DELISTING) {
    const symbol = e.symbol;
    const rows = await k.db.select({ d: reportDates.reportDate }).from(reportDates).where(and(eq(reportDates.symbol, symbol), gte(reportDates.reportDate, FINANCIALS_SEJAK), lte(reportDates.reportDate, "2099-12-31")));
    if (rows.length) tersedia.set(symbol, rows.length);
    else if (await k.dates404(symbol)) tersedia.set(symbol, -2);
    else {
      const dates = await k.bacaCache(`/v2/company/get_quarterly_financial_dates/${symbol}/`, {}, (b) => {
        const p = QuarterlyFinancialDatesSchema.safeParse(b);
        return p.success ? (p.data as QuarterlyFinancialDates) : null;
      });
      tersedia.set(symbol, dates ? nQuartersTersedia(dates, FINANCIALS_SEJAK, 1000) : k.arg.dry ? FINANCIALS_MAKS_KUARTAL : -1);
    }
  }
  /**
   * n_quarters ter-cache terbesar yang DITERIMA (≥ FINANCIALS_MIN_KUARTAL_DITERIMA), atau 0.
   * Kunci cache = endpoint+n_quarters, jadi run kedua memakai n yang sama → 0 kredit.
   */
  const nTerCache = (symbol: string): number => {
    for (let n = FINANCIALS_MAKS_KUARTAL; n >= FINANCIALS_MIN_KUARTAL_DITERIMA; n -= 1) {
      if (k.diCache(`/v2/financials/quarterly/${symbol}/`, { n_quarters: String(n) })) return n;
    }
    return 0;
  };
  // Hanya yang belum ter-cache membebani anggaran; pangkas kuartal seragam agar total run muat.
  // Anggaran financials = sisa anggaran tiket (kumulatif lintas run: ledger − KREDIT_SEBELUM_TIKET), dibatasi batas run.
  const terpakaiTiket = (await k.provider.ledger.totalKredit()) - KREDIT_SEBELUM_TIKET + (k.arg.dry ? k.perkiraanRun : 0);
  const sisaUntukFinancials = Math.min(ANGGARAN_TOTAL_TIKET - terpakaiTiket, BATAS_KREDIT_RUN - (k.arg.dry ? k.perkiraanRun : k.terpakaiRun));
  const belumCache = [...tersedia.entries()].filter(([s, n]) => n > 0 && nTerCache(s) === 0).map(([, n]) => n);
  const maks = pasKuartal(belumCache, Math.max(0, sisaUntukFinancials), FINANCIALS_MAKS_KUARTAL);
  if (belumCache.length && maks < FINANCIALS_MAKS_KUARTAL) console.log(`  kuartal per emiten dipangkas ${FINANCIALS_MAKS_KUARTAL} → ${maks} agar total tiket ≤ ${ANGGARAN_TOTAL_TIKET} & run ≤ ${BATAS_KREDIT_RUN} (terpakai tiket ${terpakaiTiket}, sisa untuk financials ${sisaUntukFinancials})`);

  for (const e of EMITEN_DELISTING) {
    const symbol = e.symbol;
    const nTersedia = tersedia.get(symbol) ?? -1;
    if (nTersedia === 0) {
      k.lewati("financials", symbol, `tidak ada kuartal ≥ ${FINANCIALS_SEJAK} di dates`);
      continue;
    }
    if (nTersedia < 0) {
      k.lewati("financials", symbol, nTersedia === -2 ? "dates 404 (simbol tak dikenal API) → tidak dipanggil" : "dates belum ditarik (jalankan langkah dates dulu)");
      continue;
    }
    // Sudah ter-cache dari run sebelumnya → pakai n yang sama (0 kredit); selain itu n yang dipangkas.
    const endpoint = `/v2/financials/quarterly/${symbol}/`;
    const n = nTerCache(symbol) || Math.min(nTersedia, maks);
    const data = await k.panggil("financials", `${symbol} n=${n}`, endpoint, { n_quarters: String(n) }, n, () => k.provider.quarterlyFinancials(symbol, n));
    if (!data) continue;
    const baris = data.map((q) => barisFinancial(symbol, q)).filter((r): r is NonNullable<typeof r> => r !== null);
    for (const r of baris) {
      await k.db
        .insert(financialsQ)
        .values(r)
        .onConflictDoUpdate({ target: [financialsQ.symbol, financialsQ.reportDate], set: { totalEquity: r.totalEquity, totalLiabilities: r.totalLiabilities, totalAssets: r.totalAssets, earnings: r.earnings, revenue: r.revenue, payload: r.payload } });
    }
  }
}

// ---------- Laporan ----------

interface HasilRun {
  waktu: string;
  dry: boolean;
  langkah: Langkah[];
  kelompok: Kelompok[];
  kreditLedgerSebelum: number;
  kreditLedgerSesudah: number;
  terpakaiRun: number;
  perkiraanBelumCache: number;
  berhenti: string | null;
  statistik: Record<string, StatistikLangkah>;
  catatan: CatatanPanggilan[];
}

const td = (s: unknown) => String(s ?? "-").replace(/\|/g, "\\|").replace(/\r?\n/g, " ");

async function hitungBaris(db: Db): Promise<Record<string, number>> {
  const tabel = { symbols, suspensions, report_dates: reportDates, corporate_actions: corporateActions, filings, financials_q: financialsQ } as const;
  const hasil: Record<string, number> = {};
  for (const [nama, t] of Object.entries(tabel)) {
    const [r] = await db.select({ n: count() }).from(t);
    hasil[nama] = Number(r?.n ?? 0);
  }
  return hasil;
}

async function susunLaporan(db: Db, provider: SectorsProvider, run: HasilRun, labelDb: string): Promise<string> {
  const b: string[] = [];
  const baris = await hitungBaris(db);
  const semuaSimbol = await db.select().from(symbols).orderBy(asc(symbols.group), asc(symbols.symbol));
  const perKelompok = (g: Kelompok) => semuaSimbol.filter((s) => s.group === g);
  const totalLedger = await provider.ledger.totalKredit();

  b.push("# Penarikan universe uji ke database (tiket 07)", "");
  b.push(`_Dihasilkan otomatis oleh \`npm run pull-universe\` pada ${run.waktu}${run.dry ? " (dry-run)" : ""}. Sumber angka kredit: tabel \`api_ledger\` (DB). Nama pemegang saham sengaja tidak dimuat di sini._`, "");
  b.push("## Ringkasan kredit", "");
  b.push("| Ukuran | Nilai |", "|---|---|");
  b.push(`| Kredit ledger DB sebelum run | ${run.kreditLedgerSebelum} |`);
  b.push(`| Kredit ledger DB sesudah run | ${run.kreditLedgerSesudah} |`);
  b.push(`| Kredit terpakai run ini | ${run.terpakaiRun} |`);
  b.push(`| Perkiraan belum ter-cache saat run dimulai | ${run.perkiraanBelumCache} |`);
  b.push(`| Batas keras per run / sisa minimum | ${BATAS_KREDIT_RUN} / ${SISA_MINIMUM} |`);
  b.push(`| Total kredit ledger saat laporan ditulis | ${totalLedger} dari ${provider.anggaran} (sisa ${provider.anggaran - totalLedger}; cadangan ${provider.cadangan}) |`);
  b.push(`| Kredit tiket 07 kumulatif (ledger − ${KREDIT_SEBELUM_TIKET} kredit tiket 03–04) | ${totalLedger - KREDIT_SEBELUM_TIKET} dari anggaran ${ANGGARAN_TOTAL_TIKET} |`);
  b.push(`| Penyimpan ledger/cache | ${provider.penyimpan}: ${td(labelDb)} |`);
  b.push(`| Berhenti karena anggaran | ${run.berhenti ?? "tidak"} |`);
  b.push("");
  b.push("### Per langkah", "");
  b.push("| Langkah | Anggaran §5 | Kredit run ini | Belum cache (perkiraan) | API | Cache | 404 | Gagal | Dilewati | Penyimpangan |", "|---|---|---|---|---|---|---|---|---|---|");
  for (const l of URUTAN) {
    const s = run.statistik[l];
    if (!s) continue;
    const dev = s.kredit > ANGGARAN_LANGKAH[l] ? `**+${s.kredit - ANGGARAN_LANGKAH[l]}**` : "-";
    b.push(`| ${l} | ${ANGGARAN_LANGKAH[l]} | ${s.kredit} | ${s.perkiraanBelumCache} | ${s.api} | ${s.cache} | ${s.e404} | ${s.gagal} | ${s.dilewati} | ${dev} |`);
  }
  b.push("");
  b.push("## Baris per tabel (DB)", "");
  b.push("| Tabel | Baris |", "|---|---|");
  for (const [t, n] of Object.entries(baris)) b.push(`| ${t} | ${n} |`);
  b.push("");
  b.push(`## Universe: ${semuaSimbol.length} emiten (delisting ${perKelompok("delisting").length}, pemantauan ${perKelompok("watchlist").length}, kontrol ${perKelompok("control").length})`, "");
  b.push("### 30 kontrol terpilih", "");
  b.push(`Kriteria: anggota LQ45 menurut screener \`/v2/companies/?where=${SCREENER_WHERE}\`, TIDAK muncul di feed suspensi universe 2019–2026 (${baris.suspensions} kejadian di DB), bukan anggota 18/59, lalu ${JUMLAH_KONTROL} pertama menurut ${SCREENER_ORDER_BY ? `order_by=${SCREENER_ORDER_BY}` : "urutan API (alfabetis): screener tidak mengembalikan market_cap dan menolak order_by (HTTP 400, gratis), sehingga peringkat market cap tidak tersedia tanpa kredit tambahan"}.`, "");
  b.push("| Emiten | Nama | Sub-sektor | Catatan |", "|---|---|---|---|");
  for (const s of perKelompok("control")) b.push(`| ${s.symbol} | ${td(s.companyName)} | ${td(s.subSector)} | ${td(s.notes)} |`);
  b.push("");
  b.push("### Tanggal kejadian target — 18 delisting", "");
  b.push("| Emiten | target_event_date | Catatan |", "|---|---|---|");
  for (const s of perKelompok("delisting")) b.push(`| ${s.symbol} | ${td(s.targetEventDate)} | ${td(s.notes)} |`);
  b.push("");
  b.push(`### Tanggal kejadian target — 59 pemantauan khusus (suspensi terakhir ≤ ${TANGGAL_ACUAN_PEMANTAUAN})`, "");
  b.push("| Emiten | target_event_date | Catatan |", "|---|---|---|");
  for (const s of perKelompok("watchlist")) b.push(`| ${s.symbol} | ${td(s.targetEventDate)} | ${td(s.notes)} |`);
  b.push("");
  b.push("## Emiten kosong / 404 / gagal / dilewati (run ini)", "");
  const masalah = run.catatan.filter((c) => c.sumber === "404" || c.sumber === "gagal" || c.sumber === "dilewati");
  if (!masalah.length) b.push("- Tidak ada.");
  for (const c of masalah) b.push(`- \`${c.langkah}\` ${c.id}: ${c.sumber}${c.catatan ? ` — ${td(c.catatan)}` : ""}`);
  b.push("");
  // Emiten tanpa baris di tabel data (kosong) — dari DB, bukan hanya run ini.
  const kosong: string[] = [];
  for (const t of [{ nama: "report_dates", tabel: reportDates, kolom: reportDates.symbol }, { nama: "corporate_actions", tabel: corporateActions, kolom: corporateActions.symbol }, { nama: "filings", tabel: filings, kolom: filings.symbol }] as const) {
    const ada = new Set((await db.selectDistinct({ s: t.kolom }).from(t.tabel)).map((r) => r.s));
    const target = t.nama === "filings" ? semuaSimbol.filter((s) => s.group !== "delisting") : semuaSimbol;
    const tanpa = target.filter((s) => !ada.has(s.symbol)).map((s) => s.symbol);
    kosong.push(`- \`${t.nama}\`: ${tanpa.length} emiten tanpa baris${tanpa.length ? ` — ${tanpa.join(", ")}` : ""}`);
  }
  b.push("### Emiten tanpa baris di tabel data (kondisi DB saat ini)", "", ...kosong, "");
  b.push("## Penyimpangan anggaran", "");
  const dev = URUTAN.filter((l) => (run.statistik[l]?.kredit ?? 0) > ANGGARAN_LANGKAH[l]);
  if (!dev.length && !run.berhenti) b.push(`- Tidak ada langkah yang melampaui anggaran §5; total run ${run.terpakaiRun} ≤ batas ${BATAS_KREDIT_RUN}.`);
  if (totalLedger - KREDIT_SEBELUM_TIKET > ANGGARAN_TOTAL_TIKET) b.push(`- **Total tiket ${totalLedger - KREDIT_SEBELUM_TIKET} melampaui anggaran ${ANGGARAN_TOTAL_TIKET}.**`);
  for (const l of dev) b.push(`- \`${l}\`: ${run.statistik[l].kredit} kredit vs anggaran ${ANGGARAN_LANGKAH[l]}.`);
  if (run.berhenti) b.push(`- Run dihentikan pagar anggaran: ${run.berhenti}`);
  b.push("");
  b.push("## Cara mengulang", "");
  b.push("```", "npm run pull-universe -- --dry     # pra-terbang: harus 0 belum ter-cache setelah penarikan penuh", "npm run pull-universe              # idempoten: run kedua 0 kredit (bukti di api_ledger)", "npm run pull-universe -- --laporan # tulis ulang laporan ini dari DB", "```", "");
  return b.join("\n");
}

// ---------- Main ----------

async function main(): Promise<number> {
  const arg = uraiArgumen(process.argv.slice(2));
  const terbuka = await bukaDb({ pgliteDir: arg.pgliteDir });
  try {
    return await jalankan(arg, terbuka);
  } finally {
    await terbuka.tutup();
  }
}

async function jalankan(arg: Argumen, terbuka: DbTerbuka): Promise<number> {
  const db = terbuka.db;
  // Ledger & cache SELALU di DB yang dibuka (Neon atau PGlite) — disuntik eksplisit.
  const provider = sectorsProviderDariEnv(process.env, { ledger: new LedgerDb(db), cache: new CacheDb(db) });
  if (!provider) {
    console.error("SECTORS_API_KEY tidak ditemukan di .env.local / lingkungan.");
    return 1;
  }
  console.log(`DB: ${terbuka.keterangan}`);
  const dirCache = process.env.SECTORS_CACHE_DIR || DIR_CACHE_DEFAULT;
  const fileHasil = path.join(dirCache, NAMA_HASIL);

  if (arg.laporanSaja) {
    let run: HasilRun | null = null;
    try {
      run = JSON.parse(await readFile(fileHasil, "utf8")) as HasilRun;
    } catch {
      run = null;
    }
    if (!run) {
      console.error(`Tidak ada hasil run tersimpan di ${fileHasil}; jalankan penarikan dulu.`);
      return 1;
    }
    await tulisLaporan(db, provider, run, terbuka.keterangan);
    return 0;
  }

  const k = new Konteks(provider, db, arg);
  await k.siapkan();
  const kreditSebelum = await provider.ledger.totalKredit();
  console.log(`Ledger DB: ${kreditSebelum} kredit terpakai, sisa ${provider.anggaran - kreditSebelum} (cadangan ${provider.cadangan}; sisa minimum skrip ${SISA_MINIMUM}).`);
  console.log(`Mode: ${arg.dry ? "DRY-RUN (tanpa panggilan API)" : "PENARIKAN NYATA"}; langkah: ${[...arg.langkah].join(", ")}; kelompok: ${[...arg.kelompok].join(", ")}; batas run ${BATAS_KREDIT_RUN}.`);
  console.log("");

  let berhenti: string | null = null;
  let namaEmiten = new Map<string, string>();
  try {
    for (const l of URUTAN) {
      if (!arg.langkah.has(l)) continue;
      console.log(`== ${l} ==`);
      switch (l) {
        case "suspensions":
          await langkahSuspensions(k);
          break;
        case "free-float":
          namaEmiten = await langkahFreeFloat(k);
          break;
        case "control":
          await langkahControl(k);
          break;
        case "symbols":
          if (!arg.dry) {
            if (namaEmiten.size === 0) {
              namaEmiten = (await k.bacaCache("/v2/free-float/", {}, (b) => {
                const p = FreeFloatSchema.safeParse(b);
                return p.success ? new Map(p.data.filter((e) => e.company_name).map((e) => [e.symbol, e.company_name!] as const)) : null;
              })) ?? new Map();
            }
            await langkahSymbols(k, namaEmiten);
          } else console.log("  (dry) tanpa panggilan API; upsert symbols dilewati");
          break;
        case "dates":
          await langkahDates(k);
          break;
        case "corporate-actions":
          await langkahCorporateActions(k);
          break;
        case "filings":
          await langkahFilings(k);
          break;
        case "financials":
          await langkahFinancials(k);
          break;
      }
    }
  } catch (err) {
    if (err instanceof BerhentiAnggaran) {
      berhenti = err.message;
      console.error(`\nBERHENTI (pagar anggaran): ${berhenti}`);
    } else throw err;
  }

  const kreditSesudah = await provider.ledger.totalKredit();
  const run: HasilRun = {
    waktu: new Date().toISOString(),
    dry: arg.dry,
    langkah: [...arg.langkah],
    kelompok: [...arg.kelompok],
    kreditLedgerSebelum: kreditSebelum,
    kreditLedgerSesudah: kreditSesudah,
    terpakaiRun: k.terpakaiRun,
    perkiraanBelumCache: k.perkiraanRun,
    berhenti,
    statistik: Object.fromEntries(k.statistik),
    catatan: k.catatan,
  };

  console.log("");
  console.log(`Kredit ledger DB sebelum/sesudah : ${kreditSebelum} / ${kreditSesudah} (run ini ${k.terpakaiRun})`);
  console.log(`Belum ter-cache (perkiraan)      : ${k.perkiraanRun} kredit`);
  for (const [l, s] of k.statistik) console.log(`  ${l.padEnd(17)} kredit ${String(s.kredit).padStart(3)}  belum-cache ~${String(s.perkiraanBelumCache).padStart(3)}  api ${s.api} cache ${s.cache} 404 ${s.e404} gagal ${s.gagal} dilewati ${s.dilewati}`);
  if (arg.dry) {
    console.log(`\nDry-run selesai. Perkiraan biaya run nyata ≤ ${k.perkiraanRun} kredit; batas ${BATAS_KREDIT_RUN}.`);
    return k.perkiraanRun > BATAS_KREDIT_RUN ? 2 : 0;
  }
  await mkdir(dirCache, { recursive: true });
  await writeFile(fileHasil, JSON.stringify(run, null, 2), "utf8");
  await tulisLaporan(db, provider, run, terbuka.keterangan);
  return berhenti ? 2 : 0;
}

/** Teks di bawah penanda ini ditulis manual dan dipertahankan saat laporan dibuat ulang. */
const PENANDA_MANUAL = "<!-- universe-pull:manual -->";

async function tulisLaporan(db: Db, provider: SectorsProvider, run: HasilRun, labelDb: string): Promise<void> {
  const isi = await susunLaporan(db, provider, run, labelDb);
  const file = path.resolve(FILE_LAPORAN);
  await mkdir(path.dirname(file), { recursive: true });
  let manual = `${PENANDA_MANUAL}

## Catatan manual

_(belum ditulis)_
`;
  try {
    const lama = await readFile(file, "utf8");
    const i = lama.indexOf(PENANDA_MANUAL);
    if (i >= 0) manual = lama.slice(i);
  } catch {
    /* file belum ada */
  }
  await writeFile(file, `${isi}
${manual}`, "utf8");
  console.log(`Laporan: ${FILE_LAPORAN}`);
}

main().then(
  (kode) => process.exit(kode),
  (err) => {
    console.error(`GAGAL: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(3);
  },
);
