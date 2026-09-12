// Ukur penjaga frasa terhadap korpus penyerang (tests/fixtures/korpus-anjuran.json).
//
// Mencetak presisi (bagian `harusUtuh` yang TIDAK berubah isinya) dan recall
// (bagian `harusDitandai` yang ditandai). Sengaja bisa dijalankan pada salinan
// penjaga versi LAMA maupun BARU: pembacaan hasilnya mentoleransi kedua bentuk
// `HasilSensor` (lama punya kalimatDibuang/kalimatRagu, baru punya perluTinjau),
// sehingga angka sebelum/sesudah rancang-ulang bisa dibandingkan apa adanya.
//
// Pakai: node --import tsx scripts/ukur-penjaga.ts [--rinci]
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { sensorTeks } from "../src/lib/agent/guard";

interface Baris {
  kalimat: string;
  sumber: string;
  catatan: string;
}
interface Korpus {
  harusUtuh: Baris[];
  harusDitandai: Baris[];
}

/** Bentuk hasil gabungan: penjaga lama dan baru mengembalikan medan berbeda. */
interface HasilApaPun {
  teks: string;
  kata: string[];
  kalimatDibuang?: number;
  kalimatRagu?: number;
  perluTinjau?: boolean;
}

export function bacaKorpus(akar = process.cwd()): Korpus {
  const p = path.join(akar, "tests", "fixtures", "korpus-anjuran.json");
  return JSON.parse(readFileSync(p, "utf8")) as Korpus;
}

/** true bila penjaga menandai kalimat itu sama sekali (kata, pembuangan, atau bendera). */
export function ditandai(h: HasilApaPun): boolean {
  return (
    h.kata.length > 0 ||
    (h.kalimatDibuang ?? 0) > 0 ||
    (h.kalimatRagu ?? 0) > 0 ||
    h.perluTinjau === true
  );
}

export interface Angka {
  utuhTotal: number;
  utuhBerubah: number;
  presisiPersen: number;
  ditandaiTotal: number;
  ditandaiKena: number;
  recallPersen: number;
  berubah: Baris[];
  lolos: Baris[];
}

/** Rincian per sumber baris, supaya angka penyerang bisa dilaporkan terpisah. */
export function perSumber(baris: Baris[], salah: Baris[]): Map<string, { total: number; salah: number }> {
  const m = new Map<string, { total: number; salah: number }>();
  for (const b of baris) {
    const e = m.get(b.sumber) ?? { total: 0, salah: 0 };
    e.total += 1;
    m.set(b.sumber, e);
  }
  for (const b of salah) {
    const e = m.get(b.sumber);
    if (e) e.salah += 1;
  }
  return m;
}

export function ukur(korpus: Korpus): Angka {
  const berubah: Baris[] = [];
  for (const b of korpus.harusUtuh) {
    const h = sensorTeks(b.kalimat) as HasilApaPun;
    if (h.teks !== b.kalimat) berubah.push(b);
  }
  const lolos: Baris[] = [];
  let kena = 0;
  for (const b of korpus.harusDitandai) {
    const h = sensorTeks(b.kalimat) as HasilApaPun;
    if (ditandai(h)) kena += 1;
    else lolos.push(b);
  }
  const utuhTotal = korpus.harusUtuh.length;
  const ditandaiTotal = korpus.harusDitandai.length;
  return {
    utuhTotal,
    utuhBerubah: berubah.length,
    presisiPersen: utuhTotal === 0 ? 100 : ((utuhTotal - berubah.length) / utuhTotal) * 100,
    ditandaiTotal,
    ditandaiKena: kena,
    recallPersen: ditandaiTotal === 0 ? 0 : (kena / ditandaiTotal) * 100,
    berubah,
    lolos,
  };
}

/** Sumber baris yang dikarang penyerang putaran 4 (dilaporkan terpisah). */
export const SUMBER_BOCOR = "serang:pemburu-bocor";
export const SUMBER_RAKUS = "serang:pemburu-rakus";

/** Angka yang di-commit ke docs/penjaga-frasa.json (dibulatkan satu desimal). */
export function ringkasSesudah(a: Angka, korpus = bacaKorpus()): {
  harusUtuhTotal: number;
  harusUtuhBerubah: number;
  presisiPersen: number;
  harusDitandaiTotal: number;
  harusDitandaiKena: number;
  recallPersen: number;
  penyerangBocorTotal: number;
  penyerangBocorTertangkap: number;
  penyerangRakusTotal: number;
  penyerangRakusTermakan: number;
} {
  const bocor = perSumber(korpus.harusDitandai, a.lolos).get(SUMBER_BOCOR) ?? { total: 0, salah: 0 };
  const rakus = perSumber(korpus.harusUtuh, a.berubah).get(SUMBER_RAKUS) ?? { total: 0, salah: 0 };
  return {
    harusUtuhTotal: a.utuhTotal,
    harusUtuhBerubah: a.utuhBerubah,
    presisiPersen: Number(a.presisiPersen.toFixed(1)),
    harusDitandaiTotal: a.ditandaiTotal,
    harusDitandaiKena: a.ditandaiKena,
    recallPersen: Number(a.recallPersen.toFixed(1)),
    penyerangBocorTotal: bocor.total,
    penyerangBocorTertangkap: bocor.total - bocor.salah,
    penyerangRakusTotal: rakus.total,
    penyerangRakusTermakan: rakus.salah,
  };
}

const BERKAS_SNAPSHOT = path.join("docs", "penjaga-frasa.json");

function tulisSnapshot(a: Angka): void {
  const p = path.join(process.cwd(), BERKAS_SNAPSHOT);
  // Bagian `sebelum` TIDAK bisa dihitung ulang dari kode saat ini (penjaga lama
  // sudah diganti), jadi ia dipertahankan apa adanya dari berkas yang ada dan
  // hanya bagian `sesudah` yang ditulis ulang.
  const lama = JSON.parse(readFileSync(p, "utf8")) as Record<string, unknown>;
  const baru = { ...lama, sesudah: ringkasSesudah(a) };
  writeFileSync(p, `${JSON.stringify(baru, null, 2)}\n`, "utf8");
  console.log(`snapshot ditulis: ${BERKAS_SNAPSHOT}`);
}

function utama(): void {
  const rinci = process.argv.includes("--rinci");
  const a = ukur(bacaKorpus());
  if (process.argv.includes("--snapshot")) tulisSnapshot(a);
  console.log(`PRESISI (harusUtuh tidak berubah): ${a.utuhTotal - a.utuhBerubah}/${a.utuhTotal} = ${a.presisiPersen.toFixed(1)}%`);
  console.log(`RECALL  (harusDitandai tertangkap): ${a.ditandaiKena}/${a.ditandaiTotal} = ${a.recallPersen.toFixed(1)}%`);
  console.log(`TERMAKAN (kalimat sah yang berubah isinya): ${a.utuhBerubah}`);
  console.log(`BOCOR    (anjuran tanpa penanda apa pun): ${a.lolos.length}`);
  const k = bacaKorpus();
  console.log("\n--- rincian per sumber ---");
  for (const [sumber, v] of perSumber(k.harusUtuh, a.berubah)) {
    console.log(`  harusUtuh   [${sumber}]: termakan ${v.salah}/${v.total}`);
  }
  for (const [sumber, v] of perSumber(k.harusDitandai, a.lolos)) {
    console.log(`  harusDitandai [${sumber}]: bocor ${v.salah}/${v.total} (tertangkap ${v.total - v.salah}/${v.total})`);
  }
  if (rinci) {
    console.log("\n--- kalimat sah yang BERUBAH (harus 0) ---");
    for (const b of a.berubah) console.log(`  [${b.sumber}] ${b.kalimat}\n      -> ${(sensorTeks(b.kalimat) as HasilApaPun).teks}`);
    console.log("\n--- anjuran yang BOCOR tanpa penanda ---");
    for (const b of a.lolos) console.log(`  [${b.sumber}] ${b.kalimat}`);
  }
}

/** true hanya bila berkas ini yang dijalankan langsung (bukan diimpor Vitest). */
function dijalankanLangsung(): boolean {
  const argv = process.argv[1];
  if (!argv) return false;
  try {
    return fileURLToPath(import.meta.url) === path.resolve(argv);
  } catch {
    return false;
  }
}

if (dijalankanLangsung()) utama();
