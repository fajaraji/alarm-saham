// Pagar laju route mahal (/api/agent/*, /api/portofolio/cek). Jam disuntik agar
// tes deterministik — tidak ada tidur dan tidak bergantung waktu nyata.
import { beforeEach, describe, expect, it } from "vitest";

import { jawabanTerlaluSering, kunciPemanggil, pagarLaju, resetPagar } from "../../../src/lib/api/pagar";

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

  it("kunci memakai token bila ada, selain itu IP proksi, selain itu 'lokal'", () => {
    const req = (h: Record<string, string> = {}) => new Request("http://x/api", { headers: h });
    expect(kunciPemanggil(req(), "abc")).toBe("token:abc");
    expect(kunciPemanggil(req({ "x-forwarded-for": "9.9.9.9, 10.0.0.1" }))).toBe("ip:9.9.9.9");
    expect(kunciPemanggil(req({ "x-real-ip": "8.8.8.8" }))).toBe("ip:8.8.8.8");
    expect(kunciPemanggil(req())).toBe("lokal");
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
