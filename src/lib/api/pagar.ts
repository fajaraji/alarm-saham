// Pagar laju sederhana untuk route yang membelanjakan uang/kredit tim
// (/api/agent/*, /api/portofolio/cek). Tanpa dependensi baru dan tanpa DB:
// jendela geser di memori proses.
//
// Batasnya: di serverless setiap instance punya memorinya sendiri, jadi ini
// BUKAN kuota global — ia hanya meredam pengulangan cepat dari satu penyerang
// pada satu instance. Pagar sebenarnya untuk kredit Sectors adalah
// `providerKelasB` (butuh database buku kredit) dan `SECTORS_CREDIT_RESERVE`.
//
// Dua aturan yang tidak boleh dilanggar:
//   1. kunci ember HARUS ditentukan server. Nilai yang dipilih klien (header
//      token, cookie, body) tidak boleh menjadi kunci, karena penyerang tinggal
//      menggantinya tiap permintaan untuk selalu mendapat ember kosong;
//   2. setiap JENIS operasi punya embernya sendiri (`kunciEmber`). Satu ember
//      bersama membuat permintaan nol kredit menghabiskan jatah permintaan
//      berbayar — batas paling ketat berlaku untuk semuanya.

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

/**
 * Nama ember: setiap JENIS operasi punya jatahnya sendiri.
 *
 * Tanpa ini seluruh route berbagi satu ember `ip:<IP>`, sehingga permintaan
 * kelas A yang NOL KREDIT menghabiskan jatah kelas B yang berbayar: enam klik
 * "Cek sekarang" (batas 60/menit) dalam 10 menit membuat permintaan "Sertakan
 * data terkini" (batas 6 per 10 menit) yang PERTAMA langsung ditolak 429 dengan
 * waktu tunggu 600 detik — fitur berbayar unggulan mati justru pada alur demo
 * yang paling wajar. Gagal-aman untuk kredit, tetapi salah untuk produk.
 *
 * Daftarnya SENGAJA berupa union tertutup: nama ember selalu konstanta di kode
 * server. Nilai pilihan klien (body, query, header) tidak boleh menentukan ember
 * karena penyerang tinggal menggantinya tiap permintaan untuk selalu mendapat
 * ember kosong — cacat yang sama yang dulu dibuat `token:<T>`.
 */
export type Ember =
  | "cek-kelas-a"
  | "cek-kelas-b"
  | "agent-rakit"
  | "agent-diagnosis"
  | "minta-tarik";

/** Gabungkan nama ember dengan identitas pemanggil menjadi kunci pagar laju. */
export function kunciEmber(ember: Ember, identitas: string): string {
  return `${ember}|${identitas}`;
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
