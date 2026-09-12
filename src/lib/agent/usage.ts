// Ringkasan pemakaian token dari hasil AI SDK v7 (`result.usage` = agregat semua
// langkah), dinormalisasi lintas provider:
// - Anthropic: cache read/write dari `usage.inputTokenDetails`.
// - DeepSeek : provider memetakan `prompt_cache_hit_tokens` ke
//   `inputTokenDetails.cacheReadTokens`; bila absen, dibaca dari
//   `providerMetadata.deepseek.promptCacheHitTokens`. DeepSeek tidak punya
//   cache write (cache otomatis, gratis) → 0.
import type { LanguageModelUsage, ProviderMetadata } from "ai";

export interface UsageRingkas {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

function angka(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

export function ringkasUsage(u: LanguageModelUsage | undefined, meta?: ProviderMetadata): UsageRingkas {
  const inputTokens = u?.inputTokens ?? 0;
  const outputTokens = u?.outputTokens ?? 0;
  return {
    inputTokens,
    outputTokens,
    totalTokens: u?.totalTokens ?? inputTokens + outputTokens,
    cacheReadTokens:
      u?.inputTokenDetails?.cacheReadTokens ?? angka(meta?.deepseek?.promptCacheHitTokens) ?? 0,
    cacheWriteTokens: u?.inputTokenDetails?.cacheWriteTokens ?? 0,
  };
}

/**
 * Jumlahkan beberapa ringkasan usage. Dipakai jalur dua fase (jelajah tool +
 * panggilan perangkum): biaya yang dilaporkan harus mencakup KEDUA panggilan,
 * bukan cuma yang terakhir.
 */
export function gabungUsage(...bagian: UsageRingkas[]): UsageRingkas {
  return bagian.reduce(
    (a, b) => ({
      inputTokens: a.inputTokens + b.inputTokens,
      outputTokens: a.outputTokens + b.outputTokens,
      totalTokens: a.totalTokens + b.totalTokens,
      cacheReadTokens: a.cacheReadTokens + b.cacheReadTokens,
      cacheWriteTokens: a.cacheWriteTokens + b.cacheWriteTokens,
    }),
    { inputTokens: 0, outputTokens: 0, totalTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
  );
}
