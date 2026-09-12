// Skor uji-ke-masa-lalu pada fixture universe-kecil: nilai snapshot deterministik,
// anti-lookahead lewat pergeseran tanggal kejadian target, dan alarm palsu.
import { describe, expect, it } from "vitest";

import { fromFixture, type UniverseEntry } from "../../../src/lib/engine/events";
import aturanDefault from "../../../src/lib/engine/fixtures/aturan-default.json";
import universeKecil from "../../../src/lib/engine/fixtures/universe-kecil.json";
import { formatBacktest } from "../../../src/lib/engine/format";
import { parseRule, type Rule } from "../../../src/lib/engine/rules";
import { runBacktest } from "../../../src/lib/engine/score";

const sumber = fromFixture(universeKecil);
const TODAY = "2026-09-07";
const aturan = parseRule(aturanDefault);

function hanya(rule: Omit<Rule, "name">): Rule {
  return { name: "uji", ...rule };
}

describe("runBacktest: aturan default pada fixture", () => {
  it("skor snapshot: 2/4 tertangkap, lead 41 & 5 bulan, 0 alarm palsu", async () => {
    const hasil = await runBacktest(aturan, sumber.universe, sumber, { today: TODAY });

    expect(hasil).toMatchObject({
      rule: "Saham mau pailit",
      scanStart: "2020-01-31",
      today: TODAY,
      leadCutoff: "2021-01-01",
      hits: 2,
      total: 4,
      leadMonthsAvg: 23,
      leadMonthsMedian: 23,
      falseAlarms: 0,
      controls: 4,
    });

    const per = Object.fromEntries(hasil.perSymbol.map((r) => [r.symbol, r]));
    expect(per.SRIL).toMatchObject({
      group: "delisting",
      targetEventDate: "2024-11-01",
      scanFrom: "2020-01-31",
      scanTo: "2024-10-31",
      fired: true,
      firstFireDate: "2021-05-31",
      leadMonths: 41,
      excludedFromLead: false,
    });
    expect(per.SRIL.reasons.map((r) => r.kind)).toEqual(["suspensi"]);
    expect(per.TELE).toMatchObject({
      fired: true,
      firstFireDate: "2024-12-31",
      leadMonths: 5,
      excludedFromLead: false,
    });
    // GOLL: target 2019 → rentang pindai kosong, dikecualikan dari lead
    expect(per.GOLL).toMatchObject({
      fired: false,
      firstFireDate: null,
      leadMonths: null,
      scanFrom: null,
      scanTo: null,
      excludedFromLead: true,
    });
    // WIKA: suspensi tepat pada target, kuartal lengkap, ekuitas positif → terlewat
    expect(per.WIKA).toMatchObject({ group: "watchlist", fired: false, reasons: [] });
    for (const s of ["BBCA", "TLKM", "ASII", "UNVR"]) {
      expect(per[s], s).toMatchObject({
        group: "control",
        fired: false,
        scanFrom: "2020-01-31",
        scanTo: "2026-08-31",
      });
    }

    expect(hasil.perGroup.delisting).toMatchObject({ hits: 2, total: 3, leadMonthsAvg: 23 });
    expect(hasil.perGroup.watchlist).toMatchObject({ hits: 0, total: 1, leadMonthsAvg: null });
    expect(hasil.perGroup.control).toMatchObject({ falseAlarms: 0, controls: 4, hits: 0, total: 0 });
    expect(hasil.perGroup.control.perSymbol).toHaveLength(4);
  });

  it("deterministik: dua kali jalan dan urutan universe diacak menghasilkan JSON identik", async () => {
    const a = await runBacktest(aturan, sumber.universe, sumber, { today: TODAY });
    const b = await runBacktest(aturan, [...sumber.universe].reverse(), sumber, { today: TODAY });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("formatBacktest mencetak ringkasan dan tabel per emiten", async () => {
    const hasil = await runBacktest(aturan, sumber.universe, sumber, { today: TODAY });
    const teks = formatBacktest(aturan, hasil);
    expect(teks).toContain("Tertangkap        : 2/4 emiten kena (delisting 2/3, watchlist 0/1)");
    expect(teks).toContain("Lebih awal        : rata-rata 23 bln, median 23 bln");
    expect(teks).toContain("Alarm palsu       : 0/4 kontrol sehat");
    expect(teks).toMatch(/SRIL\s+delisting\s+2024-11-01\s+2021-05-31\s+41 bln\s+TERTANGKAP/);
    expect(teks).toMatch(/GOLL\s+delisting\s+2019-01-30\s+-\s+-\s+terlewat/);
  });
});

describe("runBacktest: alarm palsu pada kontrol", () => {
  it("insider_jual ketat: UNVR alarm palsu; longgar: TLKM juga", async () => {
    const ketat = await runBacktest(
      hanya({ combine: "any", blocks: [{ kind: "insider_jual", threshold: "ketat" }] }),
      sumber.universe,
      sumber,
      { today: TODAY },
    );
    expect(ketat).toMatchObject({ falseAlarms: 1, controls: 4, hits: 0, total: 4 });
    const unvr = ketat.perSymbol.find((r) => r.symbol === "UNVR")!;
    expect(unvr).toMatchObject({ fired: true, firstFireDate: "2025-05-31", leadMonths: null });
    expect(unvr.reasons[0].detail).toContain("1.20 poin persen");

    const longgar = await runBacktest(
      hanya({ combine: "any", blocks: [{ kind: "insider_jual", threshold: "longgar" }] }),
      sumber.universe,
      sumber,
      { today: TODAY },
    );
    expect(longgar.falseAlarms).toBe(2);
    expect(
      longgar.perSymbol.filter((r) => r.group === "control" && r.fired).map((r) => r.symbol),
    ).toEqual(["TLKM", "UNVR"]);
    // SRIL (emiten kena) juga tertangkap lewat filing insider 2021
    expect(longgar.hits).toBe(1);
    expect(longgar.perSymbol.find((r) => r.symbol === "SRIL")).toMatchObject({
      fired: true,
      firstFireDate: "2021-01-31",
    });
  });

  it("rentang kontrol mengikuti opts.today", async () => {
    const hasil = await runBacktest(
      hanya({ combine: "any", blocks: [{ kind: "insider_jual", threshold: "ketat" }] }),
      sumber.universe,
      sumber,
      { today: "2025-05-30" },
    );
    expect(hasil.falseAlarms).toBe(0);
    expect(hasil.perSymbol.find((r) => r.symbol === "UNVR")!.scanTo).toBe("2025-04-30");
  });
});

describe("runBacktest: anti-lookahead lewat pergeseran tanggal kejadian target", () => {
  const sril = (target: string): UniverseEntry[] => [
    { symbol: "SRIL", group: "delisting", targetEventDate: target },
  ];
  const suspensi = hanya({ combine: "any", blocks: [{ kind: "suspensi", threshold: "longgar" }] });

  it("target sebelum akhir bulan suspensi → tidak tertangkap; sesudahnya → tertangkap dengan lead deterministik", async () => {
    const kasus: [string, boolean, number | null][] = [
      ["2021-05-20", false, null], // hanya t <= 2021-04-30 yang dipindai
      ["2021-05-31", false, null], // t harus < target
      ["2021-06-01", true, 0],
      ["2021-07-15", true, 1],
      ["2024-11-01", true, 41],
    ];
    for (const [target, fired, lead] of kasus) {
      const h = await runBacktest(suspensi, sril(target), sumber, { today: TODAY });
      expect(h.perSymbol[0], target).toMatchObject({ fired, leadMonths: lead });
      expect(h.hits).toBe(fired ? 1 : 0);
    }
  });

  it("aksi_dilutif longgar pada WIKA berbunyi sejak awal rentang (rights issue 2016) → lead 60 bulan", async () => {
    const h = await runBacktest(
      hanya({ combine: "any", blocks: [{ kind: "aksi_dilutif", threshold: "longgar" }] }),
      [{ symbol: "WIKA", group: "watchlist", targetEventDate: "2025-02-18" }],
      sumber,
      { today: TODAY },
    );
    expect(h.perSymbol[0]).toMatchObject({ fired: true, firstFireDate: "2020-01-31", leadMonths: 60 });
  });

  it("emiten kena tanpa targetEventDate ditolak", async () => {
    await expect(
      runBacktest(suspensi, [{ symbol: "SRIL", group: "delisting" }], sumber, { today: TODAY }),
    ).rejects.toThrow(/wajib punya targetEventDate/);
  });

  it("emiten tanpa data sama sekali: kontrol bersih, kena terlewat", async () => {
    const h = await runBacktest(
      aturan,
      [
        { symbol: "ZZZZ", group: "control" },
        { symbol: "YYYY", group: "delisting", targetEventDate: "2025-01-01" },
      ],
      sumber,
      { today: TODAY },
    );
    expect(h).toMatchObject({ hits: 0, total: 1, falseAlarms: 0, controls: 1, leadMonthsAvg: null });
  });
});
