// Playwright end-to-end: `next build` lalu `next start` di port 3100 agar tidak
// bentrok dengan `next dev`. Data: PGlite ./.pglite bila ada (DATABASE_URL kosong),
// selain itu fixture — nol panggilan API Sectors. Kunci AI dikosongkan agar panel AI
// diuji pada jalur 503.
//
// Catatan PGlite: satu proses per folder; jangan jalankan e2e bersamaan dengan
// `npm run backtest`/`next dev` yang membuka ./.pglite.
import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);

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
    env: { ANTHROPIC_API_KEY: "", DEEPSEEK_API_KEY: "", DATABASE_URL: "" },
  },
});
