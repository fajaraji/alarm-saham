// State papan alarm (tiket 09) + reducer murni.
//
// Bentuk state sengaja sama dengan `Rule` kecuali `blocks` boleh kosong
// (papan baru). Setiap aksi menjaga invarian RuleSchema: jenis blok unik,
// maksimal 5 blok, ambang & combine dari enum. `keRule()` memvalidasi dengan
// skema yang SAMA dengan server, sehingga klien tidak pernah mengirim aturan
// yang akan ditolak.
import { arrayMove } from "@dnd-kit/sortable";

import {
  BLOCK_KINDS,
  RuleSchema,
  type Block,
  type BlockKind,
  type Combine,
  type Rule,
  type Threshold,
} from "../engine/rules";

export interface PapanState {
  name: string;
  combine: Combine;
  blocks: Block[];
}

export const NAMA_DEFAULT = "Alarm buatanku";

export const PAPAN_AWAL: PapanState = { name: NAMA_DEFAULT, combine: "any", blocks: [] };

export type AksiPapan =
  | { tipe: "tambah"; kind: BlockKind; threshold?: Threshold; di?: number }
  | { tipe: "hapus"; kind: BlockKind }
  | { tipe: "pindah"; dari: BlockKind; ke: BlockKind }
  | { tipe: "toggleCombine" }
  | { tipe: "setCombine"; combine: Combine }
  | { tipe: "toggleAmbang"; kind: BlockKind }
  | { tipe: "setAmbang"; kind: BlockKind; threshold: Threshold }
  | { tipe: "setNama"; name: string }
  | { tipe: "kosongkan" }
  | { tipe: "muat"; rule: Rule };

const ambangBerikut: Record<Threshold, Threshold> = { longgar: "ketat", ketat: "longgar" };

export function adaBlok(state: PapanState, kind: BlockKind): boolean {
  return state.blocks.some((b) => b.kind === kind);
}

export function reducerPapan(state: PapanState, aksi: AksiPapan): PapanState {
  switch (aksi.tipe) {
    case "tambah": {
      if (!BLOCK_KINDS.includes(aksi.kind)) return state;
      if (adaBlok(state, aksi.kind)) return state;
      if (state.blocks.length >= BLOCK_KINDS.length) return state;
      const baru: Block = { kind: aksi.kind, threshold: aksi.threshold ?? "longgar" };
      const di = aksi.di === undefined ? state.blocks.length : Math.max(0, Math.min(aksi.di, state.blocks.length));
      const blocks = [...state.blocks.slice(0, di), baru, ...state.blocks.slice(di)];
      return { ...state, blocks };
    }
    case "hapus":
      return { ...state, blocks: state.blocks.filter((b) => b.kind !== aksi.kind) };
    case "pindah": {
      const dari = state.blocks.findIndex((b) => b.kind === aksi.dari);
      const ke = state.blocks.findIndex((b) => b.kind === aksi.ke);
      if (dari < 0 || ke < 0 || dari === ke) return state;
      return { ...state, blocks: arrayMove(state.blocks, dari, ke) };
    }
    case "toggleCombine":
      return { ...state, combine: state.combine === "any" ? "all" : "any" };
    case "setCombine":
      return { ...state, combine: aksi.combine };
    case "toggleAmbang":
      return {
        ...state,
        blocks: state.blocks.map((b) => (b.kind === aksi.kind ? { ...b, threshold: ambangBerikut[b.threshold] } : b)),
      };
    case "setAmbang":
      return {
        ...state,
        blocks: state.blocks.map((b) => (b.kind === aksi.kind ? { ...b, threshold: aksi.threshold } : b)),
      };
    case "setNama":
      return { ...state, name: aksi.name };
    case "kosongkan":
      return { ...state, blocks: [] };
    case "muat":
      return { name: aksi.rule.name, combine: aksi.rule.combine, blocks: aksi.rule.blocks.map((b) => ({ ...b })) };
    default:
      return state;
  }
}

/**
 * Ubah state papan menjadi aturan tervalidasi. Kembalikan `null` bila papan
 * kosong atau (seharusnya tidak pernah) melanggar skema.
 */
export function keRule(state: PapanState): Rule | null {
  if (state.blocks.length === 0) return null;
  const nama = state.name.trim() || NAMA_DEFAULT;
  const hasil = RuleSchema.safeParse({ name: nama, combine: state.combine, blocks: state.blocks });
  return hasil.success ? hasil.data : null;
}

/** Ringkasan awam satu baris untuk nama alarm/hasil, mis. "disuspensi atau utang > harta". */
export function ringkasAwam(state: PapanState, label: (kind: BlockKind) => string): string {
  const kata = state.combine === "any" ? " ATAU " : " DAN ";
  return state.blocks.map((b) => label(b.kind)).join(kata);
}
