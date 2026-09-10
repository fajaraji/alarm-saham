// E2E layar putar ulang. Sebagian tes menuntut data nyata (PGlite ./.pglite):
// nama perusahaan dan tautan PDF BEI hanya ada di jalur DB, dan COWL tidak ada
// di fixture. Tes itu di-skip dengan pesan saat server berjalan pada jalur
// fixture (E2E_TANPA_PGLITE=1 atau clone bersih) — bukan gagal.
import { expect, test } from "@playwright/test";

import { ADA_PGLITE, buka, harapkanKlaimSumberJujur, harapkanLabelSumber, PESAN_SKIP_PGLITE } from "./util";

test.describe("/putar-ulang", () => {
  test("cari SRIL → garis waktu dari DB dengan ≥ 3 kejadian, sumber & tautan BEI, lampu", async ({ page }) => {
    test.skip(!ADA_PGLITE, PESAN_SKIP_PGLITE);
    await buka(page, "/putar-ulang");
    await page.getByTestId("kotak-kode").fill("sril");
    await page.getByTestId("tombol-lihat").click();
    await expect(page).toHaveURL(/kode=sril/i);

    const wadah = page.getByTestId("putar-ulang");
    await expect(wadah).toHaveAttribute("data-symbol", "SRIL");
    await expect(page.getByRole("heading", { level: 3, name: /Sri Rejeki Isman/ })).toBeVisible();
    await harapkanLabelSumber(page.getByTestId("label-sumber"));

    const kejadian = page.getByTestId("kejadian");
    expect(await kejadian.count()).toBeGreaterThanOrEqual(3);

    // Suspensi resmi: alasan BEI + tautan PDF.
    const suspensi = page.locator('[data-testid="kejadian"][data-jenis="suspensi"]').first();
    await expect(suspensi).toContainText("Suspend more than 6 month");
    await expect(suspensi.getByRole("link", { name: /PDF BEI/ })).toHaveAttribute("href", /idx\.co\.id/);
    // Setiap kejadian menyebut sumber.
    for (const teks of await kejadian.allTextContents()) expect(teks).toMatch(/Sumber: Sectors \//);

    // Di posisi akhir (hari ini) semua kejadian aktif, lampu merah (laporan hilang + ekuitas negatif).
    expect(await page.locator('[data-testid="kejadian"][data-aktif="false"]').count()).toBe(0);
    await expect(page.getByTestId("lampu")).toHaveAttribute("data-warna", "merah");
    await expect(page.getByTestId("ringkasan")).toContainText(/sudah ada \d+ tanda/);
    await expect(page.getByTestId("pelajaran")).toContainText("Tanda pertama muncul");
    await expect(page.getByTestId("disclaimer")).toContainText("bukan saran investasi");
  });

  test("jalur fixture jujur: label 'data contoh', catatan, dan sumber tidak mengaku Sectors", async ({ page }) => {
    test.skip(ADA_PGLITE, "hanya berlaku saat server berjalan pada jalur fixture");
    await buka(page, "/putar-ulang?kode=SRIL");
    await expect(page.getByTestId("putar-ulang")).toHaveAttribute("data-symbol", "SRIL");
    await harapkanLabelSumber(page.getByTestId("label-sumber"));
    // Klaim sumber resmi tidak boleh muncul di MANA PUN pada halaman ini —
    // termasuk footer disclaimer & dialog panduan yang dipasang layout akar,
    // dan dalam urutan kata apa pun ("fakta dari data resmi" maupun "fakta
    // resmi dari feed Sectors"). Gerbang lama hanya memindai <main> dan satu
    // urutan kata, jadi footer lolos dua kali.
    await harapkanKlaimSumberJujur(page, "/putar-ulang?kode=SRIL (fixture)");
    await expect(page.getByTestId("catatan")).toContainText("data CONTOH");
    for (const teks of await page.getByTestId("kejadian").allTextContents()) {
      expect(teks).toMatch(/Sumber: data contoh — fixture/);
      expect(teks).not.toMatch(/Sumber: Sectors/);
    }
    await expect(page.locator('[data-testid="kejadian"] a')).toHaveCount(0);
  });

  test("geser slider ke kiri → jumlah kejadian aktif berubah dan lampu ikut", async ({ page }) => {
    await buka(page, "/putar-ulang?kode=SRIL");
    const slider = page.getByTestId("slider");
    const semua = await page.getByTestId("kejadian").count();
    const aktifAwal = await page.locator('[data-testid="kejadian"][data-aktif="true"]').count();
    expect(aktifAwal).toBe(semua);

    await slider.focus();
    await page.keyboard.press("Home");
    await expect(page.locator('[data-testid="kejadian"][data-aktif="true"]')).toHaveCount(0);
    await expect(page.getByTestId("ringkasan")).toContainText("belum ada tanda");
    await expect(page.getByTestId("lampu")).toHaveAttribute("data-warna", "hijau");

    // Tepat di akhir bulan suspensi (2021-05-31): suspensi aktif, lampu merah.
    await slider.fill(String(await indeksBulan(page, "2021-05-31")));
    await expect(page.getByTestId("tanggal-terpilih")).toHaveText("31 Mei 2021");
    await expect(page.locator('[data-testid="kejadian"][data-jenis="suspensi"]').first()).toHaveAttribute(
      "data-aktif",
      "true",
    );
    await expect(page.getByTestId("lampu")).toHaveAttribute("data-warna", "merah");
    const aktifTengah = await page.locator('[data-testid="kejadian"][data-aktif="true"]').count();
    expect(aktifTengah).toBeGreaterThan(0);
    expect(aktifTengah).toBeLessThan(semua);
  });

  test("cari ZZZZ → pesan jujur + tombol minta ditarik hanya mencatat", async ({ page }) => {
    await buka(page, "/putar-ulang?kode=ZZZZ");
    const kosong = page.getByTestId("tidak-ada");
    await expect(kosong).toContainText("ZZZZ belum ada di data kami");
    await expect(page.getByTestId("putar-ulang")).toHaveCount(0);
    await page.getByRole("button", { name: /Minta ZZZZ ditarik/ }).click();
    await expect(page.getByTestId("minta-tarik")).toContainText("sudah dicatat");
  });

  test("emiten 404 di sumber (COWL) → hanya suspensi + catatan data laporan tidak tersedia", async ({ page }) => {
    test.skip(!ADA_PGLITE, PESAN_SKIP_PGLITE); // COWL tidak ada di fixture universe-kecil.json
    await buka(page, "/putar-ulang?kode=COWL");
    await expect(page.getByTestId("putar-ulang")).toHaveAttribute("data-symbol", "COWL");
    await expect(page.locator('[data-testid="kejadian"][data-jenis="suspensi"]')).toHaveCount(1);
    await expect(page.locator('[data-testid="kejadian"]:not([data-jenis="suspensi"])')).toHaveCount(0);
    await expect(page.getByTestId("catatan")).toContainText("tidak tersedia di sumber");
  });

  test("chip kasus nyata tampil dan halaman tanpa kata penilaian terlarang", async ({ page }) => {
    await buka(page, "/putar-ulang?kode=WIKA");
    for (const k of ["SRIL", "TELE", "WIKA", "INAF", "BTEL", "GOLL"]) {
      await expect(page.getByTestId("chip-kasus").getByRole("link", { name: k, exact: true })).toBeVisible();
    }
    const teks = await page.locator("main").innerText();
    expect(teks).not.toMatch(/berbahaya|gorengan|akan pailit/i);
    await expect(page.locator('[data-testid="kejadian"][data-jenis="rights_issue"]')).toHaveCount(2);
  });

  test("API /api/emiten/[symbol]: 200 untuk SRIL, 404 jujur untuk ZZZZ, POST hanya mencatat", async ({ request }) => {
    const ok = await request.get("/api/emiten/SRIL?today=2026-09-07");
    expect(ok.status()).toBe(200);
    const json = (await ok.json()) as { symbol: string; status: string; kejadian: unknown[]; sumber: string };
    expect(json.symbol).toBe("SRIL");
    expect(json.status).toBe("lengkap");
    expect(json.kejadian.length).toBeGreaterThanOrEqual(3);

    const tidakAda = await request.get("/api/emiten/ZZZZ");
    expect(tidakAda.status()).toBe(404);
    expect(((await tidakAda.json()) as { pesan: string }).pesan).toContain("belum ada di data kami");

    const catat = await request.post("/api/emiten/ZZZZ");
    expect(catat.status()).toBe(200);
    expect((await catat.json()) as object).toMatchObject({ ok: true, permintaan: { symbol: "ZZZZ" } });
  });
});

/** Indeks posisi slider untuk akhir bulan tertentu, dihitung dari label rentang di layar. */
async function indeksBulan(page: import("@playwright/test").Page, akhirBulan: string): Promise<number> {
  const awal = await page.locator(".pu-slider .lbl span").first().innerText();
  const [y0, m0] = awal.split("-").map(Number);
  const [y1, m1] = akhirBulan.split("-").map(Number);
  return (y1 - y0) * 12 + (m1 - m0);
}
