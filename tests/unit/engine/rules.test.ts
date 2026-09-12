import { describe, expect, it } from "vitest";

import aturanDefault from "../../../src/lib/engine/fixtures/aturan-default.json";
import { BLOCK_KINDS, parseRule, ringkasAturan, RuleError, RuleSchema } from "../../../src/lib/engine/rules";

describe("skema aturan alarm", () => {
  it("aturan default valid dan ringkasannya terbaca", () => {
    const rule = parseRule(aturanDefault);
    expect(rule.name).toBe("Saham mau pailit");
    expect(rule.combine).toBe("any");
    expect(rule.blocks).toHaveLength(3);
    expect(ringkasAturan(rule)).toBe(
      "suspensi(longgar) ATAU laporan_hilang(longgar) ATAU ekuitas_negatif(longgar)",
    );
  });

  it("menerima combine 'all' dan semua jenis blok sekali", () => {
    const rule = parseRule({
      name: "  Semua blok  ",
      combine: "all",
      blocks: BLOCK_KINDS.map((kind) => ({ kind, threshold: "ketat" })),
    });
    expect(rule.name).toBe("Semua blok");
    expect(ringkasAturan(rule)).toContain(" DAN ");
  });

  const kasusTidakValid: [string, unknown, RegExp][] = [
    ["bukan objek", "teks", /Aturan alarm tidak valid/],
    ["tanpa blok", { name: "x", combine: "any", blocks: [] }, /minimal 1 blok/],
    ["blocks bukan array", { name: "x", combine: "any", blocks: "suspensi" }, /daftar blok/],
    ["combine salah", { name: "x", combine: "or", blocks: [{ kind: "suspensi", threshold: "longgar" }] }, /combine harus 'any' \(ATAU\) atau 'all' \(DAN\)/],
    ["jenis blok tak dikenal", { name: "x", combine: "any", blocks: [{ kind: "harga_turun", threshold: "longgar" }] }, /kind harus salah satu dari 'suspensi'/],
    ["ambang tak dikenal", { name: "x", combine: "any", blocks: [{ kind: "suspensi", threshold: "sedang" }] }, /threshold harus 'longgar', 'ketat'/],
    ["nama kosong", { name: "   ", combine: "any", blocks: [{ kind: "suspensi", threshold: "longgar" }] }, /name tidak boleh kosong/],
    ["nama bukan teks", { combine: "any", blocks: [{ kind: "suspensi", threshold: "longgar" }] }, /name harus berupa teks/],
    [
      "blok ganda",
      {
        name: "x",
        combine: "any",
        blocks: [
          { kind: "suspensi", threshold: "longgar" },
          { kind: "suspensi", threshold: "ketat" },
        ],
      },
      /blok 'suspensi' muncul lebih dari sekali/,
    ],
    ["kunci asing di aturan", { name: "x", combine: "any", blocks: [{ kind: "suspensi", threshold: "longgar" }], extra: 1 }, /Aturan alarm tidak valid/],
    ["kunci asing di blok", { name: "x", combine: "any", blocks: [{ kind: "suspensi", threshold: "longgar", n: 3 }] }, /Aturan alarm tidak valid/],
  ];

  it.each(kasusTidakValid)("menolak aturan tidak valid: %s", (_nama, input, pola) => {
    expect(() => parseRule(input)).toThrow(RuleError);
    expect(() => parseRule(input)).toThrow(pola);
    expect(RuleSchema.safeParse(input).success).toBe(false);
  });

  it("RuleError memuat path dan pesan per masalah", () => {
    try {
      parseRule({ name: "x", combine: "any", blocks: [{ kind: "suspensi", threshold: "sedang" }] });
      expect.unreachable("harus melempar");
    } catch (err) {
      expect(err).toBeInstanceOf(RuleError);
      const e = err as RuleError;
      expect(e.issues).toEqual([
        { path: "blocks.0.threshold", message: "threshold harus 'longgar', 'ketat'" },
      ]);
    }
  });
});
