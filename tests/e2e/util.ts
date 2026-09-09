// Alat bantu bersama spec e2e: deteksi sumber data server dan pengumpul console.error.
import { existsSync } from "node:fs";
import path from "node:path";

import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Server e2e berjalan tanpa DATABASE_URL: sumber = PGlite ./.pglite bila foldernya
 * ada dan `E2E_TANPA_PGLITE` tidak diset (playwright.config meneruskannya sebagai
 * TANPA_PGLITE=1 ke server); selain itu fixture universe-kecil.json (8 emiten).
 */
export const ADA_PGLITE = !process.env.E2E_TANPA_PGLITE && existsSync(path.resolve(process.cwd(), ".pglite"));

export const PESAN_SKIP_PGLITE = "butuh data nyata ./.pglite (server berjalan pada jalur fixture)";

/** Tanggal "hari ini" yang dipakukan untuk server e2e (playwright.config.ts). */
export const HARI_INI_E2E = "2026-09-07";

/**
 * Assertion label sumber yang TIDAK bisa lolos palsu.
 *
 * Teks label fixture berbunyi "data contoh (bukan data Sectors nyata)" — ia
 * memuat substring "data Sectors nyata", sehingga `toContainText("data Sectors
 * nyata")` juga lulus saat server berjalan di jalur fixture. Karena itu setiap
 * label sumber juga membawa atribut mesin `data-sumber="db" | "fixture"`.
 */
export async function harapkanLabelSumber(label: Locator): Promise<void> {
  await expect(label).toHaveAttribute("data-sumber", ADA_PGLITE ? "db" : "fixture");
  await expect(label).toContainText(ADA_PGLITE ? "data Sectors nyata" : "data contoh");
  if (!ADA_PGLITE) await expect(label).toContainText("bukan data Sectors nyata");
}

/** Pesan console.error yang memang diharapkan pada alur tanpa kunci AI / tanpa DB. */
const DIHARAPKAN: RegExp[] = [
  // Panel AI tanpa kunci → server menjawab 503 dan browser mencatat gagalnya fetch.
  /Failed to load resource: the server responded with a status of 503/,
  // Tanpa DATABASE_URL & PGlite, /api/portofolio menjawab 501 (penyimpanan lokal).
  /Failed to load resource: the server responded with a status of 501/,
];

/**
 * Kumpulkan console.error (dan pageerror) selama halaman hidup. Pesan yang cocok
 * dengan daftar DIHARAPKAN tidak dihitung; sisanya harus 0 di akhir alur.
 */
export function kumpulkanConsoleError(page: Page): { daftar: string[] } {
  const daftar: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const teks = msg.text();
    if (DIHARAPKAN.some((p) => p.test(teks))) return;
    daftar.push(`[console.error] ${teks}`);
  });
  page.on("pageerror", (err) => daftar.push(`[pageerror] ${err.message}`));
  return { daftar };
}
