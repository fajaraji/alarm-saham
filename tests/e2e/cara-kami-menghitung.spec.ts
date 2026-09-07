// E2E halaman metodologi: dirender di build production, angka sama dengan snapshot.
import { expect, test } from "@playwright/test";

import skor from "../../docs/skor-nyata.json";

test.describe("/cara-kami-menghitung", () => {
  test("halaman tampil dengan skor snapshot, tabel per emiten bisa dibuka, dan disclaimer", async ({ page }) => {
    await page.goto("/cara-kami-menghitung");
    await expect(page.getByRole("heading", { level: 1, name: "Cara kami menghitung" })).toBeVisible();
    await expect(page.getByTestId("stat-tertangkap")).toContainText(`${skor.hits}/${skor.total}`);
    await expect(page.getByTestId("stat-alarm-palsu")).toContainText(`${skor.falseAlarms}/${skor.controls}`);

    const tabel = page.getByTestId("tabel-delisting");
    await tabel.locator("summary").click();
    await expect(tabel.getByTestId("baris-emiten")).toHaveCount(skor.perGroup.delisting.perSymbol.length);
    await expect(page.getByTestId("disclaimer")).toContainText("bukan saran investasi");
  });

  test("tautan nav dari layar lain mengarah ke halaman ini", async ({ page }) => {
    await page.goto("/rakit");
    await page.getByRole("link", { name: "Cara kami menghitung" }).first().click();
    await expect(page).toHaveURL(/\/cara-kami-menghitung$/);
    await expect(page.getByTestId("metodologi")).toBeVisible();
  });
});
