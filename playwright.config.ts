// Playwright end-to-end: `next build` lalu `next start` (port 3100) agar tidak
// bentrok dengan `next dev`. Data: PGlite ./.pglite bila ada (DATABASE_URL kosong),
// selain itu fixture — nol panggilan API Sectors. Kunci AI dikosongkan agar panel AI
// diuji pada jalur 503.
//
// Env:
//   E2E_PORT=3101        port lain (menimpa pilihan otomatis di bawah).
//   E2E_SKIP_BUILD=1     pakai .next yang sudah ada.
//   E2E_TANPA_PGLITE=1   paksa jalur fixture walau ./.pglite ada (meniru clone
//                        bersih): server dijalankan dengan TANPA_PGLITE=1 dan spec
//                        yang butuh data nyata di-skip dengan pesan
//                        (tests/e2e/util.ts → ADA_PGLITE, PESAN_SKIP_PGLITE).
//   E2E_PGLITE_DIR=.pglite-e2e
//                        folder PGlite lain untuk server e2e (diteruskan sebagai
//                        ALARM_PGLITE_DIR). Dipakai gerbang jalur DB di CI:
//                        `npm run e2e:seed -- --dir=.pglite-e2e` membangun database
//                        dari benih yang di-commit, dan ./.pglite pengembang
//                        (hasil penarikan 395 kredit Sectors) tidak tersentuh.
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
const DIR_PGLITE = process.env.E2E_PGLITE_DIR?.trim() ?? "";

/**
 * URL hidup yang diuji alih-alih server lokal — dipakai gerbang smoke tiket 16
 * terhadap deploy production:
 *
 *   E2E_BASE_URL=https://<app>.vercel.app E2E_SUMBER=db E2E_AI=aktif \
 *     npx playwright test tests/e2e/smoke.spec.ts
 *
 * Bila diisi, TIDAK ada `next build`/`next start` yang dijalankan (webServer
 * dimatikan) dan tidak ada env server yang bisa kita setel — termasuk
 * ALARM_HARI_INI. Jadi waktu di seberang berjalan normal; itu memang yang
 * ingin diuji. Sumber data dan status kunci AI tidak bisa dideteksi dari sini,
 * karena itu dinyatakan lewat E2E_SUMBER dan E2E_AI (tests/e2e/util.ts).
 */
const BASE_URL_HIDUP = process.env.E2E_BASE_URL?.trim().replace(/\/+$/, "") ?? "";
const BASE_URL = BASE_URL_HIDUP || `http://127.0.0.1:${PORT}`;

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
  // URL hidup: satu klik "Uji ke masa lalu" memindai 104 emiten lewat jaringan,
  // jadi 10 detik (cukup untuk PGlite di berkas lokal) pasti kehabisan waktu.
  // Terukur 27 detik dari iad1 ke Neon ap-southeast-1 sebelum `regions: sin1`.
  timeout: BASE_URL_HIDUP ? 180_000 : 60_000,
  expect: { timeout: BASE_URL_HIDUP ? 60_000 : 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    // Overlay panduan kunjungan pertama (tiket 13) dianggap sudah ditutup agar
    // spec layar lain tidak terhalang; tests/e2e/panduan.spec.ts mengosongkannya
    // sendiri untuk menguji kunjungan pertama.
    storageState: {
      cookies: [],
      origins: [{ origin: BASE_URL, localStorage: [{ name: "alarm-saham:panduan-selesai", value: "1" }] }],
    },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // URL hidup: tidak ada server yang kita jalankan sendiri.
  webServer: BASE_URL_HIDUP ? undefined : {
    command: process.env.E2E_SKIP_BUILD
      ? `npm run start -- -p ${PORT}`
      : `npm run build && npm run start -- -p ${PORT}`,
    url: `http://127.0.0.1:${PORT}/putar-ulang`,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    stdout: "ignore",
    stderr: "pipe",
    env: {
      // SEMUA jalur kunci AI dikosongkan, bukan hanya dua yang lama. Sejak
      // tiket 08c ada jalur gateway (LLM_*), dan `next start` memuat
      // .env.local: begitu pengembang mengisi LLM_API_KEY, server e2e
      // ikut punya kunci, panel AI tidak lagi menampilkan banner 503, dan
      // spec menguji jalur yang BERBEDA dari yang ia klaim. CI tidak
      // menangkapnya karena di CI tidak ada .env.local sama sekali.
      ANTHROPIC_API_KEY: "",
      DEEPSEEK_API_KEY: "",
      LLM_API_KEY: "",
      LLM_BASE_URL: "",
      LLM_MODEL: "",
      LLM_MODEL_RINGAN: "",
      LLM_PROVIDER: "",
      DATABASE_URL: "",
      ALARM_HARI_INI: HARI_INI,
      ALARM_IZINKAN_BEKU_WAKTU: "1",
      TANPA_PGLITE: TANPA_PGLITE ? "1" : "",
      ALARM_PGLITE_DIR: DIR_PGLITE,
    },
  },
});
