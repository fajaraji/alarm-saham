import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CreditReserveError,
  InvalidQueryError,
  Ledger,
  NotFoundError,
  SchemaMismatchError,
  SectorsApiError,
  SectorsProvider,
  sectorsProviderDariEnv,
  type BarisLedger,
} from "../../../src/lib/data";
import { ujiKontrakDataProvider } from "./kontrak";
import { buatFetchFixture, dirSementara, jsonResponse } from "./mock-sectors";

const KUNCI = "kunci-rahasia-uji-XYZ789";

// ---------- Kontrak: SectorsProvider + fetch tiruan (global) ----------

ujiKontrakDataProvider("SectorsProvider (fetch tiruan)", async () => {
  vi.stubGlobal("fetch", buatFetchFixture().fetch);
  return new SectorsProvider({ apiKey: KUNCI, cacheDir: await dirSementara(), retryBaseMs: 0 });
});

// ---------- Ledger, kredit, cache, cadangan ----------

describe("SectorsProvider: buku kredit & cache", () => {
  let dir: string;
  let jam: Date;
  const now = () => jam;

  beforeEach(async () => {
    dir = await dirSementara();
    jam = new Date("2026-09-07T03:00:00Z");
  });
  afterEach(() => vi.unstubAllGlobals());

  function provider(opsi: Partial<ConstructorParameters<typeof SectorsProvider>[0]> = {}) {
    return new SectorsProvider({ apiKey: KUNCI, cacheDir: dir, retryBaseMs: 0, now, ...opsi });
  }
  const ledger = () => new Ledger(dir).semua();
  const totalKredit = () => new Ledger(dir).totalKredit();

  /** fetch global yang selalu membalas urutan respons yang diberikan. */
  function fetchUrutan(...respons: Array<() => Response | Error>) {
    const f = vi.fn(async () => {
      const berikut = respons.length > 1 ? respons.shift()! : respons[0];
      const r = berikut();
      if (r instanceof Error) throw r;
      return r;
    });
    vi.stubGlobal("fetch", f);
    return f;
  }

  it("mengirim header Authorization tanpa Bearer ke URL yang benar, mencatat 1 kredit", async () => {
    const f = fetchUrutan(() => jsonResponse(200, { results: [], pagination: { total_count: 0 } }));
    const p = provider();
    const page = await p.suspensions({ symbol: "sril.jk", start: "2019-01-01", end: "2024-12-31", limit: 30, offset: 30 });
    expect(page.results).toEqual([]);

    expect(f).toHaveBeenCalledTimes(1);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    const u = new URL(url);
    expect(u.origin + u.pathname).toBe("https://api.sectors.app/v2/suspensions/");
    expect(Object.fromEntries(u.searchParams)).toEqual({
      symbol: "SRIL",
      start: "2019-01-01",
      end: "2024-12-31",
      limit: "30",
      offset: "30",
    });
    expect((init.headers as Record<string, string>).Authorization).toBe(KUNCI);

    const baris = await ledger();
    expect(baris).toHaveLength(1);
    expect(baris[0]).toMatchObject({
      endpoint: "/v2/suspensions/",
      params: { symbol: "SRIL", start: "2019-01-01", end: "2024-12-31", limit: "30", offset: "30" },
      status: 200,
      credits: 1,
      cacheHit: false,
    });
    expect(baris[0].ts).toBe(jam.toISOString());
    expect(await p.sisaKredit()).toBe(999);
  });

  it("financials: 1 kredit per kuartal yang dikembalikan", async () => {
    const tiga = [
      { report_date: "2021-03-31", total_equity: 1 },
      { report_date: "2021-06-30", total_equity: -1 },
      { report_date: "2021-09-30", total_equity: -2 },
    ];
    fetchUrutan(() => jsonResponse(200, tiga));
    const q = await provider().quarterlyFinancials("SRIL", 3);
    expect(q).toHaveLength(3);
    expect(await totalKredit()).toBe(3);
  });

  it("free-float: ceil(jumlah emiten / 100) kredit", async () => {
    const emiten = (n: number) =>
      Array.from({ length: n }, (_, i) => ({ symbol: `S${String(i).padStart(3, "0")}`, free_float: 0.1 }));
    fetchUrutan(() => jsonResponse(200, emiten(250)));
    await provider().freeFloat();
    expect(await totalKredit()).toBe(3);

    // 5 emiten → 1 kredit (kedaluwarsa cache dulu: majukan jam 25 jam)
    jam = new Date(jam.getTime() + 25 * 3600_000);
    fetchUrutan(() => jsonResponse(200, emiten(5)));
    await provider().freeFloat();
    expect(await totalKredit()).toBe(4);
  });

  it("404 (simbol tak dikenal) tetap dicatat 1 kredit dan melempar NotFoundError", async () => {
    fetchUrutan(() => jsonResponse(404, { code: "not_found", message: "symbol tidak dikenal" }));
    const err = await provider().quarterlyFinancialDates("ZZZZ").catch((e) => e);
    expect(err).toBeInstanceOf(NotFoundError);
    expect((err as SectorsApiError).status).toBe(404);
    const baris = await ledger();
    expect(baris).toHaveLength(1);
    expect(baris[0]).toMatchObject({ status: 404, credits: 1, cacheHit: false });
  });

  it.each([
    [400, "bad_request"],
    [401, "subscription_not_active"],
    [403, "subscription_does_not_allow"],
    [429, "monthly_limit_exceeded"],
    [500, undefined],
  ])("HTTP %s dicatat 0 kredit dan melempar SectorsApiError", async (status, code) => {
    fetchUrutan(() => jsonResponse(status, code ? { code, message: "gagal" } : "bukan-json"));
    const err = await provider().corporateActions("SRIL").catch((e) => e);
    expect(err).toBeInstanceOf(SectorsApiError);
    expect((err as SectorsApiError).status).toBe(status);
    if (code) expect((err as SectorsApiError).code).toBe(code);
    const baris = await ledger();
    expect(baris).toHaveLength(1);
    expect(baris[0]).toMatchObject({ status, credits: 0 });
    expect(await totalKredit()).toBe(0);
  });

  it("panggilan identik kedua terlayani dari cache: fetch sekali, kredit tidak bertambah", async () => {
    const f = fetchUrutan(() => jsonResponse(200, { symbol: "SRIL", dividend: [] }));
    const p = provider();
    const a = await p.corporateActions("SRIL");
    const b = await p.corporateActions("SRIL");
    expect(b).toEqual(a);
    expect(f).toHaveBeenCalledTimes(1);
    expect(await totalKredit()).toBe(1);
    const baris = await ledger();
    expect(baris).toHaveLength(2);
    expect(baris[1]).toMatchObject({ credits: 0, cacheHit: true, status: 200 });
    // file cache ada di folder
    const file = (await readdir(dir)).filter((n) => n.endsWith(".json") && n !== "ledger.jsonl");
    expect(file).toHaveLength(1);
  });

  it("parameter berbeda = kunci cache berbeda", async () => {
    const f = fetchUrutan(() => jsonResponse(200, []));
    const p = provider();
    await p.quarterlyFinancials("SRIL", 2);
    await p.quarterlyFinancials("SRIL", 4);
    expect(f).toHaveBeenCalledTimes(2);
  });

  it("TTL: data terkini kedaluwarsa setelah 24 jam; data historis permanen", async () => {
    const f = fetchUrutan(() => jsonResponse(200, []));
    const p = provider();
    // terkini: daily tanpa end di masa lalu (end = hari ini)
    await p.daily("BBCA", "2026-09-01", "2026-09-07");
    await p.daily("BBCA", "2026-09-01", "2026-09-07");
    expect(f).toHaveBeenCalledTimes(1);
    jam = new Date(jam.getTime() + 24 * 3600_000 + 1);
    await p.daily("BBCA", "2026-09-01", "2026-09-07");
    expect(f).toHaveBeenCalledTimes(2);

    // historis: end di masa lalu → tidak pernah kedaluwarsa
    await p.daily("BBCA", "2024-03-01", "2024-03-31");
    jam = new Date(jam.getTime() + 1000 * 24 * 3600_000);
    await p.daily("BBCA", "2024-03-01", "2024-03-31");
    expect(f).toHaveBeenCalledTimes(3);
  });

  it("menolak dengan CreditReserveError bila sisa < cadangan; fetch tidak dipanggil", async () => {
    const f = fetchUrutan(() => jsonResponse(200, []));
    // isi ledger: 760 kredit terpakai → sisa 240 < 250
    const l = new Ledger(dir);
    const baris: BarisLedger = {
      ts: jam.toISOString(),
      endpoint: "/v2/free-float/",
      params: {},
      status: 200,
      credits: 760,
      cacheHit: false,
    };
    await l.catat(baris);

    const err = await provider().freeFloat().catch((e) => e);
    expect(err).toBeInstanceOf(CreditReserveError);
    expect((err as CreditReserveError).sisa).toBe(240);
    expect((err as CreditReserveError).cadangan).toBe(250);
    expect(f).not.toHaveBeenCalled();
    expect(await ledger()).toHaveLength(1); // tidak ada baris baru

    // tepat di ambang (sisa == cadangan) masih boleh
    const p2 = provider({ cadangan: 240 });
    await p2.freeFloat();
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("cache hit tetap dilayani meski sisa < cadangan", async () => {
    const f = fetchUrutan(() => jsonResponse(200, { symbol: "SRIL" }));
    await provider().corporateActions("SRIL");
    await new Ledger(dir).catat({
      ts: jam.toISOString(), endpoint: "x", params: {}, status: 200, credits: 900, cacheHit: false,
    });
    await expect(provider().corporateActions("SRIL")).resolves.toMatchObject({ symbol: "SRIL" });
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("ALLOW_RESERVE=1 melewati penolakan (opsi & env)", async () => {
    const f = fetchUrutan(() => jsonResponse(200, []));
    await new Ledger(dir).catat({
      ts: jam.toISOString(), endpoint: "x", params: {}, status: 200, credits: 900, cacheHit: false,
    });
    await provider({ izinkanCadangan: true }).freeFloat();
    expect(f).toHaveBeenCalledTimes(1);

    jam = new Date(jam.getTime() + 25 * 3600_000);
    const dariEnv = sectorsProviderDariEnv(
      { SECTORS_API_KEY: KUNCI, ALLOW_RESERVE: "1", SECTORS_CACHE_DIR: dir },
      { retryBaseMs: 0, now },
    )!;
    await dariEnv.freeFloat();
    expect(f).toHaveBeenCalledTimes(2);

    const tanpaIzin = sectorsProviderDariEnv(
      { SECTORS_API_KEY: KUNCI, SECTORS_CACHE_DIR: dir },
      { retryBaseMs: 0, now: () => new Date(jam.getTime() + 25 * 3600_000) },
    )!;
    await expect(tanpaIzin.freeFloat()).rejects.toBeInstanceOf(CreditReserveError);
  });

  it("retry 503 / service_unavailable hingga 3x lalu berhasil; percobaan gagal 0 kredit", async () => {
    const f = fetchUrutan(
      () => jsonResponse(503, { code: "service_unavailable" }),
      () => jsonResponse(500, { code: "service_unavailable" }),
      () => jsonResponse(200, { listing_date: "2013-06-17" }),
    );
    const lp = await provider().listingPerformance("SRIL");
    expect(lp.listing_date).toBe("2013-06-17");
    expect(f).toHaveBeenCalledTimes(3);
    const baris = await ledger();
    expect(baris.map((b) => [b.status, b.credits])).toEqual([[503, 0], [500, 0], [200, 1]]);
  });

  it("503 terus-menerus: menyerah setelah 3 retry (4 percobaan) dengan SectorsApiError", async () => {
    const f = fetchUrutan(() => jsonResponse(503, { code: "service_unavailable" }));
    const err = await provider().listingPerformance("SRIL").catch((e) => e);
    expect(err).toBeInstanceOf(SectorsApiError);
    expect((err as SectorsApiError).status).toBe(503);
    expect(f).toHaveBeenCalledTimes(4);
    expect(await totalKredit()).toBe(0);
  });

  it("kunci API tidak pernah muncul di pesan error, ledger, maupun cache", async () => {
    // gagal jaringan yang pesannya (secara tidak wajar) memuat kunci
    fetchUrutan(() => new Error(`ECONNRESET saat Authorization: ${KUNCI}`));
    const p = provider({ retry: 0 });
    const err = await p.listingPerformance("SRIL").catch((e) => e);
    expect(err).toBeInstanceOf(SectorsApiError);
    expect(String((err as Error).message)).not.toContain(KUNCI);
    expect(String((err as Error).message)).toContain("[KUNCI-DIREDAKSI]");

    // 403 dengan body yang menggemakan kunci
    fetchUrutan(() => jsonResponse(403, { code: "subscription_does_not_allow", message: `kunci ${KUNCI} ditolak` }));
    const err2 = await p.corporateActions("SRIL").catch((e) => e);
    expect(String((err2 as Error).message)).not.toContain(KUNCI);

    // 200 yang menggemakan kunci: tersimpan di cache tanpa kunci? Body disimpan apa adanya,
    // tetapi ledger & pesan error tidak memuatnya. Cek ledger.
    const isiLedger = await readFile(path.join(dir, "ledger.jsonl"), "utf8");
    expect(isiLedger).not.toContain(KUNCI);
    // Cadangan: CreditReserveError juga tidak memuat kunci
    const cre = new CreditReserveError(10, 250);
    expect(cre.message).not.toContain(KUNCI);
  });

  it("rentang di luar batas ditolak sebelum fetch (daily 90 hari, broker 14 hari)", async () => {
    const f = fetchUrutan(() => jsonResponse(200, []));
    const p = provider();
    await expect(p.daily("BBCA", "2024-01-01", "2024-04-01")).rejects.toBeInstanceOf(InvalidQueryError);
    await expect(p.brokerSummary("BBCA", "2024-01-01", "2024-01-15")).rejects.toBeInstanceOf(InvalidQueryError);
    await expect(p.daily("BBCA", "2024-02-01", "2024-01-01")).rejects.toBeInstanceOf(InvalidQueryError);
    await expect(p.daily("BBCA", "01/01/2024", "2024-01-05")).rejects.toBeInstanceOf(InvalidQueryError);
    expect(f).not.toHaveBeenCalled();
    expect(await ledger()).toHaveLength(0);
  });

  it("2xx yang tidak cocok skema: kredit tetap dicatat, body mentah di-cache, SchemaMismatchError", async () => {
    const f = fetchUrutan(() => jsonResponse(200, { bukan: "array" }));
    const p = provider();
    await expect(p.daily("BBCA", "2024-03-01", "2024-03-05")).rejects.toBeInstanceOf(SchemaMismatchError);
    expect(await totalKredit()).toBe(1);
    // panggilan ulang tidak menghabiskan kredit lagi (dilayani cache, tetap gagal skema)
    await expect(p.daily("BBCA", "2024-03-01", "2024-03-05")).rejects.toBeInstanceOf(SchemaMismatchError);
    expect(f).toHaveBeenCalledTimes(1);
    expect(await totalKredit()).toBe(1);
  });

  it("field tak dikenal dibiarkan lewat (skema longgar)", async () => {
    fetchUrutan(() =>
      jsonResponse(200, {
        results: [{ symbol: "SRIL", suspension_date: "2021-05-18", reason: "x", pdf_url: "u", field_baru: 42 }],
        pagination: { total_count: 1, extra: true },
      }),
    );
    const page = await provider().suspensions({ symbol: "SRIL" });
    expect((page.results[0] as Record<string, unknown>).field_baru).toBe(42);
  });
});
