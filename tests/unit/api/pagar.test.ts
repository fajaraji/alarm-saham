// Pagar laju route mahal (/api/agent/*, /api/portofolio/cek). Jam disuntik agar
// tes deterministik — tidak ada tidur dan tidak bergantung waktu nyata.
import { beforeEach, describe, expect, it } from "vitest";

import {
  ipPemanggil,
  jawabanTerlaluSering,
  kunciEmber,
  kunciPemanggil,
  kunciPemanggilServer,
  pagarLaju,
  resetPagar,
} from "../../../src/lib/api/pagar";

describe("pagarLaju", () => {
  beforeEach(() => resetPagar());

  it("meloloskan sampai batas, lalu menolak dengan sisa waktu tunggu", () => {
    let t = 1_000_000;
    const opsi = { maks: 3, jendelaMs: 60_000, sekarang: () => t };
    for (let i = 0; i < 3; i++) expect(pagarLaju("ip:1.2.3.4", opsi).lolos).toBe(true);
    const tolak = pagarLaju("ip:1.2.3.4", opsi);
    expect(tolak.lolos).toBe(false);
    expect(tolak.tungguDetik).toBe(60);
    // Setelah jendela lewat, kuota pulih.
    t += 60_001;
    expect(pagarLaju("ip:1.2.3.4", opsi).lolos).toBe(true);
  });

  it("ember terpisah per kunci", () => {
    const opsi = { maks: 1, jendelaMs: 60_000, sekarang: () => 5_000 };
    expect(pagarLaju("ip:a", opsi).lolos).toBe(true);
    expect(pagarLaju("ip:a", opsi).lolos).toBe(false);
    expect(pagarLaju("ip:b", opsi).lolos).toBe(true);
  });

  // Identitas pembatas HARUS datang dari server. `x-owner-token` dibuat sendiri
  // oleh peramban (UUID di localStorage, tanpa pendaftaran), jadi kalau ia
  // menentukan ember, penyerang cukup mengganti token tiap permintaan.
  it("kunci memakai IP dari proksi lebih dulu; token hanya cadangan tanpa IP", () => {
    const req = (h: Record<string, string> = {}) => new Request("http://x/api", { headers: h });
    expect(kunciPemanggil(req({ "x-real-ip": "8.8.8.8" }), "abc")).toBe("ip:8.8.8.8");
    expect(kunciPemanggil(req(), "abc")).toBe("token:abc");
    expect(kunciPemanggil(req())).toBe("lokal");
  });

  it("x-forwarded-for dibaca dari hop TERAKHIR (entri pertama bisa dipalsukan klien)", () => {
    const req = (h: Record<string, string> = {}) => new Request("http://x/api", { headers: h });
    // Klien mengirim "9.9.9.9" sendiri, proksi menambahkan IP asli di belakang.
    expect(kunciPemanggil(req({ "x-forwarded-for": "9.9.9.9, 10.0.0.1" }))).toBe("ip:10.0.0.1");
    // Header yang diisi proksi menang atas x-forwarded-for.
    expect(kunciPemanggil(req({ "x-forwarded-for": "9.9.9.9", "x-real-ip": "10.0.0.1" }))).toBe("ip:10.0.0.1");
    expect(
      kunciPemanggil(req({ "x-real-ip": "10.0.0.1", "x-vercel-forwarded-for": "10.0.0.2" })),
    ).toBe("ip:10.0.0.2");
  });

  it("kunciPemanggilServer mengabaikan token sepenuhnya", () => {
    const req = (h: Record<string, string>) => new Request("http://x/api", { headers: h });
    const a = kunciPemanggilServer(req({ "x-real-ip": "8.8.8.8", "x-owner-token": "a".repeat(36) }));
    const b = kunciPemanggilServer(req({ "x-real-ip": "8.8.8.8", "x-owner-token": "b".repeat(36) }));
    expect(a).toBe("ip:8.8.8.8");
    expect(b).toBe(a);
    expect(ipPemanggil(req({}))).toBeNull();
  });

  // Satu ember bersama membuat batas paling ketat berlaku untuk semua route:
  // permintaan nol kredit menghabiskan jatah permintaan berbayar.
  it("kunciEmber memisahkan jatah per jenis operasi pada identitas yang sama", () => {
    const identitas = "ip:203.0.113.7";
    const opsi = { maks: 1, jendelaMs: 60_000, sekarang: () => 9_000 };
    expect(pagarLaju(kunciEmber("cek-kelas-a", identitas), opsi).lolos).toBe(true);
    expect(pagarLaju(kunciEmber("cek-kelas-a", identitas), opsi).lolos).toBe(false);
    // Ember lain dengan identitas yang sama masih penuh…
    for (const ember of ["cek-kelas-b", "agent-rakit", "agent-diagnosis", "minta-tarik"] as const) {
      expect(pagarLaju(kunciEmber(ember, identitas), opsi).lolos, ember).toBe(true);
      // …tetapi tetap dibatasi sendiri.
      expect(pagarLaju(kunciEmber(ember, identitas), opsi).lolos, ember).toBe(false);
    }
    expect(kunciEmber("cek-kelas-b", identitas)).not.toBe(kunciEmber("cek-kelas-a", identitas));
  });

  it("jawaban 429 memakai bahasa awam dan header Retry-After", async () => {
    const res = jawabanTerlaluSering(42);
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("42");
    const body = (await res.json()) as { error: { kode: string; pesan: string } };
    expect(body.error.kode).toBe("TERLALU_SERING");
    expect(body.error.pesan).toContain("42 detik");
  });
});
