// Alarm untuk mode jaga: bawaan + buatan pengguna (tiket 09) + kelas B.
//
// Satu alarm jaga = alarm kelas A (aturan RuleSchema, bisa diuji ke masa lalu)
// ATAU alarm kelas B (daftar blok data terkini, hanya mode pasang). ID alarm
// bawaan berupa UUID tetap agar muat di kolom `portfolios.alarm_ids` (uuid[]).
import { z } from "zod";

import { RuleSchema, type Rule } from "../engine/rules";
import { BLOK_B_KINDS, type BlokBKind } from "./blok-b";

export interface AlarmJaga {
  id: string;
  name: string;
  kelas: "A" | "B";
  /** Kelas A: aturan blok kelas A. */
  rule?: Rule;
  /** Kelas B: blok data terkini; berbunyi bila SALAH SATU terpenuhi. */
  blokB?: BlokBKind[];
  bawaan: boolean;
}

export const ID_ALARM_PAILIT = "00000000-0000-4000-8000-00000000a001";
export const ID_ALARM_JEBAKAN = "00000000-0000-4000-8000-00000000b001";

export const ALARM_BAWAAN: readonly AlarmJaga[] = [
  {
    id: ID_ALARM_PAILIT,
    name: "Saham mau pailit",
    kelas: "A",
    bawaan: true,
    rule: {
      name: "Saham mau pailit",
      combine: "any",
      blocks: [
        { kind: "suspensi", threshold: "longgar" },
        { kind: "laporan_hilang", threshold: "longgar" },
        { kind: "ekuitas_negatif", threshold: "longgar" },
      ],
    },
  },
  {
    id: ID_ALARM_JEBAKAN,
    name: "Jebakan IPO/harga",
    kelas: "B",
    bawaan: true,
    blokB: ["ritel_dominan", "jatuh_dari_puncak", "free_float_kecil"],
  },
];

/** Alarm buatan pengguna yang dikirim klien (tersimpan di localStorage/DB tiket 09). */
export const AlarmKlienSchema = z.object({
  id: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1).max(120),
  rule: RuleSchema,
});
export type AlarmKlien = z.infer<typeof AlarmKlienSchema>;

export const BlokBSchema = z.enum(BLOK_B_KINDS);

export function alarmDariKlien(a: AlarmKlien): AlarmJaga {
  return { id: a.id, name: a.name, kelas: "A", rule: a.rule, bawaan: false };
}

/** Ringkasan satu baris untuk kartu alarm. */
export function ringkasAlarmJaga(a: AlarmJaga): string {
  if (a.kelas === "B") return (a.blokB ?? []).join(" ATAU ");
  const r = a.rule;
  if (!r) return "";
  return r.blocks.map((b) => `${b.kind}(${b.threshold})`).join(r.combine === "any" ? " ATAU " : " DAN ");
}
