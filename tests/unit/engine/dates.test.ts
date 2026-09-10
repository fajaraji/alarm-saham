// Pembeku waktu `ALARM_HARI_INI` adalah tombol pengembangan/tes. Kalau nilainya
// ikut tersalin ke dasbor produksi (mis. copy-paste .env.example), SELURUH
// aplikasi membeku di satu tanggal tanpa pesan galat: alarm berhenti mencerminkan
// kenyataan. Tes ini mengunci pagarnya — di produksi nilai itu diabaikan kecuali
// operator menyalakan kunci kedua yang eksplisit, dan tetap diperingatkan.
import { readFileSync } from "node:fs";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { ENV_IZIN_BEKU, hariIni, resetPeringatanTanggal } from "../../../src/lib/engine/dates";

const BEKU = "2026-09-07";
const HARI_NYATA = new Date().toISOString().slice(0, 10);

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  resetPeringatanTanggal();
});

describe("hariIni(): pagar pembeku waktu", () => {
  it("memakukan tanggal di luar produksi (dipakai e2e & tes)", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ALARM_HARI_INI", BEKU);
    expect(hariIni()).toBe(BEKU);
  });

  it("MENGABAIKAN ALARM_HARI_INI di produksi dan memperingatkan sekali", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ALARM_HARI_INI", BEKU);

    expect(hariIni()).toBe(HARI_NYATA);
    expect(hariIni()).toBe(HARI_NYATA);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0].join(" ")).toMatch(/ALARM_HARI_INI/);
    expect(warn.mock.calls[0].join(" ")).toMatch(/diabaikan/i);
  });

  it("di produksi tetap bisa dipakukan HANYA bila kunci kedua eksplisit dinyalakan", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ALARM_HARI_INI", BEKU);
    vi.stubEnv("ALARM_IZINKAN_BEKU_WAKTU", "1");

    expect(hariIni()).toBe(BEKU);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0].join(" ")).toMatch(/dibekukan/i);
  });

  it("kunci kedua saja (tanpa ALARM_HARI_INI) tidak membekukan apa pun", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ALARM_IZINKAN_BEKU_WAKTU", "1");
    expect(hariIni()).toBe(HARI_NYATA);
  });

  it("nilai yang tidak berformat YYYY-MM-DD diabaikan di semua mode", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ALARM_HARI_INI", "kemarin");
    expect(hariIni()).toBe(HARI_NYATA);
  });

  it(".env.example menaruh kedua kunci di bagian 'hanya untuk pengembangan/tes' dan mengosongkannya", () => {
    const teks = readFileSync(path.resolve(process.cwd(), ".env.example"), "utf8");
    const batas = teks.indexOf("Hanya untuk pengembangan/tes");
    expect(batas, "bagian 3 .env.example harus ada").toBeGreaterThan(0);
    for (const kunci of ["ALARM_HARI_INI", ENV_IZIN_BEKU]) {
      const posisi = teks.indexOf(`\n${kunci}=`);
      expect(posisi, `${kunci} harus terdaftar di .env.example`).toBeGreaterThan(batas);
      expect(teks.slice(posisi, posisi + kunci.length + 2)).toBe(`\n${kunci}=`); // nilainya kosong
    }
    expect(teks.slice(batas)).toMatch(/DIABAIKAN saat NODE_ENV=production/);
  });
});
