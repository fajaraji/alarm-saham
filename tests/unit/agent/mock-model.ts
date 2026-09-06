// Pembuat model tiruan (MockLanguageModelV4) untuk tes agent — nol panggilan API.
import { MockLanguageModelV4 } from "ai/test";

/** Hasil satu panggilan doGenerate (diturunkan dari tipe konstruktor mock; tanpa impor paket transitif). */
type LanguageModelV4GenerateResult = Extract<
  NonNullable<NonNullable<ConstructorParameters<typeof MockLanguageModelV4>[0]>["doGenerate"]>,
  readonly unknown[]
>[number];

export const USAGE_TIRUAN = {
  inputTokens: { total: 100, noCache: 60, cacheRead: 40, cacheWrite: undefined },
  outputTokens: { total: 20, text: 20, reasoning: undefined },
};

/** Langkah yang mengembalikan teks JSON (jawaban akhir structured output). */
export function langkahTeks(objek: unknown): LanguageModelV4GenerateResult {
  return {
    content: [{ type: "text", text: JSON.stringify(objek) }],
    finishReason: { unified: "stop", raw: undefined },
    usage: USAGE_TIRUAN,
    warnings: [],
  };
}

/** Langkah yang memanggil satu atau lebih tool. */
export function langkahTool(
  panggilan: { toolName: string; input: Record<string, unknown> }[],
): LanguageModelV4GenerateResult {
  return {
    content: panggilan.map((p, i) => ({
      type: "tool-call" as const,
      toolCallId: `call-${p.toolName}-${i}`,
      toolName: p.toolName,
      input: JSON.stringify(p.input),
    })),
    finishReason: { unified: "tool-calls", raw: undefined },
    usage: USAGE_TIRUAN,
    warnings: [],
  };
}

/** Model tiruan yang menjawab langkah-langkah berurutan (langkah terakhir diulang bila habis). */
export function modelTiruan(langkah: LanguageModelV4GenerateResult[]): MockLanguageModelV4 {
  let i = 0;
  return new MockLanguageModelV4({
    modelId: "mock-claude",
    doGenerate: async () => langkah[Math.min(i++, langkah.length - 1)],
  });
}
