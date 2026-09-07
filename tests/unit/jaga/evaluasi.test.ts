// cekPortofolio dengan sumber fixture (universe-kecil) dan penyedia kelas B
// buatan: komposisi status hijau/kuning/merah dari blok kelas A + B, alarm
// kelas B berbunyi, suspensi aktif → merah.
import { describe, expect, it } from "vitest";

import type { Broker, BrokerSummary, DailyBar, FreeFloatEntry } from "../../../src/lib/data/types";
import { fromFixture } from "../../../src/lib/engine/events";
import universeKecil from "../../../src/lib/engine/fixtures/universe-kecil.json";
import { ALARM_BAWAAN, ID_ALARM_JEBAKAN, ID_ALARM_PAILIT } from "../../../src/lib/jaga/bawaan";
import { cekPortofolio, statusDari, suspensiAktif, type PenyediaKelasB } from "../../../src/lib/jaga/evaluasi";

const fx = fromFixture(universeKecil);
const TODAY = "2026-09-07";

function penyedia(opsi: { ritel: boolean; jatuh: boolean; ff: number }): PenyediaKelasB & { dipanggil: string[] } {
  const dipanggil: string[] = [];
  const brokers: Broker[] = [
    { code: "YP", cohort: "retail", is_foreign: false },
    { code: "AK", cohort: "institutional", is_foreign: true },
  ];
  return {
    dipanggil,
    async brokers() {
      dipanggil.push("brokers");
      return brokers;
    },
    async brokerSummary(symbol, start, end): Promise<BrokerSummary> {
      dipanggil.push(`broker:${symbol}`);
      const ritel = opsi.ritel ? 900 : 100;
      return {
        symbol,
        start,
        end,
        data: [{ date: end, summary: [{ broker_code: "YP", bval: ritel, nval: 100 }, { broker_code: "AK", bval: 1000 - ritel, nval: -50 }] }],
      };
    },
    async freeFloat(): Promise<FreeFloatEntry[]> {
      dipanggil.push("free-float");
      return [{ symbol: "BBCA", free_float: opsi.ff }];
    },
    async daily(symbol, _start, end): Promise<DailyBar[]> {
      dipanggil.push(`daily:${symbol}`);
      return [
        { date: "2026-07-01", close: 1000 },
        { date: end, close: opsi.jatuh ? 600 : 950 },
      ];
    },
  };
}

describe("statusDari / suspensiAktif", () => {
  it("0 blok hijau, 1 kuning, >= 2 merah, suspensi aktif selalu merah", () => {
    expect(statusDari(0, null)).toBe("hijau");
    expect(statusDari(1, null)).toBe("kuning");
    expect(statusDari(2, null)).toBe("merah");
    expect(statusDari(0, "2026-01-01")).toBe("merah");
  });

  it("suspensi dalam 12 bulan aktif; lebih lama hanya aktif bila delisting/watchlist dengan suspensi >= target", async () => {
    const sril = await fx.events("SRIL");
    expect(suspensiAktif(sril, "2021-06-01")).toBe("2021-05-18");
    expect(suspensiAktif(sril, "2023-01-01")).toBeNull();
    expect(suspensiAktif(sril, "2023-01-01", { symbol: "SRIL", group: "delisting", targetEventDate: "2024-11-01" })).toBeNull();
    expect(suspensiAktif(sril, TODAY, { symbol: "SRIL", group: "delisting", targetEventDate: "2024-11-01" })).toBe("2024-11-01");
    expect(suspensiAktif(await fx.events("BBCA"), TODAY)).toBeNull();
  });
});

describe("cekPortofolio (fixture + penyedia kelas B buatan)", () => {
  it("BBCA: ritel dominan + jatuh dari puncak → merah, alarm 'Jebakan IPO/harga' berbunyi; free float normal tidak terpenuhi", async () => {
    const p = penyedia({ ritel: true, jatuh: true, ff: 0.45 });
    const hasil = await cekPortofolio({
      symbols: ["BBCA"],
      alarms: [...ALARM_BAWAAN],
      opts: { kelasB: true, today: TODAY, source: fx, universe: fx.universe, provider: p, keteranganSumber: "fixture uji" },
    });
    const b = hasil.saham[0];
    expect(b.status).toBe("merah");
    expect(b.alasan.map((a) => a.kind)).toEqual(["ritel_dominan", "jatuh_dari_puncak"]);
    expect(b.alasan.every((a) => a.kelas === "B" && a.tanggal === "2026-09-06")).toBe(true);
    expect(b.alarmBerbunyi).toEqual([{ id: ID_ALARM_JEBAKAN, name: "Jebakan IPO/harga" }]);
    expect(b.kelasB.keterangan).toBe("2 dari 3 blok data terkini terpenuhi");
    expect(b.kelasB.blok.find((x) => x.kind === "free_float_kecil")?.terpenuhi).toBe(false);
    expect(hasil.sumber).toBe("fixture uji");
    expect(hasil.kreditTerpakai).toBe(0); // penyedia tanpa ledger → 0
  });

  it("satu blok kelas B saja → kuning; registry & free float hanya dipanggil sekali untuk banyak saham", async () => {
    const p = penyedia({ ritel: false, jatuh: false, ff: 0.05 });
    const hasil = await cekPortofolio({
      symbols: ["BBCA", "TLKM"],
      alarms: [...ALARM_BAWAAN],
      opts: { kelasB: true, today: TODAY, source: fx, universe: fx.universe, provider: p },
    });
    expect(hasil.saham[0].status).toBe("kuning");
    expect(hasil.saham[0].alasan.map((a) => a.kind)).toEqual(["free_float_kecil"]);
    expect(hasil.saham[1].status).toBe("hijau"); // TLKM tidak ada di snapshot free float
    expect(p.dipanggil.filter((x) => x === "brokers")).toHaveLength(1);
    expect(p.dipanggil.filter((x) => x === "free-float")).toHaveLength(1);
    expect(p.dipanggil.filter((x) => x.startsWith("broker:"))).toHaveLength(2);
  });

  it("kelas A + kelas B digabung; alarm kelas A mati (alarmIds) tidak menghilangkan suspensi aktif", async () => {
    const p = penyedia({ ritel: true, jatuh: false, ff: 0.45 });
    const hanyaB = ALARM_BAWAAN.filter((a) => a.id !== ID_ALARM_PAILIT);
    const hasil = await cekPortofolio({
      symbols: ["WIKA", "SRIL"],
      alarms: hanyaB,
      opts: { kelasB: true, today: TODAY, source: fx, universe: fx.universe, provider: p },
    });
    const wika = hasil.saham[0];
    // WIKA (watchlist, suspensi 2025-02-18 = target) → suspensi aktif → merah, kelas B dilewati.
    expect(wika.suspensiAktif).toBe("2025-02-18");
    expect(wika.status).toBe("merah");
    expect(wika.kelasB.status).toBe("dilewati");
    expect(p.dipanggil.some((x) => x.endsWith(":WIKA"))).toBe(false);
    const sril = hasil.saham[1];
    expect(sril.status).toBe("merah");
    expect(sril.alarmBerbunyi).toEqual([]);
    expect(sril.alasan.map((a) => a.kind)).toEqual(["suspensi"]);
  });

  it("saham tanpa data → catatan jujur, hijau bila tidak ada blok", async () => {
    const hasil = await cekPortofolio({
      symbols: ["ZZZZ"],
      alarms: [...ALARM_BAWAAN],
      opts: { kelasB: false, today: TODAY, source: fx, universe: fx.universe },
    });
    expect(hasil.saham[0].adaData).toBe(false);
    expect(hasil.saham[0].status).toBe("hijau");
    expect(hasil.saham[0].catatan[0]).toMatch(/tidak ada di data kami/);
  });
});
