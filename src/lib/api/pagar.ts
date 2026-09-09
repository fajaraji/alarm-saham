// Pagar laju sederhana untuk route yang membelanjakan uang/kredit tim
// (/api/agent/*, /api/portofolio/cek). Tanpa dependensi baru dan tanpa DB:
// jendela geser di memori proses.
//
// Batasnya: di serverless setiap instance punya memorinya sendiri, jadi ini
// BUKAN kuota global — ia hanya meredam pengulangan cepat dari satu penyerang
// pada satu instance. Pagar sebenarnya untuk kredit Sectors adalah
// `providerKelasB` (butuh database buku kredit) dan `SECTORS_CREDIT_RESERVE`.
//
// Aturan yang tidak boleh dilanggar: kunci ember HARUS ditentukan server.
// Nilai yang dipilih klien (header token, cookie, body) tidak boleh menjadi
// kunci, karena penyerang tinggal menggantinya tiap permintaan untuk selalu
// mendapat ember kosong.

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
 * Alamat pemanggil menurut proksi, BUKAN menurut klien.
 *
 * Urutan sengaja begini:
 *   1. `x-vercel-forwarded-for` — diisi edge Vercel, tidak bisa ditimpa klien;
 *   2. `x-real-ip` — juga diisi proksi (Vercel, nginx);
 *   3. entri TERAKHIR `x-forwarded-for` — hop terdekat, yaitu nilai yang
 *      ditambahkan proksi kita. Entri pertama justru yang paling mudah
 *      dipalsukan: klien tinggal mengirim headernya sendiri dan proksi
 *      menambahkan IP aslinya di belakang.
 * Tanpa satu pun (mis. localhost) seluruh permintaan berbagi satu ember.
 */
export function ipPemanggil(req: Request): string | null {
  const vercel = req.headers.get("x-vercel-forwarded-for")?.split(",").pop()?.trim();
  if (vercel) return vercel;
  const real = req.headers.get("x-real-ip")?.trim();
  if (real) return real;
  const maju = req.headers.get("x-forwarded-for")?.split(",").pop()?.trim();
  return maju || null;
}

/**
 * Kunci pembatas yang SELURUHNYA ditentukan server. Dipakai route yang
 * membelanjakan kredit/uang: nilai yang dipilih klien tidak boleh menentukan
 * embernya sendiri.
 */
export function kunciPemanggilServer(req: Request): string {
  const ip = ipPemanggil(req);
  return ip ? `ip:${ip}` : "lokal";
}

/**
 * Kunci pembatas umum: alamat IP dari proksi lebih dulu, token pemilik hanya
 * sebagai cadangan saat tidak ada IP sama sekali (pengembangan lokal).
 *
 * Dulu urutannya terbalik ("token dulu, karena lebih spesifik di belakang
 * NAT"), dan itu lubang: `x-owner-token` dibuat sendiri oleh peramban (UUID di
 * localStorage, tanpa pendaftaran), jadi penyerang cukup mengirim UUID baru
 * tiap permintaan untuk selalu mendapat ember kuota kosong. Identitas pembatas
 * harus datang dari server.
 */
export function kunciPemanggil(req: Request, token: string | null = null): string {
  const ip = ipPemanggil(req);
  if (ip) return `ip:${ip}`;
  return token ? `token:${token}` : "lokal";
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
