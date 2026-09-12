// E2E layar "Rakit alarm": klik-untuk-tambah, seret ke area buang, seret dari
// palet ke papan, ATAU→DAN, uji ke masa lalu (PGlite bila ada, selain itu fixture), banner AI 503,
// dan screenshot mode terang & gelap (folder ter-gitignore).
import { expect, test, type Locator, type Page } from "@playwright/test";

import { ADA_PGLITE, AI_AKTIF, buka, harapkanLabelSumber } from "./util";

const FOLDER_SCREENSHOT = "tests/e2e/screenshots";

/** Seret dengan penunjuk nyata (dnd-kit butuh gerakan bertahap melewati jarak aktivasi). */
async function seret(page: Page, dari: Locator, ke: Locator) {
  const a = await dari.boundingBox();
  const b = await ke.boundingBox();
  if (!a || !b) throw new Error("Elemen seret/tujuan tidak terlihat");
  const x0 = a.x + a.width / 2;
  const y0 = a.y + a.height / 2;
  const x1 = b.x + b.width / 2;
  const y1 = b.y + b.height / 2;
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  await page.mouse.move(x0 + 8, y0 + 8, { steps: 4 });
  await page.mouse.move(x1, y1, { steps: 16 });
  await page.waitForTimeout(80);
  await page.mouse.move(x1 + 1, y1 + 1, { steps: 2 });
  await page.mouse.up();
}

/**
 * Seret pendek yang dibatalkan: lewati jarak aktivasi (4 px) lalu kembali dan
 * lepas di titik semula, sehingga peramban mengirim klik kompatibilitas ke
 * elemen yang sama.
 */
async function seretLaluBatal(page: Page, dari: Locator) {
  const a = await dari.boundingBox();
  if (!a) throw new Error("Elemen seret tidak terlihat");
  const x = a.x + a.width / 2;
  const y = a.y + a.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 12, y + 12, { steps: 4 });
  await page.mouse.move(x, y, { steps: 4 });
  await page.mouse.up();
}

test("rakit 2 blok → buang satu → seret dari palet → DAN → uji → hasil & banner AI", async ({ page }) => {
  // Viewport tinggi agar palet, papan, dan area buang terlihat bersamaan (seret memakai koordinat viewport).
  await page.setViewportSize({ width: 1280, height: 1400 });
  await buka(page, "/rakit");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Rakit alarmmu");
  await expect(page.getByText("Alarm Saham adalah alat informasi dan analisis, bukan saran investasi.")).toBeVisible();

  // Klik-untuk-tambah (fallback keyboard/sentuh)
  await page.getByTestId("palet-suspensi").click();
  await page.getByTestId("palet-laporan_hilang").click();
  await expect(page.getByTestId("blok-suspensi")).toBeVisible();
  await expect(page.getByTestId("blok-laporan_hilang")).toBeVisible();
  await expect(page.getByTestId("palet-suspensi")).toBeDisabled();
  await expect(page.getByTestId("tombol-gabung")).toHaveText("ATAU");

  // Seret satu blok ke area buang
  const pegangan = page.getByTestId("blok-laporan_hilang").getByRole("button", { name: /Pegang untuk memindahkan/ });
  await seret(page, pegangan, page.getByTestId("area-buang"));
  await expect(page.getByTestId("blok-laporan_hilang")).toHaveCount(0);
  await expect(page.getByTestId("palet-laporan_hilang")).toBeEnabled();

  // Seret dari palet ke papan (salin)
  await seret(page, page.getByTestId("palet-ekuitas_negatif"), page.getByTestId("papan-dropzone"));
  await expect(page.getByTestId("blok-ekuitas_negatif")).toBeVisible();

  // ATAU → DAN, dan ambang longgar → ketat
  await page.getByTestId("tombol-gabung").click();
  await expect(page.getByTestId("tombol-gabung")).toHaveText("DAN");
  await page.getByTestId("blok-suspensi").getByRole("button", { name: /^Ambang/ }).click();
  await expect(page.getByTestId("blok-suspensi")).toHaveAttribute("data-threshold", "ketat");

  // Uji ke masa lalu: /api/backtest memakai getEventSource() (tiket 13) — PGlite
  // ./.pglite bila ada (DATABASE_URL kosong) → "data Sectors nyata", 107 saham;
  // tanpa PGlite → fixture "data contoh", 8 saham.
  await page.getByRole("button", { name: "Uji ke masa lalu" }).click();
  await expect(page.getByTestId("skor-tertangkap")).not.toHaveText("–");
  await expect(page.getByTestId("skor-palsu")).toHaveText(/^\d+\/\d+$/);
  await harapkanLabelSumber(page.getByTestId("label-sumber"));
  if (ADA_PGLITE) {
    await expect(page.getByTestId("hasil-uji")).toContainText(/Diuji ke 10\d saham/);
    await expect(page.getByTestId("skor-palsu")).toHaveText(/^\d+\/30$/);
    // MENN, TGRA, WSKT tidak punya tanggal kejadian target → dilewati seperti CLI (docs/universe-pull.md catatan 4).
    await expect(page.getByTestId("dilewati")).toContainText("3 saham dilewati");
  } else {
    // Fixture: 8 emiten, 4 kontrol; tidak ada emiten tanpa tanggal kejadian target.
    await expect(page.getByTestId("hasil-uji")).toContainText("Diuji ke 8 saham");
    await expect(page.getByTestId("skor-palsu")).toHaveText(/^\d+\/4$/);
  }
  await expect(page.getByTestId("kelompok-delisting")).toBeVisible();
  await expect(page.getByTestId("kelompok-control")).toBeVisible();
  await expect(page.getByTestId("sel-SRIL")).toBeVisible();

  // Panel AI: kunci belum diisi → banner sopan (503). Dilewati bila server
  // yang diuji justru punya kunci (E2E_AI=aktif, mis. URL produksi).
  if (!AI_AKTIF) await expect(page.getByTestId("banner-ai-diagnosis")).toContainText("Fitur AI belum aktif");

  // Screenshot dua mode (hanya dilaporkan bahwa keduanya dirender)
  await page.emulateMedia({ colorScheme: "light" });
  await page.waitForTimeout(400); // tunggu transisi warna (transition-colors 150 ms) selesai
  await page.screenshot({ path: `${FOLDER_SCREENSHOT}/rakit-terang.png`, fullPage: true });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${FOLDER_SCREENSHOT}/rakit-gelap.png`, fullPage: true });
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

/**
 * Regresi CI: klik yang datang SEGERA setelah seret tidak boleh hilang.
 *
 * @dnd-kit/core meredam semua klik di `document` selama 50 ms setelah seret
 * (AbstractPointerSensor.detach) — lihat src/components/rakit/sensor.ts. Tes
 * di atas tidak menangkapnya di laptop karena `locator.click()` di Windows
 * butuh ~148 ms; di runner Linux hanya 41 ms, jadi kliknya jatuh di dalam
 * jendela peredam dan papan diam-diam tidak berubah ATAU → DAN
 * (run 34427424551).
 *
 * Tes ini menghafal titik tombolnya dulu, lalu mengulang alurnya dan mengklik
 * titik itu tanpa satu pun perjalanan bolak-balik setelah `mouse.up()`,
 * sehingga jaraknya ≤ jarak CI di mesin mana pun. Penguncian yang benar-benar
 * bebas waktu ada di tests/ui/rakit-sensor.test.tsx; yang ini memastikan
 * perilakunya juga benar pada build produksi + React sungguhan.
 *
 * Ia TETAP merah waktu peredamnya cuma diperpendek jadi `setTimeout(..., 0)`
 * (run 34437835563): task timer kalah prioritas dari task input, jadi klik yang
 * disuntikkan masih menyalip callback timernya. Jangan "memperbaiki" tes ini
 * dengan menambah jeda — jeda apa pun di sini menyembunyikan justru jendela
 * yang sedang diukur. Penutup di sensor.ts sekarang tidak memakai timer sama
 * sekali; tes ini yang menjaga janji itu.
 */
test("klik tepat sesudah seret tetap sampai ke papan (peredam klik dnd-kit)", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1400 });

  async function rakitSampaiDrop() {
    await page.getByTestId("palet-suspensi").click();
    await expect(page.getByTestId("blok-suspensi")).toBeVisible();
    await seret(page, page.getByTestId("palet-ekuitas_negatif"), page.getByTestId("papan-dropzone"));
  }

  // Putaran 1: hafalkan posisi tombol gabung sesudah drop.
  await buka(page, "/rakit");
  await rakitSampaiDrop();
  const kotak = await page.getByTestId("tombol-gabung").boundingBox();
  if (!kotak) throw new Error("tombol-gabung tidak terlihat sesudah seret dari palet");

  // Putaran 2: papan bersih, alur sama, klik langsung di titik hafalan.
  await buka(page, "/rakit");
  await rakitSampaiDrop();
  await page.mouse.click(kotak.x + kotak.width / 2, kotak.y + kotak.height / 2);
  await expect(page.getByTestId("tombol-gabung")).toHaveText("DAN");
});

/**
 * Sisi lain dari kontrak yang sama: peredamnya memang masih meredam.
 *
 * Blok palet adalah <button> yang bisa diseret SEKALIGUS punya onClick "tambah"
 * (Palet.tsx), jadi klik kompatibilitas milik seret pendek yang dibatalkan di
 * atasnya HARUS tetap ditelan. Kejadiannya tidak bisa dibaca dari isi papan:
 * `deteksiTabrakan` jatuh ke `closestCenter` kalau penunjuk tidak di atas
 * droppable mana pun, jadi seret yang dibatalkan tetap mendarat di papan, dan
 * `reducerPapan` menolak blok kembar — dua jalur itu menutupi kliknya. Yang
 * diukur di sini adalah faktanya langsung: apakah klik sampai ke fase bubble
 * `document`, tempat React App Router memasang seluruh onClick-nya.
 *
 * Satu angka mengunci KEDUA arah sekaligus, tanpa asumsi urutan: sesudah blok
 * kedua muncul, perekam harus memuat TEPAT satu klik. Dua = klik milik seret
 * bocor (peredam dicabut terlalu dini); nol = peredamnya tidak pernah dicabut,
 * dan bloknya bahkan tidak akan muncul. Titik klik kedua dihafal SEBELUM seret
 * supaya tidak ada perjalanan bolak-balik sesudah `mouse.up()` — sama ketatnya
 * dengan tes di atas.
 *
 * Tes ini juga yang akan memberi tahu kalau Chromium suatu saat berhenti
 * memberi klik kompatibilitas stempel yang sama dengan `pointerup`-nya —
 * dasar empiris seluruh penutup di src/components/rakit/sensor.ts.
 */
test("klik milik seret ditelan, klik sesudahnya lolos (dua sisi peredam)", async ({ page }) => {
  await buka(page, "/rakit");
  await page.evaluate(() => {
    (window as unknown as { __klik: number }).__klik = 0;
    document.addEventListener("click", () => (window as unknown as { __klik: number }).__klik++);
  });
  // Palet tidak bergeser saat papan bertambah blok (aside `self-start`), jadi
  // titik ini masih sahih sesudah seret.
  const kotak = await page.getByTestId("palet-aksi_dilutif").boundingBox();
  if (!kotak) throw new Error("palet-aksi_dilutif tidak terlihat");

  await seretLaluBatal(page, page.getByTestId("palet-suspensi"));
  await page.mouse.click(kotak.x + kotak.width / 2, kotak.y + kotak.height / 2);
  await expect(page.getByTestId("blok-aksi_dilutif")).toBeVisible();

  const sampai = await page.evaluate(() => (window as unknown as { __klik: number }).__klik);
  expect(sampai, "2 = klik milik seret bocor; 1 = tepat klik kedua saja").toBe(1);
});

test("Minta AI rakit tanpa kunci → banner sopan, papan tetap bisa dirakit sendiri", async ({ page }) => {
  await buka(page, "/rakit");
  await page.getByRole("textbox", { name: /Ceritakan alarm/ }).fill("aku mau alarm buat saham yang mau pailit");
  await page.getByRole("button", { name: "Minta AI rakit" }).click();
  if (!AI_AKTIF) await expect(page.getByTestId("catatan-rakit")).toContainText("Fitur AI belum aktif");
  await page.getByTestId("palet-insider_jual").click();
  await expect(page.getByTestId("blok-insider_jual")).toBeVisible();
});

test("keyboard: pegang blok, panah bawah, lepas → urutan berubah", async ({ page }) => {
  await buka(page, "/rakit");
  await page.getByTestId("palet-suspensi").click();
  await page.getByTestId("palet-aksi_dilutif").click();
  const pegangan = page.getByTestId("blok-suspensi").getByRole("button", { name: /Pegang untuk memindahkan/ });
  await pegangan.focus();
  await page.keyboard.press("Space");
  await page.waitForTimeout(100);
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(100);
  await page.keyboard.press("Space");
  const urutan = await page.getByTestId("papan-dropzone").locator("li[data-testid^='blok-']").evaluateAll((els) =>
    els.map((e) => e.getAttribute("data-testid")),
  );
  expect(urutan).toEqual(["blok-aksi_dilutif", "blok-suspensi"]);
});
