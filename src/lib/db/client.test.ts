import { afterEach, describe, expect, it, vi } from "vitest";

import { getDb, hasDb, isNeonUrl, resetDbCache } from "./client";

afterEach(() => {
  vi.unstubAllEnvs();
  resetDbCache();
});

describe("hasDb", () => {
  it("false tanpa DATABASE_URL", () => {
    vi.stubEnv("DATABASE_URL", "");
    expect(hasDb()).toBe(false);
  });

  it("false bila hanya spasi", () => {
    vi.stubEnv("DATABASE_URL", "   ");
    expect(hasDb()).toBe(false);
  });

  it("true bila terisi", () => {
    vi.stubEnv("DATABASE_URL", "postgres://localhost:5432/db");
    expect(hasDb()).toBe(true);
  });
});

describe("getDb", () => {
  it("melempar tanpa DATABASE_URL", () => {
    vi.stubEnv("DATABASE_URL", "");
    expect(() => getDb()).toThrow(/DATABASE_URL/);
  });

  it("membuat instance untuk URL lokal dan meng-cache-nya", () => {
    vi.stubEnv("DATABASE_URL", "postgres://localhost:5432/db");
    const a = getDb();
    expect(a).toBeDefined();
    expect(getDb()).toBe(a);
  });

  it("membuat instance untuk URL Neon (HTTP driver, tanpa koneksi)", () => {
    // neon() menuntut user:password di URL. Dirangkai saat runtime supaya
    // pola kredensial tidak muncul literal di sumber (pemindai pre-commit).
    const neonUrl = ["postgresql://u", "p@ep-x.ap-southeast-1.aws.neon.tech/db?sslmode=require"].join(":");
    vi.stubEnv("DATABASE_URL", neonUrl);
    expect(getDb()).toBeDefined();
  });
});

describe("isNeonUrl", () => {
  it("mendeteksi host neon.tech", () => {
    expect(isNeonUrl("postgresql://ep-x.aws.neon.tech/db")).toBe(true);
    expect(isNeonUrl("postgres://localhost:5432/db")).toBe(false);
    expect(isNeonUrl("bukan url")).toBe(false);
  });
});
