// Daftar tanda urut tanggal; yang bertanggal > t diredupkan (data-aktif="false").
// Catatan "laporan tersedia" dilipat ke <details> agar daftar tanda tetap terbaca.
import { hanyaTanda, type Kejadian } from "@/lib/putar-ulang/kejadian";
import { fmtTanggal } from "@/lib/putar-ulang/ringkas";

export function GarisWaktu({ kejadian, t }: { kejadian: Kejadian[]; t: string }) {
  const tanda = hanyaTanda(kejadian);
  const tersedia = kejadian.filter((k) => k.jenis === "laporan_tersedia");
  return (
    <div>
      <div data-testid="garis-waktu">
        {tanda.length === 0 && <p className="pu-sub">Tidak ada tanda untuk emiten ini di data kami.</p>}
        {tanda.map((k) => {
          const aktif = k.date <= t;
          return (
            <div
              key={k.id}
              className={`pu-tl ${k.tingkat}`}
              data-testid="kejadian"
              data-aktif={aktif ? "true" : "false"}
              data-jenis={k.jenis}
              data-date={k.date}
            >
              <div className="dot" aria-hidden />
              <div>
                <div className="when">{fmtTanggal(k.date)}</div>
                <div className="what">{k.judul}</div>
                <div className="why">{k.rincian}</div>
                <div className="src">
                  Sumber: {k.sumber.nama}
                  {k.sumber.url && (
                    <>
                      {" · "}
                      <a href={k.sumber.url} target="_blank" rel="noopener noreferrer">
                        dokumen resmi (PDF BEI)
                      </a>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {tersedia.length > 0 && (
        <details className="pu-details" data-testid="laporan-tersedia">
          <summary>
            Laporan keuangan tersedia: {tersedia.length} kuartal ({tersedia[0].date} – {tersedia[tersedia.length - 1].date})
            {" · "}
            {tersedia.filter((k) => k.date <= t).length} sampai tanggal terpilih
          </summary>
          <p style={{ margin: "6px 0 0" }}>Sumber: {tersedia[0].sumber.nama}</p>
          <ul>
            {tersedia.map((k) => (
              <li key={k.id} style={{ opacity: k.date <= t ? 1 : 0.35 }}>
                {k.judul.replace("Laporan keuangan ", "").replace(" tersedia", "")} · {k.date}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
