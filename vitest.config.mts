import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const akar = path.dirname(fileURLToPath(import.meta.url));

// Dua proyek Vitest:
//   - "unit": Node — mesin, route handler, reducer, integrasi DB.
//   - "ui"  : jsdom + Testing Library — komponen React (file .test.tsx).
// Tes end-to-end (tests/e2e) milik Playwright, bukan Vitest.
export default defineConfig({
  resolve: {
    // Alias "@/..." mengikuti tsconfig paths agar route handler & komponen bisa diuji langsung.
    alias: { "@": path.resolve(akar, "src") },
  },
  test: {
    exclude: ["**/node_modules/**", "**/.next/**", "tests/e2e/**"],
    // PGlite in-memory + migrasi dan impor route berat (grammY/AI SDK) bisa >10 s
    // saat suite berjalan paralel di mesin yang sibuk; batas bawaan (5 s/10 s) terlalu ketat.
    testTimeout: 30_000,
    hookTimeout: 60_000,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      reportsDirectory: "coverage",
    },
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: ["tests/**/*.test.ts", "src/**/*.test.ts"],
          exclude: ["**/node_modules/**", "tests/e2e/**"],
        },
      },
      {
        extends: true,
        test: {
          name: "ui",
          environment: "jsdom",
          include: ["tests/**/*.test.tsx", "src/**/*.test.tsx"],
          exclude: ["**/node_modules/**", "tests/e2e/**"],
          setupFiles: ["./tests/setup.ts"],
        },
      },
    ],
  },
});
