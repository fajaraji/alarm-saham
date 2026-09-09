// Pemindai rahasia (scripts/pola-rahasia.mjs) — dipakai hook pre-commit
// (scripts/check-secrets.mjs) dan pemindai seluruh riwayat (npm run scan:history).
//
// CATATAN PENTING untuk yang menyunting berkas ini: setiap "kunci" contoh di
// bawah DIRANGKAI SAAT TES BERJALAN (mis. "sk-" + "ant-" + ...), tidak pernah
// ditulis utuh sebagai satu literal. Kalau ditulis utuh, berkas tes ini sendiri
// akan tercatat di riwayat git sebagai kebocoran dan `npm run scan:history`
// gagal selamanya — persis gerbang yang sedang kita uji.
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { berkasDilewati, periksaIsi, POLA } from "../../../scripts/pola-rahasia.mjs";

const akar = process.cwd();
const huruf = (n: number, c = "a") => c.repeat(n);

/** Contoh nilai berbentuk kunci, dirangkai agar tidak pernah utuh di berkas ini. */
const CONTOH: { nama: string; teks: string }[] = [
  { nama: "kunci Anthropic", teks: `const k = "${"sk-"}${"ant-"}api03-${huruf(60)}";` },
  { nama: "kunci gaya DeepSeek/OpenAI", teks: `kunci = '${"sk-"}${huruf(32, "b")}'` },
  { nama: "kunci akses AWS", teks: `aws = ${"AKIA"}${huruf(16, "Z")}` },
  { nama: "token bot Telegram", teks: `bot = 1234567890:${huruf(35, "C")}` },
  { nama: "URL Postgres berkredensial", teks: `${"postgres"}://pengguna:sandi@host/db` },
  { nama: "SECTORS_API_KEY terisi", teks: `${"SECTORS_API_KEY"}=nilai-rahasia` },
  { nama: "DEEPSEEK_API_KEY terisi", teks: `${"DEEPSEEK_API_KEY"}=nilai-rahasia` },
  { nama: "ANTHROPIC_API_KEY terisi", teks: `${"ANTHROPIC_API_KEY"}=nilai-rahasia` },
  { nama: "DATABASE_URL terisi", teks: `${"DATABASE_URL"}=nilai-rahasia` },
  { nama: "CRON_SECRET terisi", teks: `${"CRON_SECRET"}=nilai-rahasia` },
  { nama: "TELEGRAM_BOT_TOKEN terisi", teks: `${"TELEGRAM_BOT_TOKEN"}=nilai-rahasia` },
  { nama: "TELEGRAM_WEBHOOK_SECRET terisi", teks: `${"TELEGRAM_WEBHOOK_SECRET"}=nilai-rahasia` },
];

describe("pola rahasia", () => {
  it.each(CONTOH)("menangkap $nama di berkas biasa", ({ teks }) => {
    const temuan = periksaIsi("src/contoh.ts", `baris aman\n${teks}\nbaris aman lagi\n`);
    expect(temuan.length).toBeGreaterThan(0);
    expect(temuan[0].baris).toBe(2);
  });

  it("tidak pernah mengembalikan isi baris yang cocok (log CI itu publik)", () => {
    const teks = `${"SECTORS_API_KEY"}=nilai-rahasia`;
    const temuan = periksaIsi("docs/catatan.md", teks);
    expect(temuan).toHaveLength(1);
    expect(JSON.stringify(temuan)).not.toContain("nilai-rahasia");
    expect(Object.keys(temuan[0]).sort()).toEqual(["baris", "jalur", "pola"]);
  });

  it("tidak menandai pembacaan/penulisan process.env di kode (didahului titik)", () => {
    const kode = [
      `if (process.env.${"SECTORS_API_KEY"}) jalan();`,
      `process.env.${"DATABASE_URL"} = urlAsli;`,
      `const nilai = env.${"CRON_SECRET"}?.trim();`,
    ].join("\n");
    expect(periksaIsi("src/lib/contoh.ts", kode)).toEqual([]);
  });

  it("tidak menandai placeholder dokumentasi yang tidak mungkin jadi kunci", () => {
    const dokumen = [
      `Isi ${"ANTHROPIC_API_KEY"}= di .env.local (kosongkan bila tidak punya).`,
      `Kunci berawalan ${"sk-"}${"ant-"}... (titik) dan ${"sk-"}${"ant-"}xxxx hanyalah contoh.`,
    ].join("\n");
    expect(periksaIsi("README.md", dokumen)).toEqual([]);
  });

  it("melewati berkas biner (ikon, gambar, font)", () => {
    for (const berkas of ["src/app/favicon.ico", "public/logo.png", "src/font.woff2"]) {
      expect(berkasDilewati(berkas)).toBe(true);
      expect(periksaIsi(berkas, `${"SECTORS_API_KEY"}=nilai-rahasia`)).toEqual([]);
    }
  });

  it("tidak mengecualikan berkas apa pun (pengecualian = titik buta permanen)", () => {
    for (const berkas of ["scripts/pola-rahasia.mjs", "scripts/check-secrets.mjs", ".env.example"]) {
      expect(berkasDilewati(berkas)).toBe(false);
    }
  });

  it("setiap pola punya nama dan tidak cocok dengan teks sumbernya sendiri", () => {
    const sumber = readFileSync(path.join(akar, "scripts/pola-rahasia.mjs"), "utf8");
    expect(POLA.length).toBeGreaterThanOrEqual(12);
    for (const p of POLA) expect(typeof p.nama).toBe("string");
    // Kalau pola cocok dengan berkas pola itu sendiri, berkasnya harus
    // dikecualikan — dan pengecualian itulah titik buta yang ingin dihindari.
    expect(periksaIsi("scripts/pola-rahasia.mjs", sumber)).toEqual([]);
  });
});

describe(".env.example", () => {
  const isi = readFileSync(path.join(akar, ".env.example"), "utf8");

  it("bersih: berkas contoh yang di-commit tidak memicu satu temuan pun", () => {
    expect(periksaIsi(".env.example", isi)).toEqual([]);
  });

  it("tetap dipindai: nilai yang tidak sengaja diisi di sana ditolak", () => {
    // Berkas contoh dulu dikecualikan TOTAL dengan alasan "nilainya kosong" —
    // justru berkas inilah yang paling mungkin salah diisi saat menyiapkan
    // lingkungan lalu ikut ter-commit.
    const diisi = isi.replace(/^SECTORS_API_KEY=$/m, `${"SECTORS_API_KEY"}=nilai-rahasia`);
    expect(diisi).not.toBe(isi);
    expect(periksaIsi(".env.example", diisi).length).toBeGreaterThan(0);
  });

  it("menolak variabel rahasia baru yang diberi nilai di berkas contoh", () => {
    const baru = `${isi}\nLAYANAN_BARU_TOKEN=nilai-rahasia\n`;
    const temuan = periksaIsi(".env.example", baru);
    expect(temuan).toHaveLength(1);
    expect(temuan[0].pola).toContain("LAYANAN_BARU_TOKEN");
  });

  it("membiarkan nilai contoh non-rahasia (model, angka ambang, komentar)", () => {
    const aman = ["DEEPSEEK_MODEL=deepseek-v4-flash", "SECTORS_CREDIT_RESERVE=250", "# APP_URL=https://contoh.vercel.app"].join("\n");
    expect(periksaIsi(".env.example", aman)).toEqual([]);
  });
});
