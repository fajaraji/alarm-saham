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
