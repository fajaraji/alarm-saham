// Server Sectors tiruan untuk tes: fetch palsu yang melayani permintaan dari
// FixtureProvider, sehingga tes kontrak yang sama dapat dijalankan untuk
// SectorsProvider tanpa menyentuh API sungguhan.
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { FixtureProvider, NotFoundError, SECTORS_BASE_URL } from "../../../src/lib/data";

export function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export interface PanggilanTercatat {
  url: string;
  headers: Record<string, string>;
}

export function buatFetchFixture(fixture = new FixtureProvider()) {
  const panggilan: PanggilanTercatat[] = [];
  const fetchPalsu = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    panggilan.push({ url: url.toString(), headers: (init?.headers ?? {}) as Record<string, string> });
    if (!url.toString().startsWith(SECTORS_BASE_URL)) return jsonResponse(500, { code: "wrong_host" });
    const q = Object.fromEntries(url.searchParams.entries());
    const num = (v?: string) => (v === undefined ? undefined : Number(v));
    try {
      const p = url.pathname;
      let m: RegExpMatchArray | null;
      if (p === "/v2/suspensions/") {
        return jsonResponse(
          200,
          await fixture.suspensions({ ...q, limit: num(q.limit), offset: num(q.offset) }),
        );
      }
      if ((m = p.match(/^\/v2\/company\/get_quarterly_financial_dates\/([A-Z0-9]{4})\/$/))) {
        return jsonResponse(200, await fixture.quarterlyFinancialDates(m[1]));
      }
      if (p === "/v2/filings/") {
        const { symbol, ...sisa } = q;
        return jsonResponse(
          200,
          await fixture.filings(symbol, {
            ...(sisa as object),
            limit: num(q.limit),
            offset: num(q.offset),
          }),
        );
      }
      if ((m = p.match(/^\/v2\/company\/corporate-actions\/([A-Z0-9]{4})\/$/))) {
        return jsonResponse(200, await fixture.corporateActions(m[1]));
      }
      if ((m = p.match(/^\/v2\/financials\/quarterly\/([A-Z0-9]{4})\/$/))) {
        return jsonResponse(200, await fixture.quarterlyFinancials(m[1], num(q.n_quarters)));
      }
      if (p === "/v2/free-float/") {
        return jsonResponse(200, await fixture.freeFloat());
      }
      if ((m = p.match(/^\/v2\/broker-summary\/([A-Z0-9]{4})\/$/))) {
        return jsonResponse(200, await fixture.brokerSummary(m[1], q.start, q.end));
      }
      if ((m = p.match(/^\/v2\/listing-performance\/([A-Z0-9]{4})\/$/))) {
        return jsonResponse(200, await fixture.listingPerformance(m[1]));
      }
      if ((m = p.match(/^\/v2\/daily\/([A-Z0-9]{4})\/$/))) {
        return jsonResponse(200, await fixture.daily(m[1], q.start, q.end));
      }
      return jsonResponse(404, { code: "not_found", message: `rute tidak dikenal: ${p}` });
    } catch (err) {
      if (err instanceof NotFoundError) {
        return jsonResponse(404, { code: "not_found", message: "symbol tidak dikenal" });
      }
      return jsonResponse(400, { code: "bad_request", message: String(err) });
    }
  };
  return { fetch: fetchPalsu as unknown as typeof fetch, panggilan };
}

/** Folder cache sementara per tes. */
export async function dirSementara(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), "alarm-saham-sectors-"));
}
