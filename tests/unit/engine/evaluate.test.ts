// Tes tiap blok kelas A terpicu/tidak pada t tertentu, longgar vs ketat,
// ATAU vs DAN, dan anti-lookahead. Data dari fixture universe-kecil.json.
import { describe, expect, it } from "vitest";

import { daftarAkhirBulan } from "../../../src/lib/engine/dates";
import { fires } from "../../../src/lib/engine/evaluate";
import { fromFixture, kosong, type EmitenEvents } from "../../../src/lib/engine/events";
import universeKecil from "../../../src/lib/engine/fixtures/universe-kecil.json";
import type { BlockKind, Rule, Threshold } from "../../../src/lib/engine/rules";

const sumber = fromFixture(universeKecil);
const events: Record<string, EmitenEvents> = {};
for (const u of sumber.universe) events[u.symbol] = await sumber.events(u.symbol);

function aturan(kind: BlockKind, threshold: Threshold): Rule {
  return { name: `uji ${kind} ${threshold}`, combine: "any", blocks: [{ kind, threshold }] };
}

function bunyi(kind: BlockKind, threshold: Threshold, symbol: string, t: string): boolean {
  return fires(aturan(kind, threshold), events[symbol], t).fired;
}

describe("blok suspensi", () => {
  it("longgar: berbunyi sejak akhir bulan suspensi, padam setelah 12 bulan", () => {
    expect(bunyi("suspensi", "longgar", "SRIL", "2021-04-30")).toBe(false);
    expect(bunyi("suspensi", "longgar", "SRIL", "2021-05-18")).toBe(true);
    expect(bunyi("suspensi", "longgar", "SRIL", "2021-05-31")).toBe(true);
    expect(bunyi("suspensi", "longgar", "SRIL", "2022-04-30")).toBe(true);
    expect(bunyi("suspensi", "longgar", "SRIL", "2022-05-31")).toBe(false);
    // suspensi kedua (2024-11-01) menyalakan lagi
    expect(bunyi("suspensi", "longgar", "SRIL", "2024-10-31")).toBe(false);
    expect(bunyi("suspensi", "longgar", "SRIL", "2024-11-30")).toBe(true);
  });

  it("ketat: >= 6 bulan tanpa kuartal laporan baru; kuartal baru dianggap pencabutan", () => {
    expect(bunyi("suspensi", "ketat", "GOLL", "2019-06-30")).toBe(false); // belum 6 bulan
    expect(bunyi("suspensi", "ketat", "GOLL", "2019-07-30")).toBe(true);
    expect(bunyi("suspensi", "ketat", "GOLL", "2019-12-31")).toBe(true);
    expect(bunyi("suspensi", "ketat", "GOLL", "2020-03-31")).toBe(false); // ada kuartal 2020 q1
    // SRIL terus melapor setelah suspensi 2021 → ketat tidak pernah berbunyi sebelum 2024
    expect(bunyi("suspensi", "ketat", "SRIL", "2022-05-31")).toBe(false);
    expect(bunyi("suspensi", "ketat", "SRIL", "2025-05-31")).toBe(true); // suspensi 2024-11-01, tanpa kuartal baru
  });

  it("detail alasan menyebut tanggal suspensi", () => {
    const r = fires(aturan("suspensi", "longgar"), events.TELE, "2024-12-31");
    expect(r.reasons).toEqual([
      { kind: "suspensi", threshold: "longgar", detail: expect.stringContaining("2024-12-27") },
    ]);
  });
});

describe("blok laporan_hilang", () => {
  it("longgar 120 hari / ketat 180 hari setelah akhir kuartal yang tidak tersedia", () => {
    // SRIL: kuartal terakhir 2024 q3; 2024 q4 (akhir 2024-12-31) tidak ada
    expect(bunyi("laporan_hilang", "longgar", "SRIL", "2025-04-29")).toBe(false);
    expect(bunyi("laporan_hilang", "longgar", "SRIL", "2025-04-30")).toBe(true);
    expect(bunyi("laporan_hilang", "ketat", "SRIL", "2025-04-30")).toBe(false);
    expect(bunyi("laporan_hilang", "ketat", "SRIL", "2025-06-28")).toBe(false);
    expect(bunyi("laporan_hilang", "ketat", "SRIL", "2025-06-29")).toBe(true);
    const r = fires(aturan("laporan_hilang", "longgar"), events.SRIL, "2025-09-30");
    expect(r.reasons[0].detail).toContain("2024 q4");
    expect(r.reasons[0].detail).toContain("+1 kuartal lain");
  });

  it("emiten dengan kuartal lengkap tidak pernah berbunyi; tanpa kuartal → tidak bisa dinilai", () => {
    for (const t of daftarAkhirBulan("2020-01-31", "2026-08-31")) {
      expect(bunyi("laporan_hilang", "longgar", "BBCA", t), t).toBe(false);
    }
    expect(fires(aturan("laporan_hilang", "longgar"), kosong("XXXX"), "2025-12-31").fired).toBe(false);
    // GOLL: kuartal berhenti 2021 q3 → 2021 q4 hilang mulai 2022-04-30
    expect(bunyi("laporan_hilang", "longgar", "GOLL", "2022-04-29")).toBe(false);
    expect(bunyi("laporan_hilang", "longgar", "GOLL", "2022-04-30")).toBe(true);
  });
});

describe("blok aksi_dilutif", () => {
  it("longgar: rights issue apa pun dengan ex_date <= t; ketat: rasio >= 0.5", () => {
    expect(bunyi("aksi_dilutif", "longgar", "WIKA", "2016-11-10")).toBe(false);
    expect(bunyi("aksi_dilutif", "longgar", "WIKA", "2016-11-11")).toBe(true);
    expect(bunyi("aksi_dilutif", "ketat", "WIKA", "2020-01-31")).toBe(false); // rasio 0,3
    expect(bunyi("aksi_dilutif", "ketat", "WIKA", "2024-04-16")).toBe(false);
    expect(bunyi("aksi_dilutif", "ketat", "WIKA", "2024-04-17")).toBe(true); // rasio 5,22
    expect(bunyi("aksi_dilutif", "longgar", "SRIL", "2026-08-31")).toBe(false);
  });
});

describe("blok ekuitas_negatif", () => {
  it("longgar: ekuitas kuartal terakhir <= t negatif", () => {
    expect(bunyi("ekuitas_negatif", "longgar", "SRIL", "2023-09-29")).toBe(false); // belum ada laporan <= t
    expect(bunyi("ekuitas_negatif", "longgar", "SRIL", "2023-09-30")).toBe(true);
    expect(bunyi("ekuitas_negatif", "longgar", "TELE", "2025-06-30")).toBe(false); // positif
  });

  it("ketat: turun >= 50% YoY terhadap kuartal setahun sebelumnya", () => {
    expect(bunyi("ekuitas_negatif", "ketat", "TELE", "2025-03-31")).toBe(false); // tak ada pembanding 2024-03-31
    expect(bunyi("ekuitas_negatif", "ketat", "TELE", "2025-06-29")).toBe(false);
    expect(bunyi("ekuitas_negatif", "ketat", "TELE", "2025-06-30")).toBe(true); // 1,2 T → 0,4 T
    expect(bunyi("ekuitas_negatif", "ketat", "WIKA", "2025-03-31")).toBe(true); // 5 T → 2 T
    expect(bunyi("ekuitas_negatif", "ketat", "SRIL", "2024-09-30")).toBe(false); // pembanding negatif → tak dinilai
    expect(bunyi("ekuitas_negatif", "ketat", "BBCA", "2026-06-30")).toBe(false);
  });
});

describe("blok insider_jual", () => {
  it("longgar: ada filing jual insider/institusi dalam 180 hari; ketat: total >= 1 poin persen", () => {
    expect(bunyi("insider_jual", "longgar", "UNVR", "2025-03-09")).toBe(false);
    expect(bunyi("insider_jual", "longgar", "UNVR", "2025-03-10")).toBe(true);
    expect(bunyi("insider_jual", "ketat", "UNVR", "2025-03-31")).toBe(false); // 0,8 poin
    expect(bunyi("insider_jual", "ketat", "UNVR", "2025-05-31")).toBe(true); // 0,8 + 0,4
    expect(bunyi("insider_jual", "ketat", "UNVR", "2025-09-30")).toBe(false); // filing Maret keluar jendela
    expect(bunyi("insider_jual", "longgar", "UNVR", "2025-11-30")).toBe(false); // semua keluar jendela
    expect(bunyi("insider_jual", "longgar", "TLKM", "2025-08-31")).toBe(true);
    expect(bunyi("insider_jual", "ketat", "TLKM", "2025-08-31")).toBe(false);
    // pembelian insider dan transaksi "others" tidak dihitung
    expect(bunyi("insider_jual", "longgar", "BBCA", "2025-04-30")).toBe(false);
    expect(bunyi("insider_jual", "longgar", "WIKA", "2026-01-31")).toBe(false);
  });
});

describe("gabungan ATAU vs DAN", () => {
  const blocks: Rule["blocks"] = [
    { kind: "suspensi", threshold: "longgar" },
    { kind: "ekuitas_negatif", threshold: "longgar" },
  ];
  const atau: Rule = { name: "atau", combine: "any", blocks };
  const dan: Rule = { name: "dan", combine: "all", blocks };

  it("satu blok terpenuhi: ATAU berbunyi, DAN tidak (alasan tetap dilaporkan)", () => {
    const a = fires(atau, events.SRIL, "2021-05-31");
    const d = fires(dan, events.SRIL, "2021-05-31");
    expect(a.fired).toBe(true);
    expect(d.fired).toBe(false);
    expect(d.reasons.map((r) => r.kind)).toEqual(["suspensi"]);
  });

  it("semua blok terpenuhi: keduanya berbunyi", () => {
    const d = fires(dan, events.SRIL, "2024-11-30");
    expect(d.fired).toBe(true);
    expect(d.reasons.map((r) => r.kind)).toEqual(["suspensi", "ekuitas_negatif"]);
    expect(fires(atau, events.SRIL, "2024-11-30").fired).toBe(true);
  });

  it("tidak ada blok terpenuhi: keduanya diam", () => {
    expect(fires(atau, events.BBCA, "2026-08-31")).toEqual({ fired: false, reasons: [] });
    expect(fires(dan, events.BBCA, "2026-08-31")).toEqual({ fired: false, reasons: [] });
  });
});

describe("anti-lookahead", () => {
  const semuaBlok: Rule = {
    name: "semua",
    combine: "any",
    blocks: [
      { kind: "suspensi", threshold: "longgar" },
      { kind: "laporan_hilang", threshold: "longgar" },
      { kind: "aksi_dilutif", threshold: "ketat" },
      { kind: "ekuitas_negatif", threshold: "ketat" },
      { kind: "insider_jual", threshold: "ketat" },
    ],
  };

  function potong(e: EmitenEvents, t: string): EmitenEvents {
    return {
      symbol: e.symbol,
      suspensions: e.suspensions.filter((x) => x.date <= t),
      quarters: e.quarters.filter((x) => x.periodEnd <= t),
      rightIssues: e.rightIssues.filter((x) => x.exDate <= t),
      financials: e.financials.filter((x) => x.date <= t),
      filings: e.filings.filter((x) => x.date <= t),
    };
  }

  it("hasil pada t identik dengan/tanpa data bertanggal > t, untuk semua emiten dan akhir bulan", () => {
    for (const symbol of Object.keys(events)) {
      for (const t of daftarAkhirBulan("2019-01-31", "2026-08-31")) {
        const penuh = fires(semuaBlok, events[symbol], t);
        const terpotong = fires(semuaBlok, potong(events[symbol], t), t);
        expect(penuh, `${symbol} @ ${t}`).toEqual(terpotong);
      }
    }
  });

  it("menggeser t ke belakang sehari melewati tanggal kejadian mematikan alarm", () => {
    const r = aturan("suspensi", "longgar");
    expect(fires(r, events.TELE, "2024-12-27").fired).toBe(true);
    expect(fires(r, events.TELE, "2024-12-26").fired).toBe(false);
  });
});
