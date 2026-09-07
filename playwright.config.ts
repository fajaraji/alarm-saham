// Playwright end-to-end: build + start Next (tanpa kunci AI, tanpa DB) lalu
// buka /rakit di Chromium. Port 3100 agar tidak bentrok dengan `next dev`.
import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npm run build && npm run start -- -p ${PORT}`,
    url: `http://localhost:${PORT}/rakit`,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    stdout: "ignore",
    stderr: "pipe",
    // Uji memakai mock/fixture: pastikan fitur AI 503 dan sumber uji = fixture.
    env: { ANTHROPIC_API_KEY: "", DATABASE_URL: "" },
  },
});
