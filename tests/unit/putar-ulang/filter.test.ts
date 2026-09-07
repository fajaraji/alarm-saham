// Filter slider: batas tanggal inklusif; rentang slider = akhir bulan.
import { describe, expect, it } from "vitest";

import { rentangSlider, sampaiTanggal, setelahTanggal } from "../../../src/lib/putar-ulang/filter";
import type { Kejadian } from "../../../src/lib/putar-ulang/kejadian";

function k(date: string, tingkat: Kejadian["tingkat"] = "warn"): Kejadian {
  return {
    id: `k-${date}`,
    date,
    jenis: "ekuitas_negatif",
    tingkat,
    judul: "x",
    rincian: "y",
    sumber: { nama: "Sectors /uji", url: null },
  };
}

describe("sampaiTanggal / setelahTanggal", () => {
  const daftar = [k("2021-05-17"), k("2021-05-18"), k("2021-05-19")];

  it("kejadian pada tanggal t ikut 'sudah terjadi' (inklusif)", () => {
    expect(sampaiTanggal(daftar, "2021-05-18").map((x) => x.date)).toEqual(["2021-05-17", "2021-05-18"]);
    expect(setelahTanggal(daftar, "2021-05-18").map((x) => x.date)).toEqual(["2021-05-19"]);
  });

  it("sehari sebelum: kejadian belum terjadi; setelah semua: semua aktif", () => {
    expect(sampaiTanggal(daftar, "2021-05-16")).toEqual([]);
    expect(sampaiTanggal(daftar, "2030-01-01")).toHaveLength(3);
    expect(setelahTanggal(daftar, "2030-01-01")).toEqual([]);
  });

  it("gabungan sampai + setelah selalu = seluruh daftar", () => {
    for (const t of ["2020-01-01", "2021-05-18", "2021-05-19", "2026-09-07"]) {
      expect(sampaiTanggal(daftar, t).length + setelahTanggal(daftar, t).length).toBe(daftar.length);
    }
  });
});

describe("rentangSlider", () => {
  it("mulai sebulan sebelum kejadian pertama, berakhir di akhir bulan today, semua akhir bulan", () => {
    const r = rentangSlider([k("2021-05-18"), k("2022-01-10")], "2022-03-15");
    expect(r.awal).toBe("2021-04-30");
    expect(r.akhir).toBe("2022-03-31");
    expect(r.tanggal).toEqual([
      "2021-04-30",
      "2021-05-31",
      "2021-06-30",
      "2021-07-31",
      "2021-08-31",
      "2021-09-30",
      "2021-10-31",
      "2021-11-30",
      "2021-12-31",
      "2022-01-31",
      "2022-02-28",
      "2022-03-31",
    ]);
  });

  it("tanggal tambahan (target_event_date) ikut menentukan batas", () => {
    const r = rentangSlider([k("2021-05-18")], "2021-06-01", ["2019-01-30"]);
    expect(r.awal).toBe("2018-12-31");
  });

  it("tanpa kejadian → 24 bulan terakhir; selalu minimal satu posisi", () => {
    const r = rentangSlider([], "2026-09-07");
    expect(r.awal).toBe("2024-09-30");
    expect(r.akhir).toBe("2026-09-30");
    expect(r.tanggal.length).toBeGreaterThan(0);
  });
});
