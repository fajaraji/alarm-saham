// Evaluator murni blok kelas B (tanpa I/O): ritel dominan, free float, jatuh dari puncak.
import { describe, expect, it } from "vitest";

import type { BrokerSummary, DailyBar } from "../../../src/lib/data/types";
import {
  AMBANG_B,
  jendelaKelasB,
  nilaiFreeFloat,
  nilaiJatuhDariPuncak,
  nilaiRitelDominan,
  petaCohort,
} from "../../../src/lib/jaga/blok-b";

const REGISTRY = petaCohort([
  { code: "YP", cohort: "retail", is_foreign: false },
  { code: "PD", cohort: "retail", is_foreign: false },
  { code: "AK", cohort: "institutional", is_foreign: true },
  { code: "CC", cohort: "mixed", is_foreign: false },
  { code: "ZZ", cohort: null, is_foreign: false },
]);

function baris(broker_code: string, bval: number, nval: number) {
  return { broker_code, bval, nval, sval: bval - nval };
}

function ringkas(data: BrokerSummary["data"]): BrokerSummary {
  return { symbol: "UJI", start: "2026-08-24", end: "2026-09-06", data };
}

describe("jendelaKelasB", () => {
  it("end = sehari sebelum today; broker 14 hari & daily 90 hari inklusif", () => {
    expect(jendelaKelasB("2026-09-07")).toEqual({
      brokerStart: "2026-08-24",
      brokerEnd: "2026-09-06",
      dailyStart: "2026-06-09",
      dailyEnd: "2026-09-06",
    });
  });
});

describe("nilaiRitelDominan", () => {
  it("terpenuhi: ritel >= 70% nilai beli dan asing/institusi net melepas", () => {
    const h = nilaiRitelDominan(
      ringkas([
        { date: "2026-09-05", summary: [baris("YP", 700, 300), baris("AK", 200, -250), baris("CC", 100, -50)] },
        { date: "2026-09-06", summary: [baris("PD", 800, 400), baris("AK", 100, -100)] },
      ]),
      REGISTRY,
    );
    expect(h.terpenuhi).toBe(true);
    expect(h.tanggal).toBe("2026-09-06");
    expect(h.detail).toMatch(/broker ritel 79%/);
    expect(h.detail).toMatch(/net melepas/);
    expect(h.detail).toMatch(/2026-09-05–2026-09-06 \(2 hari bursa\)/);
  });

  it("tidak terpenuhi bila asing/institusi net menambah walau ritel dominan", () => {
    const h = nilaiRitelDominan(ringkas([{ date: "2026-09-06", summary: [baris("YP", 900, 500), baris("AK", 100, 50)] }]), REGISTRY);
    expect(h.terpenuhi).toBe(false);
    expect(h.detail).toMatch(/net menambah/);
  });

  it("tidak terpenuhi bila porsi ritel di bawah ambang", () => {
    const h = nilaiRitelDominan(ringkas([{ date: "2026-09-06", summary: [baris("YP", 300, 100), baris("AK", 700, -100)] }]), REGISTRY);
    expect(h.terpenuhi).toBe(false);
    expect(h.detail).toMatch(/broker ritel 30%/);
  });

  it("data kosong (saham tidak diperdagangkan) → tidak terpenuhi dengan keterangan", () => {
    const h = nilaiRitelDominan(ringkas([]), REGISTRY);
    expect(h.terpenuhi).toBe(false);
    expect(h.detail).toMatch(/tidak ada transaksi broker/);
    expect(h.tanggal).toBeNull();
  });

  it("semua broker tak dikenal registry → tidak terpenuhi, dijelaskan", () => {
    const h = nilaiRitelDominan(ringkas([{ date: "2026-09-06", summary: [baris("QQ", 900, 500)] }]), REGISTRY);
    expect(h.terpenuhi).toBe(false);
    expect(h.detail).toMatch(/cohort broker tidak dikenal/);
  });
});

describe("nilaiFreeFloat", () => {
  it("< 15% terpenuhi; >= 15% tidak; absen → tidak dengan keterangan", () => {
    expect(nilaiFreeFloat({ symbol: "A", free_float: 0.099 }, "2026-09-06").terpenuhi).toBe(true);
    expect(nilaiFreeFloat({ symbol: "A", free_float: AMBANG_B.freeFloat }, "2026-09-06").terpenuhi).toBe(false);
    const absen = nilaiFreeFloat(undefined, "2026-09-06");
    expect(absen.terpenuhi).toBe(false);
    expect(absen.detail).toMatch(/tidak ada di snapshot/);
  });
});

describe("nilaiJatuhDariPuncak", () => {
  const bar = (date: string, close: number | null): DailyBar => ({ date, close, high: close ?? 0 });

  it("close terakhir <= 70% tertinggi 90 hari → terpenuhi", () => {
    const h = nilaiJatuhDariPuncak([bar("2026-07-01", 100), bar("2026-08-01", 200), bar("2026-09-06", 130)]);
    expect(h.terpenuhi).toBe(true);
    expect(h.detail).toMatch(/tertinggi 90 hari 200 \(2026-08-01\)/);
    expect(h.detail).toMatch(/turun 35%/);
    expect(h.tanggal).toBe("2026-09-06");
  });

  it("belum jatuh cukup dalam → tidak terpenuhi; close null diabaikan; urutan tanggal tidak penting", () => {
    const h = nilaiJatuhDariPuncak([bar("2026-09-06", 150), bar("2026-08-01", 200), bar("2026-09-07", null)]);
    expect(h.terpenuhi).toBe(false);
    expect(h.tanggal).toBe("2026-09-06");
  });

  it("tanpa harga → tidak terpenuhi", () => {
    expect(nilaiJatuhDariPuncak([]).terpenuhi).toBe(false);
  });
});
