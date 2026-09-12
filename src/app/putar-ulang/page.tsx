// /putar-ulang?kode=SRIL — server component: muat data emiten dari DB/PGlite/fixture
// (nol panggilan API Sectors), lalu serahkan ke komponen klien untuk slider.
//
// Label sumber WAJIB ikut ke bawah (properti `sumberContoh`): pada server tanpa
// DATABASE_URL dan tanpa ./.pglite, isinya fixture contoh — angka keuangan,
// rasio rights issue, dan filing di sana ilustratif. Sebelumnya halaman ini
// menyebut semuanya "fakta dari data resmi" tanpa satu pun penanda.
import { daftarBisaDicari } from "@/lib/putar-ulang/daftar-cari";
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

  const sumber = await getEventSource();
  const universe = await sumber.universe();
  const contoh = sumber.jenis === "fixture";
  // Saran ketik: seluruh emiten yang benar-benar bisa dicari di server ini.
  const opsiCari = await daftarBisaDicari(sumber.db, universe);
  // Cakupan dihitung dari sumber yang benar-benar dipakai, bukan angka tetap:
  // pada jalur fixture universe hanya 8 emiten, bukan 107.
  const jumlah = {
    total: universe.length,
    delisting: universe.filter((u) => u.group === "delisting").length,
    watchlist: universe.filter((u) => u.group === "watchlist").length,
    control: universe.filter((u) => u.group === "control").length,
  };

  let isi: React.ReactNode = null;
  if (mentah && !kode) {
    isi = (
      <div className="pu-empty" data-testid="tidak-ada">
        <h3>Kode saham harus 2–5 huruf</h3>
        <p>Contoh: SRIL, WIKA, BBCA.</p>
      </div>
    );
  } else if (kode) {
    const emiten = await muatEmitenDariSumber(sumber, kode, today);
    isi =
      emiten.status === "tidak_ada" ? (
        <div className="pu-empty" data-testid="tidak-ada">
          <h3>{kode} belum ada di data kami</h3>
          <p>
            Data yang dipakai server ini memuat {jumlah.total} emiten universe uji ({jumlah.delisting}{" "}
            <Istilah id="delisting">dihapus dari bursa</Istilah>, {jumlah.watchlist}{" "}
            <Istilah id="pemantauan_khusus">pemantauan khusus</Istilah>, {jumlah.control}{" "}
            <Istilah id="kontrol_sehat">kontrol sehat</Istilah>){contoh ? "" : " ditambah feed suspensi seluruh bursa 2018–2026"}.{" "}
            {kode} tidak ada di dalamnya. Kami tidak menarik data baru secara otomatis. Setiap penarikan memakai{" "}
            <Istilah id="kredit_sectors">kredit</Istilah> dan diputuskan manusia.
          </p>
          <MintaTarik symbol={kode} />
          <p className="pu-hint" style={{ marginTop: 10 }}>
            Sumber data saat ini: {sumber.keterangan}.
          </p>
        </div>
      ) : (
        <PutarUlang emiten={emiten} keteranganSumber={sumber.keterangan} />
      );
  }

  return (
    <>
      <div className="pu-eyebrow">Langkah 1 dari 3</div>
      <h2 className="pu-h2">
        Lihat rekamannya: tanda resmi sudah ada sebelum sahamnya <Istilah id="suspensi">berhenti diperdagangkan</Istilah>.
      </h2>
      {/* Lede jalur data NYATA dibuang: kalimatnya ("fakta resmi dari feed
          Sectors, tidak ada penilaian") hampir kata per kata sama dengan footer
          disclaimer yang tampil di SETIAP halaman. Lede jalur data contoh
          dipertahankan karena ia peringatan khas layar ini dan menyebut
          jumlahnya, yang tidak ada di footer. */}
      {contoh ? (
        <p className="pu-lede">
          Server ini <b>belum terhubung ke database Sectors</b>, jadi yang tampil adalah data contoh ({jumlah.total} emiten)
          untuk mendemokan cara kerja layar ini. Bentuk datanya meniru feed BEI lewat Sectors, tetapi angkanya ilustratif.
          Jangan dibaca sebagai fakta tentang emiten yang bersangkutan.
        </p>
      ) : null}
      <PetunjukLayar
        langkah={[
          <>Ketik kode saham, lalu pilih dari saran yang muncul.</>,
          <>Geser slider waktu untuk mundur ke masa lalu.</>,
          <>Lihat lampu dan tanda yang sudah ada pada tanggal itu.</>,
        ]}
      />
      <Pencarian kode={kode} cakupan={{ jumlah: jumlah.total, contoh }} opsi={opsiCari} />
      {/* Keadaan "belum mencari" tidak lagi memasang kalimat sendiri: kalimat
          lamanya duduk persis di bawah tombol dan chip yang dimaksudnya, dan
          mengulang petunjuk pertama. Kotak cari yang kosong sudah menjelaskan
          dirinya lewat placeholder dan daftar saran. */}
      {isi}
    </>
  );
}
