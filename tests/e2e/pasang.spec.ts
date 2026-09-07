// E2E layar "Pasang" di atas data nyata (PGlite ./.pglite, DATABASE_URL kosong):
// tambah BBCA & SRIL → cek sekarang (kelas A saja) → SRIL merah dengan alasan
// suspensi, BBCA hijau → muat ulang → portofolio tetap ada. Toggle "data
// terkini" (kelas B) sengaja TIDAK dijalankan agar tidak memakai kredit Sectors.
import { expect, test } from "@playwright/test";

test("tambah BBCA & SRIL → cek sekarang → peta berwarna & pesan → muat ulang tetap ada", async ({ page }) => {
  await page.goto("/pasang");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Pasang alarmmu");
  await expect(page.getByTestId("disclaimer")).toContainText("bukan saran investasi");
  await expect(page.getByTestId("portofolio-kosong")).toBeVisible();
  await expect(page.getByTestId("label-penyimpanan")).not.toHaveText("memuat…");

  // Alarm bawaan tampil & aktif
  await expect(page.getByTestId("alarm-00000000-0000-4000-8000-00000000a001")).toHaveAttribute("data-aktif", "true");
  await expect(page.getByTestId("alarm-00000000-0000-4000-8000-00000000b001")).toHaveAttribute("data-aktif", "true");

  // Tambah dua saham (huruf kecil pun diterima), lalu tolak ganda
  await page.getByTestId("kotak-kode").fill("bbca");
  await page.getByTestId("tombol-tambah").click();
  await page.getByTestId("kotak-kode").fill("SRIL");
  await page.getByTestId("kotak-kode").press("Enter");
  await expect(page.getByTestId("tile-BBCA")).toBeVisible();
  await expect(page.getByTestId("tile-SRIL")).toBeVisible();
  await page.getByTestId("kotak-kode").fill("BBCA");
  await page.getByTestId("tombol-tambah").click();
  await expect(page.getByTestId("galat-tambah")).toContainText("sudah ada");
  expect(await page.locator("[data-testid^='tile-']").count()).toBe(2);

  // Cek sekarang (kelas A dari PGlite; toggle data terkini tetap mati)
  await expect(page.getByTestId("toggle-kelas-b")).not.toBeChecked();
  await page.getByTestId("tombol-cek").click();
  await expect(page.getByTestId("tile-SRIL")).toHaveAttribute("data-status", "merah");
  await expect(page.getByTestId("tile-BBCA")).toHaveAttribute("data-status", "hijau");
  await expect(page.getByTestId("alasan-SRIL")).toContainText(/suspensi/i);
  await expect(page.getByTestId("label-sumber")).toContainText("data Sectors nyata");
  await expect(page.getByTestId("kredit-terpakai")).toContainText("kredit Sectors terpakai: 0");

  // Pesan penjelasan: syarat + tanggal + sumber + disclaimer, tanpa kata rekomendasi
  const pesan = page.getByTestId("pesan-SRIL");
  await expect(pesan).toContainText("alarm berbunyi");
  await expect(pesan).toContainText("2021-05-18");
  await expect(pesan).toContainText("bukan saran investasi");
  await expect(pesan).toContainText("Saham mau pailit");
  const teks = (await pesan.textContent()) ?? "";
  expect(teks.replace(/filing jual/g, "")).not.toMatch(/\b(beli|jual|rekomendasi)\b/i);
  await expect(page.getByTestId("pesan-BBCA")).toContainText("aman menurut alarmmu");

  // Kotak masuk: bendera SRIL
  await expect(page.getByTestId("kotak-masuk")).toHaveAttribute("data-baru", "1");
  await expect(page.getByTestId("bendera").first()).toContainText("SRIL");

  // Muat ulang: portofolio & hasil terakhir tetap ada
  await page.reload();
  await expect(page.getByTestId("label-penyimpanan")).not.toHaveText("memuat…");
  await expect(page.getByTestId("tile-BBCA")).toBeVisible();
  await expect(page.getByTestId("tile-SRIL")).toBeVisible();
  await expect(page.getByTestId("tile-SRIL")).toHaveAttribute("data-status", "merah");
  await expect(page.getByTestId("toggle-kelas-b")).not.toBeChecked();
});

test("saham di luar data kami ditandai 'tidak ada data'; hapus saham menyimpan ulang", async ({ page }) => {
  await page.goto("/pasang");
  await expect(page.getByTestId("label-penyimpanan")).not.toHaveText("memuat…");
  await page.getByTestId("kotak-kode").fill("ZZZZ");
  await page.getByTestId("tombol-tambah").click();
  await expect(page.getByTestId("tanpa-data-ZZZZ")).toBeVisible();
  await page.getByRole("button", { name: "Hapus ZZZZ" }).click();
  await expect(page.getByTestId("tile-ZZZZ")).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId("label-penyimpanan")).not.toHaveText("memuat…");
  await expect(page.getByTestId("tile-ZZZZ")).toHaveCount(0);
});
