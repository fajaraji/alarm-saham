// Reducer papan alarm: setiap aksi menjaga state tetap valid RuleSchema.
import { describe, expect, it } from "vitest";

import { BLOCK_KINDS, RuleSchema, type BlockKind } from "../../../src/lib/engine/rules";
import { DAFTAR_BLOK, INFO_BLOK, labelAmbang, labelBlok } from "../../../src/lib/rakit/blok";
import {
  adaBlok,
  keRule,
  NAMA_DEFAULT,
  PAPAN_AWAL,
  reducerPapan,
  ringkasAwam,
  type AksiPapan,
  type PapanState,
} from "../../../src/lib/rakit/reducer";

function jalankan(aksi: AksiPapan[], awal: PapanState = PAPAN_AWAL): PapanState {
  return aksi.reduce(reducerPapan, awal);
}

function harusValid(s: PapanState) {
  if (s.blocks.length === 0) return;
  const rule = keRule(s);
  expect(rule).not.toBeNull();
  expect(RuleSchema.safeParse(rule).success).toBe(true);
}

describe("reducerPapan", () => {
  it("papan awal kosong → keRule null (tidak pernah mengirim aturan kosong)", () => {
    expect(PAPAN_AWAL.blocks).toHaveLength(0);
    expect(keRule(PAPAN_AWAL)).toBeNull();
  });

  it("tambah: ambang default longgar, jenis unik, maksimal 5", () => {
    let s = jalankan([{ tipe: "tambah", kind: "suspensi" }]);
    expect(s.blocks).toEqual([{ kind: "suspensi", threshold: "longgar" }]);
    s = reducerPapan(s, { tipe: "tambah", kind: "suspensi" });
    expect(s.blocks).toHaveLength(1);
    for (const k of BLOCK_KINDS) s = reducerPapan(s, { tipe: "tambah", kind: k, threshold: "ketat" });
    expect(s.blocks).toHaveLength(BLOCK_KINDS.length);
    harusValid(s);
    // kind asing diabaikan
    s = reducerPapan(s, { tipe: "tambah", kind: "harga_turun" as BlockKind });
    expect(s.blocks).toHaveLength(BLOCK_KINDS.length);
  });

  it("tambah di posisi tertentu (drop di atas blok lain) dan di luar batas dijepit", () => {
    const s = jalankan([
      { tipe: "tambah", kind: "suspensi" },
      { tipe: "tambah", kind: "laporan_hilang" },
      { tipe: "tambah", kind: "ekuitas_negatif", di: 0 },
      { tipe: "tambah", kind: "insider_jual", di: 99 },
    ]);
    expect(s.blocks.map((b) => b.kind)).toEqual(["ekuitas_negatif", "suspensi", "laporan_hilang", "insider_jual"]);
    harusValid(s);
  });

  it("hapus & pindah (urut ulang) menjaga keunikan", () => {
    let s = jalankan([
      { tipe: "tambah", kind: "suspensi" },
      { tipe: "tambah", kind: "laporan_hilang" },
      { tipe: "tambah", kind: "aksi_dilutif" },
    ]);
    s = reducerPapan(s, { tipe: "pindah", dari: "aksi_dilutif", ke: "suspensi" });
    expect(s.blocks.map((b) => b.kind)).toEqual(["aksi_dilutif", "suspensi", "laporan_hilang"]);
    s = reducerPapan(s, { tipe: "pindah", dari: "suspensi", ke: "insider_jual" });
    expect(s.blocks.map((b) => b.kind)).toEqual(["aksi_dilutif", "suspensi", "laporan_hilang"]);
    s = reducerPapan(s, { tipe: "hapus", kind: "suspensi" });
    expect(adaBlok(s, "suspensi")).toBe(false);
    expect(s.blocks).toHaveLength(2);
    harusValid(s);
  });

  it("ATAU ↔ DAN dan ambang longgar ↔ ketat", () => {
    let s = jalankan([{ tipe: "tambah", kind: "suspensi" }, { tipe: "tambah", kind: "ekuitas_negatif" }]);
    expect(s.combine).toBe("any");
    s = reducerPapan(s, { tipe: "toggleCombine" });
    expect(s.combine).toBe("all");
    s = reducerPapan(s, { tipe: "toggleCombine" });
    expect(s.combine).toBe("any");
    s = reducerPapan(s, { tipe: "toggleAmbang", kind: "suspensi" });
    expect(s.blocks[0].threshold).toBe("ketat");
    expect(s.blocks[1].threshold).toBe("longgar");
    s = reducerPapan(s, { tipe: "toggleAmbang", kind: "suspensi" });
    expect(s.blocks[0].threshold).toBe("longgar");
    s = reducerPapan(s, { tipe: "setAmbang", kind: "ekuitas_negatif", threshold: "ketat" });
    expect(s.blocks[1].threshold).toBe("ketat");
    harusValid(s);
  });

  it("muat aturan & kosongkan; nama kosong jatuh ke default", () => {
    const rule = RuleSchema.parse({
      name: "Uji",
      combine: "all",
      blocks: [{ kind: "laporan_hilang", threshold: "ketat" }],
    });
    let s = reducerPapan(PAPAN_AWAL, { tipe: "muat", rule });
    expect(keRule(s)).toEqual(rule);
    s = reducerPapan(s, { tipe: "setNama", name: "   " });
    expect(keRule(s)?.name).toBe(NAMA_DEFAULT);
    s = reducerPapan(s, { tipe: "kosongkan" });
    expect(s.blocks).toHaveLength(0);
    expect(keRule(s)).toBeNull();
  });

  it("urutan aksi acak (deterministik) tidak pernah menghasilkan state tidak valid", () => {
    let seed = 42;
    const acak = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
    const pilih = <T>(xs: readonly T[]) => xs[Math.floor(acak() * xs.length)];
    let s = PAPAN_AWAL;
    for (let i = 0; i < 500; i++) {
      const k = pilih(BLOCK_KINDS);
      const aksi = pilih<AksiPapan>([
        { tipe: "tambah", kind: k },
        { tipe: "tambah", kind: k, di: Math.floor(acak() * 6) },
        { tipe: "hapus", kind: k },
        { tipe: "pindah", dari: k, ke: pilih(BLOCK_KINDS) },
        { tipe: "toggleCombine" },
        { tipe: "toggleAmbang", kind: k },
      ]);
      s = reducerPapan(s, aksi);
      harusValid(s);
      expect(new Set(s.blocks.map((b) => b.kind)).size).toBe(s.blocks.length);
    }
  });

  it("ringkasAwam memakai label awam dan kata gabung", () => {
    const s = jalankan([{ tipe: "tambah", kind: "suspensi" }, { tipe: "tambah", kind: "ekuitas_negatif" }]);
    expect(ringkasAwam(s, labelBlok)).toBe("Saham disuspensi ATAU Utang lebih besar dari harta");
    expect(ringkasAwam(reducerPapan(s, { tipe: "toggleCombine" }), labelBlok)).toContain(" DAN ");
  });
});

describe("metadata blok (palet)", () => {
  it("lima blok kelas A dengan label awam, tooltip, dua ambang, dan kedalaman data", () => {
    expect(DAFTAR_BLOK.map((b) => b.kind)).toEqual([...BLOCK_KINDS]);
    for (const b of DAFTAR_BLOK) {
      expect(b.label.length).toBeGreaterThan(3);
      expect(b.tooltip.length).toBeGreaterThan(10);
      expect(labelAmbang(b.kind, "longgar")).not.toBe(labelAmbang(b.kind, "ketat"));
    }
    expect(INFO_BLOK.insider_jual.dataSejak).toBe("hanya 2024+");
    expect(INFO_BLOK.suspensi.dataSejak).toBe("data sejak 2020");
  });
});
