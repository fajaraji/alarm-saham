// Kotak cari kode saham (form GET, bekerja tanpa JS) + chip kasus nyata.
//
// Kalimat cakupan WAJIB datang dari sumber yang benar-benar dipakai server
// (`kalimatCakupan`), bukan dari angka yang dipakukan di sini: pada jalur data
// contoh kotak ini dulu menjanjikan "107 emiten universe uji + feed suspensi
// seluruh bursa" tiga baris di bawah lede yang mengaku "data contoh (8 emiten)".
import Link from "next/link";

import { kalimatCakupan, type Cakupan } from "@/lib/cakupan";

export const KASUS_NYATA = ["SRIL", "TELE", "WIKA", "INAF", "BTEL", "GOLL"] as const;

export function Pencarian({ kode, cakupan }: { kode: string | null; cakupan: Cakupan }) {
  return (
    <>
      <form className="pu-search" action="/putar-ulang" method="get" role="search">
        <div className="pu-field">
          <span className="pu-prefix">IDX</span>
          <input
            name="kode"
            defaultValue={kode ?? ""}
            placeholder="ketik kode, mis. SRIL"
            maxLength={5}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            aria-label="Kode saham"
            data-testid="kotak-kode"
          />
          <button className="pu-btn primary" type="submit" style={{ margin: "4px 0" }} data-testid="tombol-lihat">
            Lihat
          </button>
        </div>
        <span className="pu-hint" data-testid="cakupan-cari" data-sumber={cakupan.contoh ? "fixture" : "db"}>
          Kode apa pun boleh dicari. {kalimatCakupan(cakupan)}
        </span>
      </form>
      <div className="pu-pick" data-testid="chip-kasus">
        Kasus nyata:
        {KASUS_NYATA.map((k) => (
          <Link key={k} href={`/putar-ulang?kode=${k}`} aria-current={kode === k ? "true" : undefined}>
            {k}
          </Link>
        ))}
      </div>
    </>
  );
}
