// Konfigurasi drizzle-kit (generate/migrate).
//
// - DATABASE_URL terisi  -> Postgres/Neon sungguhan.
// - DATABASE_URL kosong  -> PGlite lokal di ./.pglite (tanpa Docker/Neon),
//   supaya `npm run db:migrate` selalu bisa dibuktikan di mesin mana pun.
import "dotenv/config";
import { defineConfig } from "drizzle-kit";

const url = process.env.DATABASE_URL?.trim();

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  strict: true,
  verbose: true,
  ...(url
    ? { dbCredentials: { url } }
    : { driver: "pglite", dbCredentials: { url: "./.pglite" } }),
});
