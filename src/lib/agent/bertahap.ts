// Protokol jawaban bertahap diagnosis (tiket 22), dipakai server DAN klien.
//
// Diagnosis memakan 60-240 detik. Tanpa jawaban bertahap pengguna menatap satu
// kalimat "sedang memeriksa" tanpa kabar. Dengan ini setiap langkah agent tiba
// begitu selesai: satu baris JSON per langkah, lalu satu baris `selesai` berisi
// jawaban akhir yang SAMA dengan jawaban JSON biasa, atau satu baris `galat`.
//
// Berkas ini sengaja tanpa impor server (hanya `import type`), karena klien
// browser juga memakainya untuk membaca aliran jawabannya.
import type { TraceStep } from "./diagnosis";

/** Tipe konten jawaban bertahap. Klien memintanya lewat header `accept`. */
export const TIPE_BERTAHAP = "application/x-ndjson";

export type BarisBertahap<Hasil = unknown> =
  | { jenis: "langkah"; langkah: TraceStep[] }
  | { jenis: "selesai"; hasil: Hasil }
  | { jenis: "galat"; status: number; error: { kode: string; pesan: string; rincian?: unknown } };

/** Satu baris NDJSON dari objek baris. */
export function barisNdjson(baris: BarisBertahap): string {
  return `${JSON.stringify(baris)}\n`;
}

/**
 * Baca aliran NDJSON baris demi baris, memanggil `padaBaris` untuk setiap baris
 * utuh. Baris yang terpotong di antara dua potongan jaringan disambung dulu.
 * Baris yang bukan JSON sah dilewati: satu baris rusak tidak boleh membuang
 * langkah-langkah lain yang sudah sah.
 */
export async function bacaNdjson<Hasil>(
  body: ReadableStream<Uint8Array>,
  padaBaris: (baris: BarisBertahap<Hasil>) => void,
): Promise<void> {
  const reader = body.getReader();
  const dec = new TextDecoder();
  let sisa = "";
  const olah = (teks: string) => {
    const t = teks.trim();
    if (!t) return;
    try {
      padaBaris(JSON.parse(t) as BarisBertahap<Hasil>);
    } catch {
      // Lewati baris rusak; lihat komentar fungsi.
    }
  };
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    sisa += dec.decode(value, { stream: true });
    let i: number;
    while ((i = sisa.indexOf("\n")) >= 0) {
      olah(sisa.slice(0, i));
      sisa = sisa.slice(i + 1);
    }
  }
  olah(sisa + dec.decode());
}
