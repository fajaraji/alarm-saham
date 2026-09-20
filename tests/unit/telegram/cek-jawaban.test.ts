// Isi jawaban /cek (tiket 43) di atas fixture universe-kecil: nol kredit, nol
// panggilan API, dan `sumberJaga` ditiru agar tes tidak pernah membuka ./.pglite
// milik pengembang (lihat tests/unit/pglite-salinan.ts).
import { describe, expect, it, vi } from "vitest";

import { fromFixture } from "../../../src/lib/engine/events";
import universeKecil from "../../../src/lib/engine/fixtures/universe-kecil.json";

const fx = fromFixture(universeKecil);

vi.mock("../../../src/lib/jaga/penyedia", () => ({
  sumberJaga: async () => ({
    jenis: "fixture" as const,
    keterangan: "fixture universe-kecil.json",
    source: fx,
    db: null,
    universe: async () => fx.universe,
    tutup: async () => {},
  }),
  dbJaga: async () => null,
  providerKelasB: () => undefined,
}));

const { jawabanCek, TEKS_CEK } = await import("../../../src/lib/telegram/cek");

describe("jawabanCek", () => {
  it("kode kosong dan kode ngawur dijawab tanpa menjalankan apa pun", async () => {
    expect(await jawabanCek("   ")).toBe(TEKS_CEK.kosong);
    expect(await jawabanCek("saham apa ya")).toMatch(/bukan kode saham/);
  });

  it("saham dengan tanda: sebut status, jumlah syarat, tanggal, dan sumbernya", async () => {
    const teks = await jawabanCek(" sril ");
    expect(teks).toMatch(/^SRIL \(/);
    expect(teks).toMatch(/syarat terpenuhi/);
    expect(teks).toMatch(/sumber: data contoh/);
  });

  it("saham di luar data kami dijawab jujur 'belum bisa dinilai', bukan aman", async () => {
    const teks = await jawabanCek("ZZZZ");
    expect(teks).toMatch(/belum bisa dinilai/);
    expect(teks).toMatch(/tidak ada di/);
    expect(teks).not.toMatch(/aman/i);
  });

  it("tanpa database, kalimat tanggal penarikan data tidak dikarang", async () => {
    expect(await jawabanCek("BBCA")).not.toMatch(/ditarik terakhir/);
  });
});
