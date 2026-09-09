// Sumber data yang sedang dipakai server, untuk lapisan tampilan yang ada di
// SEMUA halaman (footer disclaimer, overlay panduan, beranda, layar pasang).
//
// Kenapa perlu: kalimat "semua yang tampil adalah fakta resmi dari feed Sectors"
// dulu tanpa syarat di footer layout akar, di dialog panduan kunjungan pertama,
// dan di beranda. Di jalur data contoh (server tanpa DATABASE_URL dan tanpa
// ./.pglite — persis kondisi deploy Vercel sebelum database diisi) aplikasi jadi
// menyangkal label "data contoh"-nya sendiri di layar yang sama.
//
// `connection()` memaksa penilaian ini terjadi saat PERMINTAAN, bukan saat build.
// Tanpa itu halaman statis (beranda, kamus, metodologi) akan memakukan jawaban
// dari lingkungan build — yang tidak punya DATABASE_URL — sehingga server
// produksi berisi data nyata pun akan menampilkan label "data contoh".
import { connection } from "next/server";

import { jenisSumberTerpilih, type JenisSumber } from "./engine/sumber";

export interface SumberSitus {
  /** true = database berisi data Sectors nyata; false = fixture data contoh. */
  nyata: boolean;
  jenis: JenisSumber;
}

export async function sumberSitus(): Promise<SumberSitus> {
  await connection();
  const jenis = jenisSumberTerpilih();
  return { nyata: jenis !== "fixture", jenis };
}
