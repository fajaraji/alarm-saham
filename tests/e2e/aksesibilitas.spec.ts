// Aksesibilitas & kontras (tiket 15): axe-core pada 6 halaman, mode terang dan
// gelap. Tidak boleh ada pelanggaran serious/critical (kontras warna, label
// kontrol, nama tombol). Untuk /rakit dan /pasang halaman diisi dulu (blok di
// papan, hasil uji, saham di peta) agar komponen interaktif ikut dipindai.
//
// Dua permukaan interaktif dipindai terpisah karena tidak pernah terlihat pada
// muatan biasa: dialog panduan (storageState menandainya sudah selesai) dan
// popover Istilah (dirender `hidden`, sehingga dilewati axe).
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { buka } from "./util";

const HALAMAN = ["/", "/putar-ulang?kode=SRIL", "/rakit", "/pasang", "/cara-kami-menghitung", "/kamus"] as const;
const MODE = ["light", "dark"] as const;
const TAG = ["wcag2a", "wcag2aa", "wcag21aa", "best-practice"];

async function isiHalaman(page: Page, url: string) {
  if (url === "/rakit") {
    await page.getByTestId("palet-suspensi").click();
    await page.getByTestId("palet-laporan_hilang").click();
    await page.getByRole("button", { name: "Uji ke masa lalu" }).click();
    await expect(page.getByTestId("skor-tertangkap")).toHaveText(/^\d+\/\d+$/);
    // Diagnosis tidak lagi jalan otomatis di akhir uji, jadi bannernya baru
    // ada sesudah tombolnya ditekan (server e2e tanpa kunci → 503). Axe
    // memang perlu memeriksa panel AI dalam keadaan terisi, bukan kosong.
    await page.getByRole("button", { name: /Minta diagnosis AI/ }).click();
    await expect(page.getByTestId("banner-ai-diagnosis")).toBeVisible();
  } else if (url === "/pasang") {
    await expect(page.getByTestId("label-penyimpanan")).not.toHaveText("memuat…");
    await page.getByTestId("kotak-kode").fill("SRIL");
    await page.getByTestId("tombol-tambah").click();
    await page.getByTestId("kotak-kode").fill("ZZZZ");
    await page.getByTestId("tombol-tambah").click();
    await page.getByTestId("tombol-cek").click();
    await expect(page.getByTestId("tile-SRIL")).toHaveAttribute("data-status", "merah");
  } else if (url.startsWith("/putar-ulang")) {
    await expect(page.getByTestId("putar-ulang")).toHaveAttribute("data-symbol", "SRIL");
  } else if (url === "/cara-kami-menghitung") {
    await page.getByTestId("tabel-delisting").locator("summary").click();
  }
}

/** Jalankan axe dan kembalikan ringkasan pelanggaran serious/critical. */
async function pelanggaranBerat(page: Page): Promise<string[]> {
  const hasil = await new AxeBuilder({ page }).withTags(TAG).analyze();
  return hasil.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id} (${v.impact}): ${v.help}\n  ${v.nodes.slice(0, 5).map((n) => n.html.slice(0, 160)).join("\n  ")}`);
}

for (const mode of MODE) {
  test.describe(`axe mode ${mode}`, () => {
    test.use({ colorScheme: mode });
    for (const url of HALAMAN) {
      test(`${url}: 0 pelanggaran serious/critical`, async ({ page }) => {
        await buka(page, url);
        await isiHalaman(page, url);
        const ringkas = await pelanggaranBerat(page);
        expect(ringkas, ringkas.join("\n\n")).toEqual([]);
      });
    }

    test("dialog panduan terbuka: 0 pelanggaran serious/critical", async ({ page }) => {
      await buka(page, "/rakit");
      await page.getByTestId("tombol-panduan").click();
      await expect(page.getByTestId("overlay-panduan")).toBeVisible();
      const ringkas = await pelanggaranBerat(page);
      expect(ringkas, ringkas.join("\n\n")).toEqual([]);
    });

    test("tooltip istilah terbuka: 0 pelanggaran serious/critical", async ({ page }) => {
      // Istilah yang dipakai di sini harus benar-benar ada di /rakit. Dulu
      // "laporan_hilang", yang hidup di baris petunjuk; sejak petunjuknya
      // dipangkas (U1), istilah itu tinggal di palet dan kotak skor. Dipakai
      // "lebih_awal" dari kotak skor, yang selalu dirender bahkan sebelum uji
      // dijalankan, jadi tes ini tidak bergantung pada state apa pun.
      await buka(page, "/rakit");
      const pemicu = page.locator('[data-istilah="lebih_awal"]').first();
      await pemicu.click();
      await expect(page.getByTestId("tooltip-lebih_awal").first()).toBeVisible();
      const ringkas = await pelanggaranBerat(page);
      expect(ringkas, ringkas.join("\n\n")).toEqual([]);
    });
  });
}

test("fokus keyboard terlihat pada pegangan blok /rakit", async ({ page }) => {
  await buka(page, "/rakit");
  await page.getByTestId("palet-suspensi").click();
  const pegangan = page.getByTestId("blok-suspensi").getByRole("button", { name: /Pegang untuk memindahkan/ });
  // Blok ditambahkan lewat klik (modalitas tetikus), sehingga Chromium tidak
  // menganggap fokus berikutnya "focus-visible". Satu Tab mengembalikan
  // modalitas ke keyboard — persis situasi pengguna keyboard.
  await page.keyboard.press("Tab");
  await pegangan.focus();
  const gaya = await pegangan.evaluate((el) => {
    const s = getComputedStyle(el);
    return { matches: el.matches(":focus-visible"), outlineStyle: s.outlineStyle, outlineWidth: s.outlineWidth };
  });
  expect(gaya.matches).toBe(true);
  expect(gaya.outlineStyle).not.toBe("none");
  expect(parseFloat(gaya.outlineWidth)).toBeGreaterThan(0);
});

test("fokus keyboard terlihat pada kotak cari /putar-ulang", async ({ page }) => {
  // Kontrol pertama layar Langkah 1. Penandanya digambar di wadah (.pu-field
  // :focus-within), bukan di <input>, karena outline mengelilingi kotak.
  await buka(page, "/putar-ulang");
  await page.getByTestId("kotak-kode").focus();
  const gaya = await page.getByTestId("kotak-kode").evaluate((el) => {
    const wadah = el.closest(".pu-field") as HTMLElement;
    const s = getComputedStyle(wadah);
    return { fokusDiDalam: wadah.matches(":focus-within"), outlineStyle: s.outlineStyle, outlineWidth: s.outlineWidth };
  });
  expect(gaya.fokusDiDalam).toBe(true);
  expect(gaya.outlineStyle).not.toBe("none");
  expect(parseFloat(gaya.outlineWidth)).toBeGreaterThan(0);
});

test("dialog panduan menjebak fokus (Tab berputar di dalam kartu)", async ({ page }) => {
  await buka(page, "/rakit");
  await page.getByTestId("tombol-panduan").click();
  await expect(page.getByTestId("overlay-panduan")).toBeVisible();
  // 5 kali Tab jauh melewati jumlah kontrol di kartu (2 tautan/tombol).
  for (let i = 0; i < 5; i++) await page.keyboard.press("Tab");
  const diDalam = await page.evaluate(() => {
    const kartu = document.querySelector('[role="dialog"]');
    return Boolean(kartu && document.activeElement && kartu.contains(document.activeElement));
  });
  expect(diDalam).toBe(true);
});
