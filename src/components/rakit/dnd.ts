// Kesepakatan dnd-kit untuk papan alarm: ID area, data yang dibawa saat
// seret, deteksi tabrakan, dan pengumuman pembaca layar (Bahasa Indonesia).
import {
  closestCenter,
  pointerWithin,
  type Announcements,
  type CollisionDetection,
  type ScreenReaderInstructions,
  type UniqueIdentifier,
} from "@dnd-kit/core";

import { BLOCK_KINDS, type BlockKind } from "@/lib/engine/rules";
import { labelBlok } from "@/lib/rakit/blok";

export const ID_PAPAN = "papan";
export const ID_BUANG = "buang";
const AWALAN_PALET = "palet:";

export interface DataSeret {
  asal: "palet" | "papan";
  kind: BlockKind;
}

export function idPalet(kind: BlockKind): string {
  return `${AWALAN_PALET}${kind}`;
}

export function isBlockKind(id: UniqueIdentifier): id is BlockKind {
  return typeof id === "string" && (BLOCK_KINDS as readonly string[]).includes(id);
}

/** Label awam dari ID apa pun (blok papan, blok palet, area). */
export function labelId(id: UniqueIdentifier): string {
  if (typeof id !== "string") return String(id);
  if (id === ID_PAPAN) return "papan alarm";
  if (id === ID_BUANG) return "area buang";
  const kind = id.startsWith(AWALAN_PALET) ? id.slice(AWALAN_PALET.length) : id;
  return isBlockKind(kind) ? `blok ${labelBlok(kind)}` : id;
}

/**
 * Deteksi tabrakan: penunjuk di dalam area buang → buang; penunjuk di dalam
 * blok/papan → itu (blok lebih kecil menang); tanpa penunjuk (keyboard) →
 * pusat terdekat, tanpa area buang (keyboard membuang lewat tombol ×).
 */
export const deteksiTabrakan: CollisionDetection = (args) => {
  const didalam = pointerWithin(args);
  const buang = didalam.find((c) => c.id === ID_BUANG);
  if (buang) return [buang];
  if (didalam.length > 0) return didalam;
  return closestCenter({
    ...args,
    droppableContainers: args.droppableContainers.filter((c) => c.id !== ID_BUANG),
  });
};

export const pengumuman: Announcements = {
  onDragStart: ({ active }) => `Mengangkat ${labelId(active.id)}.`,
  onDragOver: ({ active, over }) =>
    over ? `${labelId(active.id)} berada di atas ${labelId(over.id)}.` : `${labelId(active.id)} tidak berada di atas area mana pun.`,
  onDragEnd: ({ active, over }) =>
    over ? `${labelId(active.id)} dilepas di ${labelId(over.id)}.` : `${labelId(active.id)} dilepas; tidak ada perubahan.`,
  onDragCancel: ({ active }) => `Dibatalkan. ${labelId(active.id)} dikembalikan ke tempat semula.`,
};

export const instruksiPembacaLayar: ScreenReaderInstructions = {
  draggable:
    "Tekan Spasi untuk mengangkat blok, tombol panah untuk memindahkannya, Spasi lagi untuk melepas, Escape untuk membatalkan.",
};
