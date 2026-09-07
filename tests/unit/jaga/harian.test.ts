// Bagian murni cron harian (tiket 12): bendera baru vs run terakhir, susunan
// pesan Telegram (disclaimer di setiap potongan), tanggal WIB, gabung kotak masuk.
import { describe, expect, it } from "vitest";

import { DISCLAIMER } from "../../../src/lib/agent/instructions";
import type { HasilPortofolio, HasilSaham } from "../../../src/lib/jaga/evaluasi";
import { benderaBaru, tanggalWib } from "../../../src/lib/jaga/harian";
import { MAKS_PANJANG_PESAN, susunPesanTelegram, type BenderaBaru } from "../../../src/lib/jaga/pengirim";
import type { RingkasanJaga } from "../../../src/lib/jaga/portofolio";
import { gabungKotakMasuk, MAKS_KOTAK_MASUK, type PesanKotakMasuk } from "../../../src/lib/jaga/simpan";

function saham(symbol: string, status: HasilSaham["status"], alarm: string[] = []): HasilSaham {
  return {
    symbol,
    status,
    adaData: true,
    suspensiAktif: null,
    alasan: [],
    alarmBerbunyi: alarm.map((name, i) => ({ id: `id-${i}`, name })),
    kelasB: { status: "nonaktif", keterangan: "", blok: [] },
    catatan: [],
  };
}

function hasil(...s: HasilSaham[]): HasilPortofolio {
  return { today: "2026-09-07", sumber: "uji", saham: s, kreditTerpakai: 0, panggilanApi: 0, cacheHit: 0 };
}

const penjelasan = (symbols: string[]) => symbols.map((symbol) => ({ symbol, teks: `${symbol} penjelasan. ${DISCLAIMER}`, olehAi: false, perluTinjau: false }));

describe("benderaBaru", () => {
  it("run pertama: semua kuning/merah jadi bendera, hijau tidak", () => {
    const b = benderaBaru(null, hasil(saham("SRIL", "merah", ["Saham mau pailit"]), saham("BBCA", "hijau")), penjelasan(["SRIL", "BBCA"]));
    expect(b.map((x) => x.symbol)).toEqual(["SRIL"]);
    expect(b[0].judul).toContain("Saham mau pailit");
    expect(b[0].teks).toContain(DISCLAIMER);
  });

  it("hasil sama dengan run terakhir → tidak ada bendera (idempoten)", () => {
    const sebelum: RingkasanJaga[] = [{ symbol: "SRIL", status: "merah", blok: ["suspensi"], alarm: ["Saham mau pailit"] }];
    expect(benderaBaru(sebelum, hasil(saham("SRIL", "merah", ["Saham mau pailit"])), penjelasan(["SRIL"]))).toEqual([]);
  });

  it("memburuk (hijau → kuning) atau alarm baru berbunyi → bendera; membaik → tidak", () => {
    const sebelum: RingkasanJaga[] = [
      { symbol: "AAAA", status: "hijau", blok: [], alarm: [] },
      { symbol: "BBBB", status: "kuning", blok: ["laporan_hilang"], alarm: [] },
      { symbol: "CCCC", status: "merah", blok: ["suspensi"], alarm: ["Saham mau pailit"] },
    ];
    const b = benderaBaru(
      sebelum,
      hasil(saham("AAAA", "kuning"), saham("BBBB", "kuning", ["Alarm baru"]), saham("CCCC", "kuning")),
      penjelasan(["AAAA", "BBBB", "CCCC"]),
    );
    expect(b.map((x) => x.symbol)).toEqual(["AAAA", "BBBB"]);
    expect(b[0].judul).toBe("AAAA: status hijau → kuning");
    expect(b[1].judul).toContain("“Alarm baru”");
  });

  it("saham baru ditambahkan setelah run terakhir: dinilai seperti run pertama", () => {
    const sebelum: RingkasanJaga[] = [{ symbol: "AAAA", status: "hijau", blok: [], alarm: [] }];
    const b = benderaBaru(sebelum, hasil(saham("AAAA", "hijau"), saham("ZZZZ", "merah")), penjelasan(["AAAA", "ZZZZ"]));
    expect(b.map((x) => x.symbol)).toEqual(["ZZZZ"]);
    expect(b[0].judul).toBe("ZZZZ: status merah");
  });
});

describe("susunPesanTelegram", () => {
  const dasar = { owner: "o", portfolioId: "p", runId: null, today: "2026-09-07" };

  it("satu pesan berisi judul, penjelasan, dan disclaimer tepat sekali di akhir", () => {
    const bendera: BenderaBaru[] = [{ symbol: "SRIL", status: "merah", judul: "SRIL: alarm berbunyi", teks: `SRIL tersuspensi. ${DISCLAIMER}` }];
    const pesan = susunPesanTelegram({ ...dasar, bendera });
    expect(pesan).toHaveLength(1);
    expect(pesan[0]).toContain("7 Sep 2026");
    expect(pesan[0]).toContain("SRIL: alarm berbunyi");
    expect(pesan[0]).toContain("SRIL tersuspensi.");
    expect(pesan[0].split(DISCLAIMER)).toHaveLength(2);
    expect(pesan[0].trimEnd().endsWith(DISCLAIMER)).toBe(true);
  });

  it("pesan panjang dipecah di bawah batas Telegram; setiap potongan ditutup disclaimer", () => {
    const bendera: BenderaBaru[] = Array.from({ length: 12 }, (_, i) => ({
      symbol: `S${i}`,
      status: "kuning" as const,
      judul: `S${i}: status kuning`,
      teks: `${"x".repeat(600)} ${DISCLAIMER}`,
    }));
    const pesan = susunPesanTelegram({ ...dasar, bendera });
    expect(pesan.length).toBeGreaterThan(1);
    for (const p of pesan) {
      expect(p.length).toBeLessThan(4096);
      expect(p.length).toBeLessThanOrEqual(MAKS_PANJANG_PESAN + 700 + DISCLAIMER.length + 2);
      expect(p.trimEnd().endsWith(DISCLAIMER)).toBe(true);
    }
    expect(pesan.join("\n")).toContain("S11: status kuning");
  });
});

describe("tanggalWib", () => {
  it("23:30 UTC = 06:30 WIB hari berikutnya (jadwal cron 30 23 * * *)", () => {
    expect(tanggalWib(new Date("2026-09-06T23:30:00Z"))).toBe("2026-09-07");
    expect(tanggalWib(new Date("2026-09-07T10:00:00Z"))).toBe("2026-09-07");
    expect(tanggalWib(new Date("2026-09-07T16:59:59Z"))).toBe("2026-09-07");
    expect(tanggalWib(new Date("2026-09-07T17:00:00Z"))).toBe("2026-09-08");
  });
});

describe("gabungKotakMasuk", () => {
  const pesan = (id: string, waktu: string, baru = true): PesanKotakMasuk => ({ id, waktu, symbol: "SRIL", status: "merah", judul: id, teks: "", baru });

  it("unik per id (server menang), terbaru dulu, dipotong MAKS", () => {
    const lokal = [pesan("a", "2026-09-01T00:00:00Z"), pesan("b", "2026-09-03T00:00:00Z", true)];
    const server = [pesan("b", "2026-09-03T00:00:00Z", false), pesan("c", "2026-09-02T00:00:00Z")];
    const g = gabungKotakMasuk(server, lokal);
    expect(g.map((p) => p.id)).toEqual(["b", "c", "a"]);
    expect(g[0].baru).toBe(false);
    const banyak = Array.from({ length: MAKS_KOTAK_MASUK + 10 }, (_, i) => pesan(`x${i}`, `2026-01-${String((i % 28) + 1).padStart(2, "0")}T00:00:00Z`));
    expect(gabungKotakMasuk(banyak, [])).toHaveLength(MAKS_KOTAK_MASUK);
  });
});
