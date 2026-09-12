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
const SUMBER_DIPAKSA = process.env.E2E_SUMBER?.trim().toLowerCase();
if (SUMBER_DIPAKSA && SUMBER_DIPAKSA !== "db" && SUMBER_DIPAKSA !== "contoh") {
  throw new Error(`E2E_SUMBER="${SUMBER_DIPAKSA}" tidak dikenal; pilih "db" atau "contoh".`);
}

/**
 * Sumber data server yang sedang diuji.
 *
 * Bawaannya dideteksi dari folder PGlite LOKAL — benar untuk server e2e yang
 * dijalankan playwright.config.ts sendiri, tetapi tidak berarti apa-apa saat
 * yang diuji adalah URL hidup (E2E_BASE_URL): folder di laptop tidak
 * mengatakan apa pun tentang database server di seberang. Karena itu
 * E2E_SUMBER=db (produksi dengan Neon) atau E2E_SUMBER=contoh memaksanya.
 */
export const ADA_PGLITE = SUMBER_DIPAKSA
  ? SUMBER_DIPAKSA === "db"
  : !process.env.E2E_TANPA_PGLITE && existsSync(path.resolve(process.cwd(), DIR_PGLITE_E2E));

/**
 * Apakah server yang diuji punya kunci AI. Bawaan MATI: server e2e lokal dan
 * CI sengaja dijalankan tanpa kunci supaya panel AI teruji di jalur 503-nya.
 * Produksi punya kunci, jadi smoke terhadap URL hidup dijalankan dengan
 * E2E_AI=aktif.
 */
export const AI_AKTIF = process.env.E2E_AI?.trim().toLowerCase() === "aktif";

export const PESAN_SKIP_PGLITE = `butuh data nyata ${DIR_PGLITE_E2E} (server berjalan pada jalur fixture)`;

/** Tanggal "hari ini" yang dipakukan untuk server e2e (playwright.config.ts). */
export const HARI_INI_E2E = "2026-09-07";

/**
 * Tunggu sampai halaman benar-benar interaktif sebelum menyentuh apa pun.
 *
 * Setiap layar dirender di server, jadi tombol/slider/blok sudah TERLIHAT dan
 * `locator.click()` sudah dianggap sah oleh Playwright jauh sebelum bundel
 * kliennya tiba. Klik sedini itu hilang tanpa jejak: tidak ada handler yang
 * terpasang, tidak ada galat, dan tesnya baru gagal beberapa baris kemudian
 * dengan pesan yang menyesatkan ("elemen X tidak muncul") — persis kelas bug
 * yang membuat CI merah.
 *
 * `<html data-siap="1">` dipasang di effect PanduanProvider (layout akar), jadi
 * tandanya berlaku untuk SEMUA halaman. Ini bukan sleep dan bukan atribut
 * khusus tes: ia menyatakan fakta yang sama yang dipakai produk untuk berhenti
 * menampilkan kursor "bisa diseret" pada kontrol yang belum hidup.
 */
export async function tungguSiap(page: Page): Promise<void> {
  await expect(page.locator("html")).toHaveAttribute("data-siap", "1");
}

/**
 * Buka satu halaman aplikasi dan tunggu sampai ia interaktif.
 *
 * Pakai ini, JANGAN `page.goto`, di setiap spec yang menyentuh kontrol klien —
 * satu tes yang lupa menunggu cukup untuk membuat CI merah sesekali, dan
 * kegagalannya muncul di baris lain sehingga sulit dilacak. Navigasi di dalam
 * aplikasi (klik tautan) tidak perlu diulang: `data-siap` dipasang di layout
 * akar dan bertahan selama pindah halaman sisi klien.
 */
export async function buka(page: Page, jalur: string): Promise<void> {
  await page.goto(jalur);
  await tungguSiap(page);
}

/** `page.reload()` + penantian yang sama — muat ulang berarti hidrasi dari nol. */
export async function muatUlang(page: Page): Promise<void> {
  await page.reload();
  await tungguSiap(page);
}

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
];

/**
 * Klaim CAKUPAN: seolah server ini memegang universe dan feed yang nyata.
 *
 * Terpisah dari daftar di atas karena satu halaman memang boleh menyebutnya:
 * /cara-kami-menghitung adalah halaman metodologi yang seluruh angkanya
 * SNAPSHOT yang di-commit, dan ia mengatakannya di paragraf pertama. Menghapus
 * angka itu di jalur data contoh justru menyesatkan ke arah sebaliknya
 * (menyembunyikan bahwa Sectors adalah sumber inti). Pengecualian itu hanya
 * berlaku selama kalimat pembatasnya benar-benar ada — lihat PEMBATAS_METODOLOGI.
 *
 * Pola `/\b107\b/` sengaja tanpa satuan: daftar lama memuat "107 saham" tetapi
 * tidak "107 emiten", sehingga kotak cari /putar-ulang yang berbunyi "107 emiten
 * universe uji + feed suspensi seluruh bursa" lolos gerbang selama dua putaran.
 */
export const KLAIM_CAKUPAN_NYATA: RegExp[] = [
  /\b107\b/,
  // Klaim cakupan berkurung: "…ada di data kami (107 emiten universe uji + feed
  // suspensi seluruh bursa)". Isi kurungnya bebas, jadi mengganti urutan kata
  // tidak menolongnya lolos.
  /data\s+kami\s*\(/i,
  /feed\s+suspensi\s+(seluruh\s+bursa|BEI)\b/i,
];

/**
 * Kalimat pembatas halaman metodologi. Selama ia ada, /cara-kami-menghitung
 * boleh memuat angka universe nyata; kalau dihapus, gerbang ikut gagal.
 */
export const PEMBATAS_METODOLOGI =
  /snapshot yang di-commit[\s\S]{0,400}bukan hasil hitung ulang dari sumber data yang sedang dipakai server ini/i;

/** Klaim yang WAJIB ada di jalur data nyata (footer memikul kalimat sumbernya). */
export const KLAIM_WAJIB_JALUR_DB = /fakta resmi dari feed Sectors/i;

/**
 * Periksa SELURUH halaman (bukan hanya <main>): footer disclaimer dan overlay
 * panduan dipasang di layout akar, jadi keduanya di luar <main>.
 */
export async function harapkanKlaimSumberJujur(page: Page, jalur: string): Promise<void> {
  const teks = await page.locator("body").innerText();
  const metodologi = jalur.startsWith("/cara-kami-menghitung");
  await expect(page.getByTestId("disclaimer"), jalur).toHaveAttribute("data-sumber", ADA_PGLITE ? "db" : "fixture");
  if (metodologi) {
    // Pengecualian cakupan halaman metodologi hanya sah bila pembatasnya ada.
    expect(teks, `${jalur}: pengecualian metodologi butuh kalimat pembatas snapshot`).toMatch(PEMBATAS_METODOLOGI);
  }
  if (ADA_PGLITE) {
    expect(teks, `${jalur}: footer jalur DB harus menyebut sumbernya`).toMatch(KLAIM_WAJIB_JALUR_DB);
    return;
  }
  for (const pola of KLAIM_SUMBER_RESMI) {
    expect(teks, `${jalur}: klaim sumber resmi "${pola}" muncul padahal servernya jalur data contoh`).not.toMatch(pola);
  }
  if (!metodologi) {
    for (const pola of KLAIM_CAKUPAN_NYATA) {
      expect(teks, `${jalur}: klaim cakupan nyata "${pola}" muncul padahal servernya jalur data contoh`).not.toMatch(pola);
    }
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
