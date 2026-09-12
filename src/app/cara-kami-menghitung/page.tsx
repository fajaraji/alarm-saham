// /cara-kami-menghitung — halaman metodologi (tiket 14). Server component tanpa
// data dinamis: angka skor dibaca dari docs/skor-nyata.json (snapshot yang
// di-commit dan diverifikasi tes), definisi blok & ambang dari konstanta mesin
// uji (src/lib/engine) agar tidak pernah menyimpang dari kode yang menghitung.
import type { Metadata } from "next";

import { Istilah } from "@/components/panduan/Istilah";
import { ISTILAH_BLOK } from "@/components/panduan/kamus";
import {
  INSIDER_POIN_KETAT,
  JENDELA_INSIDER_HARI,
  PENURUNAN_EKUITAS_KETAT,
  RASIO_DILUSI_KETAT,
  TENGGAT_LAPORAN_HARI,
} from "@/lib/engine/evaluate";
import type { Group } from "@/lib/engine/events";
import { BLOCK_KINDS, LABEL_BLOK, type BlockKind } from "@/lib/engine/rules";
import { LEAD_CUTOFF_DEFAULT, LOOKBACK_YEARS_DEFAULT, SCAN_START_DEFAULT, type PerSymbolResult } from "@/lib/engine/score";
import { KREDIT_LEDGER } from "@/lib/metodologi/kredit";
import {
  CONTOH_LABEL_BACKSTOP,
  JUMLAH_FRASA_BACKSTOP,
  KORPUS_PENJAGA,
  PENJAGA_FRASA,
  PERINTAH_UKUR_PENJAGA,
} from "@/lib/metodologi/penjaga";
import {
  KREDIT_ANGGARAN,
  KREDIT_CADANGAN_JURI,
  KREDIT_KELAS_B,
  KREDIT_PEMBUKTIAN,
  KREDIT_TANGGAL_LEDGER,
  KREDIT_TOTAL_LEDGER,
  KREDIT_UNIVERSE,
  PERINTAH_SNAPSHOT,
  SKOR_NYATA,
  barisKelompok,
  ringkasSkor,
  totalKredit,
} from "@/lib/metodologi/skor";

export const metadata: Metadata = {
  title: "Cara kami menghitung · Alarm Saham",
  description:
    "Definisi tiap blok alarm, cara skor uji-ke-masa-lalu dihitung, universe uji, keterbatasan data, dan kredit Sectors yang terpakai.",
};

/** Definisi terukur tiap blok, longgar vs ketat — kalimat mengikuti evaluate.ts. */
const DEFINISI_BLOK: Record<BlockKind, { awam: string; longgar: string; ketat: string; sumber: string; kedalaman: string }> = {
  suspensi: {
    awam: "Bursa menghentikan perdagangan saham itu untuk sementara, seperti toko yang disegel petugas.",
    longgar: "ada kejadian suspensi dalam 12 bulan sebelum tanggal t (inklusif t)",
    ketat: "ada suspensi yang sudah berumur ≥ 6 bulan pada t dan belum ada kuartal laporan baru setelahnya (feed tidak memuat tanggal pencabutan, jadi ini asumsi yang kami dokumentasikan)",
    sumber: "/v2/suspensions/ (feed seluruh bursa)",
    kedalaman: "Des 2018 (jarang), padat sejak 2020",
  },
  laporan_hilang: {
    awam: "Perusahaan berhenti menyampaikan laporan kuartalan, seperti murid yang berhenti mengumpulkan rapor.",
    longgar: `kuartal Q dinyatakan hilang bila akhir periode Q + ${TENGGAT_LAPORAN_HARI.longgar} hari ≤ t dan Q tidak ada di daftar kuartal yang tersedia`,
    ketat: `sama, dengan tenggat ${TENGGAT_LAPORAN_HARI.ketat} hari`,
    sumber: "/v2/company/get_quarterly_financial_dates/{symbol}/",
    kedalaman: "2020 kuartal 1",
  },
  aksi_dilutif: {
    awam: "Perusahaan menerbitkan saham baru (rights issue) sehingga porsi pemegang lama mengecil, seperti kue yang dipotong lebih banyak.",
    longgar: "ada rights issue dengan ex-date ≤ t",
    ketat: `rasio saham baru terhadap lama (new_ratio / old_ratio) ≥ ${RASIO_DILUSI_KETAT}; rights issue tanpa rasio tidak dihitung`,
    sumber: "/v2/company/corporate-actions/{symbol}/",
    kedalaman: "2016 (WIKA); umumnya 2020+",
  },
  ekuitas_negatif: {
    awam: "Kalau semua harta dijual pun utang belum lunas (ekuitas negatif).",
    longgar: "total_equity < 0 pada kuartal terakhir yang bertanggal ≤ t",
    ketat: `ekuitas turun ≥ ${PENURUNAN_EKUITAS_KETAT * 100}% dibanding kuartal tepat setahun sebelumnya yang ekuitasnya positif`,
    sumber: "/v2/financials/quarterly/{symbol}/ (hanya 18 emiten delisting; 1 kredit per kuartal)",
    kedalaman: "2020 kuartal 1 (mengikuti dates)",
  },
  insider_jual: {
    awam: "Direksi, komisaris, atau institusi besar melepas sahamnya.",
    longgar: `ada filing jual oleh insider/institusi dalam ${JENDELA_INSIDER_HARI} hari sebelum t`,
    ketat: `total penurunan kepemilikan dalam jendela itu ≥ ${INSIDER_POIN_KETAT} poin persen`,
    sumber: "/v2/filings/?symbol=",
    kedalaman: "2024 (tidak ada satu pun filing ≤ 2023 di feed), kelas A terbatas",
  },
};

const NAMA_KELOMPOK: Record<Group, string> = {
  delisting: "18 emiten dihapus dari bursa (efektif 10 Nov 2026)",
  watchlist: "59 emiten Papan Pemantauan Khusus (per 30 Jun 2026)",
  control: "30 kontrol sehat (LQ45 tanpa suspensi 2019–2026)",
};

function angka(x: number | null | undefined): string {
  return x == null ? "–" : String(x).replace(".", ",");
}

function Stat({ label, nilai, sub, testid }: { label: React.ReactNode; nilai: string; sub?: string; testid?: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4 shadow-panel" data-testid={testid}>
      <p className="m-0 text-[12px] font-semibold text-ink-3">{label}</p>
      <p className="m-0 mt-1 font-display text-3xl font-extrabold leading-none text-ink">{nilai}</p>
      {sub ? <p className="m-0 mt-1.5 text-xs text-ink-2">{sub}</p> : null}
    </div>
  );
}

function StatusEmiten({ r }: { r: PerSymbolResult }) {
  if (r.group === "control") {
    return r.fired ? (
      <span className="rounded-md bg-crit-soft px-1.5 py-0.5 font-semibold text-crit">alarm palsu</span>
    ) : (
      <span className="rounded-md bg-ok-soft px-1.5 py-0.5 text-ok">bersih</span>
    );
  }
  return r.fired ? (
    <span className="rounded-md bg-ok-soft px-1.5 py-0.5 font-semibold text-ok">tertangkap</span>
  ) : (
    <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-ink-2">terlewat</span>
  );
}

function TabelKelompok({ group }: { group: Group }) {
  const baris = barisKelompok(SKOR_NYATA, group);
  const kena = group !== "control";
  const jumlah = baris.filter((r) => r.fired).length;
  return (
    <details className="rounded-xl border border-line bg-surface" data-testid={`tabel-${group}`}>
      <summary className="cursor-pointer px-4 py-3 font-semibold">
        {NAMA_KELOMPOK[group]}: {kena ? `${jumlah}/${baris.length} tertangkap` : `${jumlah}/${baris.length} alarm palsu`}
      </summary>
      <div className="overflow-x-auto border-t border-line">
        <table className="w-full min-w-[720px] border-collapse text-[13px]">
          <thead>
            <tr className="text-left text-[11.5px] font-semibold text-ink-3">
              <th className="px-3 py-2">Emiten</th>
              <th className="px-3 py-2">{kena ? "Kejadian target" : "Dipindai sampai"}</th>
              <th className="px-3 py-2">Bunyi pertama</th>
              <th className="px-3 py-2">Lebih awal</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Blok yang terpenuhi saat bunyi pertama</th>
            </tr>
          </thead>
          <tbody>
            {baris.map((r) => (
              <tr key={r.symbol} className="border-t border-line align-top" data-testid="baris-emiten" data-symbol={r.symbol}>
                <td className="px-3 py-2 font-mono font-semibold">{r.symbol}</td>
                <td className="px-3 py-2 font-mono">{kena ? (r.targetEventDate ?? "–") : (r.scanTo ?? "–")}</td>
                <td className="px-3 py-2 font-mono">{r.firstFireDate ?? "–"}</td>
                <td className="px-3 py-2 font-mono">
                  {r.leadMonths == null ? "–" : `${r.leadMonths} bln`}
                  {r.excludedFromLead ? <span title={`target sebelum ${LEAD_CUTOFF_DEFAULT}; tidak ikut rata-rata`}> (x)</span> : null}
                </td>
                <td className="px-3 py-2">
                  <StatusEmiten r={r} />
                </td>
                <td className="px-3 py-2 text-ink-2">
                  {r.reasons.length ? r.reasons.map((a) => `${LABEL_BLOK[a.kind]}: ${a.detail}`).join("; ") : "–"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

export default function HalamanCaraKamiMenghitung() {
  const s = ringkasSkor(SKOR_NYATA);
  const kreditPembuktian = totalKredit(KREDIT_PEMBUKTIAN);
  const kreditUniverse = totalKredit(KREDIT_UNIVERSE);
  const kreditKelasB = totalKredit(KREDIT_KELAS_B);

  return (
    <main className="mx-auto w-full max-w-[1000px] flex-1 px-6 pb-16 pt-6" data-testid="metodologi">
      <p className="text-[12px] font-semibold text-ink-3">Metodologi</p>
      <h1 className="mb-2 mt-1 font-display text-[30px] font-extrabold leading-tight tracking-tight text-balance">
        Cara kami menghitung
      </h1>
      <p className="m-0 max-w-[70ch] text-ink-2">
        Halaman ini menjelaskan, dengan bahasa sehari-hari lalu bagian teknisnya, bagaimana Alarm Saham menguji sebuah alarm
        ke masa lalu dan apa saja yang belum bisa kami buktikan. Angka di halaman ini adalah <b>snapshot yang di-commit</b>{" "}
        (<code className="font-mono">docs/skor-nyata.json</code>, <code className="font-mono">docs/kredit-ledger.json</code>, dan{" "}
        <code className="font-mono">docs/penjaga-frasa.json</code>),
        hasil menjalankan mesin uji di atas database berisi data Sectors, bukan hasil hitung ulang dari sumber data yang
        sedang dipakai server ini. Tidak ada angka yang dibuat-buat untuk demo, dan tes otomatis memastikan angka di halaman
        ini sama dengan keluaran mesin uji.
      </p>

      {/* ------------------------------------------------------------ */}
      <section className="mt-8" aria-labelledby="skor">
        <h2 id="skor" className="font-display text-xl font-bold">
          Skor nyata aturan bawaan (snapshot {SKOR_NYATA.today})
        </h2>
        <p className="mt-1 max-w-[70ch] text-ink-2">
          Aturan yang diuji: <strong>{SKOR_NYATA.rule}</strong> = {LABEL_BLOK.suspensi} (longgar) ATAU {LABEL_BLOK.laporan_hilang}{" "}
          (longgar) ATAU {LABEL_BLOK.ekuitas_negatif} (longgar). Dipindai setiap akhir bulan dari {SKOR_NYATA.scanStart} sampai{" "}
          {SKOR_NYATA.today}.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            testid="stat-tertangkap"
            label="Tertangkap"
            nilai={`${s.hits}/${s.total}`}
            sub={`delisting ${s.delisting.hits}/${s.delisting.total} · pemantauan khusus ${s.watchlist.hits}/${s.watchlist.total}`}
          />
          <Stat
            testid="stat-lebih-awal"
            label={<Istilah id="lebih_awal">Lebih awal</Istilah>}
            nilai={`${angka(s.leadAvg)} bln`}
            sub={`rata-rata; median ${angka(s.leadMedian)} bln (hanya kejadian ≥ ${SKOR_NYATA.leadCutoff})`}
          />
          <Stat
            testid="stat-alarm-palsu"
            label={<Istilah id="alarm_palsu">Alarm palsu</Istilah>}
            nilai={`${s.falseAlarms}/${s.controls}`}
            sub="kontrol sehat yang alarmnya pernah berbunyi"
          />
          <Stat
            testid="stat-dilewati"
            label="Dilewati"
            nilai={String(s.skipped.length)}
            sub={`${s.skipped.join(", ")}: tanpa tanggal kejadian target`}
          />
        </div>
        <p className="mt-3 text-sm text-ink-2" data-testid="blok-pertama">
          Blok yang terpenuhi saat alarm pertama berbunyi pada {s.hits} emiten tertangkap:{" "}
          {BLOCK_KINDS.filter((k) => s.blokPertama[k] > 0)
            .map((k) => `${LABEL_BLOK[k]} ${s.blokPertama[k]}`)
            .join(", ")}
          . {s.excludedFromLead} emiten kena punya kejadian target sebelum {SKOR_NYATA.leadCutoff}; mereka ikut hitungan
          tertangkap/terlewat tetapi tidak ikut rata-rata &ldquo;lebih awal&rdquo; karena data laporan baru mulai 2020.
        </p>
        <p className="mt-2 text-sm text-ink-2">
          Cara mereproduksi (nol panggilan API, dari database lokal):{" "}
          <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[12px]">{PERINTAH_SNAPSHOT}</code>. Tanpa
          database, tambahkan <code className="font-mono">--fixture</code> untuk contoh kecil 8 emiten.
        </p>
        <div className="mt-4 grid gap-3">
          <TabelKelompok group="delisting" />
          <TabelKelompok group="watchlist" />
          <TabelKelompok group="control" />
        </div>
      </section>

      {/* ------------------------------------------------------------ */}
      <section className="mt-10" aria-labelledby="apa">
        <h2 id="apa" className="font-display text-xl font-bold">
          Apa yang sebenarnya dihitung
        </h2>
        <dl className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-line bg-surface p-4">
            <dt className="font-semibold">&ldquo;Berbunyi&rdquo;</dt>
            <dd className="m-0 mt-1 text-sm text-ink-2">
              Alarm berbunyi pada tanggal t bila syarat bloknya terpenuhi <em>hanya</em> dengan data yang bertanggal ≤ t.
              Blok digabung dengan ATAU (cukup satu terpenuhi) atau DAN (semua harus terpenuhi). Kami memeriksa t pada
              setiap akhir bulan.
            </dd>
          </div>
          <div className="rounded-xl border border-line bg-surface p-4">
            <dt className="font-semibold">&ldquo;Tertangkap&rdquo; dan &ldquo;lebih awal&rdquo;</dt>
            <dd className="m-0 mt-1 text-sm text-ink-2">
              Emiten kena dikatakan tertangkap bila alarm berbunyi <em>sebelum</em> tanggal kejadian targetnya. Lebih awal =
              bulan utuh antara bunyi pertama dan kejadian target. Bunyi di bulan yang sama dengan kejadian tidak sempat
              &ldquo;terdengar&rdquo; (mis. WIKA: suspensi jatuh tepat pada tanggal target).
            </dd>
          </div>
          <div className="rounded-xl border border-line bg-surface p-4">
            <dt className="font-semibold">&ldquo;Alarm palsu&rdquo;</dt>
            <dd className="m-0 mt-1 text-sm text-ink-2">
              Alarm berbunyi kapan pun pada emiten kontrol sehat dalam rentang {SCAN_START_DEFAULT} sampai tanggal uji.
              Satu kali bunyi sudah dihitung palsu.
            </dd>
          </div>
          <div className="rounded-xl border border-line bg-surface p-4">
            <dt className="font-semibold">Rentang pindai</dt>
            <dd className="m-0 mt-1 text-sm text-ink-2">
              Emiten kena: dari yang terbesar antara {SCAN_START_DEFAULT} dan {LOOKBACK_YEARS_DEFAULT} tahun sebelum
              target, sampai sebelum target. Kontrol: {SCAN_START_DEFAULT} sampai tanggal uji. Emiten kena dengan target
              sebelum {LEAD_CUTOFF_DEFAULT} ikut hitungan tertangkap tetapi tidak ikut rata-rata lebih awal.
            </dd>
          </div>
        </dl>
      </section>

      {/* ------------------------------------------------------------ */}
      <section className="mt-10" aria-labelledby="blok">
        <h2 id="blok" className="font-display text-xl font-bold">
          Definisi tiap blok dan ambangnya
        </h2>
        <p className="mt-1 max-w-[70ch] text-ink-2">
          Lima blok &ldquo;kelas A&rdquo; ini yang bisa diuji ke masa lalu. Angka ambang di bawah dibaca langsung dari
          konstanta mesin uji, jadi tidak bisa berbeda dari kode yang menghitung.
        </p>
        <div className="mt-3 grid gap-3">
          {BLOCK_KINDS.map((k) => {
            const d = DEFINISI_BLOK[k];
            return (
              <article key={k} className="rounded-xl border border-line bg-surface p-4" data-testid={`blok-${k}`}>
                <h3 className="m-0 font-display text-base font-bold">
                  <Istilah id={ISTILAH_BLOK[k]}>{LABEL_BLOK[k]}</Istilah> <code className="ml-1 font-mono text-[12px] font-normal text-ink-3">{k}</code>
                </h3>
                <p className="m-0 mt-1 text-sm text-ink-2">{d.awam}</p>
                <dl className="mt-2 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[110px_1fr]">
                  <dt className="font-semibold text-ink-3">Longgar</dt>
                  <dd className="m-0">{d.longgar}</dd>
                  <dt className="font-semibold text-ink-3">Ketat</dt>
                  <dd className="m-0">{d.ketat}</dd>
                  <dt className="font-semibold text-ink-3">Sumber</dt>
                  <dd className="m-0 font-mono text-[12px]">{d.sumber}</dd>
                  <dt className="font-semibold text-ink-3">Data sejak</dt>
                  <dd className="m-0">{d.kedalaman}</dd>
                </dl>
              </article>
            );
          })}
        </div>
        <p className="mt-3 text-sm text-ink-2">
          Blok kelas B (<Istilah id="ritel_dominan">ritel dominan</Istilah>, <Istilah id="free_float">free float</Istilah> kecil, <Istilah id="jatuh_dari_puncak">jatuh dari puncak 90 hari</Istilah>) memakai data terkini yang tidak punya
          sejarah di Sectors, sehingga hanya untuk mode &ldquo;pasang&rdquo; dan <strong>tidak pernah</strong> ikut skor uji
          ke masa lalu.
        </p>
      </section>

      {/* ------------------------------------------------------------ */}
      <section className="mt-10" aria-labelledby="universe">
        <h2 id="universe" className="font-display text-xl font-bold">
          Universe uji: 18 + 59 + 30 emiten
        </h2>
        <ul className="mt-2 grid gap-2 pl-5 text-sm text-ink-2">
          <li>
            <strong>18 emiten <Istilah id="delisting">dihapus dari bursa</Istilah></strong> (delisting efektif 10 November 2026; 7 karena pailit, 11 karena
            suspensi lebih dari 50 bulan). Kejadian target = tanggal suspensi yang berujung delisting, diverifikasi ke feed
            suspensi; 5 emiten (ENVY, LMAS, MTRA, SBAT, TELE) memakai tanggal catatan publik karena feed tidak memuat
            suspensinya.
          </li>
          <li>
            <strong>59 emiten <Istilah id="pemantauan_khusus">Papan Pemantauan Khusus</Istilah></strong> per 30 Juni 2026 (Peng-S-00019/BEI.PLP/06-2026). Kejadian
            target = suspensi terakhir ≤ 30 Juni 2026 di feed. Tiga emiten (MENN, TGRA, WSKT) tidak punya kejadian di
            feed dan dilewati, bukan dihitung sebagai tertangkap.
          </li>
          <li>
            <strong>30 <Istilah id="kontrol_sehat">kontrol sehat</Istilah></strong>: anggota LQ45 menurut screener Sectors yang tidak pernah muncul di feed
            suspensi 2019–2026 dan bukan anggota dua kelompok di atas. Dari 44 yang lolos, kami mengambil{" "}
            <strong>30 pertama menurut urutan API (alfabetis)</strong>, bukan peringkat kapitalisasi pasar, karena
            screener tidak mengembalikan market cap dan menolak <code className="font-mono">order_by</code> (HTTP 400).
            Memilih ulang berarti menarik ulang data ±90 kredit, jadi himpunan ini dikunci dan diumumkan apa adanya.
          </li>
        </ul>
      </section>

      {/* ------------------------------------------------------------ */}
      <section className="mt-10" aria-labelledby="lookahead">
        <h2 id="lookahead" className="font-display text-xl font-bold">
          Anti-lookahead: tidak mengintip masa depan
        </h2>
        <p className="mt-1 max-w-[70ch] text-ink-2">
          Sumber data mengembalikan <em>semua</em> baris satu emiten; pemotongan &ldquo;hanya yang bertanggal ≤ t&rdquo;
          dilakukan di satu tempat oleh fungsi evaluasi murni. Daftar kuartal tersedia pun dipotong: kuartal dianggap
          &ldquo;diketahui&rdquo; pada t hanya bila akhir periodenya ≤ t, karena endpoint tidak memuat tanggal
          penyampaian. Tes otomatis membuktikan bahwa menggeser tanggal kejadian target mengubah hasil secara deterministik,
          dan skor yang sama dari fixture maupun database harus identik.
        </p>
      </section>

      {/* ------------------------------------------------------------ */}
      <section className="mt-10" aria-labelledby="batas">
        <h2 id="batas" className="font-display text-xl font-bold">
          Keterbatasan yang jujur
        </h2>
        <ul className="mt-2 grid gap-2 pl-5 text-sm text-ink-2" data-testid="keterbatasan">
          <li>
            <strong>Data laporan dan keuangan baru mulai 2020 kuartal 1.</strong> Inilah sebab {s.delisting.total - s.delisting.hits}{" "}
            dari {s.delisting.total} emiten delisting terlewat: kejadian target mereka 2018–2021 (GOLL Jan 2019, PLAS Des
            2018, LCGP/TRIL Mei 2019, SUGI Jul 2019, MABA/SKYB Feb 2020, COWL Jul 2020, ENVY Des 2020), sehingga rentang
            pindai sebelum target nyaris kosong. Untuk SRIL, TDPM, dan TOYS suspensi jatuh tepat pada tanggal target dan
            laporan masih lengkap sebelumnya. Tanda-tandanya justru banyak <em>setelah</em> target.
          </li>
          <li>
            <strong>8 emiten mengembalikan 404</strong> pada endpoint tanggal laporan (COWL, SUGI, MABA, SKYB, KBRI, NUSA,
            RIMO, SIMA: &ldquo;Invalid stock symbol&rdquo;). Untuk mereka hanya feed suspensi yang ada; blok laporan hilang,
            dilutif, dan ekuitas negatif tidak bisa dihitung.
          </li>
          <li>
            <strong><Istilah id="insider_jual">Filing orang dalam</Istilah> hanya sejak 2024.</strong> Feed filings tidak memuat satu pun baris ≤ 2023, sehingga
            blok &ldquo;orang dalam menjual&rdquo; hanya boleh diklaim untuk jendela 2024 ke depan (aturan cadangan
            PLAN §7.2 terpicu: klaimnya dalam bulan, bukan tahun).
          </li>
          <li>
            <strong>Suspensi per simbol hanya 1 baris</strong> (suspensi terakhir). Sejarah suspensi diambil dari feed seluruh
            bursa, yang sendiri jarang sebelum 2020 dan tidak memuat tanggal pencabutan.
          </li>
          <li>
            <strong><Istilah id="free_float">Free float</Istilah> tanpa sejarah</strong>: hanya snapshot hari ini (TTL cache 24 jam), jadi tidak bisa diuji ke masa
            lalu, dipakai untuk nama emiten dan mode pasang saja.
          </li>
          <li>
            <strong>Alarm palsu AADI</strong> adalah keterbatasan definisi kami, bukan tanda apa pun tentang emitennya: AADI
            tercatat di bursa Desember 2024, daftar kuartalnya melompat dari 2024 q2 ke 2024 q4, dan blok laporan hilang
            menganggap 2024 q3 &ldquo;hilang&rdquo;. Definisi belum diubah agar skor tetap sebanding dengan fixture tes.
          </li>
          <li>
            <strong>Survivorship dan pemilihan universe.</strong> Kelompok kena dipilih dari daftar resmi yang sudah diketahui
            hasilnya (delisting, pemantauan khusus); kontrol dipilih dari LQ45 hari ini. Skor ini menjawab &ldquo;apakah
            tanda resmi sudah ada sebelum kejadian&rdquo;, bukan &ldquo;berapa peluang emiten acak akan kena&rdquo;.
          </li>
          <li>
            <strong>Granularitas bulanan.</strong> Kejadian yang terjadi di bulan yang sama dengan bunyi pertama tidak
            dihitung lebih awal; blok laporan hilang tidak bisa mendeteksi laporan yang telat lalu akhirnya disampaikan.
          </li>
        </ul>
      </section>

      {/* ------------------------------------------------------------ */}
      <section className="mt-10" aria-labelledby="penjaga">
        <h2 id="penjaga" className="font-display text-xl font-bold">
          Bagaimana kami menjaga keluaran AI bukan saran investasi
        </h2>
        <p className="mt-1 max-w-[70ch] text-ink-2">
          Alarm Saham adalah alat informasi dan analisis. Kami <strong>tidak</strong> mengklaim punya penyensor yang
          memblokir semua kalimat beranjuran; klaim itu pernah ada di dokumen kami dan tidak benar. Dua pemeriksa
          adversarial mengukurnya: dari 65 anjuran investasi yang mereka karang, 60 lolos utuh tanpa satu pun penanda,
          sementara penyaring yang sama memakan 41 dari 83 kalimat sah, termasuk kedua alasan usulan blok pada satu
          jawaban diagnosis. Pola kata tidak bisa memutuskan apakah subjek sebuah kalimat Bahasa Indonesia adalah
          portofolio kamu atau setelan alarmmu. Jadi tugasnya dibagi tiga, dan urutannya penting.
        </p>
        <ol className="mt-3 grid gap-2 pl-5 text-sm text-ink-2" data-testid="lapis-penjaga">
          <li>
            <strong>Instruksi sistem: kontrol utama.</strong> Model dilarang menyinggung seluruh pokok bahasannya:
            posisi, porsi, lot, dana, waktu bertransaksi, dan penilaian harga. Yang justru menjadi tugasnya disebut
            terpisah (menjelaskan fakta data, mengusulkan blok/ambang, langkah pemeriksaan), ditambah empat contoh
            negatif berpasangan.
          </li>
          <li>
            <strong>Keluaran terstruktur: kontrol struktural.</strong> Usulan blok tiba sebagai data: jenis blok dan
            ambang adalah pilihan tertutup, bukti berupa tanggal. Model tidak punya tempat menulis instruksi transaksi
            tanpa terlihat.
          </li>
          <li>
            <strong>Penjaga frasa: cadangan terakhir.</strong> {JUMLAH_FRASA_BACKSTOP} frasa yang tidak mungkin
            bermakna lain, misalnya {CONTOH_LABEL_BACKSTOP.map((l) => `“${l}”`).join(", ")}. Frasa yang cocok
            disamarkan; sisa kalimatnya (termasuk angka dan tanggalnya) dibiarkan utuh. Alasan usulan blok tidak
            pernah digunting: kalau penjaga menyala di sana, teksnya tetap tampil dengan tanda peringatan, karena
            usulan tanpa alasan justru menghapus inti fiturnya.
          </li>
        </ol>
        <p className="mt-3 max-w-[70ch] text-ink-2">
          Angkanya diukur, bukan diklaim. Tolok ukurnya <code className="font-mono">{KORPUS_PENJAGA}</code>:{" "}
          {PENJAGA_FRASA.sesudah.harusUtuhTotal} kalimat sah yang wajib utuh dan {PENJAGA_FRASA.sesudah.harusDitandaiTotal}{" "}
          anjuran, isinya kalimat verbatim dari kedua pemeriksa. Diukur {PENJAGA_FRASA.tanggal} dengan{" "}
          <code className="font-mono">{PERINTAH_UKUR_PENJAGA}</code>, dan dicetak ulang setiap kali{" "}
          <code className="font-mono">npm test</code> berjalan.
        </p>
        <div className="mt-3 overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full min-w-[560px] border-collapse text-[13px]" data-testid="tabel-penjaga">
            <thead>
              <tr className="text-left text-[11.5px] font-semibold text-ink-3">
                <th className="px-3 py-2">Ukuran</th>
                <th className="px-3 py-2 text-right">Sebelum ({PENJAGA_FRASA.sebelum.commit})</th>
                <th className="px-3 py-2 text-right">Sekarang</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-line">
                <td className="px-3 py-2">Presisi: kalimat sah yang tidak berubah isinya</td>
                <td className="px-3 py-2 text-right font-mono">
                  {PENJAGA_FRASA.sebelum.harusUtuhTotal - PENJAGA_FRASA.sebelum.harusUtuhBerubah}/
                  {PENJAGA_FRASA.sebelum.harusUtuhTotal} = {PENJAGA_FRASA.sebelum.presisiPersen}%
                </td>
                <td className="px-3 py-2 text-right font-mono font-semibold" data-testid="penjaga-presisi">
                  {PENJAGA_FRASA.sesudah.harusUtuhTotal - PENJAGA_FRASA.sesudah.harusUtuhBerubah}/
                  {PENJAGA_FRASA.sesudah.harusUtuhTotal} = {PENJAGA_FRASA.sesudah.presisiPersen}%
                </td>
              </tr>
              <tr className="border-t border-line">
                <td className="px-3 py-2">Recall: anjuran yang ditandai</td>
                <td className="px-3 py-2 text-right font-mono">
                  {PENJAGA_FRASA.sebelum.harusDitandaiKena}/{PENJAGA_FRASA.sebelum.harusDitandaiTotal} ={" "}
                  {PENJAGA_FRASA.sebelum.recallPersen}%
                </td>
                <td className="px-3 py-2 text-right font-mono" data-testid="penjaga-recall">
                  {PENJAGA_FRASA.sesudah.harusDitandaiKena}/{PENJAGA_FRASA.sesudah.harusDitandaiTotal} ={" "}
                  {PENJAGA_FRASA.sesudah.recallPersen}%
                </td>
              </tr>
              <tr className="border-t border-line">
                <td className="px-3 py-2">Kalimat sah yang termakan penjaga</td>
                <td className="px-3 py-2 text-right font-mono">{PENJAGA_FRASA.sebelum.harusUtuhBerubah}</td>
                <td className="px-3 py-2 text-right font-mono font-semibold">{PENJAGA_FRASA.sesudah.harusUtuhBerubah}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3 max-w-[70ch] text-ink-2">
          Kami memilih <strong>presisi</strong>: gerbang uji merah bila satu kalimat sah berubah, tetapi tidak pernah
          merah karena recall rendah. Artinya penjaga frasa <strong>tidak menjamin</strong> semua anjuran tertangkap:
          recall terukurnya {PENJAGA_FRASA.sesudah.recallPersen}%, dan {PENJAGA_FRASA.sesudah.harusDitandaiTotal -
            PENJAGA_FRASA.sesudah.harusDitandaiKena}{" "}
          baris tolok ukur lewat tanpa penanda. Yang ditinggalkan bersama pilihan itu, terang-terangan:
        </p>
        <ul className="mt-2 grid gap-1.5 pl-5 text-sm text-ink-2" data-testid="batas-penjaga">
          {PENJAGA_FRASA.batasYangDiakui.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
        <p className="mt-3 max-w-[70ch] text-ink-2">
          Untuk pesan pagi mode jaga pilihannya berbeda dan lebih ketat: teks templat sudah memuat seluruh fakta, jadi
          begitu penjaga menyala pada rapian model, rapian itu dibuang seluruhnya dan templatnya yang dikirim.
        </p>
      </section>

      {/* ------------------------------------------------------------ */}
      <section className="mt-10" aria-labelledby="kredit">
        <h2 id="kredit" className="font-display text-xl font-bold">
          Kredit Sectors yang terpakai
        </h2>
        <p className="mt-1 max-w-[70ch] text-ink-2">
          Setiap panggilan API dicatat di buku kredit (tabel <code className="font-mono">api_ledger</code>), termasuk cache hit
          dan 404. Per {KREDIT_TANGGAL_LEDGER}: <strong data-testid="kredit-total">{KREDIT_TOTAL_LEDGER} dari {KREDIT_ANGGARAN}</strong>{" "}
          kredit terpakai; sisa {KREDIT_ANGGARAN - KREDIT_TOTAL_LEDGER}, dengan {KREDIT_CADANGAN_JURI} kredit cadangan untuk demo juri
          yang tidak disentuh kode (panggilan ditolak bila sisa di bawah cadangan). Uji ke masa lalu dan halaman ini tidak
          memanggil API sama sekali.
        </p>
        <div className="mt-3 overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full min-w-[640px] border-collapse text-[13px]">
            <thead>
              <tr className="text-left text-[11.5px] font-semibold text-ink-3">
                <th className="px-3 py-2">Langkah</th>
                <th className="px-3 py-2 text-right">Kredit</th>
                <th className="px-3 py-2">Catatan</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-line bg-surface-2">
                <td className="px-3 py-1.5 font-semibold" colSpan={3}>
                  Pembuktian data (tiket 03–04): {kreditPembuktian} kredit
                </td>
              </tr>
              {KREDIT_PEMBUKTIAN.map((b) => (
                <tr key={b.langkah} className="border-t border-line align-top">
                  <td className="px-3 py-2">{b.langkah}</td>
                  <td className="px-3 py-2 text-right font-mono">{b.kredit}</td>
                  <td className="px-3 py-2 text-ink-2">{b.catatan}</td>
                </tr>
              ))}
              <tr className="border-t border-line bg-surface-2">
                <td className="px-3 py-1.5 font-semibold" colSpan={3}>
                  Penarikan universe 107 emiten (tiket 07): {kreditUniverse} kredit
                </td>
              </tr>
              {KREDIT_UNIVERSE.map((b) => (
                <tr key={b.langkah} className="border-t border-line align-top">
                  <td className="px-3 py-2">{b.langkah}</td>
                  <td className="px-3 py-2 text-right font-mono">{b.kredit}</td>
                  <td className="px-3 py-2 text-ink-2">{b.catatan}</td>
                </tr>
              ))}
              <tr className="border-t border-line bg-surface-2">
                <td className="px-3 py-1.5 font-semibold" colSpan={3}>
                  Uji kelas B nyata (tiket 11): {kreditKelasB} kredit
                </td>
              </tr>
              {KREDIT_KELAS_B.map((b) => (
                <tr key={b.langkah} className="border-t border-line align-top">
                  <td className="px-3 py-2">{b.langkah}</td>
                  <td className="px-3 py-2 text-right font-mono">{b.kredit}</td>
                  <td className="px-3 py-2 text-ink-2">{b.catatan}</td>
                </tr>
              ))}
              <tr className="border-t border-line-strong font-semibold">
                <td className="px-3 py-2">Total ledger</td>
                <td className="px-3 py-2 text-right font-mono">{kreditPembuktian + kreditUniverse + kreditKelasB}</td>
                <td className="px-3 py-2 text-ink-2">
                  = {KREDIT_TOTAL_LEDGER} menurut api_ledger ({KREDIT_LEDGER.baris} baris, snapshot{" "}
                  <code className="font-mono">docs/kredit-ledger.json</code>); run ulang penarikan = 0 kredit (idempoten)
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <p className="mt-8 text-sm text-ink-2">
        Rincian teknis lebih lanjut: <code className="font-mono">docs/mesin-uji.md</code> (asumsi mesin),{" "}
        <code className="font-mono">docs/data-proof.md</code> (kedalaman data per endpoint),{" "}
        <code className="font-mono">docs/universe-pull.md</code> (penarikan & kredit), dan{" "}
        <code className="font-mono">docs/decisions.md</code> (log keputusan) di repositori.
      </p>
    </main>
  );
}
