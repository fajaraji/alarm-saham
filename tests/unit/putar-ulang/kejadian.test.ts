// Turunan garis waktu: laporan hilang dari daftar kuartal, sumber per kejadian.
import { describe, expect, it } from "vitest";

import { kosong, type EmitenEvents } from "../../../src/lib/engine/events";
import {
  hanyaTanda,
  turunkanKejadian,
  turunkanLaporanHilang,
} from "../../../src/lib/putar-ulang/kejadian";

function kuartal(...akhir: string[]): EmitenEvents["quarters"] {
  return akhir.map((periodEnd) => ({
    periodEnd,
    fiscalYear: Number(periodEnd.slice(0, 4)),
    quarter: `q${Math.ceil(Number(periodEnd.slice(5, 7)) / 3)}`,
  }));
}

describe("turunkanLaporanHilang", () => {
  it("tanpa kuartal sama sekali → tidak bisa dinilai (kosong)", () => {
    expect(turunkanLaporanHilang([], "2026-09-07")).toEqual([]);
  });

  it("kuartal lengkap sampai tenggat → kosong; lewat tenggat → hilang pada akhir+120 hari", () => {
    const q = kuartal("2024-03-31", "2024-06-30", "2024-09-30");
    // 2024-12-31 + 120 hari = 2025-04-30; sehari sebelumnya belum hilang.
    expect(turunkanLaporanHilang(q, "2025-04-29")).toEqual([]);
    const h = turunkanLaporanHilang(q, "2025-04-30");
    expect(h).toHaveLength(1);
    expect(h[0]).toMatchObject({ periodEnd: "2024-12-31", fiscalYear: 2024, quarter: "q4", date: "2025-04-30", berturut: 1 });
  });

  it("deretan kuartal hilang setelah kuartal terakhir dinomori berturut; celah di tengah tidak", () => {
    const q = kuartal("2023-12-31", "2024-03-31", "2024-06-30", "2024-12-31");
    const h = turunkanLaporanHilang(q, "2026-09-07");
    expect(h.map((x) => [x.periodEnd, x.berturut])).toEqual([
      ["2024-09-30", null], // celah di tengah (kasus AADI)
      ["2025-03-31", 1],
      ["2025-06-30", 2],
      ["2025-09-30", 3],
      ["2025-12-31", 4],
      ["2026-03-31", 5],
    ]);
    // 2026-06-30 + 120 = 2026-10-28 > today → belum hilang.
    expect(h.some((x) => x.periodEnd === "2026-06-30")).toBe(false);
  });

  it("tenggat ketat 180 hari menggeser tanggal", () => {
    const h = turunkanLaporanHilang(kuartal("2024-09-30"), "2026-01-01", 180);
    expect(h[0]).toMatchObject({ periodEnd: "2024-12-31", date: "2025-06-29" });
  });
});

describe("turunkanKejadian", () => {
  const events: EmitenEvents = {
    ...kosong("UJIA"),
    suspensions: [{ date: "2021-05-18", reason: "Suspend more than 6 month" }],
    quarters: kuartal("2020-03-31", "2020-06-30"),
    rightIssues: [{ exDate: "2020-04-17", newRatio: 5, oldRatio: 1 }],
    financials: [
      { date: "2020-03-31", totalEquity: 1e12 },
      { date: "2020-06-30", totalEquity: -2.5e12 },
    ],
    filings: [
      { date: "2024-02-01", holderType: "insider", transactionType: "sell", sharePctBefore: 5, sharePctAfter: 4 },
      { date: "2024-02-02", holderType: "insider", transactionType: "buy", sharePctBefore: 4, sharePctAfter: 5 },
      { date: "2024-02-03", holderType: "corporate-investor", transactionType: "sell", sharePctBefore: 1, sharePctAfter: 0 },
    ],
  };
  const k = turunkanKejadian({
    events,
    pdfUrl: { "2021-05-18": "https://www.idx.co.id/x.pdf" },
    today: "2021-06-30",
  });

  it("urut naik menurut tanggal dan setiap kejadian punya sumber", () => {
    const tanggal = k.map((x) => x.date);
    expect(tanggal).toEqual([...tanggal].sort());
    for (const x of k) expect(x.sumber.nama).toMatch(/^Sectors \//);
  });

  it("suspensi memuat alasan resmi dan tautan PDF BEI", () => {
    const s = k.find((x) => x.jenis === "suspensi")!;
    expect(s.tingkat).toBe("crit");
    expect(s.rincian).toContain("Suspend more than 6 month");
    expect(s.sumber.url).toBe("https://www.idx.co.id/x.pdf");
  });

  it("laporan hilang diturunkan: 2020-09-30 + 120 hari = 2021-01-28, 2020-12-31 → 2021-04-30", () => {
    expect(k.filter((x) => x.jenis === "laporan_hilang").map((x) => x.date)).toEqual(["2021-01-28", "2021-04-30"]);
  });

  it("hanya ekuitas negatif, hanya filing jual insider/institusi, rights issue dengan rasio", () => {
    expect(k.filter((x) => x.jenis === "ekuitas_negatif").map((x) => x.date)).toEqual(["2020-06-30"]);
    const fil = k.filter((x) => x.jenis === "insider_jual");
    expect(fil.map((x) => x.date)).toEqual(["2024-02-01"]);
    expect(fil[0].rincian).not.toMatch(/nama pemegang: /i);
    const ri = k.find((x) => x.jenis === "rights_issue")!;
    expect(ri.rincian).toContain("5×");
  });

  it("hanyaTanda membuang catatan laporan tersedia", () => {
    expect(k.filter((x) => x.jenis === "laporan_tersedia")).toHaveLength(2);
    expect(hanyaTanda(k).every((x) => x.tingkat !== "info")).toBe(true);
    expect(hanyaTanda(k)).toHaveLength(k.length - 2);
  });

  it("kalimat tidak memuat kata penilaian terlarang", () => {
    const teks = k.map((x) => `${x.judul} ${x.rincian}`).join(" ");
    expect(teks).not.toMatch(/berbahaya|gorengan|akan pailit/i);
  });
});
