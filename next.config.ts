import path from "node:path";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Kunci akar Turbopack ke direktori repo ini.
  // Tanpa ini, Next memilih folder induk yang punya package-lock.json
  // (mis. C:\Users\User) sehingga berkas di luar repo diabaikan.
  turbopack: {
    root: path.resolve(__dirname),
  },
  // PGlite (Postgres via WASM) dimuat dinamis di server saat DATABASE_URL kosong;
  // jangan dibundel agar berkas WASM/kunci direktori ./.pglite tetap dari node_modules.
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default nextConfig;
