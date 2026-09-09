// Alat bantu bersama spec e2e: deteksi sumber data server dan pengumpul console.error.
import { existsSync } from "node:fs";
import path from "node:path";

import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Folder PGlite yang dipakai server e2e. Sama persis dengan yang diteruskan
 * playwright.config.ts sebagai ALARM_PGLITE_DIR — kalau keduanya berbeda, spec
 * akan menuntut data nyata dari server yang berjalan di fixture (atau sebaliknya).
 */
export const DIR_PGLITE_E2E = process.env.E2E_PGLITE_DIR?.trim() || ".pglite";

/**
 * Server e2e berjalan tanpa DATABASE_URL: sumber = PGlite (DIR_PGLITE_E2E) bila
 * foldernya ada dan `E2E_TANPA_PGLITE` tidak diset (playwright.config meneruskannya
 * sebagai TANPA_PGLITE=1 ke server); selain itu fixture universe-kecil.json (8 emiten).
 *
 * Di CI kedua varian sama-sama dijalankan: job `e2e` (jalur data contoh) dan job
 * `e2e-db` yang lebih dulu membangun database dari benih yang di-commit
 * (`npm run e2e:seed -- --dir=.pglite-e2e`). Jangan mengubah ini menjadi selalu
 * false "supaya hijau": jalur DB adalah bentuk yang dideploy.
 */
export const ADA_PGLITE =
  !process.env.E2E_TANPA_PGLITE && existsSync(path.resolve(process.cwd(), DIR_PGLITE_E2E));

export const PESAN_SKIP_PGLITE = `butuh data nyata ${DIR_PGLITE_E2E} (server berjalan pada jalur fixture)`;

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

/**
 * Kalimat yang MENGKLAIM isi layar adalah data resmi Sectors. Tidak satu pun
 * boleh muncul saat server berjalan pada jalur data contoh.
 *
 * Ditulis sebagai beberapa varian urutan kata dengan sengaja: gerbang lama
 * hanya mencocokkan satu kalimat persis ("fakta dari data resmi") di dalam
 * <main>, sehingga footer yang berbunyi "fakta resmi dari feed Sectors" lolos
 * dua kali — beda urutan kata DAN di luar <main>.
 */
export const KLAIM_SUMBER_RESMI: RegExp[] = [
  /fakta\s+(dari\s+)?(data\s+)?resmi/i,
  /data\s+resmi/i,
  /Sectors\s+Financial\s+API/i,
  /Alasan\s+resmi\s+BEI/i,
  /emiten\s+nyata/i,
  /107\s+saham/i,
];

/** Klaim yang WAJIB ada di jalur data nyata (footer memikul kalimat sumbernya). */
export const KLAIM_WAJIB_JALUR_DB = /fakta resmi dari feed Sectors/i;

/**
 * Periksa SELURUH halaman (bukan hanya <main>): footer disclaimer dan overlay
 * panduan dipasang di layout akar, jadi keduanya di luar <main>.
 */
export async function harapkanKlaimSumberJujur(page: Page, jalur: string): Promise<void> {
  const teks = await page.locator("body").innerText();
  await expect(page.getByTestId("disclaimer"), jalur).toHaveAttribute("data-sumber", ADA_PGLITE ? "db" : "fixture");
  if (ADA_PGLITE) {
    expect(teks, `${jalur}: footer jalur DB harus menyebut sumbernya`).toMatch(KLAIM_WAJIB_JALUR_DB);
    return;
  }
  for (const pola of KLAIM_SUMBER_RESMI) {
    expect(teks, `${jalur}: klaim sumber resmi "${pola}" muncul padahal servernya jalur data contoh`).not.toMatch(pola);
  }
  expect(teks, `${jalur}: jalur data contoh harus mengakui data contoh`).toMatch(/data contoh/i);
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
