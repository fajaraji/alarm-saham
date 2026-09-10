"use client";
// Layar "Pasang" (tiket 11): portofolio per tautan rahasia (token pemilik di
// localStorage → header x-owner-token), daftar alarm dengan toggle, "Cek
// sekarang" (kelas A, nol kredit) + opsi data terkini (kelas B, kredit Sectors),
// peta portofolio berwarna, pesan penjelasan, dan kotak masuk.
//
// Penyimpanan: server (DB) bila /api/portofolio menjawab 200; bila 501, hanya
// localStorage. Salinan lokal selalu ditulis agar muat ulang tetap utuh.
import { useEffect, useRef, useState } from "react";

import { ALARM_BAWAAN, type AlarmKlien } from "@/lib/jaga/bawaan";
import type { BlokBKind } from "@/lib/jaga/blok-b";
import type { HasilPortofolio, HasilSaham } from "@/lib/jaga/evaluasi";
import {
  cekAdaData,
  cekPortofolioServer,
  daftarAlarmServer,
  KODE_TANPA_DB,
  muatKotakMasukServer,
  muatPortofolioServer,
  simpanPortofolioServer,
  tandaiKotakMasukServer,
  type ResponCek,
} from "@/lib/jaga/api";
import { RuleSchema } from "@/lib/engine/rules";
import {
  gabungKotakMasuk,
  hasilTerakhirLokal,
  kotakMasukLokal,
  portofolioLokal,
  simpanHasilTerakhir,
  simpanKotakMasuk,
  simpanPortofolioLokal,
  turunkanBendera,
  type PesanKotakMasuk,
} from "@/lib/jaga/simpan";
import { daftarAlarmLokal, tokenPemilik } from "@/lib/rakit/simpan";

import { KartuAlarm, type AlarmTampil } from "./KartuAlarm";
import { KotakMasuk } from "./KotakMasuk";
import { PesanPenjelasan } from "./PesanPenjelasan";
import { PetaPortofolio } from "./PetaPortofolio";
import { TEKS } from "./teks";

const POLA_KODE = /^[A-Z]{4}$/;

type Penyimpanan = "memuat" | "server" | "lokal";

function alarmBawaanTampil(): AlarmTampil[] {
  return ALARM_BAWAAN.map((a) => ({ ...a, asal: "bawaan" as const }));
}

export function PanelPasang() {
  const [token, setToken] = useState<string | null>(null);
  const [penyimpanan, setPenyimpanan] = useState<Penyimpanan>("memuat");
  const [symbols, setSymbols] = useState<string[]>([]);
  const [adaData, setAdaData] = useState<Record<string, boolean | null>>({});
  const [kode, setKode] = useState("");
  const [galatTambah, setGalatTambah] = useState<string | null>(null);

  const [alarms, setAlarms] = useState<AlarmTampil[]>(alarmBawaanTampil);
  const [aktif, setAktif] = useState<Set<string>>(() => new Set(ALARM_BAWAAN.map((a) => a.id)));

  const [kelasB, setKelasB] = useState(false);
  const [freeFloat, setFreeFloat] = useState(false);

  const [hasil, setHasil] = useState<ResponCek | null>(null);
  const [sedangCek, setSedangCek] = useState(false);
  const [galatCek, setGalatCek] = useState<string | null>(null);
  const [kotak, setKotak] = useState<PesanKotakMasuk[]>([]);
  // Id portofolio di server = kode untuk /mulai di bot Telegram (tiket 12).
  const [idPortofolio, setIdPortofolio] = useState<string | null>(null);

  const siap = useRef(false);
  const noCek = useRef(0);

  async function periksaData(s: string) {
    const ada = await cekAdaData(s);
    setAdaData((m) => ({ ...m, [s]: ada }));
  }

  // ----- muat awal: token, portofolio (lokal → server), alarm (lokal → server), kotak masuk
  useEffect(() => {
    (async () => {
      const t = tokenPemilik();
      setToken(t);
      const lokal = portofolioLokal();
      let simbolAwal = lokal?.symbols ?? [];
      let aktifAwal = new Set(lokal?.alarmIds ?? ALARM_BAWAAN.map((a) => a.id));

      const lokalAlarm: AlarmTampil[] = daftarAlarmLokal()
        .filter((a) => RuleSchema.safeParse(a.rule).success)
        .map((a) => ({ id: a.id, name: a.name, kelas: "A" as const, rule: a.rule, bawaan: false, asal: "lokal" as const }));
      let daftarAlarm: AlarmTampil[] = [...alarmBawaanTampil(), ...lokalAlarm];
      if (!lokal) aktifAwal = new Set(daftarAlarm.map((a) => a.id));

      const terakhir = hasilTerakhirLokal();
      if (terakhir) {
        setHasil({
          today: terakhir.today,
          sumber: terakhir.hasil.sumber,
          saham: terakhir.hasil.saham,
          penjelasan: terakhir.penjelasan,
          kreditTerpakai: terakhir.hasil.kreditTerpakai,
          panggilanApi: terakhir.hasil.panggilanApi,
          cacheHit: terakhir.hasil.cacheHit,
          kelasB: false,
        });
      }
      setKotak(kotakMasukLokal());

      if (t) {
        const [rp, ra] = await Promise.all([muatPortofolioServer(t), daftarAlarmServer(t)]);
        if (rp.ok) {
          setPenyimpanan("server");
          if (rp.data.portofolio) {
            simbolAwal = rp.data.portofolio.symbols;
            aktifAwal = new Set(rp.data.portofolio.alarmIds);
            setIdPortofolio(rp.data.portofolio.id);
          }
          // Kotak masuk server (diisi cron harian) digabung dengan yang di browser.
          void muatKotakMasukServer(t).then((rk) => {
            if (rk.ok && rk.data.pesan.length) setKotak((k) => gabungKotakMasuk(rk.data.pesan, k));
          });
        } else {
          setPenyimpanan(rp.galat.kode === KODE_TANPA_DB || rp.galat.status === 501 ? "lokal" : "lokal");
        }
        if (ra.ok) {
          const dariServer: AlarmTampil[] = ra.data.alarms.flatMap((a) => {
            const rules = a.rules.map((r) => RuleSchema.safeParse(r)).filter((p) => p.success).map((p) => p.data);
            return rules.map((rule, i) => ({
              id: a.id,
              name: rules.length > 1 ? `${a.name} (${i + 1})` : a.name,
              kelas: "A" as const,
              rule,
              bawaan: false,
              asal: "server" as const,
            }));
          });
          const sudah = new Set(daftarAlarm.map((a) => a.id));
          daftarAlarm = [...daftarAlarm, ...dariServer.filter((a) => !sudah.has(a.id))];
        }
      } else {
        setPenyimpanan("lokal");
      }
      setAlarms(daftarAlarm);
      setAktif(aktifAwal);
      setSymbols(simbolAwal);
      siap.current = true;
      for (const s of simbolAwal) void periksaData(s);
    })();
  }, []);

  // ----- simpan setiap kali portofolio/alarm aktif berubah (setelah muat awal)
  async function simpan(daftar: string[], aktifIds: Set<string>) {
    simpanPortofolioLokal(daftar, [...aktifIds]);
    if (token && penyimpanan === "server") {
      const r = await simpanPortofolioServer(token, { symbols: daftar, alarmIds: [...aktifIds] });
      if (r.ok) setIdPortofolio(r.data.portofolio.id);
      else if (r.galat.status === 501 || r.galat.kode === KODE_TANPA_DB) setPenyimpanan("lokal");
    }
  }

  function tambah() {
    const s = kode.trim().toUpperCase().replace(/\.JK$/, "");
    if (!POLA_KODE.test(s)) {
      setGalatTambah("Kode saham harus 4 huruf, mis. BBCA.");
      return;
    }
    if (symbols.includes(s)) {
      setGalatTambah(`${s} sudah ada di portofolio. Setiap saham cukup sekali.`);
      return;
    }
    setGalatTambah(null);
    const baru = [...symbols, s];
    setSymbols(baru);
    setKode("");
    void periksaData(s);
    void simpan(baru, aktif);
  }

  function hapus(s: string) {
    const baru = symbols.filter((x) => x !== s);
    setSymbols(baru);
    void simpan(baru, aktif);
  }

  function toggleAlarm(id: string, on: boolean) {
    const baru = new Set(aktif);
    if (on) baru.add(id);
    else baru.delete(id);
    setAktif(baru);
    void simpan(symbols, baru);
  }

  async function cek() {
    if (symbols.length === 0 || sedangCek) return;
    const no = ++noCek.current;
    setSedangCek(true);
    setGalatCek(null);
    const alarmLokal: AlarmKlien[] = alarms
      .filter((a) => a.asal === "lokal" && a.rule)
      .map((a) => ({ id: a.id, name: a.name, rule: a.rule! }));
    const blokB: BlokBKind[] | undefined = kelasB && !freeFloat ? ["ritel_dominan", "jatuh_dari_puncak"] : undefined;
    const r = await cekPortofolioServer(token, { symbols, alarmIds: [...aktif], alarms: alarmLokal, kelasB, blokB });
    if (no !== noCek.current) return;
    setSedangCek(false);
    if (!r.ok) {
      setGalatCek(r.galat.pesan);
      return;
    }
    setHasil(r.data);
    const sebelum = hasilTerakhirLokal();
    const hasilBaru: HasilPortofolio = {
      today: r.data.today,
      sumber: r.data.sumber,
      saham: r.data.saham,
      kreditTerpakai: r.data.kreditTerpakai,
      panggilanApi: r.data.panggilanApi,
      cacheHit: r.data.cacheHit,
    };
    const bendera = turunkanBendera(sebelum?.hasil ?? null, hasilBaru, r.data.penjelasan);
    simpanHasilTerakhir({ today: r.data.today, dicekPada: new Date().toISOString(), hasil: hasilBaru, penjelasan: r.data.penjelasan });
    if (bendera.length) setKotak(simpanKotakMasuk([...bendera, ...kotakMasukLokal()]));
  }

  function tandaiDibaca() {
    setKotak(simpanKotakMasuk(kotak.map((p) => ({ ...p, baru: false }))));
    if (token && penyimpanan === "server") void tandaiKotakMasukServer(token);
  }

  const petaHasil = new Map<string, HasilSaham>((hasil?.saham ?? []).map((s) => [s.symbol, s]));
  const sumberLabel = hasil ? (/fixture/i.test(hasil.sumber) ? TEKS.sumberFixture : TEKS.sumberDb) : null;

  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <section aria-labelledby="judul-portofolio" className="rounded-[14px] border border-line bg-surface p-3.5">
        <h3 id="judul-portofolio" className="font-display text-[15px] font-bold">
          {TEKS.portofolioJudul}
        </h3>
        <p className="mb-2.5 text-xs text-ink-3">
          {TEKS.portofolioSub}{" "}
          <span data-testid="label-penyimpanan" className="font-semibold">
            {penyimpanan === "memuat" ? "memuat…" : penyimpanan === "server" ? TEKS.disimpanServer : TEKS.disimpanLokal}
          </span>
        </p>
        <form
          className="mb-3 flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            tambah();
          }}
        >
          <input
            value={kode}
            onChange={(e) => setKode(e.target.value.toUpperCase())}
            maxLength={7}
            placeholder={TEKS.placeholderKode}
            aria-label="Kode saham"
            data-testid="kotak-kode"
            className="w-28 rounded-lg border border-line-strong bg-bg px-3 py-2 font-mono text-[13px] uppercase"
          />
          <button type="submit" data-testid="tombol-tambah" className="rounded-lg border border-line-strong px-3 py-2 text-[13px] font-semibold hover:bg-surface-2">
            {TEKS.tombolTambah}
          </button>
          <button
            type="button"
            data-testid="tombol-cek"
            onClick={cek}
            disabled={symbols.length === 0 || sedangCek}
            className="ml-auto rounded-lg bg-accent px-4 py-2 text-[13px] font-semibold text-accent-ink disabled:opacity-50"
          >
            {sedangCek ? TEKS.sedangCek : TEKS.tombolCek}
          </button>
        </form>
        {galatTambah ? (
          <p role="alert" data-testid="galat-tambah" className="mb-2 rounded-lg border-l-[3px] border-crit bg-crit-soft px-3 py-2 text-[13px]">
            {galatTambah}
          </p>
        ) : null}
        <label className="mb-1 flex items-start gap-2 text-[13px]">
          <input type="checkbox" checked={kelasB} onChange={(e) => setKelasB(e.target.checked)} data-testid="toggle-kelas-b" className="mt-0.5" />
          <span>
            <b>{TEKS.kelasBLabel}</b>
            <span className="block text-[11.5px] text-ink-3">{TEKS.kelasBSub}</span>
          </span>
        </label>
        {kelasB ? (
          <label className="mb-2 ml-6 flex items-center gap-2 text-[12px] text-ink-2">
            <input type="checkbox" checked={freeFloat} onChange={(e) => setFreeFloat(e.target.checked)} data-testid="toggle-free-float" />
            {TEKS.freeFloatLabel}
          </label>
        ) : null}
        <PetaPortofolio symbols={symbols} hasil={petaHasil} adaData={adaData} onHapus={hapus} sedangCek={sedangCek} />
        {galatCek ? (
          <p role="alert" data-testid="galat-cek" className="mt-2 rounded-lg border-l-[3px] border-crit bg-crit-soft px-3 py-2 text-[13px]">
            {galatCek}
          </p>
        ) : null}
        {hasil ? (
          <p className="mt-2.5 text-xs text-ink-3" data-testid="ringkasan-cek">
            Dicek {hasil.today} dengan{" "}
            {/* `data-sumber` = penanda mesin untuk tes: teks label fixture memuat
                substring "data Sectors nyata", jadi tidak bisa dibedakan dari teks. */}
            <span
              data-testid="label-sumber"
              data-sumber={/fixture/i.test(hasil.sumber) ? "fixture" : "db"}
              className={`rounded-full px-2 py-0.5 font-semibold ${/fixture/i.test(hasil.sumber) ? "bg-warn-soft text-warn" : "bg-ok-soft text-ok"}`}
            >
              {sumberLabel}
            </span>
            {" · "}
            <span data-testid="kredit-terpakai">
              kredit Sectors terpakai: {hasil.kreditTerpakai} ({hasil.panggilanApi} panggilan API, {hasil.cacheHit} dari cache)
            </span>
          </p>
        ) : null}

        <h3 className="mt-5 font-display text-[15px] font-bold">{TEKS.pesanJudul}</h3>
        <p className="mb-2.5 text-xs text-ink-3">{TEKS.pesanSub}</p>
        <PesanPenjelasan saham={hasil?.saham ?? []} penjelasan={hasil?.penjelasan ?? []} today={hasil?.today ?? null} />
      </section>

      <div className="flex flex-col gap-4">
        <section aria-labelledby="judul-alarm" className="rounded-[14px] border border-line bg-surface p-3.5">
          <h3 id="judul-alarm" className="font-display text-[15px] font-bold">
            {TEKS.alarmJudul}
          </h3>
          <p className="mb-2.5 text-xs text-ink-3">{TEKS.alarmSub}</p>
          <KartuAlarm alarms={alarms} aktif={aktif} onToggle={toggleAlarm} />
          <p className="mt-2.5 text-[11.5px] leading-snug text-ink-3">
            Alarm baru dibuat di layar <a href="/rakit" className="underline">Rakit alarm</a>; yang tersimpan di browser ini atau di server otomatis muncul di sini.
          </p>
        </section>
        <KotakMasuk pesan={kotak} onTandaiDibaca={tandaiDibaca} kodePortofolio={idPortofolio} />
      </div>
    </div>
  );
}
