"use client";
// Panel "Penjelasan AI" (kanan bawah): ringkasan diagnosis, emiten yang
// dibahas, tombol "+ Tambahkan blok" per usulan, dan trace tool-call
// bernomor. Bila kunci AI belum diisi (503) → banner sopan.
import type { BlockKind, Threshold } from "@/lib/engine/rules";
import { labelAmbang, labelBlok } from "@/lib/rakit/blok";
import { PESAN_AI_NONAKTIF, type ResponDiagnosis } from "@/lib/rakit/api";

import { TEKS } from "./teks";

interface Props {
  aiNonaktif: boolean;
  diagnosis: ResponDiagnosis | null;
  sedang: boolean;
  galat: string | null;
  adaHasil: boolean;
  onMintaDiagnosis: () => void;
  onTambahUsulan: (kind: BlockKind, threshold: Threshold) => void;
}

export function BannerAiNonaktif({ testid }: { testid: string }) {
  return (
    <p
      role="status"
      data-testid={testid}
      className="rounded-lg border-l-[3px] border-warn bg-warn-soft px-3 py-2 text-[13px] text-ink"
    >
      {PESAN_AI_NONAKTIF}
    </p>
  );
}

export function PanelAi(p: Props) {
  const d = p.diagnosis;
  return (
    <section
      aria-labelledby="judul-ai"
      aria-busy={p.sedang}
      data-testid="panel-ai"
      className="mt-3 rounded-r-[10px] border-l-[3px] border-accent bg-surface-2 px-3.5 py-2.5 text-[13px]"
    >
      <h3 id="judul-ai" className="mb-1 text-[11px] font-bold uppercase tracking-wider text-accent">
        {TEKS.aiJudul}
      </h3>

      {p.aiNonaktif ? (
        <BannerAiNonaktif testid="banner-ai-diagnosis" />
      ) : p.sedang ? (
        <p role="status">{TEKS.aiMemeriksa}</p>
      ) : p.galat ? (
        <p role="alert" className="rounded-lg border-l-[3px] border-crit bg-crit-soft px-3 py-2">
          {p.galat}
        </p>
      ) : !d ? (
        <p className="text-ink-2">{p.adaHasil ? "Klik “Minta diagnosis AI” untuk tahu di mana alarmmu bolong." : TEKS.aiBelum}</p>
      ) : (
        <div className="flex flex-col gap-2">
          <p>{d.ringkasan}</p>
          {d.perluTinjau ? (
            <p className="text-xs text-warn">
              Sebagian kata pada jawaban disamarkan karena menyerupai saran investasi. Alarm Saham hanya alat informasi.
            </p>
          ) : null}
          {d.emitenDibahas.length > 0 ? (
            <ul className="list-none p-0" aria-label="Emiten yang dibahas">
              {d.emitenDibahas.map((e) => (
                <li key={e.symbol} className="mt-1">
                  <b className="font-mono font-medium">{e.symbol}</b> — {e.sebab}
                  {e.buktiTanggal.length > 0 ? (
                    <span className="font-mono text-[11.5px] text-ink-3"> ({e.buktiTanggal.join(", ")})</span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
          {d.usulanBlok.length > 0 ? (
            <div className="flex flex-wrap gap-2" aria-label="Usulan blok dari AI">
              {d.usulanBlok.map((u) => (
                <button
                  key={`${u.kind}-${u.threshold}`}
                  type="button"
                  onClick={() => p.onTambahUsulan(u.kind, u.threshold)}
                  title={u.alasan}
                  data-testid={`usulan-${u.kind}`}
                  className="rounded-lg border border-line-strong bg-surface px-3 py-1.5 text-left font-semibold text-ink hover:border-accent"
                >
                  + Tambahkan blok “{labelBlok(u.kind)}” ({labelAmbang(u.kind, u.threshold)})
                  <span className="block text-[11.5px] font-normal text-ink-2">{u.alasan}</span>
                </button>
              ))}
            </div>
          ) : null}
          {d.trace.length > 0 ? (
            <details className="mt-1">
              <summary className="cursor-pointer text-xs font-semibold text-ink-2">
                Jejak pemeriksaan AI ({d.trace.length} langkah)
              </summary>
              <ol className="mt-1 list-decimal pl-5 text-xs text-ink-2" aria-label="Jejak pemeriksaan AI">
                {d.trace.map((t) => (
                  <li key={t.step} className="mt-0.5">
                    <span className="font-mono">{t.tool}</span>
                    {t.input && typeof t.input === "object" && Object.keys(t.input as object).length > 0 ? (
                      <span className="font-mono text-ink-3"> {JSON.stringify(t.input)}</span>
                    ) : null}
                    {" — "}
                    {t.ringkasanHasil}
                  </li>
                ))}
              </ol>
            </details>
          ) : null}
        </div>
      )}

      {!p.aiNonaktif && p.adaHasil && !p.sedang ? (
        <button
          type="button"
          onClick={p.onMintaDiagnosis}
          className="mt-2 rounded-lg border border-line-strong bg-surface px-3 py-1.5 text-xs font-semibold text-ink hover:border-accent"
        >
          {d ? "Minta diagnosis ulang" : "Minta diagnosis AI"}
        </button>
      ) : null}
    </section>
  );
}
