"use client";
// Kotak blok (kiri): lima blok kelas A. Seret = salin ke papan; klik/Enter =
// tambah (fallback keyboard & sentuh). Keyboard sengaja TIDAK memulai drag di
// palet supaya Spasi/Enter tetap berarti "tambah".
import { useDraggable } from "@dnd-kit/core";
import type { PointerEventHandler, TouchEventHandler } from "react";

import { DAFTAR_BLOK, type InfoBlok } from "@/lib/rakit/blok";
import type { BlockKind } from "@/lib/engine/rules";

import { Istilah } from "@/components/panduan/Istilah";

import { idPalet, type DataSeret } from "./dnd";
import { TEKS } from "./teks";

interface PropsItem {
  info: InfoBlok;
  sudahAda: boolean;
  onTambah: (kind: BlockKind) => void;
}

function ItemPalet({ info, sudahAda, onTambah }: PropsItem) {
  const data: DataSeret = { asal: "palet", kind: info.kind };
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: idPalet(info.kind),
    data,
    disabled: sudahAda,
  });
  // Hanya penunjuk/sentuh yang memulai seret; keyboard (Spasi/Enter) = klik tambah.
  const pointerSaja = {
    onPointerDown: listeners?.onPointerDown as PointerEventHandler<HTMLButtonElement> | undefined,
    onTouchStart: listeners?.onTouchStart as TouchEventHandler<HTMLButtonElement> | undefined,
  };

  return (
    <button
      ref={setNodeRef}
      type="button"
      {...pointerSaja}
      aria-describedby={attributes["aria-describedby"]}
      onClick={() => onTambah(info.kind)}
      disabled={sudahAda}
      title={info.tooltip}
      data-testid={`palet-${info.kind}`}
      className={`flex w-full cursor-grab flex-wrap items-center gap-2 rounded-lg bg-b-cond px-3 py-2 text-left text-[13px] font-semibold text-b-text shadow-[0_2px_0_rgba(0,0,0,.2)] transition-opacity active:cursor-grabbing disabled:cursor-default disabled:opacity-40 ${isDragging ? "opacity-50" : ""}`}
      style={{ touchAction: "manipulation" }}
    >
      <span aria-hidden="true" className="font-mono tracking-[-2px] opacity-60">
        ⋮⋮
      </span>
      <span className="flex-1">{info.label}</span>
      <span className="rounded-full bg-black/20 px-2 py-0.5 font-mono text-[10.5px] font-medium">
        {info.dataSejak}
      </span>
      {sudahAda ? <span className="sr-only">(sudah di papan)</span> : null}
    </button>
  );
}

interface PropsPalet {
  adaDiPapan: (kind: BlockKind) => boolean;
  onTambah: (kind: BlockKind) => void;
}

export function Palet({ adaDiPapan, onTambah }: PropsPalet) {
  return (
    <aside
      aria-labelledby="judul-palet"
      className="self-start rounded-[14px] border border-line bg-surface p-3.5"
    >
      <h3 id="judul-palet" className="font-display text-[15px] font-bold">
        {TEKS.paletJudul}
      </h3>
      <p className="mb-2.5 text-xs text-ink-3">{TEKS.paletSub}</p>
      <div className="flex flex-col gap-2" role="list" aria-label="Blok syarat yang tersedia">
        {DAFTAR_BLOK.map((info) => (
          <div key={info.kind} role="listitem">
            <ItemPalet info={info} sudahAda={adaDiPapan(info.kind)} onTambah={onTambah} />
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11.5px] leading-snug text-ink-3">
        Arahkan kursor ke blok untuk membaca artinya (atau buka Kamus). Blok “<Istilah id="insider_jual">orang dalam menjual</Istilah>” hanya punya data sejak 2024, jadi
        hasil ujinya lebih tipis.
      </p>
    </aside>
  );
}
