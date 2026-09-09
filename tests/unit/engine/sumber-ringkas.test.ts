// `jenisSumberTerpilih()` menebak sumber TANPA membuka koneksi, dan dipakai
// lapisan tampilan untuk memutuskan apakah boleh menulis "fakta resmi dari feed
// Sectors". Kalau tebakan itu menyimpang dari `getEventSource()`, footer bisa
// mengklaim data resmi sementara halamannya menampilkan data contoh — persis
// cacat yang ditutup tiket 15. Tes ini menyandingkan keduanya.
import { existsSync } from "node:fs";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { getEventSource, jenisSumberTerpilih, sumberNyata } from "../../../src/lib/engine/sumber";

const ADA_PGLITE = existsSync(path.resolve(process.cwd(), ".pglite"));

afterEach(() => vi.unstubAllEnvs());

describe("jenisSumberTerpilih()", () => {
  it("fixture bila DATABASE_URL kosong dan ./.pglite diabaikan", async () => {
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("TANPA_PGLITE", "1");
    expect(jenisSumberTerpilih()).toBe("fixture");
    expect(sumberNyata()).toBe(false);
    const s = await getEventSource();
    expect(s.jenis).toBe("fixture");
    await s.tutup();
  });

  it("fixture dipaksa tetap fixture walau DATABASE_URL terisi", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://contoh.invalid/alarm");
    expect(jenisSumberTerpilih({ fixture: true })).toBe("fixture");
    const s = await getEventSource({ fixture: true });
    expect(s.jenis).toBe("fixture");
    await s.tutup();
  });

  it("membedakan Neon dari Postgres biasa tanpa menyentuh jaringan", () => {
    vi.stubEnv("DATABASE_URL", "postgresql://contoh.neon.tech/alarm?sslmode=require");
    expect(jenisSumberTerpilih()).toBe("neon");
    expect(sumberNyata()).toBe(true);
    vi.stubEnv("DATABASE_URL", "postgresql://127.0.0.1:5432/alarm");
    expect(jenisSumberTerpilih()).toBe("postgres");
    expect(sumberNyata()).toBe(true);
  });

  it.skipIf(!ADA_PGLITE)("pglite bila foldernya ada — dan sama dengan getEventSource()", async () => {
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("TANPA_PGLITE", "");
    expect(jenisSumberTerpilih()).toBe("pglite");
    expect(sumberNyata()).toBe(true);
    const s = await getEventSource();
    expect(s.jenis).toBe(jenisSumberTerpilih());
    await s.tutup();
  }, 60_000);
});

/**
 * Gerbang e2e jalur DB (tiket 15, keberatan 1) menjalankan servernya di atas
 * database benih di folder tersendiri, bukan ./.pglite. Kalau ALARM_PGLITE_DIR
 * tidak benar-benar dihormati, job `e2e-db` di CI akan diam-diam berjalan pada
 * fixture (atau pada ./.pglite pengembang) dan namanya jadi bohong.
 */
describe("ALARM_PGLITE_DIR menggeser folder PGlite", () => {
  it("folder yang ditunjuk env dipakai, bukan ./.pglite", () => {
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("TANPA_PGLITE", "");
    // Folder yang PASTI ada tetapi bukan ./.pglite: keputusannya hanya existsSync,
    // jadi tidak ada koneksi yang dibuka.
    vi.stubEnv("ALARM_PGLITE_DIR", "drizzle");
    expect(jenisSumberTerpilih()).toBe("pglite");
    expect(sumberNyata()).toBe(true);
  });

  it("folder yang ditunjuk env tidak ada → fixture, walau ./.pglite ada", () => {
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("TANPA_PGLITE", "");
    vi.stubEnv("ALARM_PGLITE_DIR", ".pglite-tidak-ada-abcdef");
    expect(jenisSumberTerpilih()).toBe("fixture");
    expect(sumberNyata()).toBe(false);
  });

  it("kosong = perilaku lama (./.pglite), dan TANPA_PGLITE tetap menang", () => {
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("ALARM_PGLITE_DIR", "");
    vi.stubEnv("TANPA_PGLITE", "");
    expect(jenisSumberTerpilih()).toBe(ADA_PGLITE ? "pglite" : "fixture");
    vi.stubEnv("ALARM_PGLITE_DIR", "drizzle");
    vi.stubEnv("TANPA_PGLITE", "1");
    expect(jenisSumberTerpilih()).toBe("fixture");
  });
});
