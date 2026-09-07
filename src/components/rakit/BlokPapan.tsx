"use client";
// Satu blok syarat di papan: pegangan seret (keyboard-able), label, chip
// ambang yang bisa diklik (longgar ↔ ketat), tombol buang.
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import type { Block, BlockKind } from "@/lib/engine/rules";
import { INFO_BLOK } from "@/lib/rakit/blok";

import type { DataSeret } from "./dnd";

interface Props {
  blok: Block;
  baruMasuk: boolean;
  onToggleAmbang: (kind: BlockKind) => void;
  onHapus: (kind: BlockKind) => void;
}

export function BlokPapan({ blok, baruMasuk, onToggleAmbang, onHapus }: Props) {
  const info = INFO_BLOK[blok.kind];
  const data: DataSeret = { asal: "papan", kind: blok.kind };
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: blok.kind,
    data,
  });
  const ambang = info.ambang[blok.threshold];
  const ambangLain = info.ambang[blok.threshold === "longgar" ? "ketat" : "longgar"];

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      data-testid={`blok-${blok.kind}`}
      data-threshold={blok.threshold}
      className={`relative flex flex-wrap items-center gap-2 rounded-lg bg-b-cond px-3 py-2 text-[13px] font-semibold text-b-text shadow-[0_2px_0_rgba(0,0,0,.2)] ${isDragging ? "opacity-45" : ""} ${baruMasuk ? "blok-masuk" : ""}`}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        {...listeners}
        {...attributes}
        aria-label={`Pegang untuk memindahkan blok ${info.label}`}
        title="Seret untuk mengurutkan atau membuang"
        className="cursor-grab rounded px-1 font-mono tracking-[-2px] opacity-60 hover:opacity-100 focus-visible:opacity-100 active:cursor-grabbing"
        style={{ touchAction: "none" }}
      >
        ⋮⋮
      </button>
      <span title={info.tooltip}>{info.label}</span>
      <button
        type="button"
        onClick={() => onToggleAmbang(blok.kind)}
        title={`Klik untuk mengubah ambang menjadi: ${ambangLain}`}
        aria-label={`Ambang ${info.label}: ${ambang} (${blok.threshold}). Klik untuk mengubah menjadi ${ambangLain}`}
        className="ml-auto rounded-md bg-white/90 px-2 py-0.5 text-xs font-medium text-[#151c2b] hover:bg-white"
      >
        {ambang}
      </button>
      <button
        type="button"
        onClick={() => onHapus(blok.kind)}
        aria-label={`Buang blok ${info.label}`}
        title="Buang"
        className="h-[22px] w-[22px] rounded-md bg-black/20 leading-none text-white hover:bg-black/40"
      >
        ×
      </button>
    </li>
  );
}
