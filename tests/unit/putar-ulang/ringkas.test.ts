// Ringkasan "sampai tanggal ini sudah ada N tanda" dan kotak pelajaran berbasis fakta.
import { describe, expect, it } from "vitest";

import type { Kejadian } from "../../../src/lib/putar-ulang/kejadian";
import { fmtTanggal, pelajaran, ringkasSampai } from "../../../src/lib/putar-ulang/ringkas";

function k(date: string, tingkat: Kejadian["tingkat"], jenis: Kejadian["jenis"] = "ekuitas_negatif"): Kejadian {
  return { id: `${jenis}-${date}`, date, jenis, tingkat, judul: "Ekuitas negatif", rincian: "", sumber: { nama: "Sectors /x", url: null } };
}

describe("fmtTanggal", () => {
  it("menulis tanggal dalam Bahasa Indonesia", () => {
    expect(fmtTanggal("2021-05-18")).toBe("18 Mei 2021");
    expect(fmtTanggal("2026-11-10")).toBe("10 Nov 2026");
  });
});

describe("ringkasSampai", () => {
  const daftar = [k("2020-03-31", "info", "laporan_tersedia"), k("2021-05-18", "crit", "suspensi"), k("2022-12-31", "warn")];
  it("menghitung tanda saja (bukan info), batas inklusif", () => {
    expect(ringkasSampai(daftar, "2021-05-17")).toMatchObject({ jumlah: 0 });
    expect(ringkasSampai(daftar, "2021-05-18")).toMatchObject({ jumlah: 1, teks: "Sampai 18 Mei 2021, sudah ada 1 tanda." });
    expect(ringkasSampai(daftar, "2023-01-01").jumlah).toBe(2);
  });
});

describe("pelajaran", () => {
  it("tanda pertama sebelum target → 'N bulan sebelum'", () => {
    const baris = pelajaran({
      symbol: "UJIA",
      group: "delisting",
      targetEventDate: "2025-06-06",
      kejadian: [k("2023-09-30", "warn")],
    });
    expect(baris[0]).toBe("Tanda pertama muncul 30 Sep 2023: ekuitas negatif.");
    expect(baris[1]).toContain("20 bulan sebelum 6 Jun 2025");
  });

  it("tanda pertama setelah target → jujur bahwa tidak ada tanda lebih awal", () => {
    const baris = pelajaran({
      symbol: "UJIA",
      group: "delisting",
      targetEventDate: "2021-05-18",
      kejadian: [k("2022-12-31", "warn")],
    });
    expect(baris[1]).toContain("tidak ada tanda sebelum tanggal itu");
    expect(baris[1]).toContain("19 bulan lebih awal");
  });

  it("tanpa tanda dan tanpa kata terlarang", () => {
    const baris = pelajaran({ symbol: "UJIB", group: null, targetEventDate: null, kejadian: [k("2020-03-31", "info", "laporan_tersedia")] });
    expect(baris[0]).toContain("Tidak ada tanda untuk UJIB");
    expect(baris.join(" ")).not.toMatch(/berbahaya|gorengan|akan pailit/i);
  });
});
