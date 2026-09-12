// Smoke alur penuh (tiket 15, gerbang sebelum deploy) di build production:
// putar ulang SRIL → rakit 2 blok → uji ke masa lalu → pasang BBCA & SRIL →
// cek sekarang (kelas A saja, NOL kredit) → metodologi → kamus → beranda.
// Sepanjang alur TIDAK boleh ada console.error selain yang diharapkan (daftar
// eksplisit di util.ts: 503 panel AI tanpa kunci, 501 portofolio tanpa DB).
//
// Dijalankan pada dua varian server: dengan ./.pglite (data Sectors nyata, 107
// emiten) dan E2E_TANPA_PGLITE=1 (fixture 8 emiten, seperti CI/clone bersih).
// Ekspektasi yang bergantung sumber bercabang lewat ADA_PGLITE; label sumber
// diperiksa lewat atribut mesin `data-sumber` (lihat harapkanLabelSumber).
import { expect, test } from "@playwright/test";

import { ADA_PGLITE, AI_AKTIF, buka, harapkanLabelSumber, kumpulkanConsoleError } from "./util";

test("alur 1→2→3 utuh tanpa console.error", async ({ page }) => {
  test.setTimeout(120_000);
  const konsol = kumpulkanConsoleError(page);

  // Langkah 1: putar ulang SRIL
  await buka(page, "/putar-ulang");
  await page.getByTestId("kotak-kode").fill("SRIL");
  await page.getByTestId("tombol-lihat").click();
  await expect(page.getByTestId("putar-ulang")).toHaveAttribute("data-symbol", "SRIL");
  await harapkanLabelSumber(page.getByTestId("label-sumber"));
  expect(await page.getByTestId("kejadian").count()).toBeGreaterThanOrEqual(2);
  await expect(page.locator('[data-testid="kejadian"][data-jenis="suspensi"]').first()).toContainText(
    "Suspend more than 6 month",
  );
  // Atribusi sumber per kejadian harus jujur: hanya jalur DB yang boleh menulis
  // "Sumber: Sectors /v2/…"; jalur fixture menyebut dirinya data contoh.
  for (const teks of await page.getByTestId("kejadian").allTextContents()) {
    expect(teks).toMatch(ADA_PGLITE ? /Sumber: Sectors \// : /Sumber: data contoh: fixture/);
  }
  await expect(page.getByTestId("lampu")).toHaveAttribute("data-warna", "merah");

  // Langkah 2: rakit 2 blok lewat klik, uji ke masa lalu
  await page.getByRole("navigation", { name: "Langkah" }).getByRole("link", { name: /Rakit alarm/ }).click();
  await expect(page).toHaveURL(/\/rakit$/);
  await page.getByTestId("palet-suspensi").click();
  await page.getByTestId("palet-laporan_hilang").click();
  await expect(page.getByTestId("blok-suspensi")).toBeVisible();
  await expect(page.getByTestId("blok-laporan_hilang")).toBeVisible();
  await page.getByRole("button", { name: "Uji ke masa lalu" }).click();
  await expect(page.getByTestId("skor-tertangkap")).toHaveText(/^\d+\/\d+$/);
  await expect(page.getByTestId("skor-palsu")).toHaveText(/^\d+\/\d+$/);
  await harapkanLabelSumber(page.getByTestId("label-sumber"));
  if (ADA_PGLITE) await expect(page.getByTestId("hasil-uji")).toContainText(/Diuji ke 10\d saham/);
  await expect(page.getByTestId("sel-SRIL")).toBeVisible();
  // Panel AI. Tanpa kunci: banner nonaktif setelah 503. Dengan kunci: tombol
  // "Minta diagnosis AI" siap ditekan — dan itu sekaligus bukti kuncinya
  // terpasang. Tombolnya sengaja TIDAK diklik di smoke: satu panggilan model
  // memakan 50-240 detik dan token tiap kali gerbang ini dijalankan.
  await expect(page.getByTestId("panel-ai")).toBeVisible();
  if (AI_AKTIF) {
    await expect(page.getByRole("button", { name: /Minta diagnosis AI/ })).toBeVisible();
    await expect(page.getByTestId("banner-ai-diagnosis")).toHaveCount(0);
  } else {
    // Tanpa kunci, bannernya baru muncul sesudah tombolnya ditekan dan 503
    // tiba — sejak diagnosis tidak lagi jalan otomatis di akhir uji.
    await page.getByRole("button", { name: /Minta diagnosis AI/ }).click();
    await expect(page.getByTestId("banner-ai-diagnosis")).toContainText("Fitur AI belum aktif");
  }

  // Langkah 3: pasang BBCA & SRIL, cek sekarang (kelas A saja, nol kredit)
  await page.getByRole("navigation", { name: "Langkah" }).getByRole("link", { name: /Pasang/ }).click();
  await expect(page).toHaveURL(/\/pasang$/);
  await expect(page.getByTestId("label-penyimpanan")).not.toHaveText("memuat…");
  await page.getByTestId("kotak-kode").fill("BBCA");
  await page.getByTestId("tombol-tambah").click();
  await page.getByTestId("kotak-kode").fill("SRIL");
  await page.getByTestId("kotak-kode").press("Enter");
  await expect(page.getByTestId("tile-BBCA")).toBeVisible();
  await expect(page.getByTestId("tile-SRIL")).toBeVisible();
  await expect(page.getByTestId("toggle-kelas-b")).not.toBeChecked();
  await page.getByTestId("tombol-cek").click();
  await expect(page.getByTestId("tile-SRIL")).toHaveAttribute("data-status", "merah");
  await expect(page.getByTestId("tile-BBCA")).toHaveAttribute("data-status", "hijau");
  await expect(page.getByTestId("alasan-SRIL")).toContainText(/suspensi/i);
  await harapkanLabelSumber(page.getByTestId("label-sumber"));
  await expect(page.getByTestId("kredit-terpakai")).toContainText("kredit Sectors terpakai: 0");
  await expect(page.getByTestId("pesan-SRIL")).toContainText("bukan saran investasi");
  await expect(page.getByTestId("status-BBCA")).toHaveText("Aman menurut alarmmu");

  // Metodologi & kamus tampil
  await page.getByRole("navigation", { name: "Langkah" }).getByRole("link", { name: "Cara kami menghitung" }).click();
  await expect(page).toHaveURL(/\/cara-kami-menghitung$/);
  await expect(page.getByRole("heading", { level: 1, name: "Cara kami menghitung" })).toBeVisible();
  await expect(page.getByTestId("stat-tertangkap")).toHaveText(/\d+\/\d+/);

  await page.getByRole("navigation", { name: "Langkah" }).getByRole("link", { name: /Kamus/ }).click();
  await expect(page).toHaveURL(/\/kamus$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Istilah yang dipakai");
  await expect(page.getByTestId("kamus-suspensi")).toBeVisible();

  // Merek di header mengantar ke beranda; beranda mengarah ke 3 langkah + disclaimer
  await page.getByRole("link", { name: "Alarm Saham, beranda" }).click();
  // Dicocokkan sebagai PATH, bukan URL penuh: spec ini juga dijalankan
  // terhadap URL hidup (E2E_BASE_URL), yang domainnya bukan 127.0.0.1.
  await expect.poll(() => new URL(page.url()).pathname).toBe("/");
  await expect(page.getByRole("link", { name: /Mulai dari langkah 1/ })).toBeVisible();
  await expect(page.getByTestId("disclaimer")).toContainText("bukan saran investasi");

  expect(konsol.daftar, `console.error selama alur:\n${konsol.daftar.join("\n")}`).toEqual([]);
});
