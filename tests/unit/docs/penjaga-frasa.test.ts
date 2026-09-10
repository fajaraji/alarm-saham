// docs/penjaga-frasa.json adalah satu sumber kebenaran angka penjaga aturan
// lomba (b): halaman /cara-kami-menghitung membacanya, README menyebut angka
// yang sama, dan docs/decisions.md mengutipnya.
//
// Tes ini MENGHITUNG ULANG bagian `sesudah` dari korpus + penjaga yang
// sungguhan. Kalau seseorang menambah frasa ke FRASA_BACKSTOP, mengubah korpus,
// atau mengedit angkanya dengan tangan, tes ini merah — jadi halaman metodologi
// tidak bisa lagi menjanjikan angka yang tidak dimiliki kode. Nol API, nol
// kunci, nol database, jadi tidak ada jalur di-skip.
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { bacaKorpus, ringkasSesudah, ukur } from "../../../scripts/ukur-penjaga";
import { PENJAGA_FRASA } from "../../../src/lib/metodologi/penjaga";

const KORPUS = bacaKorpus(process.cwd());
const HITUNG_ULANG = ringkasSesudah(ukur(KORPUS), KORPUS);
const README = readFileSync(path.resolve(process.cwd(), "README.md"), "utf8");
const DECISIONS = readFileSync(path.resolve(process.cwd(), "docs", "decisions.md"), "utf8");

/** "58.4" → "58,4" (desimal Bahasa Indonesia seperti di README). */
function koma(n: number): string {
  return String(n).replace(".", ",");
}

describe("docs/penjaga-frasa.json", () => {
  it("bagian `sesudah` sama dengan hitung ulang dari korpus + penjaga sungguhan", () => {
    expect(PENJAGA_FRASA.sesudah).toEqual(HITUNG_ULANG);
  });

  it("presisi tetap 100% — kriteria lulus keras rancang-ulang putaran 5", () => {
    expect(PENJAGA_FRASA.sesudah.presisiPersen).toBe(100);
    expect(PENJAGA_FRASA.sesudah.harusUtuhBerubah).toBe(0);
  });

  it("mencatat pengukuran versi lama beserta commit-nya, sebagai pembanding", () => {
    expect(PENJAGA_FRASA.sebelum.commit).toMatch(/^[0-9a-f]{7,40}$/);
    expect(PENJAGA_FRASA.sebelum.harusUtuhBerubah).toBeGreaterThan(0);
    expect(PENJAGA_FRASA.sebelum.presisiPersen).toBeLessThan(100);
    // Jujur bahwa angka lama tidak bisa dihitung ulang dari kode sekarang.
    expect(PENJAGA_FRASA.sebelum.keterangan).toMatch(/tidak bisa dihitung ulang/i);
  });

  it("menyebut tanggal, korpus, cara mengukur, dan batas yang diakui", () => {
    expect(PENJAGA_FRASA.tanggal).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(PENJAGA_FRASA.korpus).toBe("tests/fixtures/korpus-anjuran.json");
    expect(PENJAGA_FRASA.caraMengukur).toMatch(/presisi/i);
    expect(PENJAGA_FRASA.caraMengukur).toMatch(/recall/i);
    expect(PENJAGA_FRASA.batasYangDiakui.length).toBeGreaterThanOrEqual(5);
    for (const b of PENJAGA_FRASA.batasYangDiakui) expect(b.length).toBeGreaterThan(30);
  });

  it("recall dilaporkan apa adanya, tanpa dibulatkan naik menjadi klaim jaminan", () => {
    const nyata = (HITUNG_ULANG.harusDitandaiKena / HITUNG_ULANG.harusDitandaiTotal) * 100;
    expect(PENJAGA_FRASA.sesudah.recallPersen).toBeCloseTo(nyata, 1);
    expect(PENJAGA_FRASA.sesudah.recallPersen).toBeLessThan(100);
  });
});

describe("README memakai angka snapshot, bukan angka yang diketik ulang", () => {
  const s = PENJAGA_FRASA.sesudah;
  const l = PENJAGA_FRASA.sebelum;

  it.each([
    ["presisi sesudah", `${s.harusUtuhTotal - s.harusUtuhBerubah}/${s.harusUtuhTotal} = ${koma(s.presisiPersen)}%`],
    ["presisi sebelum", `${l.harusUtuhTotal - l.harusUtuhBerubah}/${l.harusUtuhTotal} = ${koma(l.presisiPersen)}%`],
    ["recall sesudah", `${s.harusDitandaiKena}/${s.harusDitandaiTotal} = ${koma(s.recallPersen)}%`],
    ["recall sebelum", `${l.harusDitandaiKena}/${l.harusDitandaiTotal} = ${koma(l.recallPersen)}%`],
    ["korpus penyerang sesudah", `${s.penyerangBocorTertangkap}/${s.penyerangBocorTotal}`],
    ["korpus penyerang sebelum", `${l.penyerangBocorTertangkap}/${l.penyerangBocorTotal}`],
  ])("README memuat %s (%s)", (_nama, teks) => {
    expect(README).toContain(teks);
  });

  it("README menyebut tanggal & perintah pengukurannya", () => {
    expect(README).toContain(PENJAGA_FRASA.tanggal);
    expect(README).toContain("scripts/ukur-penjaga.ts");
    expect(README).toContain(PENJAGA_FRASA.korpus);
  });
});

describe("tidak ada dokumen yang mengklaim penyensor menangkap semua anjuran", () => {
  // Klaim-klaim inilah yang membuat empat putaran tambalan terasa aman padahal
  // bocor: masing-masing pernah ada di repo ini apa adanya.
  const KLAIM_TERLARANG: [string, RegExp][] = [
    ["kalimat yang melanggar akan dibuang seluruhnya oleh penyaring", /dibuang seluruhnya oleh penyaring/i],
    ["membuang kalimatnya tanpa syarat", /membuang kalimatnya tanpa syarat/i],
    ["penyaring menutup semua/seluruh anjuran", /penyaring[^.\n]{0,40}(semua|seluruh)\s+(kalimat|anjuran|saran)/i],
    ["penyensor memblokir semua kalimat beranjuran", /(memblokir|menangkap)\s+semua\s+(kalimat\s+)?(beranjuran|anjuran)/i],
    ["nol bocor", /\bnol bocor\b/i],
  ];

  it.each(KLAIM_TERLARANG)("README tidak mengklaim: %s", (_nama, pola) => {
    // Kalimat yang MENYANGKAL klaim itu boleh ada; yang dilarang klaimnya.
    const kalimat = README.split(/\n|(?<=\.)\s/).filter((k) => pola.test(k));
    for (const k of kalimat) {
      expect(k, k).toMatch(/tidak|bukan|TIDAK|klaim itu pernah/);
    }
  });

  it("README & decisions.md menyatakan batas backstop secara eksplisit", () => {
    expect(README).toMatch(/recall rendah dengan sengaja|TIDAK menjamin semua anjuran tertangkap/i);
    expect(README).toMatch(/tidak mengklaim punya penyensor yang\s+memblokir semua kalimat beranjuran/i);
    expect(DECISIONS).toMatch(/tidak menjamin semua anjuran tertangkap/i);
    expect(DECISIONS).toMatch(/putaran 5/i);
  });
});
