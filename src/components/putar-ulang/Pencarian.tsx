// Kotak cari kode saham (form GET, bekerja tanpa JS) + chip kasus nyata.
//
// Kalimat cakupan WAJIB datang dari sumber yang benar-benar dipakai server
// (`kalimatCakupan`), bukan dari angka yang dipakukan di sini: pada jalur data
// contoh kotak ini dulu menjanjikan "107 emiten universe uji + feed suspensi
// seluruh bursa" tiga baris di bawah lede yang mengaku "data contoh (8 emiten)".
import Link from "next/link";

import { kalimatCakupan, type Cakupan } from "@/lib/cakupan";
import type { OpsiCari } from "@/lib/putar-ulang/daftar-cari";

export const KASUS_NYATA = ["SRIL", "TELE", "WIKA", "INAF", "BTEL", "GOLL"] as const;

const ID_SARAN = "daftar-emiten";

/**
 * Saran ketik memakai `<datalist>` bawaan peramban, bukan dropdown buatan
 * sendiri. Alasannya tiga: ia bekerja TANPA JavaScript (form ini sengaja form
 * GET biasa), peramban sudah menangani papan tuts dan pembaca layar tanpa ARIA
 * tambahan, dan ia memfilter substring sambil pengguna mengetik. Ketik "B" →
 * peramban menampilkan seluruh emiten berawalan B.
 */
export function Pencarian({ kode, cakupan, opsi }: { kode: string | null; cakupan: Cakupan; opsi: OpsiCari[] }) {
  return (
    <>
      <form className="pu-search" action="/putar-ulang" method="get" role="search">
        <div className="pu-field">
          <span className="pu-prefix">IDX</span>
          <input
            name="kode"
            defaultValue={kode ?? ""}
            placeholder={`ketik kode atau nama, mis. SRIL (${opsi.length} emiten)`}
            maxLength={5}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            aria-label="Kode saham"
            list={ID_SARAN}
            data-testid="kotak-kode"
          />
          <datalist id={ID_SARAN} data-testid="saran-emiten">
            {opsi.map((o) => (
              <option key={o.symbol} value={o.symbol}>
                {o.nama ?? o.symbol}
              </option>
            ))}
          </datalist>
          <button className="pu-btn primary" type="submit" style={{ margin: "4px 0" }} data-testid="tombol-lihat">
            Lihat
          </button>
        </div>
        <span className="pu-hint" data-testid="cakupan-cari" data-sumber={cakupan.contoh ? "fixture" : "db"}>
          Mulai mengetik, lalu pilih dari saran. {kalimatCakupan(cakupan)}
        </span>
      </form>
      <div className="pu-pick" data-testid="chip-kasus">
        Contoh kasus nyata:
        {KASUS_NYATA.map((k) => (
          <Link key={k} href={`/putar-ulang?kode=${k}`} aria-current={kode === k ? "true" : undefined}>
            {k}
          </Link>
        ))}
      </div>
    </>
  );
}
