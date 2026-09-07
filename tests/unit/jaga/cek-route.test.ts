// Route POST /api/portofolio/cek di atas sumber fixture (universe-kecil), tanpa
// DB dan tanpa kunci Sectors: kelas A dinilai, kelas B "dilewati", ganda ditolak.
import { describe, expect, it, vi } from "vitest";

import { getEventSource } from "../../../src/lib/engine/sumber";

vi.mock("../../../src/lib/jaga/penyedia", () => ({
  dbJaga: async () => null,
  sumberJaga: () => getEventSource({ fixture: true }),
  providerKelasB: () => undefined,
}));

const { POST } = await import("../../../src/app/api/portofolio/cek/route");

function req(body: unknown): Request {
  return new Request("http://localhost/api/portofolio/cek", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/portofolio/cek (fixture, tanpa DB/kunci)", () => {
  it("kelas A: SRIL merah (suspensi aktif + laporan hilang), BBCA hijau; penjelasan per saham; 0 kredit", async () => {
    const res = await POST(req({ symbols: ["SRIL", "BBCA"], today: "2026-09-07" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.sumber).toMatch(/fixture/);
    expect(json.kreditTerpakai).toBe(0);
    expect(json.kelasB).toBe(false);
    const sril = json.saham.find((s: { symbol: string }) => s.symbol === "SRIL");
    const bbca = json.saham.find((s: { symbol: string }) => s.symbol === "BBCA");
    expect(sril.status).toBe("merah");
    // universe-kecil: suspensi terakhir 2024-11-01 = tanggal kejadian target (delisting) → masih aktif.
    expect(sril.suspensiAktif).toBe("2024-11-01");
    expect(sril.alasan.map((a: { kind: string }) => a.kind)).toContain("suspensi");
    expect(sril.alarmBerbunyi.map((a: { name: string }) => a.name)).toContain("Saham mau pailit");
    expect(sril.kelasB.status).toBe("nonaktif");
    expect(bbca.status).toBe("hijau");
    const teks = json.penjelasan.find((p: { symbol: string }) => p.symbol === "SRIL").teks;
    expect(teks).toMatch(/SRIL — alarm berbunyi/);
    expect(teks).toMatch(/bukan saran investasi\.$/);
  });

  it("kelasB=true tanpa kunci → dilewati dengan keterangan, tetap 200", async () => {
    const json = await (await POST(req({ symbols: ["BBCA"], kelasB: true, today: "2026-09-07" }))).json();
    expect(json.saham[0].kelasB.status).toBe("dilewati");
    expect(json.saham[0].kelasB.keterangan).toMatch(/kunci Sectors/);
    expect(json.kelasB).toBe(false);
  });

  it("alarmIds mengendalikan alarm aktif; alarm lokal dari klien ikut dinilai", async () => {
    const lokal = {
      id: "7f7f7f7f-1111-4222-8333-444444444444",
      name: "Hanya orang dalam",
      rule: { name: "Hanya orang dalam", combine: "any", blocks: [{ kind: "insider_jual", threshold: "longgar" }] },
    };
    const json = await (await POST(req({ symbols: ["SRIL"], alarmIds: [lokal.id], alarms: [lokal], today: "2026-09-07" }))).json();
    const sril = json.saham[0];
    expect(sril.alarmBerbunyi.map((a: { name: string }) => a.name)).not.toContain("Saham mau pailit");
    // Suspensi aktif tetap menjadi alasan (status merah) walau alarm bawaan dimatikan.
    expect(sril.status).toBe("merah");
  });

  it("saham ganda → 400 SAHAM_GANDA; kode salah → 400 INPUT_TIDAK_VALID; body bukan JSON → 400", async () => {
    const ganda = await POST(req({ symbols: ["BBCA", "bbca"] }));
    expect(ganda.status).toBe(400);
    expect((await ganda.json()).error.kode).toBe("SAHAM_GANDA");
    expect((await (await POST(req({ symbols: ["B"] }))).json()).error.kode).toBe("INPUT_TIDAK_VALID");
    expect((await POST(new Request("http://localhost/api/portofolio/cek", { method: "POST", body: "{" }))).status).toBe(400);
  });
});
