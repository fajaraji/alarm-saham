// Perakit blok: kalimat awam → aturan alarm (skema tiket 06) via structured output.
//
// Skema keluaran model memakai RuleSchema dari engine (tidak diduplikasi).
// Provider (DeepSeek/Anthropic) menerjemahkan skema ke format masing-masing —
// DeepSeek menyisipkan skema JSON ke pesan sistem bila endpoint hanya
// mendukung json_object — dan kami memvalidasi ulang dengan `parseRule`
// setelah model menjawab.
import { generateText, NoObjectGeneratedError, Output, type LanguageModel } from "ai";
import { z } from "zod";

import { parseRule, RuleError, RuleSchema, type Rule } from "../engine/rules";
// Jalur perakit: `alasan` dan `name` adalah prosa bebas biasa (bukan alasan
// usulan blok), jadi frasa backstop yang menyala di sana memang diredaksi —
// bedanya dengan diagnosis dijelaskan di guard.ts.
import { sensorObjek } from "./guard";
import { INSTRUKSI_PERAKIT } from "./instructions";
import { instruksiSistem, opsiProvider, pilihModel, providerDari } from "./model";
import { ringkasUsage, type UsageRingkas } from "./usage";

export const RakitOutputSchema = z.object({
  ditolak: z.boolean().describe("true bila kalimat di luar domain atau meminta rekomendasi"),
  pesan: z
    .string()
    .nullable()
    .describe("Pesan sopan untuk pengguna bila ditolak; null bila diterima"),
  rule: RuleSchema.nullable().describe("Aturan alarm hasil rakitan; null bila ditolak"),
  alasan: z
    .string()
    .nullable()
    .describe(
      "Satu kalimat awam kenapa blok itu dipilih — tentang blok dan datanya, bukan tentang apa yang sebaiknya pengguna lakukan atas sahamnya; null bila ditolak",
    ),
});
export type RakitOutput = z.infer<typeof RakitOutputSchema>;

export interface RakitDiterima {
  ditolak: false;
  rule: Rule;
  alasan: string;
  perluTinjau: boolean;
  kataDisensor: string[];
  usage: UsageRingkas;
}
export interface RakitDitolak {
  ditolak: true;
  pesan: string;
  perluTinjau: boolean;
  kataDisensor: string[];
  usage: UsageRingkas;
}
export type HasilRakit = RakitDiterima | RakitDitolak;

export class RakitError extends Error {
  constructor(
    message: string,
    readonly penyebab?: unknown,
  ) {
    super(message);
    this.name = "RakitError";
  }
}

export interface RakitOptions {
  /** Model suntikan (tes memakai MockLanguageModelV4). Default: model peran 'penalaran' dari provider terpilih. */
  model?: LanguageModel;
}

const KALIMAT_MAKS = 500;

export async function rakitAturan(kalimat: string, opts: RakitOptions = {}): Promise<HasilRakit> {
  const bersih = kalimat.trim();
  if (!bersih) throw new RakitError("Kalimat tidak boleh kosong");
  if (bersih.length > KALIMAT_MAKS) {
    throw new RakitError(`Kalimat terlalu panjang (maksimal ${KALIMAT_MAKS} karakter)`);
  }

  const model = pilihModel("penalaran", opts.model);
  const provider = providerDari(model);
  let hasil: Awaited<ReturnType<typeof panggil>>;
  const panggil = () =>
    generateText({
      model,
      instructions: instruksiSistem(INSTRUKSI_PERAKIT, provider),
      prompt: `Kalimat pengguna: """${bersih}"""\n\nRakit aturan alarm dari kalimat itu, atau tolak bila di luar domain.`,
      output: Output.object({ schema: RakitOutputSchema, name: "hasil_rakit" }),
      providerOptions: opsiProvider(provider, "medium"),
    });
  try {
    hasil = await panggil();
  } catch (err) {
    // Output.object sudah memvalidasi dengan RuleSchema (termasuk blok ganda);
    // kegagalan validasi muncul sebagai NoObjectGeneratedError.
    if (NoObjectGeneratedError.isInstance(err)) {
      throw new RakitError(`Model tidak menghasilkan aturan yang valid: ${err.message}`, err);
    }
    throw err;
  }
  const usage = ringkasUsage(hasil.usage, hasil.providerMetadata);
  const keluaran = hasil.output;

  if (keluaran.ditolak) {
    const pesan = keluaran.pesan?.trim() || "Maaf, kalimat itu tidak bisa dijadikan alarm saham.";
    const s = sensorObjek({ pesan });
    return { ditolak: true, pesan: s.hasil.pesan, perluTinjau: s.perluTinjau, kataDisensor: s.kataDisensor, usage };
  }

  let rule: Rule;
  try {
    rule = parseRule(keluaran.rule);
  } catch (err) {
    throw new RakitError(
      err instanceof RuleError ? `Model menghasilkan aturan tidak valid: ${err.message}` : "Model tidak menghasilkan aturan",
      err,
    );
  }
  const s = sensorObjek({ name: rule.name, alasan: keluaran.alasan?.trim() || "" });
  return {
    ditolak: false,
    rule: { ...rule, name: s.hasil.name },
    alasan: s.hasil.alasan || `Blok dipilih sesuai kalimat: ${rule.blocks.map((b) => b.kind).join(", ")}.`,
    perluTinjau: s.perluTinjau,
    kataDisensor: s.kataDisensor,
    usage,
  };
}
