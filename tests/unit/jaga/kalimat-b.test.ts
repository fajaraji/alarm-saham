// Kalimat biasa hasil data terkini (tiket 26). Semua masukan dibuat dari
// evaluator murni blok-b.ts dengan data tiruan: nol panggilan Sectors, nol kredit.
import { describe, expect, it } from "vitest";

import type { BrokerSummary, DailyBar } from "../../../src/lib/data/types";
import {
  BLOK_B_KINDS,
  nilaiFreeFloat,
  nilaiJatuhDariPuncak,
  nilaiRitelDominan,
  petaCohort,
  type HasilBlokB,
} from "../../../src/lib/jaga/blok-b";
import { dilewatiKarenaServer, JUDUL_TEMUAN_B, kalimatBlokB, kalimatDilewati, rupiahAwam } from "../../../src/lib/jaga/kalimat-b";

const NAMA_MESIN = new RegExp(BLOK_B_KINDS.join("|"));

const cohort = petaCohort([
  { code: "YP", cohort: "retail", is_foreign: false },
  { code: "PD", cohort: "retail", is_foreign: false },
  { code: "AK", cohort: "institutional", is_foreign: true },
] as never);

function ringkas(baris: { broker_code: string; bval: number; nval: number }[][], mulai = 24): BrokerSummary {
  return {
    start: `2026-08-${mulai}`,
    end: "2026-09-06",
    data: baris.map((summary, i) => ({ date: `2026-08-${mulai + i}`, summary })),
  } as never;
}

function bar(date: string, close: number): DailyBar {
  return { date, close } as DailyBar;
}

describe("kalimatBlokB", () => {
  it("ritel dominan terpenuhi: porsi ritel, arah institusi, rentang tanggal, lalu kesimpulannya", () => {
    const b = nilaiRitelDominan(
      ringkas([
        [
          { broker_code: "YP", bval: 8e9, nval: 2e9 },
          { broker_code: "AK", bval: 1e9, nval: -3.1e9 },
        ],
        [{ broker_code: "PD", bval: 1e9, nval: 5e8 }],
      ]),
      cohort,
    );
    expect(b.terpenuhi).toBe(true);
    const k = kalimatBlokB(b);
    // Satu kalimat: "terpenuhi" dikatakan lencana di layar, bukan kalimat kedua.
    expect(k).toBe(
      "Dalam 2 hari bursa (24 Agu 2026 sampai 25 Agu 2026), 90% nilai pembelian datang dari broker ritel, sementara broker asing dan institusi melepas bersih Rp3,1 miliar.",
    );
  });

  it("ritel dominan tidak terpenuhi: angkanya tetap disebut, dalam satu kalimat", () => {
    const b = nilaiRitelDominan(
      ringkas([
        [
          { broker_code: "YP", bval: 4e9, nval: 1e9 },
          { broker_code: "AK", bval: 6e9, nval: 2.5e9 },
        ],
      ]),
      cohort,
    );
    expect(b.terpenuhi).toBe(false);
    const k = kalimatBlokB(b);
    expect(k).toContain("40% nilai pembelian datang dari broker ritel");
    expect(k).toContain("menambah bersih Rp2,5 miliar");
    expect(k.match(/\./g)?.length).toBe(1);
  });

  it("jatuh dari puncak: persen di bawah harga tertinggi 90 hari, berikut harga dan tanggalnya", () => {
    const b = nilaiJatuhDariPuncak([bar("2026-07-01", 1000), bar("2026-08-01", 800), bar("2026-09-05", 650)]);
    expect(b.terpenuhi).toBe(true);
    expect(kalimatBlokB(b)).toBe(
      "Harga penutupan terakhir (Rp650 pada 5 Sep 2026) 35% di bawah harga tertinggi 90 hari (Rp1.000 pada 1 Jul 2026).",
    );
    const naik = nilaiJatuhDariPuncak([bar("2026-07-01", 900), bar("2026-09-05", 1000)]);
    expect(kalimatBlokB(naik)).toBe("Harga penutupan terakhir (Rp1.000 pada 5 Sep 2026) adalah yang tertinggi dalam 90 hari.");
  });

  it("temuan tanpa angka (data kosong, gagal, dilewati) tetap jadi kalimat biasa", () => {
    const kosong: HasilBlokB[] = [
      nilaiRitelDominan(ringkas([[]]), cohort),
      nilaiRitelDominan(ringkas([[{ broker_code: "ZZ", bval: 1, nval: 1 }]]), cohort),
      nilaiJatuhDariPuncak([]),
      nilaiFreeFloat(undefined, null),
      { kind: "ritel_dominan", terpenuhi: false, detail: "dilewati: cadangan kredit", tanggal: null, sumber: "x" },
      { kind: "ritel_dominan", terpenuhi: false, detail: "tidak ada data di Sectors (404)", tanggal: null, sumber: "x" },
      { kind: "jatuh_dari_puncak", terpenuhi: false, detail: "gagal: Sectors HTTP 502", tanggal: null, sumber: "x" },
      { kind: "jatuh_dari_puncak", terpenuhi: false, detail: "gagal: kesalahan tak terduga di server", tanggal: null, sumber: "x" },
    ];
    const kalimat = kosong.map(kalimatBlokB);
    expect(kalimat).toEqual([
      "Tidak ada transaksi broker dalam 14 hari terakhir.",
      "Porsi pembeli ritel tidak bisa dihitung: brokernya tidak ada di daftar Sectors.",
      "Tidak ada harga penutupan dalam 90 hari terakhir.",
      "Saham ini tidak ada di data saham beredar Sectors.",
      "Tidak dicek: kredit Sectors tim tinggal cadangan.",
      "Sectors tidak punya data ini untuk saham ini.",
      "Data ini gagal diambil dari Sectors. Coba cek lagi nanti.",
      "Data ini gagal diambil karena kesalahan di server kami. Coba cek lagi nanti.",
    ]);
    for (const k of kalimat) expect(k).not.toMatch(/404|HTTP|registry|cohort/);
  });

  it("tidak satu pun kalimat atau judul memuat nama mesin blok", () => {
    const semua = [
      nilaiRitelDominan(ringkas([[{ broker_code: "YP", bval: 1e9, nval: 1e8 }]]), cohort),
      nilaiJatuhDariPuncak([bar("2026-07-01", 100), bar("2026-09-05", 90)]),
      nilaiFreeFloat({ symbol: "A", free_float: 0.1 } as never, "2026-09-06"),
    ];
    for (const b of semua) expect(kalimatBlokB(b)).not.toMatch(NAMA_MESIN);
    for (const j of Object.values(JUDUL_TEMUAN_B)) expect(j).not.toMatch(NAMA_MESIN);
  });
});

describe("kalimatDilewati", () => {
  it("saham yang dilewati menyebut alasannya dalam satu kalimat", () => {
    expect(kalimatDilewati({ status: "dilewati", keterangan: "dilewati: saham ini disuspensi", blok: [] })).toBe(
      "Data terkini tidak ditarik karena saham ini disuspensi.",
    );
    expect(kalimatDilewati({ status: "dilewati", keterangan: "dilewati: cadangan kredit", blok: [] })).toBe(
      "Data terkini tidak ditarik karena kredit Sectors tim tinggal cadangan.",
    );
  });

  it("alasan yang berlaku untuk seluruh server tidak ditulis per saham", () => {
    const server = {
      status: "dilewati" as const,
      keterangan: "dilewati: server ini belum bisa menarik data terkini (butuh kunci Sectors dan database pencatat kredit)",
      blok: [],
    };
    expect(dilewatiKarenaServer(server)).toBe(true);
    expect(kalimatDilewati(server)).toBe("");
    expect(dilewatiKarenaServer({ status: "dilewati", keterangan: "dilewati: saham ini disuspensi", blok: [] })).toBe(false);
  });
});

describe("rupiahAwam", () => {
  it("memakai satuan juta, miliar, triliun", () => {
    expect(rupiahAwam(-3.1e9)).toBe("Rp3,1 miliar");
    expect(rupiahAwam(2.5e6)).toBe("Rp2,5 juta");
    expect(rupiahAwam(1.25e12)).toBe("Rp1,25 triliun");
    expect(rupiahAwam(950)).toBe("Rp950");
  });
});
