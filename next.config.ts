import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite (Postgres via WASM) dimuat dinamis di server saat DATABASE_URL kosong;
  // jangan dibundel agar berkas WASM/kunci direktori ./.pglite tetap dari node_modules.
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default nextConfig;
