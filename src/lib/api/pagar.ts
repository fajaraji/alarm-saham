// Pagar laju sederhana untuk route yang membelanjakan uang/kredit tim
// (/api/agent/*, /api/portofolio/cek). Tanpa dependensi baru dan tanpa DB:
// jendela geser di memori proses.
//
// Batasnya: di serverless setiap instance punya memorinya sendiri, jadi ini
// BUKAN kuota global — ia hanya meredam pengulangan cepat dari satu penyerang
// pada satu instance. Pagar sebenarnya untuk kredit Sectors adalah
// `providerKelasB` (butuh database buku kredit) dan `SECTORS_CREDIT_RESERVE`.

export interface OpsiPagar {
  /** Maksimum permintaan per jendela. */
  maks: number;
  /** Panjang jendela dalam milidetik. */
  jendelaMs: number;
  /** Jam suntikan untuk tes. */
  sekarang?: () => number;
}

export interface HasilPagar {
  lolos: boolean;
  /** Berapa detik lagi kuota berikutnya tersedia (0 bila lolos). */
  tungguDetik: number;
}

const riwayat = new Map<string, number[]>();

/** Hanya untuk tes: kosongkan seluruh catatan. */
export function resetPagar(): void {
  riwayat.clear();
}

export function pagarLaju(kunci: string, opsi: OpsiPagar): HasilPagar {
  const now = (opsi.sekarang ?? Date.now)();
  const batasBawah = now - opsi.jendelaMs;
  const cap = (riwayat.get(kunci) ?? []).filter((t) => t > batasBawah);
  if (cap.length >= opsi.maks) {
    const tertua = cap[0];
    riwayat.set(kunci, cap);
    return { lolos: false, tungguDetik: Math.max(1, Math.ceil((tertua + opsi.jendelaMs - now) / 1000)) };
  }
  cap.push(now);
  riwayat.set(kunci, cap);
  // Jaga peta tidak tumbuh tanpa batas pada proses yang berumur panjang.
  if (riwayat.size > 5_000) {
    for (const [k, v] of riwayat) if (v.every((t) => t <= batasBawah)) riwayat.delete(k);
  }
  return { lolos: true, tungguDetik: 0 };
}

/**
 * Kunci pembatas: token pemilik bila ada (lebih spesifik daripada IP di belakang
 * NAT), selain itu alamat IP dari header proksi. Tanpa keduanya (mis. localhost)
 * seluruh permintaan berbagi satu ember.
 */
export function kunciPemanggil(req: Request, token: string | null = null): string {
  if (token) return `token:${token}`;
  const maju = req.headers.get("x-forwarded-for");
  const ip = maju?.split(",")[0]?.trim() || req.headers.get("x-real-ip")?.trim();
  return ip ? `ip:${ip}` : "lokal";
}

/** Jawaban 429 berbahasa awam. */
export function jawabanTerlaluSering(tungguDetik: number): Response {
  return Response.json(
    {
      error: {
        kode: "TERLALU_SERING",
        pesan: `Terlalu banyak permintaan dari perangkat ini. Coba lagi sekitar ${tungguDetik} detik lagi.`,
      },
    },
    { status: 429, headers: { "Retry-After": String(tungguDetik) } },
  );
}
