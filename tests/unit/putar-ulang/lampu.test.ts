// Pemetaan lampu: hijau (0 blok), kuning (1 blok non-suspensi), merah (>= 2 atau suspensi).
import { describe, expect, it } from "vitest";

import { fires, type FireResult, type Reason } from "../../../src/lib/engine/evaluate";
import { kosong } from "../../../src/lib/engine/events";
import { ATURAN_DEFAULT, petakanLampu } from "../../../src/lib/putar-ulang/lampu";

function alasan(kind: Reason["kind"]): Reason {
  return { kind, threshold: "longgar", detail: "uji" };
}
function hasil(...reasons: Reason[]): FireResult {
  return { fired: reasons.length > 0, reasons };
}

describe("petakanLampu", () => {
  it("tanpa blok → hijau", () => {
    expect(petakanLampu(hasil())).toMatchObject({ warna: "hijau", blok: [] });
  });

  it("satu blok bukan suspensi → kuning dengan nama blok awam", () => {
    const l = petakanLampu(hasil(alasan("ekuitas_negatif")));
    expect(l.warna).toBe("kuning");
    expect(l.blok).toEqual(["Utang lebih besar dari harta"]);
  });

  it("satu blok suspensi → merah", () => {
    expect(petakanLampu(hasil(alasan("suspensi"))).warna).toBe("merah");
  });

  it("dua blok apa pun → merah", () => {
    expect(petakanLampu(hasil(alasan("laporan_hilang"), alasan("ekuitas_negatif"))).warna).toBe("merah");
  });

  it("ATURAN_DEFAULT valid dan bekerja dengan fires: SRIL-mini merah saat suspensi berumur < 12 bulan", () => {
    expect(ATURAN_DEFAULT.blocks.map((b) => b.kind)).toEqual(["suspensi", "laporan_hilang", "ekuitas_negatif"]);
    const e = { ...kosong("UJIA"), suspensions: [{ date: "2021-05-18", reason: null }] };
    expect(petakanLampu(fires(ATURAN_DEFAULT, e, "2021-05-31")).warna).toBe("merah");
    expect(petakanLampu(fires(ATURAN_DEFAULT, e, "2021-04-30")).warna).toBe("hijau");
    // > 12 bulan setelah suspensi, blok longgar tidak lagi berbunyi → hijau (jujur mengikuti aturan).
    expect(petakanLampu(fires(ATURAN_DEFAULT, e, "2022-06-30")).warna).toBe("hijau");
  });
});
