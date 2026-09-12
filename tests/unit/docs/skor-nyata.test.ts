// Snapshot skor nyata (docs/skor-nyata.json) harus sama dengan hitung ulang
// mesin uji di atas PGlite lokal ./.pglite (hasil tiket 07). Nol panggilan API.
//
// Bila ./.pglite tidak ada (mis. clone bersih tanpa data), tes hitung ulang
// di-skip dengan pesan; tes bentuk snapshot tetap berjalan.
import { existsSync } from "node:fs";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { GROUPS } from "../../../src/lib/engine/events";
import aturanDefault from "../../../src/lib/engine/fixtures/aturan-default.json";
import { BLOCK_KINDS } from "../../../src/lib/engine/rules";
import { parseRule } from "../../../src/lib/engine/rules";
import { runBacktest } from "../../../src/lib/engine/score";
import { getEventSource, type SumberKejadian } from "../../../src/lib/engine/sumber";
import { ringkasSkor, SKOR_NYATA } from "../../../src/lib/metodologi/skor";

const DIR_PGLITE = path.resolve(process.cwd(), ".pglite");
// `TANPA_PGLITE=1` memaksa jalur "seolah folder tidak ada" — cara aman menguji
// perilaku clone bersih tanpa menghapus data lokal (lihat src/lib/engine/sumber.ts).
const dipaksaTanpa = process.env.TANPA_PGLITE === "1";
const adaPglite = !dipaksaTanpa && existsSync(DIR_PGLITE);
if (!adaPglite) {
  console.warn(
    `[skor-nyata] Hitung ulang DI-SKIP: ${
      dipaksaTanpa ? "TANPA_PGLITE=1 diset" : `folder PGlite ${DIR_PGLITE} tidak ada`
    }. Jalankan \`npm run pull-universe -- --pglite\` (butuh SECTORS_API_KEY & kredit) untuk membangunnya.`,
  );
}

describe("docs/skor-nyata.json: bentuk snapshot", () => {
  it("memuat aturan default, tanggal uji, dan ringkasan yang konsisten dengan rincian per emiten", () => {
    const aturan = parseRule(aturanDefault);
    expect(SKOR_NYATA.rule).toBe(aturan.name);
    expect(SKOR_NYATA.today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(SKOR_NYATA.perSymbol.length).toBe(SKOR_NYATA.total + SKOR_NYATA.controls);
    for (const g of GROUPS) {
      const rows = SKOR_NYATA.perGroup[g].perSymbol;
      expect(rows.every((r) => r.group === g), g).toBe(true);
    }
    const kena = SKOR_NYATA.perSymbol.filter((r) => r.group !== "control");
    expect(kena.filter((r) => r.fired).length).toBe(SKOR_NYATA.hits);
    expect(SKOR_NYATA.perSymbol.filter((r) => r.group === "control" && r.fired).length).toBe(SKOR_NYATA.falseAlarms);
    for (const r of SKOR_NYATA.perSymbol) {
      for (const a of r.reasons) expect(BLOCK_KINDS).toContain(a.kind);
    }
  });

  it("tidak memuat nama pemegang saham (hanya simbol, group, tanggal, lead, alasan)", () => {
    const teks = JSON.stringify(SKOR_NYATA);
    expect(teks).not.toMatch(/holder_name|holderName|shareholder/i);
  });
});

describe.skipIf(!adaPglite)("docs/skor-nyata.json: hitung ulang dari PGlite ./.pglite", () => {
  let sumber: SumberKejadian;
  const urlAsli = process.env.DATABASE_URL;

  beforeAll(async () => {
    // Paksa jalur PGlite lokal (bukan Neon) agar snapshot dibandingkan dengan sumber yang sama.
    delete process.env.DATABASE_URL;
    sumber = await getEventSource({ pglite: true });
  }, 120_000);

  afterAll(async () => {
    if (urlAsli !== undefined) process.env.DATABASE_URL = urlAsli;
    await sumber?.tutup();
  });

  it("angka ringkasan (hits, per group, falseAlarms, leadAvg/median, dilewati) sama dengan snapshot", async () => {
    expect(sumber.jenis).toBe("pglite");
    const semua = await sumber.universe();
    const tanpaTarget = semua.filter((u) => u.group !== "control" && !u.targetEventDate);
    const universe = semua.filter((u) => !tanpaTarget.includes(u));
    const hasil = await runBacktest(parseRule(aturanDefault), universe, sumber.source, { today: SKOR_NYATA.today });

    const ulang = ringkasSkor({ ...hasil, skippedNoTarget: tanpaTarget.map((u) => u.symbol) });
    expect(ulang).toEqual(ringkasSkor(SKOR_NYATA));

    // Rincian per emiten juga harus identik (bukti reproduksi penuh, bukan hanya angka ringkasan).
    expect(hasil.perSymbol).toEqual(SKOR_NYATA.perSymbol);
  }, 180_000);
});
