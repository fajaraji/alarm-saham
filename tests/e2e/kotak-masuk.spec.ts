// E2E ringan kotak masuk (tiket 12, 25): bagian "Kotak masuk" tampil di /pasang
// dengan keterangan pengecekan pagi. Petunjuk /mulai untuk bot Telegram hanya
// ada bila server melaporkan bot aktif; server e2e sengaja berjalan tanpa bot
// (playwright.config), jadi bawaannya menguji jalur bot mati. Terhadap URL
// hidup yang botnya aktif, jalankan dengan E2E_TELEGRAM=aktif.
import { expect, test } from "@playwright/test";

import { buka, TELEGRAM_AKTIF, tutupDialogTautanPertama } from "./util";

test("kotak masuk tampil dengan keterangan cron; petunjuk Telegram hanya bila bot aktif", async ({ page }) => {
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
  await tutupDialogTautanPertama(page);
  await expect(page.getByTestId("tile-BBCA")).toBeVisible();
  // Portofolio sudah tersimpan di server (tombol "Lihat tautan" hanya ada saat itu).
  await expect(page.getByTestId("tombol-lihat-tautan")).toBeVisible();
  if (TELEGRAM_AKTIF) {
    await expect(page.getByTestId("kode-portofolio")).toHaveText(/^[0-9a-f-]{36}$/);
    await expect(page.getByTestId("petunjuk-telegram")).toContainText("/mulai");
  } else {
    await expect(page.getByTestId("petunjuk-telegram")).toHaveCount(0);
    await expect(kotak).not.toContainText("Telegram");
    await expect(kotak).not.toContainText("/mulai");
  }
  await page.getByRole("button", { name: "Hapus BBCA" }).click();
  await expect(page.getByTestId("tile-BBCA")).toHaveCount(0);
});
