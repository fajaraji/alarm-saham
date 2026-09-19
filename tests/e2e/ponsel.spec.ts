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
