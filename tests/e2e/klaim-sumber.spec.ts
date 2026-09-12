// Gerbang klaim sumber data (tiket 15, keberatan 3 & 6).
//
// Aturan lomba (d): tidak boleh menyesatkan tentang sumber data. Klaim "semua
// yang tampil adalah fakta resmi dari feed Sectors" dulu tanpa syarat di footer
// layout akar (SEMUA halaman), di dialog panduan kunjungan pertama, dan di
// beranda — sehingga pada jalur data contoh aplikasi menyangkal label "data
// contoh"-nya sendiri di layar yang sama.
//
// Gerbang lama tidak bisa menangkapnya karena hanya memindai <main> dan hanya
// satu urutan kata. Spec ini memindai SELURUH halaman, memakai daftar varian
// urutan kata, dan berjalan di kedua varian server (dengan ./.pglite dan
// E2E_TANPA_PGLITE=1) — jadi kedua arah klaim dijaga.
import { expect, test } from "@playwright/test";

import { ADA_PGLITE, buka, harapkanKlaimSumberJujur, KLAIM_CAKUPAN_NYATA, KLAIM_SUMBER_RESMI, muatUlang } from "./util";

const HALAMAN = ["/", "/putar-ulang", "/putar-ulang?kode=SRIL", "/rakit", "/pasang", "/kamus", "/cara-kami-menghitung"];

test.describe("klaim sumber data mengikuti sumber yang benar-benar dipakai", () => {
  for (const jalur of HALAMAN) {
    test(`${jalur} — klaim sumber jujur di seluruh halaman (termasuk footer)`, async ({ page }) => {
      await buka(page, jalur);
      await expect(page.getByTestId("disclaimer")).toBeVisible();
      await harapkanKlaimSumberJujur(page, jalur);
    });
  }

  test("dialog panduan kunjungan pertama ikut sumber data", async ({ page }) => {
    // Kunjungan pertama: kosongkan penanda 'panduan selesai' dari storageState.
    await buka(page, "/");
    await page.evaluate(() => window.localStorage.removeItem("alarm-saham:panduan-selesai"));
    await muatUlang(page);
    const dialog = page.getByTestId("overlay-panduan");
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute("data-sumber", ADA_PGLITE ? "db" : "fixture");
    const teks = await dialog.innerText();
    if (ADA_PGLITE) {
      expect(teks).toMatch(/fakta dari data resmi/i);
    } else {
      for (const pola of [...KLAIM_SUMBER_RESMI, ...KLAIM_CAKUPAN_NYATA]) {
        expect(teks, `dialog panduan: ${pola}`).not.toMatch(pola);
      }
      expect(teks).toMatch(/data contoh/i);
    }
    // Disclaimer wajib PLAN §2 ada di kedua jalur.
    expect(teks).toMatch(/bukan saran investasi/i);
  });
});
