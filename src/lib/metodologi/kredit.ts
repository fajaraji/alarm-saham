// Satu sumber kebenaran angka kredit Sectors: docs/kredit-ledger.json, yang
// dihasilkan `npm run kredit:snapshot -- --pglite` langsung dari tabel
// `api_ledger`.
//
// Kenapa ada berkas ini: angka kredit adalah angka yang paling dilihat juri
// untuk aturan lomba (d). Sebelum tiket 15 ia diketik ulang di halaman
// /cara-kami-menghitung (463) dan di README (467) untuk tanggal yang sama —
// permukaan yang justru dibuat untuk juri menyebut angka pra-tiket-11 sambil
// memberi tanggal pasca-tiket-11. Sekarang kedua permukaan turun dari berkas
// ini dan tests/unit/docs/kredit-ledger.test.ts menolak kalau salah satunya
// menyimpang, atau kalau berkas ini beda dengan isi api_ledger di ./.pglite.
import ledger from "../../../docs/kredit-ledger.json";

export const BERKAS_KREDIT_LEDGER = "docs/kredit-ledger.json";

export interface BarisEndpointKredit {
  endpoint: string;
  baris: number;
  kredit: number;
}

export interface KreditLedger {
  /** Dari mana angka ini dibaca (untuk jejak, tanpa kredensial). */
  sumber: string;
  /** Tanggal baris terakhir di ledger (YYYY-MM-DD). */
  tanggal: string;
  /** Jumlah baris api_ledger (termasuk cache hit dan 404). */
  baris: number;
  /** Total kredit terpakai = sum(credits). */
  total: number;
  /** Baris yang benar-benar memanggil HTTP (cache_hit = 0). */
  panggilanSungguhan: number;
  /** Baris yang dilayani dari cache (nol kredit baru). */
  cacheHit: number;
  perEndpoint: BarisEndpointKredit[];
}

export const KREDIT_LEDGER = ledger as KreditLedger;
