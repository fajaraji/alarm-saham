"use client";
// Daftar alarm terpasang (bawaan + buatan pengguna) dengan toggle aktif.
import type { AlarmJaga } from "@/lib/jaga/bawaan";
import { ringkasAlarmJaga } from "@/lib/jaga/bawaan";
import { LABEL_BLOK_B, type BlokBKind } from "@/lib/jaga/blok-b";
import { LABEL_BLOK, type BlockKind } from "@/lib/engine/rules";
import { Istilah } from "@/components/panduan/Istilah";
import { ISTILAH_BLOK, ISTILAH_BLOK_B } from "@/components/panduan/kamus";

export interface AlarmTampil extends AlarmJaga {
  asal: "bawaan" | "lokal" | "server";
}

interface Props {
  alarms: AlarmTampil[];
  aktif: Set<string>;
  onToggle: (id: string, aktif: boolean) => void;
}

/** Ringkasan awam: tiap nama blok dibungkus tooltip kamus. */
function RingkasAwam({ a }: { a: AlarmJaga }) {
  if (a.kelas === "B") {
    return (
      <>
        {(a.blokB ?? []).map((k: BlokBKind, i) => (
          <span key={k}>
            {i > 0 ? " atau " : ""}
            <Istilah id={ISTILAH_BLOK_B[k]}>{LABEL_BLOK_B[k]}</Istilah>
          </span>
        ))}
      </>
    );
  }
  const r = a.rule;
  if (!r) return <>{ringkasAlarmJaga(a)}</>;
  const kata = r.combine === "any" ? " atau " : " dan ";
  return (
    <>
      {r.blocks.map((b, i) => (
        <span key={b.kind}>
          {i > 0 ? kata : ""}
          <Istilah id={ISTILAH_BLOK[b.kind as BlockKind]}>{LABEL_BLOK[b.kind as BlockKind]}</Istilah> ({b.threshold})
        </span>
      ))}
    </>
  );
}

const LABEL_ASAL: Record<AlarmTampil["asal"], string> = {
  bawaan: "Bawaan",
  lokal: "Buatanmu (browser ini)",
  server: "Buatanmu (tersimpan)",
};

export function KartuAlarm({ alarms, aktif, onToggle }: Props) {
  return (
    <ul className="flex list-none flex-col gap-2 p-0" aria-label="Alarm terpasang">
      {alarms.map((a) => {
        const on = aktif.has(a.id);
        return (
          <li
            key={`${a.asal}:${a.id}`}
            data-testid={`alarm-${a.id}`}
            data-aktif={on}
            className={`flex items-start gap-3 rounded-[10px] border border-line px-3 py-2.5 ${on ? "bg-surface" : "bg-surface-2 opacity-70"}`}
          >
            <span
              aria-hidden="true"
              className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg font-display text-lg font-extrabold ${on ? "bg-accent text-accent-ink" : "bg-line text-ink-3"}`}
            >
              !
            </span>
            <div className="min-w-0 flex-1">
              <b className="block text-[13.5px]">{a.name}</b>
              <div className="text-[11.5px] leading-snug text-ink-3">
                {LABEL_ASAL[a.asal]} · {a.kelas === "B" ? "data terkini · " : ""}
                <RingkasAwam a={a} />
              </div>
            </div>
            <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-[12px] font-semibold">
              <input
                type="checkbox"
                checked={on}
                onChange={(e) => onToggle(a.id, e.target.checked)}
                aria-label={`Aktifkan alarm ${a.name}`}
              />
              {on ? "Aktif" : "Mati"}
            </label>
          </li>
        );
      })}
    </ul>
  );
}
