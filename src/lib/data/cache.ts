import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const TTL_SEHARI_MS = 24 * 60 * 60 * 1000;

export interface EntriCache {
  endpoint: string;
  params: Record<string, string>;
  storedAt: string; // ISO
  /** null = permanen (data historis tidak berubah). */
  ttlMs: number | null;
  status: number;
  body: unknown;
}

/** Kunci cache = endpoint + params (diurutkan) → sha256 pendek. */
export function kunciCache(endpoint: string, params: Record<string, string>): string {
  const urut = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return createHash("sha256").update(`${endpoint}?${urut}`).digest("hex").slice(0, 32);
}

export class CacheRespons {
  constructor(
    readonly dir: string,
    private readonly now: () => Date = () => new Date(),
  ) {}

  fileUntuk(endpoint: string, params: Record<string, string>): string {
    return path.join(this.dir, `${kunciCache(endpoint, params)}.json`);
  }

  async baca(endpoint: string, params: Record<string, string>): Promise<EntriCache | null> {
    let isi: string;
    try {
      isi = await readFile(this.fileUntuk(endpoint, params), "utf8");
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw err;
    }
    let entri: EntriCache;
    try {
      entri = JSON.parse(isi) as EntriCache;
    } catch {
      return null; // file rusak → anggap tidak ada
    }
    if (entri.ttlMs !== null) {
      const umur = this.now().getTime() - Date.parse(entri.storedAt);
      if (!(umur < entri.ttlMs)) return null; // kedaluwarsa
    }
    return entri;
  }

  async tulis(
    endpoint: string,
    params: Record<string, string>,
    status: number,
    body: unknown,
    ttlMs: number | null,
  ): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    const entri: EntriCache = {
      endpoint,
      params,
      storedAt: this.now().toISOString(),
      ttlMs,
      status,
      body,
    };
    await writeFile(this.fileUntuk(endpoint, params), JSON.stringify(entri), "utf8");
  }
}
