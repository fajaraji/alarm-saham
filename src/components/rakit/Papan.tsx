"use client";
// Papan alarm (tengah): kotak "Minta AI rakit", blok KALAU, dropzone sortable
// bergaris putus-putus, tombol ATAU/DAN di antara blok, blok MAKA, area buang,
// dan tombol aksi.
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Fragment, type FormEvent } from "react";

import type { BlockKind } from "@/lib/engine/rules";
import type { PapanState } from "@/lib/rakit/reducer";

import { BlokPapan } from "./BlokPapan";
import { ID_BUANG, ID_PAPAN } from "./dnd";
import { TEKS } from "./teks";

interface Props {
  state: PapanState;
  blokBaru: BlockKind | null;
  sedangUji: boolean;
  sedangRakit: boolean;
  sedangSimpan: boolean;
  bisaSimpan: boolean;
  kalimat: string;
  catatanRakit: { jenis: "info" | "galat" | "ai-nonaktif"; teks: string } | null;
  catatanSimpan: string | null;
  onKalimat: (v: string) => void;
  onMintaAi: () => void;
  onToggleCombine: () => void;
  onToggleAmbang: (kind: BlockKind) => void;
  onHapus: (kind: BlockKind) => void;
  onNama: (v: string) => void;
  onUji: () => void;
  onKosongkan: () => void;
  onSimpan: () => void;
}

function Dropzone({ children, kosong }: { children: React.ReactNode; kosong: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: ID_PAPAN });
  return (
    <ul
      ref={setNodeRef}
      data-testid="papan-dropzone"
      aria-label="Papan alarm: daftar blok syarat"
      className={`my-1.5 ml-[22px] flex min-h-[120px] list-none flex-col gap-1.5 rounded-[10px] border-2 border-dashed p-2.5 transition-colors ${isOver ? "border-accent bg-accent-soft" : "border-line-strong bg-surface-2"}`}
    >
      {kosong ? (
        <li className="px-2 py-5 text-center text-[13px] text-ink-3">
          <b className="text-accent">{TEKS.papanKosongJudul}</b>
          <br />
          {TEKS.papanKosongSub}
        </li>
      ) : (
        children
      )}
    </ul>
  );
}

function AreaBuang() {
  const { setNodeRef, isOver } = useDroppable({ id: ID_BUANG });
  return (
    <div
      ref={setNodeRef}
      data-testid="area-buang"
      aria-label="Area buang"
      className={`mt-2.5 rounded-[10px] border-2 border-dashed p-2 text-center text-xs transition-colors ${isOver ? "border-crit bg-crit-soft text-crit" : "border-line text-ink-3"}`}
    >
      {TEKS.buang}
    </div>
  );
}

export function Papan(p: Props) {
  const { state } = p;
  const kataGabung = state.combine === "any" ? "ATAU" : "DAN";
  const kataLain = state.combine === "any" ? "DAN" : "ATAU";

  function kirimAi(e: FormEvent) {
    e.preventDefault();
    p.onMintaAi();
  }

  return (
    <section aria-labelledby="judul-papan" className="rounded-[14px] border border-line bg-surface p-3.5">
      <h3 id="judul-papan" className="font-display text-[15px] font-bold">
        {TEKS.papanJudul}
      </h3>
      <p className="mb-2.5 text-xs text-ink-3">{TEKS.papanSub}</p>

      <form onSubmit={kirimAi} className="mb-3 flex gap-2">
        <input
          value={p.kalimat}
          onChange={(e) => p.onKalimat(e.target.value)}
          aria-label="Ceritakan alarm yang kamu mau, AI akan merakitnya"
          placeholder={TEKS.placeholderAi}
          maxLength={500}
          disabled={p.sedangRakit}
          className="min-w-0 flex-1 rounded-lg border border-line-strong bg-surface px-3 py-2 text-ink placeholder:text-ink-3"
        />
        <button
          type="submit"
          disabled={p.sedangRakit || p.kalimat.trim().length < 3}
          className="rounded-lg border border-accent bg-accent px-3.5 py-2 font-semibold text-accent-ink disabled:cursor-default disabled:opacity-50"
        >
          {p.sedangRakit ? "Merakit…" : TEKS.tombolAi}
        </button>
      </form>
      {p.catatanRakit ? (
        <p
          role={p.catatanRakit.jenis === "info" ? "status" : "alert"}
          data-testid="catatan-rakit"
          className={`mb-3 rounded-lg border-l-[3px] px-3 py-2 text-[13px] ${
            p.catatanRakit.jenis === "ai-nonaktif"
              ? "border-warn bg-warn-soft text-ink"
              : p.catatanRakit.jenis === "galat"
                ? "border-crit bg-crit-soft text-ink"
                : "border-accent bg-accent-soft text-ink"
          }`}
        >
          {p.catatanRakit.teks}
        </p>
      ) : null}

      <div className="flex items-center gap-2 rounded-t-[14px] rounded-b bg-b-if px-3 py-2 text-[13px] font-semibold text-b-text shadow-[0_2px_0_rgba(0,0,0,.2)]">
        <span className="font-display font-extrabold tracking-wide">{TEKS.kalau}</span>
        <span>{TEKS.kalauTeks}</span>
      </div>

      <Dropzone kosong={state.blocks.length === 0}>
        <SortableContext items={state.blocks.map((b) => b.kind)} strategy={verticalListSortingStrategy}>
          {state.blocks.map((b, i) => (
            <Fragment key={b.kind}>
              {i > 0 ? (
                <li className="self-start">
                  <button
                    type="button"
                    onClick={p.onToggleCombine}
                    title={`Klik untuk mengubah menjadi ${kataLain}`}
                    aria-label={`${kataGabung}. Cara menggabung blok; klik untuk mengubah menjadi ${kataLain}`}
                    data-testid="tombol-gabung"
                    className="rounded-full bg-ink/10 px-2.5 py-0.5 text-[11.5px] font-bold tracking-wider text-ink hover:bg-ink/20"
                  >
                    {kataGabung}
                  </button>
                </li>
              ) : null}
              <BlokPapan blok={b} baruMasuk={p.blokBaru === b.kind} onToggleAmbang={p.onToggleAmbang} onHapus={p.onHapus} />
            </Fragment>
          ))}
        </SortableContext>
      </Dropzone>

      <div className="flex items-center gap-2 rounded-t rounded-b-[14px] bg-b-then px-3 py-2 text-[13px] font-semibold text-b-text shadow-[0_2px_0_rgba(0,0,0,.2)]">
        <span className="font-display font-extrabold tracking-wide">{TEKS.maka}</span>
        <span>{TEKS.makaTeks}</span>
      </div>

      <AreaBuang />

      <label className="mt-3 block text-xs text-ink-3">
        Nama alarm
        <input
          value={state.name}
          onChange={(e) => p.onNama(e.target.value)}
          maxLength={120}
          className="mt-1 w-full rounded-lg border border-line-strong bg-surface px-3 py-1.5 text-[13px] text-ink"
        />
      </label>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={p.onUji}
          disabled={p.sedangUji}
          className="rounded-lg border border-accent bg-accent px-3.5 py-2 font-semibold text-accent-ink disabled:cursor-default disabled:opacity-50"
        >
          {p.sedangUji ? "Menguji…" : TEKS.tombolUji}
        </button>
        <button
          type="button"
          onClick={p.onSimpan}
          disabled={!p.bisaSimpan || p.sedangSimpan}
          className="rounded-lg border border-line-strong bg-surface px-3.5 py-2 font-semibold text-ink disabled:cursor-default disabled:opacity-50"
        >
          {p.sedangSimpan ? "Menyimpan…" : TEKS.tombolSimpan}
        </button>
        <button
          type="button"
          onClick={p.onKosongkan}
          disabled={state.blocks.length === 0}
          className="rounded-lg px-3.5 py-2 font-semibold text-ink-2 hover:bg-surface-2 disabled:cursor-default disabled:opacity-50"
        >
          {TEKS.tombolKosongkan}
        </button>
      </div>
      {p.catatanSimpan ? (
        <p role="status" data-testid="catatan-simpan" className="mt-2 text-[12.5px] text-ink-2">
          {p.catatanSimpan}
        </p>
      ) : null}
    </section>
  );
}
