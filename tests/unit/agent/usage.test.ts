// Normalisasi pemakaian token lintas provider (Anthropic & DeepSeek).
import { describe, expect, it } from "vitest";

import { ringkasUsage } from "../../../src/lib/agent/usage";

describe("ringkasUsage", () => {
  it("Anthropic: cache read/write dari inputTokenDetails", () => {
    expect(
      ringkasUsage({
        inputTokens: 100,
        outputTokens: 20,
        totalTokens: 120,
        inputTokenDetails: { noCacheTokens: 60, cacheReadTokens: 30, cacheWriteTokens: 10 },
        outputTokenDetails: { textTokens: 20, reasoningTokens: 0 },
      }),
    ).toEqual({ inputTokens: 100, outputTokens: 20, totalTokens: 120, cacheReadTokens: 30, cacheWriteTokens: 10 });
  });

  it("DeepSeek: cache hit dari providerMetadata.deepseek.promptCacheHitTokens bila inputTokenDetails kosong", () => {
    expect(
      ringkasUsage(
        {
          inputTokens: 200,
          outputTokens: 50,
          totalTokens: undefined,
          inputTokenDetails: { noCacheTokens: undefined, cacheReadTokens: undefined, cacheWriteTokens: undefined },
          outputTokenDetails: { textTokens: undefined, reasoningTokens: undefined },
        },
        { deepseek: { promptCacheHitTokens: 150, promptCacheMissTokens: 50 } },
      ),
    ).toEqual({ inputTokens: 200, outputTokens: 50, totalTokens: 250, cacheReadTokens: 150, cacheWriteTokens: 0 });
  });

  it("tanpa usage sama sekali → semua nol", () => {
    expect(ringkasUsage(undefined)).toEqual({ inputTokens: 0, outputTokens: 0, totalTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 });
  });
});
