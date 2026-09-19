// Ringkasan hasil alat agent untuk layar (DESIGN.md aturan 8 dan 9): kalimat
// biasa, tanggal "6 Sep 2026", tanpa nama mesin blok, tanpa galat mentah.
import { describe, expect, it } from "vitest";

import { BLOCK_KINDS } from "../../../src/lib/engine/rules";
import { RINGKAS_AWAM_GAGAL, ringkasAwamTool } from "../../../src/lib/agent/ringkas-awam";

const NAMA_MESIN = new RegExp(`\\b(${BLOCK_KINDS.join("|")})\\b`);
const ISO = /\d{4}-\d{2}-\d{2}/;

describe("ringkasAwamTool", () => {
  it("setiap alat menjadi satu kalimat biasa dengan tanggal yang dibaca orang", () => {
    const kasus: [string, unknown, string][] = [
      [
        "listMissed",
        { terlewatContoh: [{ symbol: "TELE" }, { symbol: "SRIL" }], jumlahTerlewatSeluruhnya: 8, tertangkap: [{ symbol: "WIKA" }] },
        "8 saham terlewat (mis. TELE, SRIL); 1 tertangkap.",
      ],
      ["getSuspensions", { suspensions: [{ date: "2021-05-18" }, { date: "2024-11-01" }] }, "Disuspensi 2 kali: 18 Mei 2021, 1 Nov 2024."],
      ["getSuspensions", { suspensions: [] }, "Tidak pernah disuspensi menurut data kami."],
      ["getReportDates", { jumlah: 20, kuartalPertama: "2020-03-31", kuartalTerakhir: "2024-12-31" }, "20 laporan kuartal, yang terakhir untuk periode 31 Des 2024."],
      ["getFilings", { filings: [{ transactionType: "sell" }, { transactionType: "buy" }] }, "2 laporan transaksi orang dalam, 1 di antaranya penjualan."],
      ["getCorporateActions", { rightIssues: [{ exDate: "2020-03-03" }] }, "1 rights issue: 3 Mar 2020."],
      ["getFinancials", { financials: [{ date: "2019-12-31", totalEquity: -1.1e12 }] }, "Ekuitas per 31 Des 2019: minus Rp1,1 triliun."],
      [
        "runAlarmOn",
        { symbol: "TELE", t: "2024-06-30", aturan: "x", fired: true, reasons: [{ kind: "laporan_hilang", detail: "laporan 2023 q4 ..." }] },
        "Alarm berbunyi: laporan keuangan hilang/berhenti.",
      ],
      ["runAlarmOn", { symbol: "BBCA", t: "2024-06-30", aturan: "x", fired: false, reasons: [] }, "Alarm diam pada tanggal itu."],
    ];
    for (const [alat, keluaran, harap] of kasus) {
      const k = ringkasAwamTool(alat, keluaran);
      expect(k, alat).toBe(harap);
      expect(k, alat).not.toMatch(NAMA_MESIN);
      expect(k, alat).not.toMatch(ISO);
    }
  });

  it("alat tak dikenal atau keluaran kosong tidak menghasilkan teks apa pun", () => {
    expect(ringkasAwamTool("alatBaru", { apa: 1 })).toBe("");
    expect(ringkasAwamTool("getSuspensions", null)).toBe("");
  });

  it("kalimat untuk alat yang gagal tidak memuat galat mentah", () => {
    expect(RINGKAS_AWAM_GAGAL).not.toMatch(/GALAT|Error|timeout/i);
  });
});
