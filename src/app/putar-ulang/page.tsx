// /putar-ulang?kode=SRIL — server component: muat data emiten dari DB/PGlite/fixture
// (nol panggilan API Sectors), lalu serahkan ke komponen klien untuk slider.
import { getEventSource } from "@/lib/engine/sumber";
import { muatEmitenDariSumber, normalKode } from "@/lib/putar-ulang/muat";
import { Istilah } from "@/components/panduan/Istilah";
import { PetunjukLayar } from "@/components/panduan/PetunjukLayar";
import { MintaTarik } from "@/components/putar-ulang/MintaTarik";
import { Pencarian } from "@/components/putar-ulang/Pencarian";
import { PutarUlang } from "@/components/putar-ulang/PutarUlang";

export const dynamic = "force-dynamic";

export default async function HalamanPutarUlang({ searchParams }: PageProps<"/putar-ulang">) {
  const sp = await searchParams;
  const mentah = Array.isArray(sp.kode) ? sp.kode[0] : sp.kode;
  const kode = normalKode(mentah);
  const today = typeof sp.today === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.today) ? sp.today : undefined;

  let isi: React.ReactNode = null;
  if (mentah && !kode) {
    isi = (
      <div className="pu-empty" data-testid="tidak-ada">
        <h3>Kode saham harus 2–5 huruf</h3>
        <p>Contoh: SRIL, WIKA, BBCA.</p>
      </div>
    );
  } else if (kode) {
    const sumber = await getEventSource();
    const emiten = await muatEmitenDariSumber(sumber, kode, today);
    isi =
      emiten.status === "tidak_ada" ? (
        <div className="pu-empty" data-testid="tidak-ada">
          <h3>{kode} belum ada di data kami</h3>
          <p>
            Data kami memuat 107 emiten universe uji (18 <Istilah id="delisting">dihapus dari bursa</Istilah>, 59{" "}
            <Istilah id="pemantauan_khusus">pemantauan khusus</Istilah>, 30 <Istilah id="kontrol_sehat">kontrol sehat</Istilah>
            ) ditambah feed <Istilah id="suspensi">suspensi</Istilah> seluruh bursa 2018–2026. {kode} tidak ada di keduanya.
            Kami tidak menarik data baru secara otomatis — setiap penarikan memakai{" "}
            <Istilah id="kredit_sectors">kredit</Istilah> dan diputuskan manusia.
          </p>
          <MintaTarik symbol={kode} />
          <p className="pu-hint" style={{ marginTop: 10 }}>
            Sumber data saat ini: {sumber.keterangan}.
          </p>
        </div>
      ) : (
        <PutarUlang emiten={emiten} />
      );
  }

  return (
    <>
      <div className="pu-eyebrow">Langkah 1 dari 3</div>
      <h2 className="pu-h2">
        Lihat rekamannya: tanda resmi sudah ada sebelum sahamnya <Istilah id="suspensi">berhenti diperdagangkan</Istilah>.
      </h2>
      <p className="pu-lede">
        Semua yang tampil di sini adalah fakta dari data resmi (feed BEI lewat Sectors), lengkap dengan sumbernya.
        Tidak ada penilaian, tidak ada saran.
      </p>
      <PetunjukLayar
        langkah={[
          <>Ketik kode saham (4 huruf) atau klik contoh kasus nyata.</>,
          <>Geser slider waktu ke kiri untuk mundur ke masa lalu.</>,
          <>
            Lihat lampu dan daftar tanda: mana yang sudah kelihatan pada tanggal itu — mis.{" "}
            <Istilah id="laporan_hilang">laporan hilang</Istilah> atau{" "}
            <Istilah id="ekuitas_negatif">utang lebih besar dari harta</Istilah>.
          </>,
        ]}
      />
      <Pencarian kode={kode} />
      {isi ?? (
        <p className="pu-sub" data-testid="belum-cari">
          Pilih salah satu kasus nyata di atas, atau ketik kode saham lalu tekan Lihat.
        </p>
      )}
    </>
  );
}
