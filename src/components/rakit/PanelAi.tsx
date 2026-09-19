"use client";
// Panel "Penjelasan AI" (kanan bawah): ringkasan diagnosis, emiten yang
// dibahas, tombol "+ Tambahkan blok" per usulan, dan trace tool-call
// bernomor. Bila kunci AI belum diisi (503) → banner sopan.
//
// Alasan usulan blok TIDAK PERNAH dikosongkan penjaga (tiket 15 putaran 5):
// versi lama menggantinya dengan "[kalimat saran dihapus]" dan penyerang
// membuktikan kedua alasan bisa hilang sekaligus — panel memasang dua tombol
// usulan blok tanpa satu pun alasan, yaitu justru nilai jual produk. Sekarang
// `usulanBlok[].perluTinjau` memasang tanda peringatan di atas alasannya dan
// teks aslinya tetap tampil supaya pengguna bisa menilainya sendiri.
import type { BlockKind, Threshold } from "@/lib/engine/rules";
import { fmtTanggal } from "@/lib/putar-ulang/ringkas";
import { labelAmbang, labelBlok } from "@/lib/rakit/blok";
import { PESAN_AI_NONAKTIF, type ResponDiagnosis } from "@/lib/rakit/api";

import { TEKS } from "./teks";

type LangkahJejak = ResponDiagnosis["trace"][number];

/** Nama alat agent dalam kalimat biasa, untuk jejak yang dibaca pengguna awam. */
const LABEL_ALAT: Record<string, (i: Record<string, unknown>) => string> = {
  listMissed: () => "Mencari saham yang terlewat",
  getSuspensions: (i) => `Memeriksa suspensi ${String(i.symbol ?? "")}`,
  getReportDates: (i) => `Memeriksa laporan kuartal ${String(i.symbol ?? "")}`,
  getFilings: (i) => `Memeriksa filing orang dalam ${String(i.symbol ?? "")}`,
  getCorporateActions: (i) => `Memeriksa aksi korporasi ${String(i.symbol ?? "")}`,
  getFinancials: (i) => `Memeriksa ekuitas ${String(i.symbol ?? "")}`,
  runAlarmOn: (i) => `Menguji alarm pada ${String(i.symbol ?? "")} per ${tanggalAwam(i.t)}`,
};

function tanggalAwam(x: unknown): string {
  return typeof x === "string" && /^\d{4}-\d{2}-\d{2}/.test(x) ? fmtTanggal(x) : String(x ?? "");
}

export function labelLangkah(t: LangkahJejak): string {
  const f = LABEL_ALAT[t.tool];
  const input = t.input && typeof t.input === "object" ? (t.input as Record<string, unknown>) : {};
  // Alat yang belum punya label ditulis umum; nama mesinnya tidak ditampilkan.
  return f ? f(input).trim() : "Memeriksa data";
}

/**
 * Satu baris jejak untuk pengguna: tindakan AI lalu hasilnya, dua-duanya dalam
 * kalimat biasa. `ringkasanHasil` (data untuk model: nama mesin blok, tanggal
 * ISO, galat mentah) sengaja tidak ditampilkan; aturan 8 DESIGN.md.
 */
function BarisJejak({ t }: { t: LangkahJejak }) {
  return (
    <>
      <span className="font-semibold text-ink">{labelLangkah(t)}.</span>
      {t.ringkasanAwam ? <> {t.ringkasanAwam}</> : null}
    </>
  );
}

interface Props {
  aiNonaktif: boolean;
  diagnosis: ResponDiagnosis | null;
  sedang: boolean;
  /**
   * Langkah agent yang sudah selesai, diterima satu per satu selagi diagnosis
   * berjalan (tiket 22). Kosong sebelum langkah pertama tiba.
   */
  langkahLangsung: LangkahJejak[];
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
      <h3 id="judul-ai" className="mb-1 text-[12px] font-bold text-accent">
        {TEKS.aiJudul}
      </h3>

      {p.aiNonaktif ? (
        <BannerAiNonaktif testid="banner-ai-diagnosis" />
      ) : p.sedang ? (
        // Tiket 22: dulu hanya satu kalimat ini selama 60-240 detik. Sekarang
        // setiap alat yang dipanggil agent muncul begitu selesai, sehingga
        // terlihat bahwa agent sedang bekerja dan apa yang sedang ia periksa.
        <div role="status" data-testid="ai-sedang">
          <p className="m-0">{TEKS.aiMemeriksa}</p>
          {p.langkahLangsung.length > 0 ? (
            <ol className="mb-0 mt-1.5 list-decimal pl-5 text-xs text-ink-2" aria-label="Langkah AI sejauh ini" data-testid="langkah-langsung">
              {p.langkahLangsung.map((t, i) => (
                <li key={`${t.step}-${i}`} className="mt-0.5">
                  <BarisJejak t={t} />
                </li>
              ))}
            </ol>
          ) : null}
        </div>
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
            <p className="text-xs text-warn" data-testid="tinjau-diagnosis">
              Penjaga menemukan frasa yang menyerupai saran investasi
              {d.kataDisensor.length > 0 ? ` (${d.kataDisensor.join(", ")})` : ""}. Frasa pada ringkasan disamarkan; alasan
              usulan blok dibiarkan utuh tetapi ditandai supaya bisa kamu nilai sendiri. Alarm Saham hanya alat informasi
              dan analisis.
            </p>
          ) : null}
          {d.emitenDibahas.length > 0 ? (
            <ul className="list-none p-0" aria-label="Emiten yang dibahas">
              {d.emitenDibahas.map((e) => (
                <li key={e.symbol} className="mt-1">
                  <b className="font-mono font-medium">{e.symbol}</b>: {e.sebab}
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
                  {u.perluTinjau ? (
                    // Alasannya TIDAK digunting: usulan blok tanpa alasan menghapus
                    // justru inti fitur. Yang dipasang di sini tanda peringatan.
                    <span
                      className="block text-[11.5px] font-semibold text-warn"
                      data-testid={`tinjau-usulan-${u.kind}`}
                    >
                      ⚠ Alasan ini perlu kamu nilai sendiri: ada frasa yang menyerupai saran investasi.
                    </span>
                  ) : null}
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
                {d.trace.map((t, i) => (
                  // Kunci gabungan: beberapa alat bisa dipanggil di langkah yang
                  // sama, jadi `t.step` saja bentrok.
                  <li key={`${t.step}-${i}`} className="mt-0.5">
                    <BarisJejak t={t} />
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
