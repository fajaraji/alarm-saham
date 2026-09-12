"use client";
// Layar "Rakit alarm" (tiket 09): mengikat palet, papan, hasil uji, panel AI,
// dan penyimpanan. State aturan hidup di `reducerPapan` (selalu valid
// RuleSchema); komponen ini hanya memanggil API dan mengatur alur.
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useCallback, useEffect, useId, useReducer, useRef, useState } from "react";

import type { BlockKind, Rule, Threshold } from "@/lib/engine/rules";
import { ringkasAturan } from "@/lib/engine/rules";
import {
  aiNonaktif as cekAiNonaktif,
  KODE_DB_NONAKTIF,
  mintaAiRakit,
  mintaDiagnosis,
  PESAN_AI_NONAKTIF,
  simpanAlarmKeServer,
  ujiKeMasaLalu,
  type ResponBacktest,
  type ResponDiagnosis,
} from "@/lib/rakit/api";
import { INFO_BLOK, labelBlok } from "@/lib/rakit/blok";
import { adaBlok, keRule, PAPAN_AWAL, reducerPapan, ringkasAwam, type PapanState } from "@/lib/rakit/reducer";
import { buatId, simpanAlarmLokal, tokenPemilik } from "@/lib/rakit/simpan";

import { deteksiTabrakan, ID_BUANG, ID_PAPAN, instruksiPembacaLayar, isBlockKind, pengumuman, type DataSeret } from "./dnd";
import { HasilUji } from "./HasilUji";
import { Palet } from "./Palet";
import { PanelAi } from "./PanelAi";
import { Papan } from "./Papan";
import { SensorPenunjuk } from "./sensor";
import { TEKS } from "./teks";

/** Jeda antar blok saat AI "memasukkan" aturan ke papan (ms). */
export const JEDA_ANIMASI_MS = 320;

const tunda = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function tandaState(s: PapanState): string {
  const rule = keRule(s);
  return rule ? ringkasAturan(rule) : "";
}

type CatatanRakit = { jenis: "info" | "galat" | "ai-nonaktif"; teks: string } | null;

interface HasilTersimpan extends ResponBacktest {
  /** Tanda aturan yang diuji; hasil dianggap basi bila papan berubah. */
  tanda: string;
}

export function PapanRakit() {
  const dndId = useId();
  const [state, dispatch] = useReducer(reducerPapan, PAPAN_AWAL);
  const [blokBaru, setBlokBaru] = useState<BlockKind | null>(null);
  const [seret, setSeret] = useState<DataSeret | null>(null);

  const [kalimat, setKalimat] = useState("");
  const [sedangRakit, setSedangRakit] = useState(false);
  const [catatanRakit, setCatatanRakit] = useState<CatatanRakit>(null);

  const [hasil, setHasil] = useState<HasilTersimpan | null>(null);
  const [sedangUji, setSedangUji] = useState(false);
  const [galatUji, setGalatUji] = useState<string | null>(null);

  const [aiNonaktif, setAiNonaktif] = useState(false);
  const [diagnosis, setDiagnosis] = useState<ResponDiagnosis | null>(null);
  const [sedangDiagnosis, setSedangDiagnosis] = useState(false);
  const [galatDiagnosis, setGalatDiagnosis] = useState<string | null>(null);

  const [sedangSimpan, setSedangSimpan] = useState(false);
  const [catatanSimpan, setCatatanSimpan] = useState<string | null>(null);

  // Nomor permintaan agar jawaban lama tidak menimpa yang baru.
  const noUji = useRef(0);
  const noDiagnosis = useRef(0);
  const hidup = useRef(true);
  useEffect(() => {
    hidup.current = true;
    return () => {
      hidup.current = false;
    };
  }, []);

  const tandaSekarang = tandaState(state);
  const basi = hasil !== null && hasil.tanda !== tandaSekarang;

  const sensors = useSensors(
    // SensorPenunjuk, bukan PointerSensor bawaan: sesudah seret, dnd-kit
    // meredam SEMUA klik di halaman selama 50 ms. Lihat ./sensor.ts.
    useSensor(SensorPenunjuk, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const tandaiBaru = useCallback((kind: BlockKind) => {
    setBlokBaru(kind);
    setTimeout(() => {
      if (hidup.current) setBlokBaru((k) => (k === kind ? null : k));
    }, 400);
  }, []);

  const tambah = useCallback(
    (kind: BlockKind, threshold?: Threshold, di?: number) => {
      dispatch({ tipe: "tambah", kind, threshold, di });
      tandaiBaru(kind);
      setCatatanSimpan(null);
    },
    [tandaiBaru],
  );

  // ----- drag & drop -----------------------------------------------------
  function onDragStart(e: DragStartEvent) {
    setSeret((e.active.data.current as DataSeret | undefined) ?? null);
  }
  function onDragEnd({ active, over }: DragEndEvent) {
    setSeret(null);
    const data = active.data.current as DataSeret | undefined;
    if (!data || !over) return;
    if (data.asal === "palet") {
      if (over.id === ID_PAPAN) tambah(data.kind);
      else if (isBlockKind(over.id)) tambah(data.kind, undefined, state.blocks.findIndex((b) => b.kind === over.id));
      return;
    }
    if (over.id === ID_BUANG) {
      dispatch({ tipe: "hapus", kind: data.kind });
      return;
    }
    if (isBlockKind(over.id) && over.id !== data.kind) {
      dispatch({ tipe: "pindah", dari: data.kind, ke: over.id });
    }
  }

  // ----- uji ke masa lalu ------------------------------------------------
  const jalankanDiagnosis = useCallback(
    async (rule: Rule, backtest: ResponBacktest) => {
      const no = ++noDiagnosis.current;
      setSedangDiagnosis(true);
      setGalatDiagnosis(null);
      const r = await mintaDiagnosis(rule, backtest.hasil);
      if (!hidup.current || no !== noDiagnosis.current) return;
      setSedangDiagnosis(false);
      if (r.ok) {
        setDiagnosis(r.data);
        return;
      }
      if (cekAiNonaktif(r.galat)) {
        setAiNonaktif(true);
        return;
      }
      setGalatDiagnosis(`AI belum bisa menjelaskan: ${r.galat.pesan}`);
    },
    [],
  );

  const uji = useCallback(
    async (s: PapanState = state) => {
      const rule = keRule(s);
      if (!rule) {
        setGalatUji(TEKS.papanKosongUji);
        return;
      }
      const no = ++noUji.current;
      setSedangUji(true);
      setGalatUji(null);
      setDiagnosis(null);
      setGalatDiagnosis(null);
      const r = await ujiKeMasaLalu(rule);
      if (!hidup.current || no !== noUji.current) return;
      setSedangUji(false);
      if (!r.ok) {
        setGalatUji(`Uji ke masa lalu gagal: ${r.galat.pesan}`);
        return;
      }
      const tersimpan: HasilTersimpan = { ...r.data, tanda: ringkasAturan(rule) };
      setHasil(tersimpan);
      // Diagnosis TIDAK dipanggil di sini. Dulu baris ini berbunyi
      // `if (!aiNonaktif) void jalankanDiagnosis(rule, tersimpan)`, dan selama
      // pengembangan efeknya tidak pernah terlihat karena server e2e lokal dan
      // CI sengaja berjalan tanpa kunci AI — panel selalu berhenti di banner
      // 503. Di produksi (kunci terpasang) jalur itu hidup, dan konsekuensinya
      // diukur: tiap klik "Uji ke masa lalu" membakar ~55-66 ribu token dan
      // menahan panel 50-240 detik. Yang menentukan keputusannya bukan biaya
      // itu, melainkan bahwa kegagalan gateway ("Layanan sedang penuh", yang
      // memang pernah terjadi) lalu memunculkan galat AI pada SETIAP uji ke
      // masa lalu — padahal backtest-nya sendiri sukses dalam 2 detik.
      // Sekarang hasil uji berdiri sendiri dan AI adalah tindakan sadar lewat
      // tombol "Minta diagnosis AI" (PanelAi → onMintaDiagnosis).
    },
    [state],
  );

  // ----- AI merakit ------------------------------------------------------
  async function mintaRakit() {
    const teks = kalimat.trim();
    if (teks.length < 3) return;
    setSedangRakit(true);
    setCatatanRakit({ jenis: "info", teks: TEKS.aiMerakit });
    const r = await mintaAiRakit(teks);
    if (!hidup.current) return;
    if (!r.ok) {
      setSedangRakit(false);
      if (cekAiNonaktif(r.galat)) {
        setAiNonaktif(true);
        setCatatanRakit({ jenis: "ai-nonaktif", teks: PESAN_AI_NONAKTIF });
      } else {
        setCatatanRakit({ jenis: "galat", teks: `AI belum bisa merakit: ${r.galat.pesan}` });
      }
      return;
    }
    if (r.data.ditolak) {
      setSedangRakit(false);
      setCatatanRakit({ jenis: "galat", teks: r.data.pesan });
      return;
    }
    await masukkanBertahap(r.data.rule);
    if (!hidup.current) return;
    setSedangRakit(false);
    setCatatanRakit({ jenis: "info", teks: `${r.data.alasan} Blok sudah jadi — sekarang klik “${TEKS.tombolUji}”.` });
  }

  /** Kosongkan papan lalu masukkan blok satu per satu (animasi masuk). */
  async function masukkanBertahap(rule: Rule) {
    dispatch({ tipe: "kosongkan" });
    dispatch({ tipe: "setCombine", combine: rule.combine });
    dispatch({ tipe: "setNama", name: rule.name });
    for (const b of rule.blocks) {
      await tunda(JEDA_ANIMASI_MS);
      if (!hidup.current) return;
      tambah(b.kind, b.threshold);
    }
  }

  // ----- usulan AI → ubah papan → uji ulang -------------------------------
  function tambahUsulan(kind: BlockKind, threshold: Threshold) {
    const aksi = adaBlok(state, kind)
      ? ({ tipe: "setAmbang", kind, threshold } as const)
      : ({ tipe: "tambah", kind, threshold } as const);
    const berikut = reducerPapan(state, aksi);
    dispatch(aksi);
    tandaiBaru(kind);
    void uji(berikut);
  }

  // ----- simpan ----------------------------------------------------------
  async function simpan() {
    const rule = keRule(state);
    if (!rule) return;
    setSedangSimpan(true);
    setCatatanSimpan(null);
    const token = tokenPemilik() ?? buatId();
    const skor =
      hasil && !basi
        ? {
            hits: hasil.hasil.hits,
            total: hasil.hasil.total,
            falseAlarms: hasil.hasil.falseAlarms,
            controls: hasil.hasil.controls,
            leadMonthsAvg: hasil.hasil.leadMonthsAvg,
            sumber: hasil.sumber,
            today: hasil.hasil.today,
          }
        : null;
    const r = await simpanAlarmKeServer({ owner_token: token, name: rule.name, rules: [rule], last_score: skor });
    if (!hidup.current) return;
    const diDb = r.ok;
    if (!r.ok && !(r.galat.status === 503 && r.galat.kode === KODE_DB_NONAKTIF) && r.galat.status !== 0) {
      setSedangSimpan(false);
      setCatatanSimpan(`Gagal menyimpan ke server: ${r.galat.pesan}`);
      return;
    }
    simpanAlarmLokal({
      id: r.ok ? r.data.id : buatId(),
      name: rule.name,
      rule,
      lastScore: skor,
      disimpanPada: new Date().toISOString(),
      di: diDb ? "db" : "lokal",
    });
    setSedangSimpan(false);
    setCatatanSimpan(
      diDb
        ? `Alarm “${rule.name}” tersimpan di server dan di browser ini (tautan rahasiamu tersimpan otomatis).`
        : `Alarm “${rule.name}” tersimpan di browser ini. Server belum punya database, jadi belum bisa dibagikan lewat tautan.`,
    );
  }

  const ringkasan = ringkasAwam(state, labelBlok);

  return (
    <DndContext
      id={dndId}
      sensors={sensors}
      collisionDetection={deteksiTabrakan}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setSeret(null)}
      accessibility={{ announcements: pengumuman, screenReaderInstructions: instruksiPembacaLayar }}
    >
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-[260px_1fr_1fr]">
        <div className="md:col-span-2 lg:col-span-1">
          <Palet adaDiPapan={(k) => adaBlok(state, k)} onTambah={(k) => tambah(k)} />
        </div>
        <Papan
          state={state}
          blokBaru={blokBaru}
          sedangUji={sedangUji}
          sedangRakit={sedangRakit}
          sedangSimpan={sedangSimpan}
          bisaSimpan={state.blocks.length > 0}
          kalimat={kalimat}
          catatanRakit={catatanRakit}
          catatanSimpan={catatanSimpan}
          onKalimat={setKalimat}
          onMintaAi={() => void mintaRakit()}
          onToggleCombine={() => dispatch({ tipe: "toggleCombine" })}
          onToggleAmbang={(kind) => dispatch({ tipe: "toggleAmbang", kind })}
          onHapus={(kind) => dispatch({ tipe: "hapus", kind })}
          onNama={(name) => dispatch({ tipe: "setNama", name })}
          onUji={() => void uji()}
          onKosongkan={() => {
            dispatch({ tipe: "kosongkan" });
            setGalatUji(null);
          }}
          onSimpan={() => void simpan()}
        />
        <div className="rounded-[14px] border border-line bg-surface p-3.5">
          {ringkasan ? (
            <p className="sr-only" data-testid="ringkasan-aturan">
              Aturan saat ini: {ringkasan}
            </p>
          ) : null}
          <HasilUji hasil={hasil} basi={basi} sedangUji={sedangUji} galat={galatUji} />
          <PanelAi
            aiNonaktif={aiNonaktif}
            diagnosis={diagnosis}
            sedang={sedangDiagnosis}
            galat={galatDiagnosis}
            adaHasil={hasil !== null && !basi}
            onMintaDiagnosis={() => {
              const rule = keRule(state);
              if (rule && hasil) void jalankanDiagnosis(rule, hasil);
            }}
            onTambahUsulan={tambahUsulan}
          />
        </div>
      </div>
      <DragOverlay dropAnimation={null}>
        {seret ? (
          <div className="flex items-center gap-2 rounded-lg bg-b-cond px-3 py-2 text-[13px] font-semibold text-b-text shadow-panel">
            <span aria-hidden="true" className="font-mono tracking-[-2px] opacity-60">
              ⋮⋮
            </span>
            {INFO_BLOK[seret.kind].label}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
