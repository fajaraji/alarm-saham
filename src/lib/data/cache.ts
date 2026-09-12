import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
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

/** Kontrak penyimpan cache respons: berkas (`CacheRespons`) atau tabel `api_cache` (`CacheDb`). */
export interface PenyimpanCache {
  baca(endpoint: string, params: Record<string, string>): Promise<EntriCache | null>;
  tulis(
    endpoint: string,
    params: Record<string, string>,
    status: number,
    body: unknown,
    ttlMs: number | null,
  ): Promise<void>;
  /** Kunci (`kunciCache`) semua entri yang masih berlaku — untuk pra-terbang massal. */
  kunciBerlaku(): Promise<Set<string>>;
}

export class CacheRespons implements PenyimpanCache {
  constructor(
    readonly dir: string,
    private readonly now: () => Date = () => new Date(),
  ) {}

  fileUntuk(endpoint: string, params: Record<string, string>): string {
    return path.join(this.dir, `${kunciCache(endpoint, params)}.json`);
  }

  async kunciBerlaku(): Promise<Set<string>> {
    let nama: string[];
    try {
      nama = await readdir(this.dir);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return new Set();
      throw err;
    }
    const hasil = new Set<string>();
    for (const n of nama) {
      if (!/^[0-9a-f]{32}\.json$/.test(n)) continue;
      const entri = await this.bacaFile(path.join(this.dir, n));
      if (entri) hasil.add(n.slice(0, 32));
    }
    return hasil;
  }

  /** Semua entri (termasuk yang kedaluwarsa) — untuk migrasi ke DB. */
  async semuaEntri(): Promise<Array<{ kunci: string; entri: EntriCache }>> {
    let nama: string[];
    try {
      nama = await readdir(this.dir);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw err;
    }
    const hasil: Array<{ kunci: string; entri: EntriCache }> = [];
    for (const n of nama) {
      if (!/^[0-9a-f]{32}\.json$/.test(n)) continue;
      const entri = await this.bacaFile(path.join(this.dir, n), true);
      if (entri) hasil.push({ kunci: n.slice(0, 32), entri });
    }
    return hasil;
  }

  private async bacaFile(file: string, abaikanTtl = false): Promise<EntriCache | null> {
    let isi: string;
    try {
      isi = await readFile(file, "utf8");
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
    if (!abaikanTtl && entri.ttlMs !== null) {
      const umur = this.now().getTime() - Date.parse(entri.storedAt);
      if (!(umur < entri.ttlMs)) return null; // kedaluwarsa
    }
    return entri;
  }

  async baca(endpoint: string, params: Record<string, string>): Promise<EntriCache | null> {
    return this.bacaFile(this.fileUntuk(endpoint, params));
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
