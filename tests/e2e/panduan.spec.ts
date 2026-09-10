// E2E lapisan awam (tiket 13): overlay panduan kunjungan pertama → "Saya sudah
// paham" → muat ulang → tidak muncul → tombol Panduan → muncul lagi; footer
// disclaimer di semua halaman; tooltip kamus aksesibel; halaman /kamus.
//
// Konteks browser di sini sengaja TANPA storageState global (playwright.config
// menandai panduan selesai untuk spec tiket lain agar overlay tidak menghalangi).
import { expect, test } from "@playwright/test";

import { buka, muatUlang } from "./util";

const DISCLAIMER = "Alarm Saham adalah alat informasi dan analisis, bukan saran investasi.";
const HALAMAN = ["/putar-ulang", "/rakit", "/pasang", "/cara-kami-menghitung", "/kamus"] as const;

test.describe("panduan & kamus", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("kunjungan pertama → overlay → Saya sudah paham → muat ulang tidak muncul → tombol Panduan → muncul", async ({ page }) => {
    await buka(page, "/rakit");
    const dialog = page.getByRole("dialog", { name: /cara pakainya dalam 3 langkah/ });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("listitem")).toHaveCount(3);
    await page.getByTestId("panduan-paham").click();
    await expect(dialog).toBeHidden();
    expect(await page.evaluate(() => window.localStorage.getItem("alarm-saham:panduan-selesai"))).toBe("1");

    await muatUlang(page);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Rakit alarmmu");
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await page.getByTestId("tombol-panduan").click();
    await expect(page.getByRole("dialog", { name: /cara pakainya dalam 3 langkah/ })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("'Mulai dari langkah 1' membawa ke /putar-ulang dan tidak muncul lagi di sana", async ({ page }) => {
    await buka(page, "/pasang");
    await page.getByTestId("panduan-mulai").click();
    await expect(page).toHaveURL(/\/putar-ulang$/);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByTestId("petunjuk")).toHaveCount(3);
  });
});

test.describe("footer disclaimer & header di semua halaman", () => {
  for (const url of HALAMAN) {
    test(`${url}: satu footer disclaimer, header dengan Kamus & Panduan`, async ({ page }) => {
      await buka(page, url);
      await expect(page.getByTestId("disclaimer")).toHaveCount(1);
      await expect(page.getByTestId("disclaimer")).toContainText(DISCLAIMER);
      await expect(page.getByTestId("tombol-panduan")).toBeVisible();
      await expect(page.getByRole("navigation", { name: "Langkah" }).getByRole("link", { name: /Kamus/ })).toBeVisible();
      if (url !== "/cara-kami-menghitung" && url !== "/kamus") await expect(page.getByTestId("petunjuk")).toHaveCount(3);
    });
  }
});

test("tooltip kamus: hover/fokus membuka, Esc menutup, tautan ke /kamus#istilah", async ({ page }) => {
  await buka(page, "/rakit");
  const tombol = page.locator("button[data-istilah='alarm_palsu']").first();
  const tipId = await tombol.getAttribute("aria-describedby");
  expect(tipId).toBeTruthy();
  const tip = page.locator(`[id="${tipId}"]`);
  await expect(tip).toBeHidden();
  await tombol.hover();
  await expect(tip).toBeVisible();
  await expect(tip).toContainText("Alarm palsu");
  await page.mouse.move(0, 0);
  await expect(tip).toBeHidden();

  await tombol.focus();
  await expect(tip).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(tip).toBeHidden();

  await tombol.click();
  await tip.getByRole("link", { name: /Lihat di Kamus/ }).click();
  await expect(page).toHaveURL(/\/kamus#alarm_palsu$/);
  await expect(page.getByTestId("kamus-alarm_palsu")).toBeVisible();
});

test("/kamus memuat istilah wajib dengan perumpamaan dan tautan halaman", async ({ page }) => {
  await buka(page, "/kamus");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Istilah yang dipakai");
  for (const id of ["suspensi", "delisting", "laporan_hilang", "insider_jual", "ekuitas_negatif", "rights_issue", "free_float", "ritel_dominan", "alarm_palsu", "lebih_awal", "kontrol_sehat"]) {
    await expect(page.getByTestId(`kamus-${id}`)).toBeVisible();
  }
  await page.getByTestId("kamus-suspensi").getByRole("link", { name: "Putar ulang" }).click();
  await expect(page).toHaveURL(/\/putar-ulang$/);
  const teks = await page.locator("main").innerText();
  expect(teks).not.toMatch(/\b(beli|jual|rekomendasi|gorengan|berbahaya|akan pailit)\b/i);
});
