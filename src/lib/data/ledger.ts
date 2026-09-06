import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";

/** Satu baris buku kredit: satu panggilan (termasuk cache hit dan error). */
export interface BarisLedger {
  ts: string; // ISO 8601
  endpoint: string; // path tanpa base URL, mis. /v2/suspensions/
  params: Record<string, string>;
  status: number | null; // null = gagal jaringan
  credits: number;
  cacheHit: boolean;
  note?: string;
}

export const NAMA_FILE_LEDGER = "ledger.jsonl";

export class Ledger {
  readonly file: string;

  constructor(dir: string) {
    this.file = path.join(dir, NAMA_FILE_LEDGER);
  }

  async catat(baris: BarisLedger): Promise<void> {
    await mkdir(path.dirname(this.file), { recursive: true });
    await appendFile(this.file, JSON.stringify(baris) + "\n", "utf8");
  }

  async semua(): Promise<BarisLedger[]> {
    let isi: string;
    try {
      isi = await readFile(this.file, "utf8");
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw err;
    }
    const hasil: BarisLedger[] = [];
    for (const line of isi.split(/\r?\n/)) {
      if (!line.trim()) continue;
      try {
        hasil.push(JSON.parse(line) as BarisLedger);
      } catch {
        // baris rusak (mis. tulis terputus) — abaikan, jangan gagalkan seluruh ledger
      }
    }
    return hasil;
  }

  /** Total kredit yang sudah terpakai menurut buku ini. */
  async totalKredit(): Promise<number> {
    const baris = await this.semua();
    return baris.reduce((acc, b) => acc + (Number.isFinite(b.credits) ? b.credits : 0), 0);
  }
}
