// Tiket 39: suspensi karena gerak harga bukan tanda perusahaan bermasalah, dan
// "lebih awal" diukur ke hari saham berhenti diperdagangkan.
import { describe, expect, it } from "vitest";

import { fires, suspensiGerakHarga, suspensiMasalah, targetTerukur } from "../../../src/lib/engine/evaluate";
import { kosong, type EmitenEvents } from "../../../src/lib/engine/events";
import { parseRule } from "../../../src/lib/engine/rules";
import { pilihUniverseUji } from "../../../src/lib/engine/universe-uji";

const COOLING = "Terjadinya peningkatan harga kumulatif yang signifikan pada saham ROCK.JK, dalam rangka cooling down sebagai bentuk perlindungan bagi investor";
const LAPORAN = "Belum menyampaikan laporan keuangan auditan tahunan";

function emiten(symbol: string, suspensions: { date: string; reason: string | null }[]): EmitenEvents {
  return { ...kosong(symbol), suspensions };
}

const aturanSuspensi = parseRule({ name: "uji", combine: "any", blocks: [{ kind: "suspensi", threshold: "longgar" }] });

describe("suspensiGerakHarga", () => {
  it("mengenali kalimat feed BEI untuk jeda lonjakan harga, dan tidak mengenai alasan lain", () => {
    expect(suspensiGerakHarga({ date: "2026-01-02", reason: COOLING })).toBe(true);
    expect(suspensiGerakHarga({ date: "2026-01-02", reason: "Terjadinya peningkatan harga kumulatif yang signifikan pada saham UDNG.JK" })).toBe(true);
    expect(suspensiGerakHarga({ date: "2026-01-02", reason: LAPORAN })).toBe(false);
    expect(suspensiGerakHarga({ date: "2026-01-02", reason: "Suspend more than 6 month" })).toBe(false);
    // Tanpa alasan kita tidak bisa bilang itu jeda rutin, jadi tetap dihitung.
    expect(suspensiGerakHarga({ date: "2026-01-02", reason: null })).toBe(false);
  });

  it("blok suspensi diam untuk jeda lonjakan harga, tetap berbunyi untuk alasan lain", () => {
    const gerak = emiten("ROCK", [{ date: "2026-08-03", reason: COOLING }]);
    expect(suspensiMasalah(gerak, "2026-09-07")).toEqual([]);
    expect(fires(aturanSuspensi, gerak, "2026-09-07").fired).toBe(false);

    const masalah = emiten("ZBRA", [{ date: "2026-08-03", reason: LAPORAN }]);
    expect(fires(aturanSuspensi, masalah, "2026-09-07").fired).toBe(true);
  });
});

describe("targetTerukur", () => {
  it("memundurkan tanggal catatan ke suspensi masalah paling awal (kasus LMAS)", () => {
    const lmas = emiten("LMAS", [{ date: "2022-08-01", reason: "Suspend more than 6 month" }]);
    expect(targetTerukur("2023-12-20", lmas)).toBe("2022-08-01");
  });

  it("jeda lonjakan harga tidak boleh dipakai sebagai tanggal berhenti diperdagangkan", () => {
    const e = emiten("AAAA", [
      { date: "2024-02-01", reason: COOLING },
      { date: "2025-06-30", reason: LAPORAN },
    ]);
    expect(targetTerukur("2026-01-22", e)).toBe("2025-06-30");
  });

  it("memakai penghentian dari pengumuman publik bila lebih awal (kasus TELE)", () => {
    const tele = emiten("TELE", [{ date: "2024-12-27", reason: "Suspend more than 6 month" }]);
    expect(targetTerukur("2025-06-06", tele, "2020-06-10")).toBe("2020-06-10");
    // Tanggal publik SESUDAH catatan diabaikan: aturannya hanya memundurkan.
    expect(targetTerukur("2025-06-06", tele, "2026-01-01")).toBe("2024-12-27");
  });

  it("tanpa suspensi apa pun, tanggal catatan dipakai apa adanya", () => {
    expect(targetTerukur("2020-12-01", kosong("ENVY"))).toBe("2020-12-01");
  });
});

describe("pilihUniverseUji", () => {
  const source = {
    name: "uji",
    async events(symbol: string) {
      const data: Record<string, EmitenEvents> = {
        ZBRA: emiten("ZBRA", [{ date: "2025-06-30", reason: LAPORAN }]),
        ENVY: emiten("ENVY", []),
        ROCK: emiten("ROCK", [{ date: "2026-08-03", reason: COOLING }]),
        BBCA: kosong("BBCA"),
      };
      return data[symbol] ?? kosong(symbol);
    },
  };

  it("melewati emiten kena yang tanggal berhentinya tidak diketahui, dan memundurkan sisanya", async () => {
    const { universe, dilewati } = await pilihUniverseUji(
      [
        { symbol: "ZBRA", group: "watchlist", targetEventDate: "2026-01-22" },
        { symbol: "ENVY", group: "delisting", targetEventDate: "2020-12-01" },
        { symbol: "ROCK", group: "watchlist", targetEventDate: "2026-06-30" },
        { symbol: "MENN", group: "watchlist", targetEventDate: null },
        { symbol: "BBCA", group: "control", targetEventDate: null },
      ],
      source,
    );
    // ENVY & MENN: tidak ada suspensi di feed / tidak ada tanggal catatan.
    // ROCK: yang ada hanya jeda lonjakan harga, jadi juga tidak bisa diukur.
    expect(dilewati).toEqual(["ENVY", "MENN", "ROCK"]);
    expect(universe.map((u) => `${u.symbol}:${u.targetEventDate ?? "-"}`)).toEqual(["ZBRA:2025-06-30", "BBCA:-"]);
  });
});
