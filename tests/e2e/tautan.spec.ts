// E2E tautan rahasia `/pasang#kunci=...` (tiket 23). Portofolio pemilik tautan
// disiapkan lewat API dengan token acak (bukan lewat browser lain), lalu tautan
// dibuka di browser yang belum atau sudah memegang kunci. Nol kredit Sectors.
import { randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";

import { ADA_PGLITE, buka } from "./util";

const KUNCI_PEMILIK = "alarm-saham.pemilik";

async function tokenBrowser(page: import("@playwright/test").Page): Promise<string | null> {
  return page.evaluate((k) => window.localStorage.getItem(k), KUNCI_PEMILIK);
}

test.describe("jalur database", () => {
  test.skip(!ADA_PGLITE, "portofolio di server butuh database");

  test("tautan di browser tanpa kunci memulihkan portofolio, dan kunci hilang dari bilah alamat", async ({ page, request }) => {
    const kunci = randomUUID();
    const r = await request.post("/api/portofolio", {
      headers: { "x-owner-token": kunci },
      data: { symbols: ["BBCA", "SRIL"] },
    });
    expect(r.ok()).toBe(true);

    await buka(page, `/pasang#kunci=${kunci}`);
    await expect(page.getByTestId("tile-BBCA")).toBeVisible();
    await expect(page.getByTestId("tile-SRIL")).toBeVisible();
    await expect(page.getByTestId("pesan-tautan")).toHaveAttribute("data-jenis", "pulih");
    expect(new URL(page.url()).hash).toBe("");
    expect(await tokenBrowser(page)).toBe(kunci);
  });

  test("browser dengan kunci lain bertanya dulu; Batal tidak mengubah apa pun", async ({ page, request }) => {
    const kunci = randomUUID();
    await request.post("/api/portofolio", { headers: { "x-owner-token": kunci }, data: { symbols: ["TLKM"] } });

    await buka(page, "/pasang");
    await expect(page.getByTestId("label-penyimpanan")).not.toHaveText("memuat…");
    const lama = await tokenBrowser(page);
    expect(lama).toBeTruthy();

    // Tempel tautan ke bilah alamat halaman yang sama: hanya hash yang berubah.
    await page.goto(`/pasang#kunci=${kunci}`);
    const dialog = page.getByRole("dialog", { name: "Buka portofolio dari tautan?" });
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    expect(await tokenBrowser(page)).toBe(lama);
    await expect(page.getByTestId("tile-TLKM")).toHaveCount(0);
    expect(new URL(page.url()).hash).toBe("");

    // Sekali lagi, kali ini diganti.
    await page.goto("/pasang");
    await page.goto(`/pasang#kunci=${kunci}`);
    await page.getByTestId("tombol-ganti-pemilik").click();
    await expect(page.getByTestId("tile-TLKM")).toBeVisible();
    expect(await tokenBrowser(page)).toBe(kunci);
  });
});

test("kunci tidak sah ditolak dengan pesan dan tidak disimpan", async ({ page }) => {
  await buka(page, "/pasang#kunci=pendek");
  await expect(page.getByTestId("pesan-tautan")).toHaveAttribute("data-jenis", "tidakSah");
  expect(await tokenBrowser(page)).not.toBe("pendek");
  expect(new URL(page.url()).hash).toBe("");
});

test("server tanpa database mengatakan tautan tidak bisa memulihkan apa pun", async ({ page }) => {
  test.skip(ADA_PGLITE, "hanya jalur data contoh yang berjalan tanpa database");
  await buka(page, `/pasang#kunci=${randomUUID()}`);
  await expect(page.getByTestId("pesan-tautan")).toHaveAttribute("data-jenis", "tanpaDb");
});

// ----- Tiket 24: dialog salin tautan rahasia ---------------------------------

test.describe("dialog tautan setelah simpan alarm", () => {
  test("jalur database: tautan bisa disalin, dan membukanya di browser lain memulihkan alarmnya", async ({
    page,
    browser,
    context,
    baseURL,
  }) => {
    test.skip(!ADA_PGLITE, "tautan hanya ada bila alarm tersimpan di server");
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const nama = `Alarm tautan ${randomUUID().slice(0, 8)}`;

    await buka(page, "/rakit");
    await page.getByTestId("palet-suspensi").click();
    await page.getByLabel("Nama alarm").fill(nama);
    await page.getByTestId("tombol-simpan").click();

    const dialog = page.getByRole("dialog", { name: "Simpan tautan rahasiamu" });
    await expect(dialog).toBeVisible();
    const tautan = await page.getByTestId("kotak-tautan").inputValue();
    expect(tautan).toMatch(/\/pasang#kunci=[A-Za-z0-9_-]{16,128}$/);
    expect(tautan).toContain(`#kunci=${await tokenBrowser(page)}`);

    await page.getByTestId("tombol-salin-tautan").click();
    await expect(page.getByTestId("status-salin")).toHaveText("Tautan tersalin.");
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(tautan);

    // Escape menutup, fokus kembali ke tombol Simpan.
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(page.getByTestId("tombol-simpan")).toBeFocused();

    // Browser lain (konteks baru, tanpa kunci) membuka tautan itu.
    const lain = await browser.newContext({
      baseURL,
      storageState: { cookies: [], origins: [{ origin: new URL(tautan).origin, localStorage: [{ name: "alarm-saham:panduan-selesai", value: "1" }] }] },
    });
    const p2 = await lain.newPage();
    await buka(p2, tautan);
    await expect(p2.getByTestId("pesan-tautan")).toHaveAttribute("data-jenis", /pulih/);
    await expect(p2.getByRole("list", { name: "Alarm terpasang" })).toContainText(nama);
    await lain.close();
  });

  test("jalur data contoh: dialog menyatakan alarm hanya tersimpan di browser ini", async ({ page }) => {
    test.skip(ADA_PGLITE, "hanya jalur tanpa database");
    await buka(page, "/rakit");
    await page.getByTestId("palet-suspensi").click();
    await page.getByTestId("tombol-simpan").click();
    const dialog = page.getByRole("dialog", { name: "Alarm hanya tersimpan di browser ini" });
    await expect(dialog).toBeVisible();
    await expect(page.getByTestId("kotak-tautan")).toHaveCount(0);
    await dialog.getByRole("button", { name: "Tutup" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByTestId("tombol-simpan")).toBeFocused();
  });

  test("dialog bisa dipakai dengan keyboard saja; Tab tidak keluar dari dialog", async ({ page }) => {
    await buka(page, "/rakit");
    await page.getByTestId("palet-suspensi").click();
    await page.getByTestId("tombol-simpan").focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByTestId("dialog-tautan");
    await expect(dialog).toBeVisible();
    for (let i = 0; i < 6; i++) await page.keyboard.press("Tab");
    expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true);
    // Tombol Tutup dengan Enter.
    await dialog.getByRole("button", { name: "Tutup" }).focus();
    await page.keyboard.press("Enter");
    await expect(dialog).toHaveCount(0);
    await expect(page.getByTestId("tombol-simpan")).toBeFocused();
  });
});

test("layar Pasang jalur database: dialog tautan muncul sekali saat portofolio pertama tersimpan", async ({ page }) => {
  test.skip(!ADA_PGLITE, "portofolio di server butuh database");
  await buka(page, "/pasang");
  await expect(page.getByTestId("label-penyimpanan")).not.toHaveText("memuat…");
  await page.getByTestId("kotak-kode").fill("BBCA");
  await page.getByTestId("tombol-tambah").click();
  const dialog = page.getByTestId("dialog-tautan");
  await expect(dialog).toBeVisible();
  await expect(page.getByTestId("kotak-tautan")).toHaveValue(new RegExp(`#kunci=${await tokenBrowser(page)}$`));
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);

  // Saham kedua tidak memunculkannya lagi; tombol "Lihat tautan" membukanya.
  await page.getByTestId("kotak-kode").fill("SRIL");
  await page.getByTestId("tombol-tambah").click();
  await expect(page.getByTestId("tile-SRIL")).toBeVisible();
  await expect(dialog).toHaveCount(0);
  await page.getByTestId("tombol-lihat-tautan").click();
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("tombol-lihat-tautan")).toBeFocused();
});
