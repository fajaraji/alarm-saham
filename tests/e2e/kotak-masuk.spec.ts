// E2E ringan kotak masuk (tiket 12): bagian "Kotak masuk" tampil di /pasang
// dengan keterangan pengecekan pagi; setelah portofolio tersimpan di server
// (PGlite ./.pglite), kode portofolio untuk /mulai di Telegram ikut tampil.
import { expect, test } from "@playwright/test";

import { buka } from "./util";

test("kotak masuk tampil dengan keterangan cron; kode portofolio muncul setelah tersimpan di server", async ({ page }) => {
  await buka(page, "/pasang");
  await expect(page.getByTestId("label-penyimpanan")).not.toHaveText("memuat…");
  const kotak = page.getByTestId("kotak-masuk");
  await expect(kotak).toBeVisible();
  await expect(kotak).toContainText("Kotak masuk");
  await expect(page.getByTestId("kotak-cron")).toContainText("06:30 WIB");

  // "tersimpan di server (tautan rahasia)" vs "tersimpan di browser ini (server tanpa database)"
  const diServer = (await page.getByTestId("label-penyimpanan").textContent())?.includes("tautan rahasia");
  test.skip(!diServer, "server tanpa database (fixture): kode portofolio hanya ada bila tersimpan di server");

  await page.getByTestId("kotak-kode").fill("BBCA");
  await page.getByTestId("tombol-tambah").click();
  await expect(page.getByTestId("tile-BBCA")).toBeVisible();
  await expect(page.getByTestId("kode-portofolio")).toHaveText(/^[0-9a-f-]{36}$/);
  await page.getByRole("button", { name: "Hapus BBCA" }).click();
  await expect(page.getByTestId("tile-BBCA")).toHaveCount(0);
});
