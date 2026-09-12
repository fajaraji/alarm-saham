// Audit kata terlarang di seluruh copy UI (PLAN.md §5 Q5, tiket 13).
//
// Memindai src/**/*.ts|tsx dengan parser TypeScript: hanya isi string literal,
// template literal, dan teks JSX (komentar & nama identifier tidak ikut), lalu
// mencari POLA di bawah. Dua kelompok:
//   - anjuran/saran investasi (aturan lomba (b)): beli, jual, rekomendasi,
//     akumulasi, target harga, cut loss, take profit, layak dikoleksi/dibeli,
//     aman dibeli, saatnya masuk, peluang cuan;
//   - tuduhan/penilaian terhadap emiten: gorengan, berbahaya, akan pailit,
//     akan bangkrut, bandar, manipulasi, digoreng, penipu, scam.
// Kata "saran" sendiri TIDAK dilarang: kalimat disclaimer wajib berbunyi
// "bukan saran investasi".
//
// Pengecualian EKSPLISIT (istilah faktual yang memang diperlukan):
//   - "filing jual" / "transaksi jual" / "tipe jual" / "transaction_type=sell":
//     nama jenis laporan resmi di feed filings Sectors (bukan saran).
//   - Berkas penjaga & instruksi agent (guard.ts, instructions.ts): memuat daftar
//     kata terlarang justru untuk MENYENSORnya; rakit.ts: deskripsi skema untuk
//     model ("ditolak bila meminta rekomendasi").
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import ts from "typescript";
import { describe, expect, it } from "vitest";

const POLA =
  /\b(beli|jual|rekomendasi|akumulasi|target harga|cut ?loss|take[ -]?profit|layak dikoleksi|layak dibeli|aman dibeli|saatnya masuk|peluang cuan|gorengan|berbahaya|akan pailit|akan bangkrut|bandar|manipulasi|digoreng|penipu|scam)\b/gi;

/** Frasa faktual yang dihapus dari teks sebelum dicocokkan. */
const PENGECUALIAN_FRASA: RegExp[] = [/filing jual/gi, /transaksi jual/gi, /tipe jual/gi, /transaction_type=sell/gi];

/** Berkas yang sengaja memuat kata terlarang (penyensor / instruksi model). */
const PENGECUALIAN_BERKAS = ["src/lib/agent/guard.ts", "src/lib/agent/instructions.ts", "src/lib/agent/rakit.ts"];

function daftarBerkas(dir: string, keluar: string[] = []): string[] {
  for (const nama of readdirSync(dir)) {
    const p = path.join(dir, nama);
    if (statSync(p).isDirectory()) daftarBerkas(p, keluar);
    else if (/\.tsx?$/.test(nama) && !/\.test\.tsx?$/.test(nama)) keluar.push(p);
  }
  return keluar;
}

/** Semua teks "yang bisa dibaca manusia" dalam satu berkas: string, template, teks JSX. */
function teksDalamBerkas(file: string): { teks: string; baris: number }[] {
  const kode = readFileSync(file, "utf8");
  const sf = ts.createSourceFile(file, kode, ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const hasil: { teks: string; baris: number }[] = [];
  function kunjungi(n: ts.Node) {
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n) || ts.isJsxText(n)) {
      const teks = n.text.trim();
      if (teks) hasil.push({ teks, baris: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1 });
    }
    ts.forEachChild(n, kunjungi);
  }
  kunjungi(sf);
  return hasil;
}

const AKAR = path.resolve(process.cwd(), "src");

describe("copy UI tanpa kata terlarang (PLAN §5 Q5)", () => {
  const berkas = daftarBerkas(AKAR).filter((f) => !PENGECUALIAN_BERKAS.includes(path.relative(process.cwd(), f).replaceAll("\\", "/")));

  it("memindai puluhan berkas (bukan daftar kosong)", () => {
    expect(berkas.length).toBeGreaterThan(40);
  });

  it("tidak ada string/teks JSX yang memuat kata anjuran atau tuduhan", () => {
    const temuan: string[] = [];
    for (const f of berkas) {
      for (const { teks, baris } of teksDalamBerkas(f)) {
        let bersih = teks;
        for (const p of PENGECUALIAN_FRASA) bersih = bersih.replace(p, "");
        const cocok = [...bersih.matchAll(POLA)].map((m) => m[0]);
        if (cocok.length) temuan.push(`${path.relative(process.cwd(), f)}:${baris} [${cocok.join(", ")}] ${teks.slice(0, 80)}`);
      }
    }
    expect(temuan, temuan.join("\n")).toEqual([]);
  });

  it("pengecualian frasa hanya menutupi istilah faktual, bukan kalimat saran", () => {
    for (const p of PENGECUALIAN_FRASA) expect(String(p)).not.toMatch(/beli|rekomendasi|gorengan|berbahaya|pailit/);
    expect(PENGECUALIAN_FRASA.map(String)).not.toContain(String(/jual/gi));
  });

  it("parser menangkap string biasa, template, dan teks JSX", () => {
    const contoh = path.join(process.cwd(), "src/components/rakit/teks.ts");
    const teks = teksDalamBerkas(contoh).map((t) => t.teks);
    expect(teks).toContain("Uji ke masa lalu");
    const jsx = path.join(process.cwd(), "src/components/panduan/FooterDisclaimer.tsx");
    expect(teksDalamBerkas(jsx).some((t) => /tidak ada penilaian/.test(t.teks))).toBe(true);
  });
});
