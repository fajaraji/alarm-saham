// Jawaban bertahap POST /api/agent/diagnosis (tiket 22).
//
// `diagnosis` diganti tiruan yang bisa DITAHAN di tengah jalan. Tes pertama
// membaca baris pertama aliran selagi agent tiruan masih tertahan: itu yang
// membuktikan langkah benar-benar dikirim begitu selesai, bukan disangga lalu
// dikirim sekaligus di akhir. Nol panggilan model.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TIPE_BERTAHAP, type BarisBertahap } from "../../../src/lib/agent/bertahap";
import type { DiagnosisInput, DiagnosisResult, TraceStep } from "../../../src/lib/agent/diagnosis";

const tiruan = vi.hoisted(() => ({
  diagnosis: vi.fn(),
  adaKunci: true,
}));

vi.mock("../../../src/lib/agent", async (asli) => {
  const mod = await asli<typeof import("../../../src/lib/agent")>();
  return {
    ...mod,
    diagnosis: tiruan.diagnosis,
    hasAiKey: () => tiruan.adaKunci,
    pilihSumber: async () => ({ source: {}, universe: [], dilewati: [], keterangan: "sumber uji", jenis: "fixture" }),
  };
});

const { POST } = await import("../../../src/app/api/agent/diagnosis/route");

const ATURAN = { name: "Uji", combine: "any", blocks: [{ kind: "laporan_hilang", threshold: "longgar" }] };
const BACKTEST = { rule: "Uji", scanStart: "2020-01-31", today: "2026-09-07", hits: 1, total: 2, falseAlarms: 0, controls: 1, perSymbol: [] };

const L1: TraceStep = { step: 0, tool: "listMissed", input: {}, ringkasanHasil: "2 terlewat: TELE, SRIL" };
const L2: TraceStep = { step: 1, tool: "getSuspensions", input: { symbol: "TELE" }, ringkasanHasil: "1 suspensi: 2024-12-27" };

function hasilAkhir(trace: TraceStep[]): DiagnosisResult {
  return {
    ringkasan: "Alarm bolong di TELE.",
    emitenDibahas: [],
    usulanBlok: [],
    trace,
    langkah: 2,
    perluTinjau: false,
    kataDisensor: [],
    usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2, cacheReadTokens: 0, cacheWriteTokens: 0 },
  };
}

function permintaan(bertahap: boolean): Request {
  return new Request("http://localhost/api/agent/diagnosis", {
    method: "POST",
    headers: { "content-type": "application/json", ...(bertahap ? { accept: `${TIPE_BERTAHAP}, application/json` } : {}) },
    body: JSON.stringify({ rule: ATURAN, backtest: BACKTEST }),
  });
}

/** Pembaca aliran NDJSON yang mengembalikan satu baris utuh per panggilan. */
function pembacaBaris(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader();
  const dec = new TextDecoder();
  let sisa = "";
  return async (): Promise<BarisBertahap | null> => {
    for (;;) {
      const i = sisa.indexOf("\n");
      if (i >= 0) {
        const baris = sisa.slice(0, i);
        sisa = sisa.slice(i + 1);
        return JSON.parse(baris) as BarisBertahap;
      }
      const { value, done } = await reader.read();
      if (done) return null;
      sisa += dec.decode(value, { stream: true });
    }
  };
}

beforeEach(() => {
  tiruan.diagnosis.mockReset();
  tiruan.adaKunci = true;
});
afterEach(() => vi.restoreAllMocks());

describe("POST /api/agent/diagnosis, mode bertahap", () => {
  it("langkah pertama tiba SELAGI agent masih bekerja; baris terakhir = jawaban akhir yang sama", async () => {
    let lepas!: () => void;
    const tahan = new Promise<void>((r) => (lepas = r));
    tiruan.diagnosis.mockImplementation(async (input: DiagnosisInput) => {
      input.onLangkah?.([L1]);
      await tahan;
      input.onLangkah?.([L2]);
      return hasilAkhir([L1, L2]);
    });

    const res = await POST(permintaan(true));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain(TIPE_BERTAHAP);
    const baca = pembacaBaris(res.body!);

    // Agent tiruan masih tertahan di sini, tetapi langkah pertama sudah sampai.
    expect(await baca()).toEqual({ jenis: "langkah", langkah: [L1] });

    lepas();
    expect(await baca()).toEqual({ jenis: "langkah", langkah: [L2] });
    const akhir = await baca();
    expect(akhir?.jenis).toBe("selesai");
    const hasil = (akhir as Extract<BarisBertahap, { jenis: "selesai" }>).hasil as Record<string, unknown>;
    // Bentuk jawaban akhir sama dengan jawaban JSON biasa (sumber + ringkasan backtest).
    expect(hasil).toMatchObject({ sumber: "sumber uji", ringkasan: "Alarm bolong di TELE.", trace: [L1, L2] });
    expect(hasil.backtest).toEqual({ hits: 1, total: 2, falseAlarms: 0, controls: 1 });
    expect(await baca()).toBeNull();
  });

  it("galat setelah sebagian langkah terkirim menjadi baris `galat`, lalu aliran ditutup", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    tiruan.diagnosis.mockImplementation(async (input: DiagnosisInput) => {
      input.onLangkah?.([L1]);
      throw new Error("gateway penuh");
    });
    const res = await POST(permintaan(true));
    const baca = pembacaBaris(res.body!);
    expect(await baca()).toEqual({ jenis: "langkah", langkah: [L1] });
    expect(await baca()).toEqual({
      jenis: "galat",
      status: 500,
      error: { kode: "GALAT_INTERNAL", pesan: "Diagnosis gagal; coba lagi sesaat." },
    });
    expect(await baca()).toBeNull();
  });

  it("tanpa kunci AI tetap dijawab JSON 503, bukan aliran, supaya panel mengenalinya seperti dulu", async () => {
    tiruan.adaKunci = false;
    const res = await POST(permintaan(true));
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ error: { kode: "AI_TIDAK_TERSEDIA" } });
    expect(tiruan.diagnosis).not.toHaveBeenCalled();
  });

  it("klien yang tidak meminta aliran tetap mendapat JSON biasa", async () => {
    tiruan.diagnosis.mockResolvedValue(hasilAkhir([L1]));
    const res = await POST(permintaan(false));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(await res.json()).toMatchObject({ sumber: "sumber uji", trace: [L1] });
  });
});
