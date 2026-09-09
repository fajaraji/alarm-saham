// Pesan penjelasan: template deterministik (syarat + tanggal + sumber +
// disclaimer) dan jalur AI tiruan yang disensor. Tidak boleh ada kata rekomendasi.
import { describe, expect, it } from "vitest";

import { sensorTeks } from "../../../src/lib/agent/guard";
import { DISCLAIMER } from "../../../src/lib/agent/instructions";
import type { HasilSaham } from "../../../src/lib/jaga/evaluasi";
import { penjelasanSaham, templatePenjelasan } from "../../../src/lib/jaga/penjelasan";
import { langkahTeks, modelTiruan } from "../agent/mock-model";

const MERAH: HasilSaham = {
  symbol: "SRIL",
  status: "merah",
  adaData: true,
  suspensiAktif: "2021-05-18",
  alasan: [
    {
      kind: "laporan_hilang",
      kelas: "A",
      label: "Laporan keuangan hilang/berhenti",
      threshold: "longgar",
      detail: "laporan 2024 q4 (akhir 2024-12-31) belum tersedia 120 hari setelahnya (+5 kuartal lain)",
      tanggal: "2024-12-31",
      sumber: "Sectors /v2/company/get_quarterly_financial_dates/ (di DB kami)",
      alarm: [{ id: "a1", name: "Saham mau pailit" }],
    },
    {
      kind: "insider_jual",
      kelas: "A",
      label: "Orang dalam menjual",
      threshold: "longgar",
      detail: "2 filing jual oleh insider/institusi dalam 180 hari sebelum 2026-09-07",
      tanggal: "2026-09-07",
      sumber: "Sectors /v2/filings/ (di DB kami)",
      alarm: [],
    },
    {
      kind: "ritel_dominan",
      kelas: "B",
      label: "Ritel dominan, institusi melepas",
      detail: "broker ritel 88% dari nilai pembelian 2026-08-24–2026-09-06 (9 hari bursa); broker asing/institusi net melepas -Rp 1.2 M",
      tanggal: "2026-09-06",
      sumber: "Sectors /v2/broker-summary/ (14 hari) + /v2/brokers/ (cohort)",
      alarm: [{ id: "b1", name: "Jebakan IPO/harga" }],
    },
  ],
  alarmBerbunyi: [
    { id: "a1", name: "Saham mau pailit" },
    { id: "b1", name: "Jebakan IPO/harga" },
  ],
  kelasB: {
    status: "dijalankan",
    keterangan: "1 dari 2 blok data terkini terpenuhi",
    blok: [
      { kind: "ritel_dominan", terpenuhi: true, detail: "…", tanggal: "2026-09-06", sumber: "x" },
      { kind: "jatuh_dari_puncak", terpenuhi: false, detail: "penutupan 2026-09-06 = 146 vs tertinggi 90 hari 152 (2026-07-01), turun 4% (ambang >= 30%)", tanggal: "2026-09-06", sumber: "y" },
    ],
  },
  catatan: [],
};

const HIJAU: HasilSaham = {
  symbol: "BBCA",
  status: "hijau",
  adaData: true,
  suspensiAktif: null,
  alasan: [],
  alarmBerbunyi: [],
  kelasB: { status: "dilewati", keterangan: "dilewati: cadangan kredit", blok: [] },
  catatan: [],
};

const TERLARANG = /\b(beli|jual|rekomendasi|buy|sell|hold)\b/i;

describe("templatePenjelasan", () => {
  it("merah: menyebut jumlah syarat, tiap blok + tanggal + sumber, alarm yang berbunyi, suspensi, dan disclaimer", () => {
    const t = templatePenjelasan(MERAH, "2026-09-07");
    expect(t).toMatch(/^SRIL — alarm berbunyi: 3 syarat terpenuhi pada 7 Sep 2026/);
    expect(t).toContain("(1) Laporan keuangan hilang/berhenti");
    expect(t).toContain("[tanggal 2024-12-31]");
    expect(t).toContain("[sumber: Sectors /v2/company/get_quarterly_financial_dates/ (di DB kami)]");
    expect(t).toContain("(3) Ritel dominan, institusi melepas");
    expect(t).toContain("Alarm yang berbunyi: “Saham mau pailit”, “Jebakan IPO/harga”.");
    expect(t).toContain("masih tersuspensi menurut data kami (sejak 18 Mei 2021)");
    expect(t).toContain("tidak terpenuhi: jatuh_dari_puncak");
    expect(t.endsWith(DISCLAIMER)).toBe(true);
  });

  it("hijau: tidak ada syarat, keterangan kelas B dilewati, disclaimer", () => {
    const t = templatePenjelasan(HIJAU, "2026-09-07");
    expect(t).toContain("BBCA — aman menurut alarmmu: tidak ada satu pun syarat yang terpenuhi pada 7 Sep 2026.");
    expect(t).toContain("Data terkini dilewati: cadangan kredit.");
    expect(t.endsWith(DISCLAIMER)).toBe(true);
  });

  it("tidak memuat kata rekomendasi (beli/jual/rekomendasi) — frasa faktual 'filing jual' dilindungi guard", () => {
    for (const h of [MERAH, HIJAU]) {
      const t = templatePenjelasan(h, "2026-09-07");
      // Template deterministik ini juga jadi bahan rapian model: kalau penyaring
      // subjek-pasar sampai memakan satu klausanya, keluaran AI yang setia pada
      // template akan selalu ditolak. Jadi bukan cuma `kata` yang harus kosong.
      expect(sensorTeks(t)).toEqual({ teks: t, kata: [], kalimatDibuang: 0, kalimatRagu: 0 });
      expect(t).not.toMatch(/rekomendasi/i);
      // Selain frasa faktual dari mesin ("filing jual"), tidak ada kata jual/beli lepas.
      expect(t.replace(/filing jual/g, "")).not.toMatch(TERLARANG);
    }
  });
});

describe("penjelasanSaham", () => {
  it("tanpa AI (pakaiAi=false) → template apa adanya", async () => {
    const p = await penjelasanSaham(HIJAU, { today: "2026-09-07", pakaiAi: false });
    expect(p.olehAi).toBe(false);
    expect(p.teks).toBe(templatePenjelasan(HIJAU, "2026-09-07"));
  });

  it("keluaran model yang memuat kata terlarang DIBUANG: kembali ke template, ditandai perluTinjau", async () => {
    const model = modelTiruan([
      {
        content: [{ type: "text", text: "SRIL alarm berbunyi karena laporan hilang sejak 2024-12-31. Sebaiknya jual sekarang." }],
        finishReason: { unified: "stop", raw: undefined },
        usage: { inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: undefined }, outputTokens: { total: 1, text: 1, reasoning: undefined } },
        warnings: [],
      },
    ]);
    const p = await penjelasanSaham(MERAH, { today: "2026-09-07", model });
    // Pesan ini dikirim ke kotak masuk & Telegram pengguna: teks model yang
    // sempat memakai kata rekomendasi tidak dipakai sama sekali (bukan sekadar
    // disensor), supaya tidak ada sisa bingkai anjuran yang lolos.
    expect(p.olehAi).toBe(false);
    expect(p.perluTinjau).toBe(true);
    expect(p.teks).toBe(templatePenjelasan(MERAH, "2026-09-07"));
    // "filing jual" adalah nama jenis laporan resmi di feed Sectors (dilindungi guard).
    expect(p.teks.replace(/filing jual/g, "")).not.toMatch(/\bjual\b/);
    expect(p.teks).not.toContain("[dihapus]");
    expect(p.teks.endsWith(DISCLAIMER)).toBe(true);
  });

  it("keluaran model beranjuran TANPA kata terlarang juga dibuang (keberatan 5)", async () => {
    // Kalimat ini tidak memuat satu pun kata terlarang (beli/jual/hold/…), jadi
    // sebelum perbaikan tiket 15 ia lolos utuh ke kotak masuk & Telegram dengan
    // perluTinjau = false. Sekarang penyaring membuang kalimatnya, dan
    // pembuangan itu cukup untuk menolak seluruh teks model.
    const model = modelTiruan([
      {
        content: [
          {
            type: "text",
            text: "SRIL alarm berbunyi karena laporan hilang sejak 2024-12-31. Sebaiknya kamu kurangi eksposur di saham ini.",
          },
        ],
        finishReason: { unified: "stop", raw: undefined },
        usage: { inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: undefined }, outputTokens: { total: 1, text: 1, reasoning: undefined } },
        warnings: [],
      },
    ]);
    const p = await penjelasanSaham(MERAH, { today: "2026-09-07", model });
    expect(p.olehAi).toBe(false);
    expect(p.perluTinjau).toBe(true);
    expect(p.teks).toBe(templatePenjelasan(MERAH, "2026-09-07"));
    expect(p.teks).not.toMatch(/sebaiknya/i);
    expect(p.teks).not.toContain("[kalimat saran dihapus]");
  });

  it("model tiruan menjawab kosong → kembali ke template", async () => {
    const p = await penjelasanSaham(HIJAU, { today: "2026-09-07", model: modelTiruan([langkahTeks("")]) });
    // langkahTeks("") mengirim teks '""' (JSON) — bukan kosong; pakai model yang benar-benar kosong:
    expect(p.olehAi).toBe(true);
    const kosong = modelTiruan([
      {
        content: [{ type: "text", text: "   " }],
        finishReason: { unified: "stop", raw: undefined },
        usage: { inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: undefined }, outputTokens: { total: 0, text: 0, reasoning: undefined } },
        warnings: [],
      },
    ]);
    const q = await penjelasanSaham(HIJAU, { today: "2026-09-07", model: kosong });
    expect(q.olehAi).toBe(false);
    expect(q.teks).toBe(templatePenjelasan(HIJAU, "2026-09-07"));
  });
});
