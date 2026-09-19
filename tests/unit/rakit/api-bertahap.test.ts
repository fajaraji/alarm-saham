// Klien mintaDiagnosis membaca jawaban bertahap (tiket 22). `fetch` ditiru;
// aliran NDJSON dipotong di tempat yang jahat (di tengah baris) untuk
// membuktikan baris disambung dulu sebelum dibaca.
import { afterEach, describe, expect, it, vi } from "vitest";

import { TIPE_BERTAHAP } from "../../../src/lib/agent/bertahap";
import type { TraceStep } from "../../../src/lib/agent/diagnosis";
import type { Rule } from "../../../src/lib/engine/rules";
import type { BacktestResult } from "../../../src/lib/engine/score";
import { aiNonaktif, mintaDiagnosis } from "../../../src/lib/rakit/api";

const RULE: Rule = { name: "Uji", combine: "any", blocks: [{ kind: "suspensi", threshold: "longgar" }] };
const BT = {} as BacktestResult;
const L1: TraceStep = { step: 0, tool: "listMissed", input: {}, ringkasanHasil: "2 terlewat" };
const L2: TraceStep = { step: 1, tool: "getSuspensions", input: { symbol: "TELE" }, ringkasanHasil: "1 suspensi" };

function aliran(potongan: string[]): Response {
  const enc = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      for (const p of potongan) c.enqueue(enc.encode(p));
      c.close();
    },
  });
  return new Response(body, { status: 200, headers: { "content-type": `${TIPE_BERTAHAP}; charset=utf-8` } });
}

function pasangFetch(res: Response) {
  const f = vi.fn(async () => res);
  vi.stubGlobal("fetch", f);
  return f;
}

afterEach(() => vi.unstubAllGlobals());

describe("mintaDiagnosis, jawaban bertahap", () => {
  it("meminta aliran, meneruskan langkah berurutan, dan mengembalikan jawaban akhir", async () => {
    const hasil = { ringkasan: "ok", trace: [L1, L2] };
    const baris = [
      JSON.stringify({ jenis: "langkah", langkah: [L1] }),
      JSON.stringify({ jenis: "langkah", langkah: [L2] }),
      JSON.stringify({ jenis: "selesai", hasil }),
    ].join("\n");
    // Potong di tengah baris kedua, dan tanpa baris baru di akhir.
    const f = pasangFetch(aliran([baris.slice(0, 70), baris.slice(70)]));
    const diterima: TraceStep[] = [];
    const r = await mintaDiagnosis(RULE, BT, { onLangkah: (l) => diterima.push(...l) });

    const init = (f.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(new Headers(init.headers).get("accept")).toContain(TIPE_BERTAHAP);
    expect(diterima).toEqual([L1, L2]);
    expect(r).toEqual({ ok: true, data: hasil });
  });

  it("baris `galat` di tengah aliran menjadi galat biasa", async () => {
    pasangFetch(
      aliran([
        `${JSON.stringify({ jenis: "langkah", langkah: [L1] })}\n`,
        `${JSON.stringify({ jenis: "galat", status: 502, error: { kode: "DIAGNOSIS_TANPA_JAWABAN", pesan: "coba lagi" } })}\n`,
      ]),
    );
    const diterima: TraceStep[] = [];
    const r = await mintaDiagnosis(RULE, BT, { onLangkah: (l) => diterima.push(...l) });
    expect(diterima).toEqual([L1]);
    expect(r).toEqual({ ok: false, galat: { status: 502, kode: "DIAGNOSIS_TANPA_JAWABAN", pesan: "coba lagi" } });
  });

  it("aliran putus tanpa baris penutup dikatakan terus terang, tidak menggantung", async () => {
    pasangFetch(aliran([`${JSON.stringify({ jenis: "langkah", langkah: [L1] })}\n`]));
    const r = await mintaDiagnosis(RULE, BT);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.galat.kode).toBe("ALIRAN_TERPUTUS");
  });

  it("jawaban JSON 503 (tanpa kunci AI) tetap dikenali sebagai AI nonaktif", async () => {
    pasangFetch(
      new Response(JSON.stringify({ error: { kode: "AI_TIDAK_TERSEDIA", pesan: "kunci kosong" } }), {
        status: 503,
        headers: { "content-type": "application/json" },
      }),
    );
    const r = await mintaDiagnosis(RULE, BT);
    expect(r.ok).toBe(false);
    expect(!r.ok && aiNonaktif(r.galat)).toBe(true);
  });
});
