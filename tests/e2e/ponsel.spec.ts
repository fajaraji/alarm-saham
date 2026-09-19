// Ponsel 375 px (tiket 20): halaman tiga langkah tidak boleh bisa digulir ke
// samping, dan tombol Sebelumnya / Berikutnya di bawahnya muat utuh di layar.
import { expect, test } from "@playwright/test";

import { buka } from "./util";

const LEBAR = 375;

test.use({ viewport: { width: LEBAR, height: 812 } });

for (const jalur of ["/putar-ulang", "/rakit", "/pasang"] as const) {
  test(`${jalur}: tanpa gulir mendatar di lebar ${LEBAR} px`, async ({ page }) => {
    await buka(page, jalur);
    const nav = page.getByTestId("navigasi-langkah");
    await nav.scrollIntoViewIfNeeded();
    await expect(nav).toBeVisible();

    const lebar = await page.evaluate(() => ({ dokumen: document.documentElement.scrollWidth, layar: window.innerWidth }));
    expect(lebar.dokumen, "lebar dokumen melebihi layar: halaman bisa digulir ke samping").toBeLessThanOrEqual(lebar.layar);

    for (const id of ["langkah-sebelumnya", "langkah-berikutnya"]) {
      const tombol = page.getByTestId(id);
      if ((await tombol.count()) === 0) continue;
      const kotak = await tombol.boundingBox();
      expect(kotak, id).not.toBeNull();
      expect(kotak!.x, id).toBeGreaterThanOrEqual(0);
      expect(kotak!.x + kotak!.width, id).toBeLessThanOrEqual(LEBAR);
    }
  });
}

test.describe("ponsel 360 px (tiket 41)", () => {
  test.use({ viewport: { width: 360, height: 640 } });

  test("overlay panduan kunjungan pertama bisa digulir dan tombolnya terjangkau", async ({ page }) => {
    await buka(page, "/putar-ulang");
    // Kunjungan pertama: kosongkan penanda "panduan selesai" dari storageState.
    await page.evaluate(() => window.localStorage.removeItem("alarm-saham:panduan-selesai"));
    await page.reload();
    const overlay = page.getByTestId("overlay-panduan");
    await expect(overlay).toBeVisible();
    // Judul di atas kartu tidak terpotong.
    const judul = await page.locator("#judul-panduan").boundingBox();
    expect(judul, "judul panduan").not.toBeNull();
    expect(judul!.y).toBeGreaterThanOrEqual(0);
    await page.getByTestId("panduan-paham").click();
    await expect(overlay).toHaveCount(0);
    const lebar = await page.evaluate(() => ({ dokumen: document.documentElement.scrollWidth, layar: window.innerWidth }));
    expect(lebar.dokumen).toBeLessThanOrEqual(lebar.layar);
  });
});
