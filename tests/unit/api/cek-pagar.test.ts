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

  // -------------------------------------------------------------------
  // Ember per JENIS operasi. Saat kelas A dan kelas B berbagi satu kunci
  // `ip:<IP>`, permintaan nol kredit menghabiskan jatah permintaan berbayar:
  // enam klik "Cek sekarang" dalam 10 menit membuat permintaan "Sertakan data
  // terkini" yang PERTAMA langsung ditolak 429 (tunggu 600 detik). Semua tes
  // lama memanggil resetPagar() lebih dulu sehingga interaksi antar-kelas ini
  // tidak pernah teruji — termasuk tes bernama "kelas A tetap longgar".
  // -------------------------------------------------------------------
  it("kelas A yang nol kredit TIDAK menghabiskan jatah kelas B", async () => {
    const ip = "203.0.113.11";
    // Sepuluh permintaan kelas A dari IP yang sama (masih di bawah 60/menit).
    for (let i = 0; i < 10; i++) {
      const r = await POST(req({ token: tokenBaru(), ip, kelasB: false }));
      expect(r.status, `kelas A #${i + 1}`).not.toBe(429);
    }
    // Kelas B berikutnya harus tetap punya jatah penuh 6 per 10 menit.
    const kelasB: number[] = [];
    for (let i = 0; i < 6; i++) kelasB.push((await POST(req({ token: tokenBaru(), ip }))).status);
    expect(kelasB.some((s) => s === 429), `status kelas B: ${kelasB.join(",")}`).toBe(false);
  });

  it("kelas B tetap dibatasi 6 per 10 menit walau kelas A sudah dipakai", async () => {
    const ip = "203.0.113.12";
    for (let i = 0; i < 10; i++) await POST(req({ token: tokenBaru(), ip, kelasB: false }));
    for (let i = 0; i < 6; i++) await POST(req({ token: tokenBaru(), ip }));
    const lebih = await POST(req({ token: tokenBaru(), ip }));
    expect(lebih.status).toBe(429);
  });

  it("kelas B yang sudah habis TIDAK mematikan kelas A yang nol kredit", async () => {
    const ip = "203.0.113.13";
    for (let i = 0; i < 7; i++) await POST(req({ token: tokenBaru(), ip }));
    const habis = await POST(req({ token: tokenBaru(), ip }));
    expect(habis.status, "kelas B seharusnya sudah habis").toBe(429);
    const kelasA = await POST(req({ token: tokenBaru(), ip, kelasB: false }));
    expect(kelasA.status).not.toBe(429);
  });
});
