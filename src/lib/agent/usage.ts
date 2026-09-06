// Ringkasan pemakaian token dari hasil AI SDK v7 (`result.usage` = agregat semua langkah).
import type { LanguageModelUsage } from "ai";

export interface UsageRingkas {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

export function ringkasUsage(u: LanguageModelUsage | undefined): UsageRingkas {
  return {
    inputTokens: u?.inputTokens ?? 0,
    outputTokens: u?.outputTokens ?? 0,
    totalTokens: u?.totalTokens ?? (u?.inputTokens ?? 0) + (u?.outputTokens ?? 0),
    cacheReadTokens: u?.inputTokenDetails?.cacheReadTokens ?? 0,
    cacheWriteTokens: u?.inputTokenDetails?.cacheWriteTokens ?? 0,
  };
}
