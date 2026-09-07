// Kotak cari kode saham (form GET, bekerja tanpa JS) + chip kasus nyata.
import Link from "next/link";

export const KASUS_NYATA = ["SRIL", "TELE", "WIKA", "INAF", "BTEL", "GOLL"] as const;

export function Pencarian({ kode }: { kode: string | null }) {
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
        <span className="pu-hint">
          Kode apa pun boleh dicari. Yang tampil hanya data yang benar-benar ada di data kami (107 emiten universe
          uji + feed suspensi seluruh bursa).
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
