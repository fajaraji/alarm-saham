// Skema aturan alarm (blok kelas A, tiket 06).
//
// Satu aturan = nama + cara gabung (ATAU/DAN) + daftar blok. Setiap blok punya
// jenis dan ambang (longgar/ketat). Definisi terukur tiap blok ada di
// evaluate.ts dan docs/mesin-uji.md; skema ini hanya memvalidasi bentuk.
import { z } from "zod";

export const BLOCK_KINDS = [
  "suspensi",
  "laporan_hilang",
  "aksi_dilutif",
  "ekuitas_negatif",
  "insider_jual",
] as const;
export type BlockKind = (typeof BLOCK_KINDS)[number];

export const THRESHOLDS = ["longgar", "ketat"] as const;
export type Threshold = (typeof THRESHOLDS)[number];

export const COMBINES = ["any", "all"] as const;
export type Combine = (typeof COMBINES)[number];

/** Nama blok untuk tampilan (Bahasa Indonesia). */
export const LABEL_BLOK: Record<BlockKind, string> = {
  suspensi: "Saham disuspensi",
  laporan_hilang: "Laporan keuangan hilang/berhenti",
  aksi_dilutif: "Aksi korporasi dilutif",
  ekuitas_negatif: "Utang lebih besar dari harta",
  insider_jual: "Orang dalam menjual",
};

const daftarNilai = (nilai: readonly string[]) => nilai.map((v) => `'${v}'`).join(", ");

export const BlockSchema = z.strictObject({
  kind: z.enum(BLOCK_KINDS, {
    error: `kind harus salah satu dari ${daftarNilai(BLOCK_KINDS)}`,
  }),
  threshold: z.enum(THRESHOLDS, {
    error: `threshold harus ${daftarNilai(THRESHOLDS)}`,
  }),
});
export type Block = z.infer<typeof BlockSchema>;

export const RuleSchema = z
  .strictObject({
    name: z
      .string({ error: "name harus berupa teks" })
      .trim()
      .min(1, { error: "name tidak boleh kosong" })
      .max(120, { error: "name maksimal 120 karakter" }),
    combine: z.enum(COMBINES, {
      error: "combine harus 'any' (ATAU) atau 'all' (DAN)",
    }),
    blocks: z
      .array(BlockSchema, { error: "blocks harus berupa daftar blok" })
      .min(1, { error: "aturan harus memuat minimal 1 blok" })
      .max(BLOCK_KINDS.length, {
        error: `aturan maksimal ${BLOCK_KINDS.length} blok (satu per jenis)`,
      }),
  })
  .superRefine((aturan, ctx) => {
    const terlihat = new Set<BlockKind>();
    aturan.blocks.forEach((b, i) => {
      if (terlihat.has(b.kind)) {
        ctx.addIssue({
          code: "custom",
          path: ["blocks", i, "kind"],
          message: `blok '${b.kind}' muncul lebih dari sekali; setiap jenis blok hanya boleh satu`,
        });
      }
      terlihat.add(b.kind);
    });
  });
export type Rule = z.infer<typeof RuleSchema>;

export class RuleError extends Error {
  constructor(
    message: string,
    readonly issues: { path: string; message: string }[],
  ) {
    super(message);
    this.name = "RuleError";
  }
}

/** Validasi aturan; melempar RuleError berpesan Bahasa Indonesia bila tidak sah. */
export function parseRule(input: unknown): Rule {
  const hasil = RuleSchema.safeParse(input);
  if (hasil.success) return hasil.data;
  const issues = hasil.error.issues.map((i) => ({
    path: i.path.map(String).join(".") || "(akar)",
    message: i.message,
  }));
  const rincian = issues.map((i) => `  - ${i.path}: ${i.message}`).join("\n");
  throw new RuleError(`Aturan alarm tidak valid:\n${rincian}`, issues);
}

/** Ringkasan aturan satu baris, mis. "suspensi(longgar) ATAU ekuitas_negatif(longgar)". */
export function ringkasAturan(rule: Rule): string {
  const kata = rule.combine === "any" ? " ATAU " : " DAN ";
  return rule.blocks.map((b) => `${b.kind}(${b.threshold})`).join(kata);
}
