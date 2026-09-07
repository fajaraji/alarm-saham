"use client";
// Panel hasil uji (kanan atas): tiga angka + tiga baris kotak per kelompok
// universe (dihapus dari bursa, pemantauan khusus, sehat) dengan tooltip per
// emiten, dan label sumber data (Sectors nyata vs contoh).
import type { Group } from "@/lib/engine/events";
import type { BacktestResult, PerSymbolResult } from "@/lib/engine/score";
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
const ISTILAH_KELOMPOK: Record<Group, IdIstilah> = { delisting: "delisting", watchlist: "pemantauan_khusus", control: "kontrol_sehat" };

function angkaId(x: number | null, satuan = ""): string {
  if (x == null) return "–";
  return `${x.toLocaleString("id-ID", { maximumFractionDigits: 1 })}${satuan}`;
}

function tooltipEmiten(r: PerSymbolResult): string {
  const alasan = r.reasons.map((x) => labelBlok(x.kind)).join(", ");
  if (r.group === "control") {
    return r.fired
      ? `${r.symbol} · alarm palsu: berbunyi ${r.firstFireDate} (${alasan})`
      : `${r.symbol} · bersih: alarm tidak pernah berbunyi`;
  }
  if (!r.fired) return `${r.symbol} · terlewat: alarm diam sebelum ${r.targetEventDate}`;
  const lead = r.leadMonths == null ? "" : ` · ${r.leadMonths} bln lebih awal${r.excludedFromLead ? " (tidak dihitung ke rata-rata)" : ""}`;
  return `${r.symbol} · tertangkap: berbunyi ${r.firstFireDate}${lead} (${alasan})`;
}

function warnaSel(r: PerSymbolResult): string {
  if (r.group === "control") return r.fired ? "bg-crit text-white" : "bg-ok-soft text-ink-2";
  return r.fired ? "bg-ok text-white" : "bg-line text-ink-3";
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
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(38px, 1fr))" }}
        aria-label={`Emiten ${KELOMPOK[group].judul}`}
      >
        {g.perSymbol.map((r) => (
          <li
            key={r.symbol}
            title={tooltipEmiten(r)}
            aria-label={tooltipEmiten(r)}
            data-testid={`sel-${r.symbol}`}
            data-fired={r.fired}
            className={`grid h-[18px] place-items-center rounded-[3px] font-mono text-[8.5px] outline-2 -outline-offset-2 ${warnaSel(r)} ${r.targetEventDate ? "outline outline-ink" : ""}`}
          >
            {r.symbol}
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
      {h && sumber ? (
        <p className="mb-2.5 text-xs text-ink-3">
          Diuji ke {h.perSymbol.length} saham dengan{" "}
          <span
            data-testid="label-sumber"
            className={`rounded-full px-2 py-0.5 font-semibold ${hasil?.sumber === "db" ? "bg-ok-soft text-ok" : "bg-warn-soft text-warn"}`}
          >
            {sumber}
          </span>
          , akhir bulan {h.scanStart} – {h.today}.
          {hasil?.dilewati?.length ? (
            <span data-testid="dilewati">
              {" "}
              {hasil.dilewati.length} saham dilewati ({hasil.dilewati.join(", ")}) karena tidak punya tanggal kejadian target.
            </span>
          ) : null}
          {basi ? " Papan sudah berubah — klik “Uji ke masa lalu” lagi." : ""}
        </p>
      ) : (
        <p className="mb-2.5 text-xs text-ink-3">Diuji ke saham yang pernah dihapus dari bursa, yang dipantau khusus, dan yang sehat.</p>
      )}
      {galat ? (
        <p role="alert" className="mb-2 rounded-lg border-l-[3px] border-crit bg-crit-soft px-3 py-2 text-[13px]">
          {galat}
        </p>
      ) : null}

      <div className={basi ? "opacity-40 transition-opacity" : "transition-opacity"}>
        <div className="my-2.5 grid grid-cols-3 gap-2">
          <div className="rounded-[10px] bg-surface-2 px-3 py-2.5">
            <div className="text-[10.5px] font-semibold uppercase tracking-wider text-ink-3">Tertangkap</div>
            <div className="font-display text-2xl font-extrabold tabular-nums text-ok" data-testid="skor-tertangkap">
              {h ? `${h.perGroup.delisting.hits}/${h.perGroup.delisting.total}` : "–"}
            </div>
            <div className="text-[11px] text-ink-2">dari yang dihapus dari bursa</div>
          </div>
          <div className="rounded-[10px] bg-surface-2 px-3 py-2.5">
            <div className="text-[10.5px] font-semibold uppercase tracking-wider text-ink-3"><Istilah id="lebih_awal">Lebih awal</Istilah></div>
            <div className="font-display text-2xl font-extrabold tabular-nums text-warn" data-testid="skor-lead">
              {h ? angkaId(h.leadMonthsAvg, " bln") : "–"}
            </div>
            <div className="text-[11px] text-ink-2">rata-rata sebelum kejadian</div>
          </div>
          <div className="rounded-[10px] bg-surface-2 px-3 py-2.5">
            <div className="text-[10.5px] font-semibold uppercase tracking-wider text-ink-3"><Istilah id="alarm_palsu">Alarm palsu</Istilah></div>
            <div className="font-display text-2xl font-extrabold tabular-nums text-crit" data-testid="skor-palsu">
              {h ? `${h.falseAlarms}/${h.controls}` : "–"}
            </div>
            <div className="text-[11px] text-ink-2">dari <Istilah id="kontrol_sehat">saham sehat</Istilah></div>
          </div>
        </div>
        {h ? URUTAN.map((g) => <BarisKelompok key={g} hasil={h} group={g} />) : null}
      </div>
    </section>
  );
}
