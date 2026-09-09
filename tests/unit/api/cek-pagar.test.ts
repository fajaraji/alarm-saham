// Pagar laju /api/portofolio/cek untuk kelas B (satu-satunya route yang
// MEMBELANJAKAN kredit Sectors).
//
// Yang dijaga: embernya tidak boleh ditentukan nilai yang dipilih klien.
// `x-owner-token` dibuat sendiri oleh peramban (uuid di localStorage, tanpa
// pendaftaran), jadi kalau kunci ember ikut token, penyerang cukup mengirim
// UUID baru tiap permintaan untuk selalu mendapat kuota kosong.
import { beforeEach, describe, expect, it, vi } from "vitest";

import { resetPagar } from "../../../src/lib/api/pagar";
import { getEventSource } from "../../../src/lib/engine/sumber";

vi.mock("../../../src/lib/jaga/penyedia", () => ({
  // Fixture: nol panggilan API, nol kredit — yang diuji hanya pagarnya.
  sumberJaga: async () => getEventSource({ fixture: true }),
  dbJaga: async () => null,
  providerKelasB: () => undefined,
}));

const { POST } = await import("../../../src/app/api/portofolio/cek/route");

/** UUID acak baru: persis yang dilakukan peramban penyerang tiap permintaan. */
function tokenBaru(): string {
  return crypto.randomUUID();
}

function req(opsi: { token?: string | null; ip?: string; xff?: string; kelasB?: boolean }): Request {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (opsi.token) headers["x-owner-token"] = opsi.token;
  if (opsi.ip) headers["x-real-ip"] = opsi.ip;
  if (opsi.xff) headers["x-forwarded-for"] = opsi.xff;
  return new Request("http://localhost/api/portofolio/cek", {
    method: "POST",
    headers,
    body: JSON.stringify({ symbols: ["BBCA"], kelasB: opsi.kelasB ?? true }),
  });
}

describe("/api/portofolio/cek — pagar kelas B tidak bisa dilewati klien", () => {
  beforeEach(() => resetPagar());

  it("token baru tiap permintaan TIDAK memberi ember kuota baru (batas 6 per 10 menit)", async () => {
    const ip = "203.0.113.7";
    const status: number[] = [];
    for (let i = 0; i < 8; i++) status.push((await POST(req({ token: tokenBaru(), ip }))).status);
    // 6 pertama lolos pagar (apa pun hasil isinya), sisanya harus 429.
    expect(status.slice(0, 6).every((s) => s !== 429), `status: ${status.join(",")}`).toBe(true);
    expect(status.slice(6)).toEqual([429, 429]);
  });

  it("x-forwarded-for yang dipalsukan klien tidak membuat ember baru selama proksi mengisi x-real-ip", async () => {
    const ip = "203.0.113.8";
    const status: number[] = [];
    for (let i = 0; i < 8; i++) {
      status.push((await POST(req({ token: tokenBaru(), ip, xff: `10.0.0.${i}, ${ip}` }))).status);
    }
    expect(status.slice(6)).toEqual([429, 429]);
  });

  it("429 menjelaskan waktu tunggu dalam bahasa awam", async () => {
    const ip = "203.0.113.9";
    for (let i = 0; i < 6; i++) await POST(req({ token: tokenBaru(), ip }));
    const res = await POST(req({ token: tokenBaru(), ip }));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBeTruthy();
    const body = (await res.json()) as { error: { kode: string; pesan: string } };
    expect(body.error.kode).toBe("TERLALU_SERING");
  });

  it("ember global kelas B menahan serangan dari banyak IP sekaligus", async () => {
    // Tiap permintaan memakai IP DAN token yang berbeda: pagar per-IP tidak
    // pernah kena, jadi yang harus menahan adalah ember global kelas B.
    const status: number[] = [];
    for (let i = 0; i < 40; i++) {
      status.push((await POST(req({ token: tokenBaru(), ip: `198.51.100.${i}` }))).status);
    }
    expect(status.filter((s) => s === 429).length, `status: ${status.join(",")}`).toBeGreaterThan(0);
  });

  it("kelas A (nol kredit) tetap longgar: 8 permintaan berturut-turut lolos", async () => {
    const ip = "203.0.113.10";
    const status: number[] = [];
    for (let i = 0; i < 8; i++) status.push((await POST(req({ token: tokenBaru(), ip, kelasB: false }))).status);
    expect(status.includes(429)).toBe(false);
  });
});
