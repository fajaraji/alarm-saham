// Konfigurasi Vercel Cron (tiket 12): vercel.json valid, menunjuk route yang
// ada, jadwal 5 kolom "30 23 * * *" = 06:30 WIB (cron Vercel selalu UTC), dan
// .env.example mendokumentasikan rahasia yang dibutuhkan.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const akar = process.cwd();

describe("vercel.json", () => {
  const cfg = JSON.parse(readFileSync(path.join(akar, "vercel.json"), "utf8")) as { crons?: { path: string; schedule: string }[] };

  it("punya tepat satu cron ke /api/cron/jaga (batas Hobby: 1x/hari, presisi per jam)", () => {
    expect(cfg.crons).toHaveLength(1);
    const [c] = cfg.crons!;
    expect(c.path).toBe("/api/cron/jaga");
    expect(existsSync(path.join(akar, "src/app/api/cron/jaga/route.ts"))).toBe(true);
  });

  it("jadwal 30 23 * * * = 06:30 WIB; ekspresi 5 kolom tanpa nama hari/bulan", () => {
    const [c] = cfg.crons!;
    const kolom = c.schedule.trim().split(/\s+/);
    expect(kolom).toHaveLength(5);
    expect(kolom).toEqual(["30", "23", "*", "*", "*"]);
    expect(c.schedule).not.toMatch(/[A-Za-z]/);
    const menitUtc = Number(kolom[1]) * 60 + Number(kolom[0]);
    const menitWib = (menitUtc + 7 * 60) % (24 * 60);
    expect(`${String(Math.floor(menitWib / 60)).padStart(2, "0")}:${String(menitWib % 60).padStart(2, "0")}`).toBe("06:30");
  });

  // Impor route menarik PGlite/grammY/AI SDK (±4 s dingin); saat suite penuh
  // berjalan paralel bisa melewati batas 5 s bawaan — beri batas eksplisit.
  it("route cron memakai maxDuration <= 300 (batas fungsi Vercel Hobby)", async () => {
    const route = await import("../../src/app/api/cron/jaga/route");
    expect(route.maxDuration).toBeLessThanOrEqual(300);
    expect(typeof route.GET).toBe("function");
  }, 30_000);
});

describe(".env.example", () => {
  const isi = readFileSync(path.join(akar, ".env.example"), "utf8");
  it.each(["CRON_SECRET", "TELEGRAM_BOT_TOKEN", "TELEGRAM_WEBHOOK_SECRET"])("mendokumentasikan %s dengan nilai kosong", (kunci) => {
    expect(isi).toMatch(new RegExp(`^${kunci}=\\s*$`, "m"));
  });
});
