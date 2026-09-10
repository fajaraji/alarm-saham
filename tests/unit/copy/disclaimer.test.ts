// Kalimat disclaimer wajib (PLAN.md §2) hanya boleh punya SATU sumber.
// Sebelumnya ada dua konstanta bernama `DISCLAIMER` dengan bunyi berbeda di dua
// modul, sehingga kalimat wajib bisa berubah di satu tempat tanpa yang lain ikut.
import { describe, expect, it } from "vitest";

import { DISCLAIMER as DISCLAIMER_KAMUS } from "../../../src/components/panduan/kamus";
import { DISCLAIMER as DISCLAIMER_AGENT } from "../../../src/lib/agent/instructions";
import { DISCLAIMER_PESAN, DISCLAIMER_UI, KLAUSA_INTI } from "../../../src/lib/disclaimer";

describe("disclaimer", () => {
  it("kedua konstanta berasal dari src/lib/disclaimer.ts", () => {
    expect(DISCLAIMER_KAMUS).toBe(DISCLAIMER_UI);
    expect(DISCLAIMER_AGENT).toBe(DISCLAIMER_PESAN);
  });

  it("bunyi pesan keluar persis seperti PLAN.md §2", () => {
    expect(DISCLAIMER_PESAN).toBe("Alarm Saham adalah alat informasi, bukan saran investasi.");
  });

  it("keduanya memuat klausa inti dan menyebut nama produk", () => {
    for (const teks of [DISCLAIMER_PESAN, DISCLAIMER_UI]) {
      expect(teks).toContain(KLAUSA_INTI);
      expect(teks.startsWith("Alarm Saham adalah")).toBe(true);
      expect(teks.endsWith(".")).toBe(true);
    }
  });
});
