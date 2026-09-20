// Ukur kepadatan teks (DESIGN.md "Kepadatan teks", aturan 10): jumlah kata
// yang TERLIHAT di <main> pada keadaan layar yang paling sering dibaca. Kata di
// dalam <details> yang tertutup tidak dihitung, karena tidak dibaca kecuali
// dibuka. Hasilnya dicetak (baris "KEPADATAN") supaya perubahan teks bisa
// menyebut angka sebelum/sesudah di pesan commit. Nol kredit Sectors: data
// terkini (kelas B) tidak dicentang.
import { expect, test, type Page } from "@playwright/test";

import { buka, tutupDialogTautanPertama } from "./util";

async function kataTerlihat(page: Page): Promise<number> {
  return page.locator("main").evaluate((main) => {
    let teks = "";
    const jalan = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
    for (let n = jalan.nextNode(); n; n = jalan.nextNode()) {
      const el = n.parentElement;
      if (!el) continue;
      // checkVisibility menolak isi <details> tertutup, <datalist>, display:none
      // dan visibility:hidden di elemen mana pun di atasnya. .sr-only tetap
      // "terlihat" bagi peramban (kotak 1px), jadi dibuang terpisah.
      if (!el.checkVisibility({ checkVisibilityCSS: true }) || el.closest(".sr-only")) continue;
      teks += ` ${n.textContent ?? ""}`;
    }
    return teks.split(/\s+/).filter((k) => /[\p{L}\p{N}]/u.test(k)).length;
  });
}

function cetak(nama: string, kata: number) {
  console.log(`KEPADATAN ${nama}: ${kata} kata`);
}

test.describe("kepadatan teks", () => {
  test("/putar-ulang SRIL", async ({ page }) => {
    await buka(page, "/putar-ulang?kode=SRIL");
    await expect(page.getByTestId("putar-ulang")).toBeVisible();
    cetak("putar-ulang SRIL", await kataTerlihat(page));
  });

  test("/putar-ulang kode di luar data", async ({ page }) => {
    await buka(page, "/putar-ulang?kode=ZZZZ");
    cetak("putar-ulang ZZZZ", await kataTerlihat(page));
  });

  test("/rakit sesudah uji", async ({ page }) => {
    await buka(page, "/rakit");
    await page.getByTestId("palet-suspensi").click();
    await page.getByTestId("palet-laporan_hilang").click();
    await page.getByRole("button", { name: "Uji ke masa lalu" }).click();
    await expect(page.getByTestId("kalimat-hasil")).toBeVisible();
    cetak("rakit sesudah uji", await kataTerlihat(page));
  });

  test("/pasang sesudah cek BBCA + SRIL", async ({ page }) => {
    await buka(page, "/pasang");
    await expect(page.getByTestId("label-penyimpanan")).not.toHaveText("memuat…");
    await page.getByTestId("kotak-kode").fill("BBCA");
    await page.getByTestId("tombol-tambah").click();
    await tutupDialogTautanPertama(page);
    await page.getByTestId("kotak-kode").fill("SRIL");
    await page.getByTestId("tombol-tambah").click();
    await expect(page.getByTestId("toggle-kelas-b")).not.toBeChecked();
    await page.getByTestId("tombol-cek").click();
    await expect(page.getByTestId("pesan-SRIL")).toBeVisible();
    cetak("pasang sesudah cek", await kataTerlihat(page));
  });

  test("/cara-kami-menghitung", async ({ page }) => {
    await buka(page, "/cara-kami-menghitung");
    cetak("cara-kami-menghitung", await kataTerlihat(page));
  });
});
