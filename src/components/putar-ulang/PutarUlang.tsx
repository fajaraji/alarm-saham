"use client";
// Layar putar ulang satu emiten: slider waktu (akhir bulan) → kejadian setelah t
// diredupkan, lampu = status aturan default (`fires`) pada t, ringkasan jumlah tanda.
import { useMemo, useState } from "react";

import { fires } from "@/lib/engine/evaluate";
import { LABEL_BLOK } from "@/lib/engine/rules";
import { rentangSlider } from "@/lib/putar-ulang/filter";
import { ATURAN_DEFAULT, petakanLampu } from "@/lib/putar-ulang/lampu";
import type { EmitenPutarUlang } from "@/lib/putar-ulang/muat";
import { fmtTanggal, LABEL_GROUP, pelajaran, ringkasSampai } from "@/lib/putar-ulang/ringkas";

import { GarisWaktu } from "./GarisWaktu";
import { Grafik } from "./Grafik";

const LABEL_STATUS: Record<EmitenPutarUlang["status"], string> = {
  lengkap: "universe uji",
  laporan_tidak_tersedia: "universe uji · data laporan tidak tersedia di sumber",
  hanya_suspensi: "di luar universe uji · hanya feed suspensi",
  tidak_ada: "belum ada di data kami",
};

export function PutarUlang({ emiten }: { emiten: EmitenPutarUlang }) {
  const rentang = useMemo(
    () => rentangSlider(emiten.kejadian, emiten.today, emiten.targetEventDate ? [emiten.targetEventDate] : []),
    [emiten],
  );
  const [idx, setIdx] = useState(rentang.tanggal.length - 1);
  const t = rentang.tanggal[Math.min(idx, rentang.tanggal.length - 1)];

  const lampu = useMemo(() => petakanLampu(fires(ATURAN_DEFAULT, emiten.events, t)), [emiten.events, t]);
  const ringkas = ringkasSampai(emiten.kejadian, t);
  const barisPelajaran = useMemo(
    () =>
      pelajaran({
        symbol: emiten.symbol,
        group: emiten.group,
        targetEventDate: emiten.targetEventDate,
        kejadian: emiten.kejadian,
      }),
    [emiten],
  );

  return (
    <div className="pu-replay" data-testid="putar-ulang" data-symbol={emiten.symbol}>
      <div className="pu-panel">
        <h3>
          {emiten.companyName ? `${emiten.companyName} (${emiten.symbol})` : emiten.symbol}{" "}
          {emiten.group && <span className={`pu-badge ${emiten.group}`}>{LABEL_GROUP[emiten.group]}</span>}
        </h3>
        <p className="pu-sub">
          {LABEL_STATUS[emiten.status]}
          {emiten.targetEventDate && <> · kejadian target yang kami catat: {fmtTanggal(emiten.targetEventDate)}</>}
        </p>

        <Grafik kejadian={emiten.kejadian} rentang={rentang} t={t} target={emiten.targetEventDate} />

        <div className="pu-slider">
          <input
            type="range"
            min={0}
            max={rentang.tanggal.length - 1}
            value={Math.min(idx, rentang.tanggal.length - 1)}
            onChange={(e) => setIdx(Number(e.currentTarget.value))}
            aria-label="Geser waktu"
            aria-valuetext={fmtTanggal(t)}
            data-testid="slider"
          />
          <div className="lbl">
            <span>{rentang.awal}</span>
            <b data-testid="tanggal-terpilih">{fmtTanggal(t)}</b>
            <span>{rentang.akhir}</span>
          </div>
          <div className="pu-dragme">◀ geser ke kiri untuk mundur ke masa lalu</div>
        </div>

        <div className="pu-now" data-testid="lampu" data-warna={lampu.warna}>
          <div className={`pu-lamp ${lampu.warna}`} aria-hidden />
          <div>
            <b>{lampu.judul}</b>
            <div>{lampu.keterangan}</div>
            <div className="d">
              aturan default: {ATURAN_DEFAULT.blocks.map((b) => LABEL_BLOK[b.kind].toLowerCase()).join(" ATAU ")} · dinilai
              pada {t} · hanya data bertanggal ≤ {t}
            </div>
          </div>
        </div>
        <p className="pu-sub" style={{ marginTop: 10 }} data-testid="ringkasan" data-jumlah={ringkas.jumlah}>
          {ringkas.teks}
        </p>
      </div>

      <div className="pu-panel">
        <h3>Tanda yang sudah kelihatan sampai tanggal itu</h3>
        <p className="pu-sub">Yang belum terjadi diredupkan. Sumber data ditulis kecil di bawah tiap tanda.</p>
        <GarisWaktu kejadian={emiten.kejadian} t={t} />
        <div className="pu-lesson" data-testid="pelajaran">
          <b>Pelajaran dari rekaman ini</b>
          <ul>
            {barisPelajaran.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </div>
        {emiten.catatan.length > 0 && (
          <div className="pu-note" data-testid="catatan">
            <b>Keterbatasan data emiten ini</b>
            <ul>
              {emiten.catatan.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
