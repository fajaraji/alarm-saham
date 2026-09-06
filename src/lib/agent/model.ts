// Pemilih model AI (Vercel AI SDK v7 + @ai-sdk/anthropic v4).
//
// - `claude-opus-5`  : diagnosis & perakit blok (butuh penalaran; thinking adaptive).
// - `claude-sonnet-5`: penjelasan ringan (mis. teks harian).
//
// Tidak ada klien yang dibuat di module scope: `next build` mengimpor modul
// route saat ANTHROPIC_API_KEY mungkin kosong. Fungsi melempar
// `AiKeyMissingError` (bukan crash saat import) bila kunci tidak ada, dan
// setiap pemanggil boleh menyuntikkan model sendiri (tes memakai model tiruan).
import { createAnthropic, type AnthropicLanguageModelOptions } from "@ai-sdk/anthropic";
import type { generateText, Instructions, LanguageModel } from "ai";

/** Tipe providerOptions milik generateText (`ai` tidak mengekspor `ProviderOptions` langsung). */
type ProviderOptions = NonNullable<Parameters<typeof generateText>[0]["providerOptions"]>;

export const MODEL_ID = {
  diagnosis: "claude-opus-5",
  perakit: "claude-opus-5",
  penjelasan: "claude-sonnet-5",
} as const;
export type PeranModel = keyof typeof MODEL_ID;

export class AiKeyMissingError extends Error {
  constructor() {
    super(
      "ANTHROPIC_API_KEY belum diset. Isi di .env.local (lihat .env.example) agar fitur AI (perakit blok & diagnosis) bisa dipakai.",
    );
    this.name = "AiKeyMissingError";
  }
}

/** Apakah kunci Anthropic tersedia di lingkungan proses. */
export function hasAiKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

/**
 * Kembalikan model untuk peran tertentu. `override` (mis. MockLanguageModelV4
 * di tes) selalu menang dan tidak menyentuh kunci API.
 */
export function pilihModel(peran: PeranModel, override?: LanguageModel): LanguageModel {
  if (override) return override;
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) throw new AiKeyMissingError();
  return createAnthropic({ apiKey })(MODEL_ID[peran]);
}

export type Effort = NonNullable<AnthropicLanguageModelOptions["effort"]>;

/**
 * providerOptions untuk panggilan ke Anthropic: thinking adaptive (Opus 5 /
 * Sonnet 5 menolak budgetTokens) + tingkat effort.
 */
export function opsiAnthropic(effort: Effort = "high"): ProviderOptions {
  // `satisfies` menjaga tipe literal (JSON murni) sekaligus memvalidasi nama opsi.
  return {
    anthropic: { thinking: { type: "adaptive" }, effort } satisfies AnthropicLanguageModelOptions,
  };
}

/**
 * Bungkus instruksi sistem sebagai pesan `system` dengan breakpoint prompt
 * caching (ephemeral, 1 jam). Teks instruksi harus stabil byte-per-byte —
 * jangan menyisipkan tanggal/ID dinamis di sini; letakkan di pesan pengguna.
 */
export function instruksiSistem(teks: string): Instructions {
  return [
    {
      role: "system",
      content: teks,
      providerOptions: { anthropic: { cacheControl: { type: "ephemeral", ttl: "1h" } } },
    },
  ];
}
