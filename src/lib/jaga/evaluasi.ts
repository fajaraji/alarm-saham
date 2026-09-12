// Mode jaga (tiket 11): evaluasi satu portofolio pada tanggal `today`.
//
// Kelas A: `fires()` di atas EventSource (DB/PGlite/fixture) — nol panggilan API.
// Kelas B: data terkini dari provider Sectors dengan cache 24 jam (panggilan
// kedua dalam sehari = 0 kredit) dan tunduk cadangan kredit (CreditReserveError
// → blok "dilewati: cadangan kredit"). Saham yang suspensinya masih aktif di
// data kami TIDAK dipanggil ke kelas B (broker kosong/404 tetap ditagih).
//
// Status: hijau = tidak ada blok terpenuhi; kuning = 1 blok; merah = >= 2 blok
// atau suspensi aktif.
import { catatanTidakAdaData } from "../cakupan";
import { CreditReserveError, NotFoundError, SectorsApiError, type DataProvider } from "../data/provider";
import type { Broker, FreeFloatEntry } from "../data/types";
import type { PenyimpanLedger } from "../data/ledger";
import { hariIni, tambahBulan } from "../engine/dates";
import { fires } from "../engine/evaluate";
import type { EmitenEvents, EventSource, UniverseEntry } from "../engine/events";
import { LABEL_BLOK, type BlockKind, type Threshold } from "../engine/rules";
import type { AlarmJaga } from "./bawaan";
import {
  BLOK_B_KINDS,
  jendelaKelasB,
  LABEL_BLOK_B,
  nilaiFreeFloat,
  nilaiJatuhDariPuncak,
  nilaiRitelDominan,
  petaCohort,
  SUMBER_BLOK_B,
  type BlokBKind,
  type HasilBlokB,
} from "./blok-b";

export type StatusSaham = "hijau" | "kuning" | "merah";

/** Endpoint Sectors di balik tiap blok kelas A (data sudah di DB kami). */
export const SUMBER_BLOK_A: Record<BlockKind, string> = {
  suspensi: "Sectors /v2/suspensions/ (feed BEI, di DB kami)",
  laporan_hilang: "Sectors /v2/company/get_quarterly_financial_dates/ (di DB kami)",
  aksi_dilutif: "Sectors /v2/company/corporate-actions/ (di DB kami)",
  ekuitas_negatif: "Sectors /v2/financials/quarterly/ (di DB kami)",
  insider_jual: "Sectors /v2/filings/ (di DB kami)",
};

/**
 * Label sumber satu blok kelas A. Pada jalur fixture (server tanpa DATABASE_URL
 * dan tanpa ./.pglite) angkanya ILUSTRATIF, jadi ia TIDAK boleh diatribusikan ke
 * endpoint Sectors — pesan penjelasan ikut dikirim ke kotak masuk & Telegram.
 */
export function sumberBlokA(kind: BlockKind, contoh = false): string {
  return contoh
    ? `data contoh: fixture universe-kecil.json (bentuknya meniru ${SUMBER_BLOK_A[kind].replace(/^Sectors /, "").replace(/ \(.*\)$/, "")})`
    : SUMBER_BLOK_A[kind];
}

export interface AlasanJaga {
  kind: BlockKind | BlokBKind;
  kelas: "A" | "B";
  label: string;
  threshold?: Threshold;
  detail: string;
  tanggal: string | null;
  sumber: string;
  /** Alarm yang memuat blok ini dan berbunyi. */
  alarm: { id: string; name: string }[];
}

export interface KelasBSaham {
  status: "dijalankan" | "dilewati" | "nonaktif";
  keterangan: string;
  blok: HasilBlokB[];
}

export interface HasilSaham {
  symbol: string;
  status: StatusSaham;
  /** Ada baris apa pun untuk simbol ini di data kami (DB/fixture). */
  adaData: boolean;
  /** Tanggal suspensi yang masih aktif menurut data kami; null bila tidak ada. */
  suspensiAktif: string | null;
  alasan: AlasanJaga[];
  alarmBerbunyi: { id: string; name: string }[];
  kelasB: KelasBSaham;
  catatan: string[];
}

export interface HasilPortofolio {
  today: string;
  sumber: string;
  saham: HasilSaham[];
  /** Kredit Sectors yang benar-benar ditagih selama pengecekan ini (dari ledger). */
  kreditTerpakai: number;
  panggilanApi: number;
  cacheHit: number;
}

/** Bagian provider yang dibutuhkan kelas B (Sectors nyata atau fixture di tes). */
export type PenyediaKelasB = Pick<DataProvider, "brokerSummary" | "freeFloat" | "daily" | "brokers"> & {
  ledger?: PenyimpanLedger;
};

export interface OpsiCek {
  kelasB: boolean;
  /** Batasi blok kelas B yang dijalankan (default: semua blok dari alarm kelas B aktif). */
  blokB?: BlokBKind[];
  today?: string;
  source: EventSource;
  /** Untuk menandai suspensi aktif (delisting/watchlist) — opsional. */
  universe?: UniverseEntry[];
  provider?: PenyediaKelasB | null;
  /** Keterangan sumber kelas A untuk laporan. */
  keteranganSumber?: string;
  /** true bila sumber kelas A adalah fixture contoh (bukan data Sectors). */
  sumberContoh?: boolean;
}

export interface InputCek {
  symbols: string[];
  alarms: AlarmJaga[];
  opts: OpsiCek;
}

const POLA_TANGGAL = /\d{4}-\d{2}-\d{2}/;

function adaData(e: EmitenEvents): boolean {
  return (
    e.suspensions.length + e.quarters.length + e.rightIssues.length + e.financials.length + e.filings.length > 0
  );
}

/**
 * Suspensi yang masih aktif pada `today` menurut data kami (feed tidak memuat
 * tanggal pencabutan): (a) suspensi dalam 12 bulan terakhir, atau (b) emiten
 * delisting/watchlist yang suspensi terakhirnya >= tanggal kejadian target.
 */
export function suspensiAktif(e: EmitenEvents, today: string, u?: UniverseEntry): string | null {
  const s = e.suspensions.filter((x) => x.date <= today);
  if (s.length === 0) return null;
  const terakhir = s[s.length - 1].date;
  if (terakhir > tambahBulan(today, -12)) return terakhir;
  if (u && (u.group === "delisting" || u.group === "watchlist") && u.targetEventDate && terakhir >= u.targetEventDate) {
    return terakhir;
  }
  return null;
}

export function statusDari(jumlahBlok: number, suspensi: string | null): StatusSaham {
  if (suspensi) return "merah";
  if (jumlahBlok >= 2) return "merah";
  if (jumlahBlok === 1) return "kuning";
  return "hijau";
}

interface CacheKelasB {
  brokers?: Promise<Broker[]>;
  freeFloat?: Promise<FreeFloatEntry[]>;
}

function pesanGalat(err: unknown): string {
  if (err instanceof CreditReserveError) return "dilewati: cadangan kredit";
  if (err instanceof NotFoundError) return "tidak ada data di Sectors (404)";
  if (err instanceof SectorsApiError) return `gagal: Sectors HTTP ${err.status}`;
  // Pesan mentah TIDAK diteruskan ke klien: galat sistem berkas di serverless
  // memuat jalur absolut server (mis. "EROFS ... '/var/task/.cache/sectors'")
  // dan detail itu dirender apa adanya di UI.
  console.error("[jaga] blok kelas B gagal:", err);
  return "gagal: kesalahan tak terduga di server";
}

async function jalankanKelasB(
  symbol: string,
  blok: BlokBKind[],
  today: string,
  provider: PenyediaKelasB,
  memo: CacheKelasB,
): Promise<HasilBlokB[]> {
  const j = jendelaKelasB(today);
  const hasil: HasilBlokB[] = [];
  const gagal = (kind: BlokBKind, err: unknown): HasilBlokB => ({
    kind,
    terpenuhi: false,
    detail: pesanGalat(err),
    tanggal: null,
    sumber: SUMBER_BLOK_B[kind],
  });
  for (const kind of blok) {
    try {
      if (kind === "ritel_dominan") {
        memo.brokers ??= provider.brokers();
        const [registry, ringkas] = await Promise.all([
          memo.brokers,
          provider.brokerSummary(symbol, j.brokerStart, j.brokerEnd),
        ]);
        hasil.push(nilaiRitelDominan(ringkas, petaCohort(registry)));
      } else if (kind === "free_float_kecil") {
        memo.freeFloat ??= provider.freeFloat();
        const daftar = await memo.freeFloat;
        hasil.push(nilaiFreeFloat(daftar.find((f) => f.symbol === symbol), j.dailyEnd));
      } else {
        const bars = await provider.daily(symbol, j.dailyStart, j.dailyEnd);
        hasil.push(nilaiJatuhDariPuncak(bars));
      }
    } catch (err) {
      // Batalkan memo yang gagal agar simbol berikutnya tidak mewarisi penolakan lama.
      if (kind === "ritel_dominan") memo.brokers = undefined;
      if (kind === "free_float_kecil") memo.freeFloat = undefined;
      hasil.push(gagal(kind, err));
    }
  }
  return hasil;
}

export async function cekPortofolio({ symbols, alarms, opts }: InputCek): Promise<HasilPortofolio> {
  const today = opts.today ?? hariIni();
  const contoh = opts.sumberContoh === true;
  const daftar = [...new Set(symbols.map((s) => s.trim().toUpperCase()))];
  const alarmA = alarms.filter((a) => a.kelas === "A" && a.rule);
  const alarmB = alarms.filter((a) => a.kelas === "B" && a.blokB?.length);
  const blokBAktif: BlokBKind[] = (
    opts.blokB ?? [...new Set(alarmB.flatMap((a) => a.blokB ?? []))]
  ).filter((k) => BLOK_B_KINDS.includes(k));
  const universe = new Map((opts.universe ?? []).map((u) => [u.symbol, u]));
  const ledger = opts.provider?.ledger;
  const barisSebelum = ledger ? (await ledger.semua()).length : 0;
  const memo: CacheKelasB = {};
  const saham: HasilSaham[] = [];

  for (const symbol of daftar) {
    const events = await opts.source.events(symbol);
    const u = universe.get(symbol);
    const suspensi = suspensiAktif(events, today, u);
    const perKind = new Map<string, AlasanJaga>();
    const alarmBerbunyi: { id: string; name: string }[] = [];
    const catatan: string[] = [];

    for (const a of alarmA) {
      const r = fires(a.rule!, events, today);
      if (r.fired) alarmBerbunyi.push({ id: a.id, name: a.name });
      for (const alasan of r.reasons) {
        const ada = perKind.get(alasan.kind);
        if (ada) {
          if (r.fired) ada.alarm.push({ id: a.id, name: a.name });
          continue;
        }
        perKind.set(alasan.kind, {
          kind: alasan.kind,
          kelas: "A",
          label: LABEL_BLOK[alasan.kind],
          threshold: alasan.threshold,
          detail: alasan.detail,
          tanggal: alasan.detail.match(POLA_TANGGAL)?.[0] ?? null,
          sumber: sumberBlokA(alasan.kind, contoh),
          alarm: r.fired ? [{ id: a.id, name: a.name }] : [],
        });
      }
    }
    if (suspensi && !perKind.has("suspensi")) {
      perKind.set("suspensi", {
        kind: "suspensi",
        kelas: "A",
        label: LABEL_BLOK.suspensi,
        detail: `suspensi ${suspensi} masih aktif menurut data kami (feed tidak memuat tanggal pencabutan)`,
        tanggal: suspensi,
        sumber: sumberBlokA("suspensi", contoh),
        alarm: [],
      });
    }

    let kelasB: KelasBSaham;
    if (!opts.kelasB) {
      kelasB = { status: "nonaktif", keterangan: "data terkini tidak disertakan", blok: [] };
    } else if (blokBAktif.length === 0) {
      kelasB = { status: "nonaktif", keterangan: "tidak ada alarm kelas B yang aktif", blok: [] };
    } else if (!opts.provider) {
      kelasB = {
        status: "dilewati",
        keterangan: "dilewati: server ini tidak menyediakan data terkini (butuh kunci Sectors dan database buku kredit)",
        blok: [],
      };
    } else if (suspensi) {
      kelasB = {
        status: "dilewati",
        keterangan: `dilewati: saham tersuspensi sejak ${suspensi} (Sectors mengembalikan data broker kosong/404 dan tetap menagih kredit)`,
        blok: [],
      };
    } else {
      const blok = await jalankanKelasB(symbol, blokBAktif, today, opts.provider, memo);
      const dilewati = blok.filter((b) => b.detail.startsWith("dilewati:"));
      kelasB = {
        status: "dijalankan",
        keterangan:
          dilewati.length === blok.length
            ? dilewati[0].detail
            : `${blok.filter((b) => b.terpenuhi).length} dari ${blok.length} blok data terkini terpenuhi`,
        blok,
      };
      for (const b of blok) {
        if (!b.terpenuhi) continue;
        const pemilik = alarmB.filter((a) => a.blokB?.includes(b.kind)).map((a) => ({ id: a.id, name: a.name }));
        for (const p of pemilik) if (!alarmBerbunyi.some((x) => x.id === p.id)) alarmBerbunyi.push(p);
        perKind.set(b.kind, {
          kind: b.kind,
          kelas: "B",
          label: LABEL_BLOK_B[b.kind],
          detail: b.detail,
          tanggal: b.tanggal,
          sumber: b.sumber,
          alarm: pemilik,
        });
      }
    }

    if (!adaData(events)) {
      // Cakupan mengikuti sumber yang benar-benar dipakai. Kalimat ini muncul di
      // panel pesan /pasang; sebelumnya ia menjanjikan universe nyata walau
      // server sedang berjalan di jalur data contoh.
      catatan.push(catatanTidakAdaData(symbol, { jumlah: universe.size, contoh }));
    }
    const alasan = [...perKind.values()];
    saham.push({
      symbol,
      status: statusDari(alasan.length, suspensi),
      adaData: adaData(events),
      suspensiAktif: suspensi,
      alasan,
      alarmBerbunyi,
      kelasB,
      catatan,
    });
  }

  let kreditTerpakai = 0;
  let panggilanApi = 0;
  let cacheHit = 0;
  if (ledger) {
    const baru = (await ledger.semua()).slice(barisSebelum);
    for (const b of baru) {
      kreditTerpakai += Number.isFinite(b.credits) ? b.credits : 0;
      if (b.cacheHit) cacheHit += 1;
      else panggilanApi += 1;
    }
  }

  return {
    today,
    sumber: opts.keteranganSumber ?? opts.source.name,
    saham,
    kreditTerpakai,
    panggilanApi,
    cacheHit,
  };
}
