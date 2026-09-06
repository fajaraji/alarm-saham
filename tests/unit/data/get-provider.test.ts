import { afterEach, describe, expect, it, vi } from "vitest";
import {
  FixtureProvider,
  PESAN_TANPA_KUNCI,
  SectorsProvider,
  getProvider,
  resetProvider,
} from "../../../src/lib/data";

describe("getProvider", () => {
  afterEach(() => resetProvider());

  it("tanpa SECTORS_API_KEY -> FixtureProvider, peringatan hanya sekali", () => {
    const warn = vi.fn();
    const a = getProvider({ env: {}, warn });
    const b = getProvider({ env: {}, warn });
    expect(a).toBeInstanceOf(FixtureProvider);
    expect(b).toBe(a);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(PESAN_TANPA_KUNCI);
  });

  it("dengan SECTORS_API_KEY -> SectorsProvider tanpa peringatan; env cadangan dibaca", () => {
    const warn = vi.fn();
    const p = getProvider({
      env: { SECTORS_API_KEY: "kunci-uji-123", SECTORS_CREDIT_RESERVE: "300", ALLOW_RESERVE: "1" },
      warn,
    });
    expect(p).toBeInstanceOf(SectorsProvider);
    expect((p as SectorsProvider).cadangan).toBe(300);
    expect((p as SectorsProvider).izinkanCadangan).toBe(true);
    expect(warn).not.toHaveBeenCalled();
  });
});
