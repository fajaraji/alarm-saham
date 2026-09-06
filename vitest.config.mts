import { defineConfig } from "vitest/config";

// Konfigurasi Vitest minimal: hanya tes unit di lingkungan Node.
// Tes UI (jsdom) bisa ditambahkan nanti bila diperlukan.
export default defineConfig({
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
