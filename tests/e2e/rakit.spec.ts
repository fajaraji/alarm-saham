// E2E layar "Rakit alarm": klik-untuk-tambah, seret ke area buang, seret dari
// palet ke papan, ATAU→DAN, uji ke masa lalu (PGlite bila ada, selain itu fixture), banner AI 503,
// dan screenshot mode terang & gelap (folder ter-gitignore).
import { existsSync } from "node:fs";
import path from "node:path";

import { expect, test, type Locator, type Page } from "@playwright/test";

const FOLDER_SCREENSHOT = "tests/e2e/screenshots";
/** Server e2e berjalan tanpa DATABASE_URL; bila ./.pglite ada, sumber = PGlite (data Sectors nyata). */
const ADA_PGLITE = existsSync(path.resolve(process.cwd(), ".pglite"));

/** Seret dengan penunjuk nyata (dnd-kit butuh gerakan bertahap melewati jarak aktivasi). */
async function seret(page: Page, dari: Locator, ke: Locator) {
  const a = await dari.boundingBox();
  const b = await ke.boundingBox();
  if (!a || !b) throw new Error("Elemen seret/tujuan tidak terlihat");
  const x0 = a.x + a.width / 2;
  const y0 = a.y + a.height / 2;
  const x1 = b.x + b.width / 2;
  const y1 = b.y + b.height / 2;
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  await page.mouse.move(x0 + 8, y0 + 8, { steps: 4 });
  await page.mouse.move(x1, y1, { steps: 16 });
  await page.waitForTimeout(80);
  await page.mouse.move(x1 + 1, y1 + 1, { steps: 2 });
  await page.mouse.up();
}

test("rakit 2 blok → buang satu → seret dari palet → DAN → uji → hasil & banner AI", async ({ page }) => {
  // Viewport tinggi agar palet, papan, dan area buang terlihat bersamaan (seret memakai koordinat viewport).
  await page.setViewportSize({ width: 1280, height: 1400 });
  await page.goto("/rakit");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Rakit alarmmu");
  await expect(page.getByText("Alarm Saham adalah alat informasi dan analisis, bukan saran investasi.")).toBeVisible();

  // Klik-untuk-tambah (fallback keyboard/sentuh)
  await page.getByTestId("palet-suspensi").click();
  await page.getByTestId("palet-laporan_hilang").click();
  await expect(page.getByTestId("blok-suspensi")).toBeVisible();
  await expect(page.getByTestId("blok-laporan_hilang")).toBeVisible();
  await expect(page.getByTestId("palet-suspensi")).toBeDisabled();
  await expect(page.getByTestId("tombol-gabung")).toHaveText("ATAU");

  // Seret satu blok ke area buang
  const pegangan = page.getByTestId("blok-laporan_hilang").getByRole("button", { name: /Pegang untuk memindahkan/ });
  await seret(page, pegangan, page.getByTestId("area-buang"));
  await expect(page.getByTestId("blok-laporan_hilang")).toHaveCount(0);
  await expect(page.getByTestId("palet-laporan_hilang")).toBeEnabled();

  // Seret dari palet ke papan (salin)
  await seret(page, page.getByTestId("palet-ekuitas_negatif"), page.getByTestId("papan-dropzone"));
  await expect(page.getByTestId("blok-ekuitas_negatif")).toBeVisible();

  // ATAU → DAN, dan ambang longgar → ketat
  await page.getByTestId("tombol-gabung").click();
  await expect(page.getByTestId("tombol-gabung")).toHaveText("DAN");
  await page.getByTestId("blok-suspensi").getByRole("button", { name: /^Ambang/ }).click();
  await expect(page.getByTestId("blok-suspensi")).toHaveAttribute("data-threshold", "ketat");

  // Uji ke masa lalu: /api/backtest memakai getEventSource() (tiket 13) — PGlite
  // ./.pglite bila ada (DATABASE_URL kosong) → "data Sectors nyata", 107 saham;
  // tanpa PGlite → fixture "data contoh", 8 saham.
  await page.getByRole("button", { name: "Uji ke masa lalu" }).click();
  await expect(page.getByTestId("skor-tertangkap")).not.toHaveText("–");
  await expect(page.getByTestId("skor-palsu")).toHaveText(/^\d+\/\d+$/);
  if (ADA_PGLITE) {
    await expect(page.getByTestId("label-sumber")).toContainText("data Sectors nyata");
    await expect(page.getByTestId("hasil-uji")).toContainText(/Diuji ke 10\d saham/);
    await expect(page.getByTestId("skor-palsu")).toHaveText(/^\d+\/30$/);
    // MENN, TGRA, WSKT tidak punya tanggal kejadian target → dilewati seperti CLI (docs/universe-pull.md catatan 4).
    await expect(page.getByTestId("dilewati")).toContainText("3 saham dilewati");
  } else {
    await expect(page.getByTestId("label-sumber")).toContainText("data contoh");
  }
  await expect(page.getByTestId("kelompok-delisting")).toBeVisible();
  await expect(page.getByTestId("kelompok-control")).toBeVisible();
  await expect(page.getByTestId("sel-SRIL")).toBeVisible();

  // Panel AI: kunci belum diisi → banner sopan (503)
  await expect(page.getByTestId("banner-ai-diagnosis")).toContainText("Fitur AI belum aktif");

  // Screenshot dua mode (hanya dilaporkan bahwa keduanya dirender)
  await page.emulateMedia({ colorScheme: "light" });
  await page.waitForTimeout(400); // tunggu transisi warna (transition-colors 150 ms) selesai
  await page.screenshot({ path: `${FOLDER_SCREENSHOT}/rakit-terang.png`, fullPage: true });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${FOLDER_SCREENSHOT}/rakit-gelap.png`, fullPage: true });
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("Minta AI rakit tanpa kunci → banner sopan, papan tetap bisa dirakit sendiri", async ({ page }) => {
  await page.goto("/rakit");
  await page.getByRole("textbox", { name: /Ceritakan alarm/ }).fill("aku mau alarm buat saham yang mau pailit");
  await page.getByRole("button", { name: "Minta AI rakit" }).click();
  await expect(page.getByTestId("catatan-rakit")).toContainText("Fitur AI belum aktif");
  await page.getByTestId("palet-insider_jual").click();
  await expect(page.getByTestId("blok-insider_jual")).toBeVisible();
});

test("keyboard: pegang blok, panah bawah, lepas → urutan berubah", async ({ page }) => {
  await page.goto("/rakit");
  await page.getByTestId("palet-suspensi").click();
  await page.getByTestId("palet-aksi_dilutif").click();
  const pegangan = page.getByTestId("blok-suspensi").getByRole("button", { name: /Pegang untuk memindahkan/ });
  await pegangan.focus();
  await page.keyboard.press("Space");
  await page.waitForTimeout(100);
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(100);
  await page.keyboard.press("Space");
  const urutan = await page.getByTestId("papan-dropzone").locator("li[data-testid^='blok-']").evaluateAll((els) =>
    els.map((e) => e.getAttribute("data-testid")),
  );
  expect(urutan).toEqual(["blok-aksi_dilutif", "blok-suspensi"]);
});
