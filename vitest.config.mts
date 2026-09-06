import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const akar = path.dirname(fileURLToPath(import.meta.url));

// Konfigurasi Vitest minimal: hanya tes unit di lingkungan Node.
// Tes UI (jsdom) bisa ditambahkan nanti bila diperlukan.
export default defineConfig({
  resolve: {
    // Alias "@/..." mengikuti tsconfig paths agar route handler bisa diuji langsung.
    alias: { "@": path.resolve(akar, "src") },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      reportsDirectory: "coverage",
    },
  },
});
