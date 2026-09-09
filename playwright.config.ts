// Playwright end-to-end: `next build` lalu `next start` (port 3100) agar tidak
// bentrok dengan `next dev`. Data: PGlite ./.pglite bila ada (DATABASE_URL kosong),
// selain itu fixture — nol panggilan API Sectors. Kunci AI dikosongkan agar panel AI
// diuji pada jalur 503.
//
// Env:
//   E2E_PORT=3101        port lain (menimpa pilihan otomatis di bawah).
//   E2E_SKIP_BUILD=1     pakai .next yang sudah ada.
//   E2E_TANPA_PGLITE=1   paksa jalur fixture walau ./.pglite ada (meniru CI / clone
//                        bersih): server dijalankan dengan TANPA_PGLITE=1 dan spec
//                        yang butuh data nyata di-skip dengan pesan
//                        (tests/e2e/util.ts → ADA_PGLITE, PESAN_SKIP_PGLITE).
//
// Dua varian memakai PORT BERBEDA secara otomatis karena `reuseExistingServer`
// akan memakai ulang server yang masih hidup di port yang sama — dan server
// varian sebelumnya dijalankan dengan env yang berbeda, sehingga suite bisa
// hijau sambil menguji varian yang salah.
//
// Catatan PGlite: satu proses per folder; jangan jalankan e2e bersamaan dengan
// `npm run backtest`/`next dev` yang membuka ./.pglite.
import { defineConfig, devices } from "@playwright/test";

const TANPA_PGLITE = Boolean(process.env.E2E_TANPA_PGLITE);
const PORT = Number(process.env.E2E_PORT ?? (TANPA_PGLITE ? 3101 : 3100));

/**
 * Tanggal "hari ini" dipakukan di server e2e (src/lib/engine/dates.ts membaca
 * ALARM_HARI_INI). Tanpa ini, blok `laporan_hilang` mulai berbunyi 120 hari
 * setelah kuartal terakhir di fixture, sehingga emiten kontrol (BBCA/TLKM/ASII/
 * UNVR) berubah hijau → kuning dengan sendirinya pada 2027-01-28 dan spec
 * membusuk tanpa ada yang menyentuh kode. Nilainya = docs/skor-nyata.json.today.
 *
 * `next start` berjalan dengan NODE_ENV=production, dan di produksi ALARM_HARI_INI
 * SENGAJA diabaikan (pagar tiket 15: nilai yang tanpa sengaja tersalin ke dasbor
 * deploy akan membekukan seluruh aplikasi diam-diam). Karena itu server e2e juga
 * menyalakan kunci kedua ALARM_IZINKAN_BEKU_WAKTU=1 — satu-satunya cara membekukan
 * waktu di build produksi, dan pilihan yang harus dilakukan sadar.
 */
const HARI_INI = "2026-09-07";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "retain-on-failure",
    // Overlay panduan kunjungan pertama (tiket 13) dianggap sudah ditutup agar
    // spec layar lain tidak terhalang; tests/e2e/panduan.spec.ts mengosongkannya
    // sendiri untuk menguji kunjungan pertama.
    storageState: {
      cookies: [],
      origins: [{ origin: `http://127.0.0.1:${PORT}`, localStorage: [{ name: "alarm-saham:panduan-selesai", value: "1" }] }],
    },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: process.env.E2E_SKIP_BUILD
      ? `npm run start -- -p ${PORT}`
      : `npm run build && npm run start -- -p ${PORT}`,
    url: `http://127.0.0.1:${PORT}/putar-ulang`,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    stdout: "ignore",
    stderr: "pipe",
    env: {
      ANTHROPIC_API_KEY: "",
      DEEPSEEK_API_KEY: "",
      DATABASE_URL: "",
      ALARM_HARI_INI: HARI_INI,
      ALARM_IZINKAN_BEKU_WAKTU: "1",
      TANPA_PGLITE: TANPA_PGLITE ? "1" : "",
    },
  },
});
