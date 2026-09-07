// Bendera kotak masuk (murni): status memburuk atau alarm baru berbunyi.
import { describe, expect, it } from "vitest";

import type { HasilPortofolio, HasilSaham } from "../../../src/lib/jaga/evaluasi";
import { turunkanBendera } from "../../../src/lib/jaga/simpan";

function saham(symbol: string, status: HasilSaham["status"], alarm: string[] = []): HasilSaham {
  return {
    symbol,
    status,
    adaData: true,
    suspensiAktif: null,
    alasan: [],
    alarmBerbunyi: alarm.map((a) => ({ id: a, name: a })),
    kelasB: { status: "nonaktif", keterangan: "", blok: [] },
    catatan: [],
  };
}

function hasil(...s: HasilSaham[]): HasilPortofolio {
  return { today: "2026-09-07", sumber: "db", saham: s, kreditTerpakai: 0, panggilanApi: 0, cacheHit: 0 };
}

describe("turunkanBendera", () => {
  it("cek pertama: hanya saham kuning/merah jadi bendera, teks dari penjelasan", () => {
    const b = turunkanBendera(null, hasil(saham("BBCA", "hijau"), saham("SRIL", "merah", ["pailit"])), [
      { symbol: "SRIL", teks: "SRIL — alarm berbunyi …", olehAi: false, perluTinjau: false },
    ], "2026-09-07T01:00:00Z");
    expect(b.map((x) => x.symbol)).toEqual(["SRIL"]);
    expect(b[0].judul).toBe("SRIL: alarm “pailit” berbunyi");
    expect(b[0].teks).toMatch(/^SRIL/);
    expect(b[0].baru).toBe(true);
  });

  it("cek berikutnya: memburuk atau alarm baru → bendera; membaik/tetap → tidak", () => {
    const sebelum = hasil(saham("AAAA", "hijau"), saham("BBBB", "merah", ["x"]), saham("CCCC", "kuning"), saham("DDDD", "merah"));
    const sesudah = hasil(
      saham("AAAA", "kuning"), // memburuk
      saham("BBBB", "merah", ["x", "y"]), // alarm baru
      saham("CCCC", "hijau"), // membaik
      saham("DDDD", "merah"), // tetap
      saham("EEEE", "hijau"), // baru & hijau
    );
    const b = turunkanBendera(sebelum, sesudah, [], "2026-09-08T01:00:00Z");
    expect(b.map((x) => x.symbol)).toEqual(["AAAA", "BBBB"]);
    expect(b[0].judul).toBe("AAAA: status hijau → kuning");
    expect(b[1].judul).toBe("BBBB: alarm “y” berbunyi");
  });
});
