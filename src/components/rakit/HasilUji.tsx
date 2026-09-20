"use client";
// Panel hasil uji (kanan atas). Urutan baca (tiket 21, DESIGN.md aturan 1 dan
// 2): satu kalimat jawaban, saham yang tertangkap, satu baris sumber data, lalu
// SATU lipatan berisi tiga angka ringkas dan grid semua saham per kelompok.
// Tiga angka itu dulu tampil terbuka tepat di bawah kalimat yang menyebut
// angka yang sama, jadi sekarang mereka tempat kedua yang terlipat.
import type { Group } from "@/lib/engine/events";
import type { BacktestResult, PerSymbolResult } from "@/lib/engine/score";
import { fmtTanggal } from "@/lib/putar-ulang/ringkas";
import { labelBlok } from "@/lib/rakit/blok";
import type { ResponBacktest } from "@/lib/rakit/api";

import { Istilah } from "@/components/panduan/Istilah";
import type { IdIstilah } from "@/components/panduan/kamus";

import { KELOMPOK, TEKS } from "./teks";

interface Props {
  hasil: ResponBacktest | null;
  basi: boolean;
  sedangUji: boolean;
  galat: string | null;
}

const URUTAN: Group[] = ["delisting", "watchlist", "control"];
const ISTILAH_KELOMPOK: Record<Group, IdIstilah> = { delisting: "delisting", watchlist: "berpotensi_delisting", control: "kontrol_sehat" };

function angkaId(x: number | null, satuan = ""): string {
  if (x == null) return "–";
  return `${x.toLocaleString("id-ID", { maximumFractionDigits: 1 })}${satuan}`;
}

function tglAwam(t: string | null | undefined): string {
  return t ? fmtTanggal(t) : "-";
}

function tooltipEmiten(r: PerSymbolResult): string {
  const alasan = r.reasons.map((x) => labelBlok(x.kind)).join(", ");
  if (r.group === "control") {
    return r.fired
      ? `${r.symbol} · alarm palsu: berbunyi ${tglAwam(r.firstFireDate)} (${alasan})`
      : `${r.symbol} · bersih: alarm tidak pernah berbunyi`;
  }
  if (!r.fired) return `${r.symbol} · terlewat: alarm diam sebelum ${tglAwam(r.targetEventDate)}`;
  const lead = r.leadMonths == null ? "" : ` · ${r.leadMonths} bln lebih awal${r.excludedFromLead ? " (tidak dihitung ke rata-rata)" : ""}`;
  return `${r.symbol} · tertangkap: berbunyi ${tglAwam(r.firstFireDate)}${lead} (${alasan})`;
}

// Warna sel: teks memakai token --ok-ink/--crit-ink (bukan `text-white`) karena
// --ok/--crit berbalik menjadi pastel terang di mode gelap; putih di atasnya
// hanya 1,85:1. Sel "tidak berbunyi" memakai ink-2 agar lolos 4.5:1 di kedua tema.
function warnaSel(r: PerSymbolResult): string {
  if (r.group === "control") return r.fired ? "bg-crit text-crit-ink" : "bg-ok-soft text-ink-2";
  return r.fired ? "bg-ok text-ok-ink" : "bg-line text-ink-2";
}

function BarisKelompok({ hasil, group }: { hasil: BacktestResult; group: Group }) {
  const g = hasil.perGroup[group];
  if (g.perSymbol.length === 0) return null;
  const nilai = group === "control" ? `${g.falseAlarms}/${g.controls} salah bunyi` : `${g.hits}/${g.total}`;
  return (
    <div className="mt-2.5" data-testid={`kelompok-${group}`}>
      <div className="mb-1 flex justify-between gap-2 text-xs text-ink-2">
        <span>
          {g.perSymbol.length} saham <Istilah id={ISTILAH_KELOMPOK[group]}>{KELOMPOK[group].judul}</Istilah> ·{" "}
          {KELOMPOK[group].catatan}
        </span>
        <b className="font-mono font-medium">{nilai}</b>
      </div>
      <ul
        className="grid list-none gap-[3px] p-0"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(44px, 1fr))" }}
        aria-label={`Emiten ${KELOMPOK[group].judul}`}
      >
        {g.perSymbol.map((r) => (
          <li
            key={r.symbol}
            title={tooltipEmiten(r)}
            aria-label={tooltipEmiten(r)}
            data-testid={`sel-${r.symbol}`}
            data-fired={r.fired}
            className={`grid h-[20px] place-items-center rounded-[3px] font-mono text-[10px] outline-2 -outline-offset-2 ${warnaSel(r)} ${r.targetEventDate ? "outline outline-ink" : ""}`}
          >
            {r.symbol}
          </li>
        ))}
      </ul>
    </div>
  );
}

const FRASA_KELOMPOK: Record<Exclude<Group, "control">, string> = {
  delisting: "saham yang dihapus dari bursa",
  watchlist: "saham berpotensi delisting",
};

/**
 * Satu kalimat jawaban (tiket 21, DESIGN.md aturan 5).
 *
 * Angkanya SAMA dengan kotak skor di bawahnya, tidak dihitung ulang: kotak
 * "Tertangkap" memakai kelompok dihapus dari bursa, "Lebih awal" memakai
 * rata-rata SELURUH saham kena (dihapus + berpotensi delisting), "Alarm palsu"
 * memakai kontrol sehat. Karena itu kalimat ini menyebut kedua kelompok kena
 * lebih dulu, baru rata-ratanya. Menulis "6 dari 18, rata-rata 8,4 bulan lebih
 * awal" akan menyesatkan: 8,4 bukan rata-rata keenam saham itu.
 */
function KalimatJawaban({ h }: { h: BacktestResult }) {
  const kena = (["delisting", "watchlist"] as const).map((g) => ({ g, ...h.perGroup[g] })).filter((x) => x.total > 0);
  const totalKena = kena.reduce((a, x) => a + x.total, 0);
  const totalTertangkap = kena.reduce((a, x) => a + x.hits, 0);
  const b = (x: string | number) => <b className="font-semibold text-ink">{x}</b>;
  // Istilah dijelaskan lewat tooltip kamus, bukan kalimat penjelas (aturan 7).
  const palsu =
    h.controls > 0 ? (
      h.falseAlarms === 0 ? (
        <>, dan tidak salah bunyi pada satu pun dari {h.controls} saham sehat</>
      ) : (
        <>
          , dan <Istilah id="alarm_palsu">salah bunyi</Istilah> pada {b(h.falseAlarms)} dari {h.controls} saham sehat
        </>
      )
    ) : null;
  return (
    <p className="m-0 mb-3 text-[14px] leading-relaxed text-ink-2" data-testid="kalimat-hasil">
      {totalTertangkap === 0 ? (
        <>
          Alarmmu tidak berbunyi lebih dulu pada satu pun dari {b(totalKena)} saham kena{palsu}.
        </>
      ) : (
        <>
          Alarmmu berbunyi lebih dulu pada{" "}
          {kena.map((x, i) => (
            <span key={x.g}>
              {i > 0 ? " dan " : ""}
              {b(x.hits)} dari {x.total} {FRASA_KELOMPOK[x.g]}
            </span>
          ))}
          {h.leadMonthsAvg != null ? (
            <>
              , rata-rata {b(angkaId(h.leadMonthsAvg, " bulan"))} <Istilah id="lebih_awal">lebih awal</Istilah>
            </>
          ) : null}
          {palsu}.
        </>
      )}
    </p>
  );
}

/** Nama saham kena yang tertangkap, paling awal bunyinya lebih dulu. */
function DaftarTertangkap({ h }: { h: BacktestResult }) {
  const tertangkap = h.perSymbol
    .filter((r) => r.group !== "control" && r.fired)
    .sort((a, b) => (b.leadMonths ?? -1) - (a.leadMonths ?? -1) || a.symbol.localeCompare(b.symbol));
  if (tertangkap.length === 0) return null;
  return (
    <div className="mb-3">
      <p className="m-0 mb-1.5 text-[12px] font-semibold text-ink-3">Saham yang tertangkap</p>
      <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0" aria-label="Saham yang tertangkap" data-testid="daftar-tertangkap">
        {tertangkap.map((r) => (
          <li
            key={r.symbol}
            data-testid={`tertangkap-${r.symbol}`}
            title={tooltipEmiten(r)}
            className="rounded-md bg-ok-soft px-2 py-1 text-[12px] text-ink"
          >
            <span className="font-mono font-semibold">{r.symbol}</span>
            {r.leadMonths != null ? <span className="text-ink-2"> · {r.leadMonths} bln lebih awal</span> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function HasilUji({ hasil, basi, sedangUji, galat }: Props) {
  const h = hasil?.hasil;
  const sumber = hasil ? (hasil.sumber === "db" ? TEKS.sumberDb : TEKS.sumberFixture) : null;
  return (
    <section aria-labelledby="judul-hasil" aria-busy={sedangUji} data-testid="hasil-uji" data-basi={basi}>
      <h3 id="judul-hasil" className="font-display text-[15px] font-bold">
        {TEKS.hasilJudul}
      </h3>
      {galat ? (
        <p role="alert" className="mb-2 rounded-lg border-l-[3px] border-crit bg-crit-soft px-3 py-2 text-[13px]">
          {galat}
        </p>
      ) : null}
      {basi && h ? (
        <p role="status" className="mb-2 text-[12.5px] font-semibold text-warn">
          Papan sudah berubah. Klik “Uji ke masa lalu” lagi.
        </p>
      ) : null}
      {!h ? (
        <p className="mb-2.5 text-xs text-ink-3">
          Diuji ke saham yang pernah dihapus dari bursa, yang dipantau khusus, dan yang sehat: berapa yang tertangkap, berapa
          bulan <Istilah id="lebih_awal">lebih awal</Istilah>, dan berapa <Istilah id="alarm_palsu">alarm palsu</Istilah>.
        </p>
      ) : null}

      {h && sumber ? (
        <div className={basi ? "opacity-40 transition-opacity" : "transition-opacity"}>
          <KalimatJawaban h={h} />
          <DaftarTertangkap h={h} />
          <p className="m-0 text-xs text-ink-3">
            Diuji ke {h.perSymbol.length} saham dengan{" "}
            {/* `data-sumber` = penanda mesin untuk tes: teks "data contoh (bukan data
                Sectors nyata)" memuat substring "data Sectors nyata", jadi assertion
                teks saja tidak bisa membedakan kedua jalur. */}
            <span
              data-testid="label-sumber"
              data-sumber={hasil?.sumber === "db" ? "db" : "fixture"}
              className={`rounded-md px-1.5 py-0.5 font-semibold ${hasil?.sumber === "db" ? "bg-ok-soft text-ok" : "bg-warn-soft text-warn"}`}
            >
              {sumber}
            </span>
            , akhir bulan {fmtTanggal(h.scanStart)} sampai {fmtTanggal(h.today)}.
            {hasil?.dataPer ? <span data-testid="data-per"> Data ditarik {fmtTanggal(hasil.dataPer)}.</span> : null}
            {hasil?.dilewati?.length ? (
              <span data-testid="dilewati">
                {" "}
                {hasil.dilewati.length} saham dilewati ({hasil.dilewati.join(", ")}) karena tanggal berhentinya diperdagangkan tidak ada di data kami.
              </span>
            ) : null}
          </p>
          <details className="mt-2" data-testid="rincian-kelompok">
            <summary className="cursor-pointer text-[12.5px] font-semibold text-accent">
              Lihat angka dan semua {h.perSymbol.length} saham yang diuji, per kelompok
            </summary>
            <div className="my-2.5 grid grid-cols-3 gap-2">
              <div className="rounded-[10px] bg-surface-2 px-3 py-2.5">
                <div className="text-[11.5px] font-semibold text-ink-3">Tertangkap</div>
                <div className="font-display text-2xl font-extrabold tabular-nums text-ok" data-testid="skor-tertangkap">
                  {`${h.perGroup.delisting.hits}/${h.perGroup.delisting.total}`}
                </div>
                <div className="text-[11px] text-ink-2">dari yang dihapus dari bursa</div>
              </div>
              <div className="rounded-[10px] bg-surface-2 px-3 py-2.5">
                <div className="text-[11.5px] font-semibold text-ink-3">Lebih awal</div>
                <div className="font-display text-2xl font-extrabold tabular-nums text-warn" data-testid="skor-lead">
                  {angkaId(h.leadMonthsAvg, " bln")}
                </div>
                <div className="text-[11px] text-ink-2">rata-rata sebelum kejadian</div>
              </div>
              <div className="rounded-[10px] bg-surface-2 px-3 py-2.5">
                <div className="text-[11.5px] font-semibold text-ink-3">Alarm palsu</div>
                <div className="font-display text-2xl font-extrabold tabular-nums text-crit" data-testid="skor-palsu">
                  {`${h.falseAlarms}/${h.controls}`}
                </div>
                <div className="text-[11px] text-ink-2">dari saham sehat</div>
              </div>
            </div>
            {URUTAN.map((g) => (
              <BarisKelompok key={g} hasil={h} group={g} />
            ))}
          </details>
        </div>
      ) : null}
    </section>
  );
}
