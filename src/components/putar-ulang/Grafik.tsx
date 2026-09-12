// Grafik sederhana: pita waktu per jenis kejadian (tidak ada data harga di DB —
// jadi yang digambar adalah kejadian resmi, bukan harga). Titik setelah t diredupkan.
import type { RentangSlider } from "@/lib/putar-ulang/filter";
import type { JenisKejadian, Kejadian } from "@/lib/putar-ulang/kejadian";

const URUTAN_LAJUR: { jenis: JenisKejadian; label: string }[] = [
  { jenis: "suspensi", label: "Suspensi" },
  { jenis: "laporan_hilang", label: "Laporan hilang" },
  { jenis: "ekuitas_negatif", label: "Ekuitas negatif" },
  { jenis: "rights_issue", label: "Rights issue" },
  { jenis: "insider_jual", label: "Orang dalam menjual" },
  { jenis: "laporan_tersedia", label: "Laporan tersedia" },
];

const LEBAR = 640;
const KIRI = 118;
const KANAN = 16;
const ATAS = 14;
const TINGGI_LAJUR = 26;
const BAWAH = 24;

function hari(d: string): number {
  return Date.parse(`${d}T00:00:00Z`) / 86_400_000;
}

export function Grafik({
  kejadian,
  rentang,
  t,
  target,
}: {
  kejadian: Kejadian[];
  rentang: RentangSlider;
  t: string;
  target: string | null;
}) {
  const h0 = hari(rentang.awal);
  const h1 = Math.max(hari(rentang.akhir), h0 + 1);
  const x = (d: string) => KIRI + ((hari(d) - h0) / (h1 - h0)) * (LEBAR - KIRI - KANAN);

  const lajur = URUTAN_LAJUR.filter((l) => kejadian.some((k) => k.jenis === l.jenis));
  const tinggi = ATAS + Math.max(lajur.length, 1) * TINGGI_LAJUR + BAWAH;

  const tahunAwal = Number(rentang.awal.slice(0, 4)) + 1;
  const tahunAkhir = Number(rentang.akhir.slice(0, 4));
  const tahun: number[] = [];
  for (let y = tahunAwal; y <= tahunAkhir; y++) tahun.push(y);

  return (
    <div className="pu-chart" data-testid="grafik">
      {/* role="img" memangkas seluruh isi SVG dari pohon aksesibilitas, jadi
          <title> tiap titik tidak pernah terdengar. aria-label karena itu memuat
          angkanya, dan padanan tekstual lengkapnya ada di daftar "Tanda yang
          sudah kelihatan" (data-testid="garis-waktu") yang ditunjuk aria-describedby. */}
      <svg
        viewBox={`0 0 ${LEBAR} ${tinggi}`}
        role="img"
        aria-label={`Pita waktu ${kejadian.length} kejadian dalam ${lajur.length} jenis, ${rentang.awal} sampai ${rentang.akhir}; garis penunjuk pada ${t}.`}
        aria-describedby="garis-waktu-teks"
      >
        {tahun.map((y) => (
          <g key={y}>
            <line className="lane" x1={x(`${y}-01-01`)} x2={x(`${y}-01-01`)} y1={ATAS} y2={tinggi - BAWAH} />
            <text x={x(`${y}-01-01`) + 3} y={tinggi - 8}>
              {y}
            </text>
          </g>
        ))}
        {lajur.map((l, i) => {
          const y = ATAS + i * TINGGI_LAJUR + TINGGI_LAJUR / 2;
          return (
            <g key={l.jenis}>
              <line className="lane" x1={KIRI} x2={LEBAR - KANAN} y1={y} y2={y} />
              <text x={8} y={y + 3}>
                {l.label}
              </text>
              {kejadian
                .filter((k) => k.jenis === l.jenis)
                .map((k) => (
                  <circle
                    key={k.id}
                    className={`ev ${k.tingkat} ${k.date > t ? "future" : ""}`}
                    cx={x(k.date)}
                    cy={y}
                    r={k.tingkat === "info" ? 3 : 5}
                  >
                    <title>{`${k.date} — ${k.judul}`}</title>
                  </circle>
                ))}
            </g>
          );
        })}
        {target && target >= rentang.awal && target <= rentang.akhir && (
          <g>
            <line className="target" x1={x(target)} x2={x(target)} y1={ATAS - 6} y2={tinggi - BAWAH} />
            <text x={Math.min(x(target) + 3, LEBAR - 90)} y={ATAS - 2}>
              kejadian target {target}
            </text>
          </g>
        )}
        <line className="cursor" x1={x(t)} x2={x(t)} y1={ATAS - 8} y2={tinggi - BAWAH + 4} />
      </svg>
    </div>
  );
}
