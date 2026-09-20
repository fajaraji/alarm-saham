// E2E layar "Pasang" (PGlite ./.pglite bila ada, selain itu fixture; DATABASE_URL
// kosong): tambah BBCA & SRIL → cek sekarang (kelas A saja) → SRIL merah dengan
// alasan suspensi, BBCA hijau → muat ulang → portofolio tetap ada. Toggle "data
// terkini" (kelas B) sengaja TIDAK dijalankan agar tidak memakai kredit Sectors.
import { expect, test } from "@playwright/test";

import { ADA_PGLITE, buka, harapkanLabelSumber, muatUlang, tutupDialogTautanPertama } from "./util";

test("tambah BBCA & SRIL → cek sekarang → peta berwarna & pesan → muat ulang tetap ada", async ({ page }) => {
  await buka(page, "/pasang");
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
  await tutupDialogTautanPertama(page);
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
  await harapkanLabelSumber(page.getByTestId("label-sumber"));
  await expect(page.getByTestId("kredit-terpakai")).toContainText("kredit Sectors terpakai: 0");

  // Pesan penjelasan: syarat + tanggal + sumber + disclaimer, tanpa kata rekomendasi
  const pesan = page.getByTestId("pesan-SRIL");
  await expect(pesan).toContainText("alarm berbunyi");
  // Tanggal suspensi yang dilaporkan berbeda per sumber: DB memuat seluruh feed
  // BEI (suspensi pertama 18 Mei 2021), fixture hanya dua baris (terakhir 1 Nov 2024).
  // Tanggal ditulis untuk dibaca orang, bukan ISO (DESIGN.md aturan 9).
  await expect(pesan).toContainText(ADA_PGLITE ? "18 Mei 2021" : "1 Nov 2024");
  await expect(pesan).toContainText("bukan saran investasi");
  await expect(pesan).toContainText("Waspada suspensi");
  // Atribusi sumber di pesan penjelasan harus ikut jujur pada jalur fixture.
  await expect(pesan).toContainText(ADA_PGLITE ? "Sectors /v2/suspensions/" : "data contoh: fixture");
  if (!ADA_PGLITE) await expect(pesan).not.toContainText("Sectors /v2/");
  const teks = (await pesan.textContent()) ?? "";
  expect(teks.replace(/filing jual/g, "")).not.toMatch(/\b(beli|jual|rekomendasi)\b/i);
  await expect(page.getByTestId("pesan-BBCA")).toContainText("aman menurut alarmmu");

  // Kotak masuk: bendera SRIL
  await expect(page.getByTestId("kotak-masuk")).toHaveAttribute("data-baru", "1");
  await expect(page.getByTestId("bendera").first()).toContainText("SRIL");

  // Muat ulang: portofolio & hasil terakhir tetap ada
  await muatUlang(page);
  await expect(page.getByTestId("label-penyimpanan")).not.toHaveText("memuat…");
  await expect(page.getByTestId("tile-BBCA")).toBeVisible();
  await expect(page.getByTestId("tile-SRIL")).toBeVisible();
  await expect(page.getByTestId("tile-SRIL")).toHaveAttribute("data-status", "merah");
  await expect(page.getByTestId("toggle-kelas-b")).not.toBeChecked();
});

test("saham di luar data kami ditandai 'tidak ada data'; hapus saham menyimpan ulang", async ({ page }) => {
  await buka(page, "/pasang");
  await expect(page.getByTestId("label-penyimpanan")).not.toHaveText("memuat…");
  await page.getByTestId("kotak-kode").fill("ZZZZ");
  await page.getByTestId("tombol-tambah").click();
  await tutupDialogTautanPertama(page);
  await expect(page.getByTestId("tanpa-data-ZZZZ")).toBeVisible();
  await page.getByRole("button", { name: "Hapus ZZZZ" }).click();
  await expect(page.getByTestId("tile-ZZZZ")).toHaveCount(0);
  await muatUlang(page);
  await expect(page.getByTestId("label-penyimpanan")).not.toHaveText("memuat…");
  await expect(page.getByTestId("tile-ZZZZ")).toHaveCount(0);
});

test("alarm buatan sendiri bisa dihapus dari /pasang dan tidak kembali setelah muat ulang (tiket 33)", async ({ page }) => {
  // Rakit dan simpan satu alarm lewat layar Rakit, persis seperti pengguna.
  await buka(page, "/rakit");
  await page.getByTestId("palet-suspensi").click();
  await page.getByLabel("Nama alarm").fill("Alarm untuk dihapus");
  await page.getByTestId("tombol-simpan").click();
  await expect(page.getByTestId("dialog-tautan")).toBeVisible();
  await page.keyboard.press("Escape");

  await buka(page, "/pasang");
  await expect(page.getByTestId("label-penyimpanan")).not.toHaveText("memuat…");
  const kartu = page.getByRole("list", { name: "Alarm terpasang" }).getByRole("listitem").filter({ hasText: "Alarm untuk dihapus" });
  await expect(kartu).toHaveCount(1);
  // Alarm bawaan tidak punya tombol hapus.
  await expect(page.getByTestId("hapus-alarm-00000000-0000-4000-8000-00000000a001")).toHaveCount(0);

  await kartu.getByRole("button", { name: "Hapus alarm Alarm untuk dihapus" }).click();
  await page.getByTestId("tombol-ya-hapus-alarm").click();
  await expect(page.getByTestId("pesan-alarm")).toContainText("dihapus");
  await expect(kartu).toHaveCount(0);

  await muatUlang(page);
  await expect(page.getByTestId("label-penyimpanan")).not.toHaveText("memuat…");
  await expect(page.getByRole("list", { name: "Alarm terpasang" })).not.toContainText("Alarm untuk dihapus");
});
