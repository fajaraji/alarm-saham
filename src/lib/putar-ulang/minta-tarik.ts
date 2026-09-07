// "Minta ditarik": permintaan pengguna agar emiten di luar universe ditarik nanti.
// HANYA mencatat (berkas log JSONL lokal + console); tidak pernah memanggil API
// Sectors — penarikan tetap keputusan manusia dengan anggaran kredit.
import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

export const BERKAS_PERMINTAAN = path.join(".cache", "permintaan-tarik.jsonl");

export interface PermintaanTarik {
  symbol: string;
  at: string;
  /** Dari mana permintaan datang (mis. "putar-ulang"). */
  asal: string;
}

export interface HasilCatat {
  permintaan: PermintaanTarik;
  /** "berkas" bila tersimpan ke JSONL, "log" bila hanya ke console (mis. sistem berkas hanya-baca). */
  disimpanDi: "berkas" | "log";
}

export async function catatPermintaanTarik(symbol: string, asal = "putar-ulang"): Promise<HasilCatat> {
  const permintaan: PermintaanTarik = { symbol, at: new Date().toISOString(), asal };
  const baris = `${JSON.stringify(permintaan)}\n`;
  try {
    const berkas = path.resolve(process.cwd(), BERKAS_PERMINTAAN);
    await mkdir(path.dirname(berkas), { recursive: true });
    await appendFile(berkas, baris, "utf8");
    return { permintaan, disimpanDi: "berkas" };
  } catch {
    console.log(`[minta-tarik] ${baris.trim()}`);
    return { permintaan, disimpanDi: "log" };
  }
}
