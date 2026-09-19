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
import { dilewatiKarenaServer } from "@/lib/jaga/kalimat-b";
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
import { fmtTanggal } from "@/lib/putar-ulang/ringkas";
import {
  gabungKotakMasuk,
  hasilTerakhirLokal,
  kotakMasukLokal,
  lupakanPortofolioLokal,
  portofolioLokal,
  simpanHasilTerakhir,
  simpanKotakMasuk,
  simpanPortofolioLokal,
  turunkanBendera,
  type PesanKotakMasuk,
} from "@/lib/jaga/simpan";
import {
  bacaKunciTautan,
  daftarAlarmLokal,
  gantiTokenPemilik,
  tautanPemilik,
  tokenPemilik,
  tokenPemilikAda,
  type KunciTautan,
} from "@/lib/rakit/simpan";
import { Dialog } from "@/components/ui/Dialog";
import { DialogTautan } from "@/components/ui/DialogTautan";

import { KartuAlarm, type AlarmTampil } from "./KartuAlarm";
import { KotakMasuk } from "./KotakMasuk";
import { PesanPenjelasan } from "./PesanPenjelasan";
import { PetaPortofolio } from "./PetaPortofolio";
import { TEKS, TEKS_TAUTAN } from "./teks";

const POLA_KODE = /^[A-Z]{4}$/;

/** Temuan data terkini yang ditarik dari layar ini: pembeli 14 hari dan jarak dari puncak 90 hari. */
const BLOK_B_LAYAR: BlokBKind[] = ["ritel_dominan", "jatuh_dari_puncak"];

type Penyimpanan = "memuat" | "server" | "lokal";

interface PesanTautan {
  jenis: "pulih" | "pulihKosong" | "sama" | "tanpaDb" | "tidakSah" | "gagalSimpan" | "gagalMuat" | "batal" | "batalBaru";
  teks: string;
  nada: "ok" | "warn" | "crit";
}

function pesanTautan(jenis: Exclude<PesanTautan["jenis"], "gagalMuat">): PesanTautan {
  const nada = jenis === "tidakSah" || jenis === "gagalSimpan" ? "crit" : jenis === "tanpaDb" ? "warn" : "ok";
  return { jenis, teks: TEKS_TAUTAN[jenis], nada };
}

const KELAS_NADA: Record<PesanTautan["nada"], string> = {
  ok: "border-ok bg-ok-soft",
  warn: "border-warn bg-warn-soft",
  crit: "border-crit bg-crit-soft",
};

/** Hapus `#kunci=...` dari bilah alamat dan dari entri riwayat yang sama. */
function bersihkanHash() {
  const { pathname, search } = window.location;
  window.history.replaceState(null, "", pathname + search);
}

function alarmBawaanTampil(): AlarmTampil[] {
  return ALARM_BAWAAN.map((a) => ({ ...a, asal: "bawaan" as const }));
}

export function PanelPasang({ telegramAktif = false }: { telegramAktif?: boolean }) {
  const [token, setToken] = useState<string | null>(null);
  const [penyimpanan, setPenyimpanan] = useState<Penyimpanan>("memuat");
  const [symbols, setSymbols] = useState<string[]>([]);
  const [adaData, setAdaData] = useState<Record<string, boolean | null>>({});
  const [kode, setKode] = useState("");
  const [galatTambah, setGalatTambah] = useState<string | null>(null);

  const [alarms, setAlarms] = useState<AlarmTampil[]>(alarmBawaanTampil);
  const [aktif, setAktif] = useState<Set<string>>(() => new Set(ALARM_BAWAAN.map((a) => a.id)));

  const [kelasB, setKelasB] = useState(false);

  const [hasil, setHasil] = useState<ResponCek | null>(null);
  const [sedangCek, setSedangCek] = useState(false);
  const [galatCek, setGalatCek] = useState<string | null>(null);
  const [kotak, setKotak] = useState<PesanKotakMasuk[]>([]);
  // Id portofolio di server = kode untuk /mulai di bot Telegram (tiket 12).
  const [idPortofolio, setIdPortofolio] = useState<string | null>(null);

  // Tautan rahasia (tiket 23): pesan hasilnya, kunci yang menunggu konfirmasi
  // (browser sudah memegang kunci lain), dan putaran muat ulang setelah ganti.
  const [pesanTautanKini, setPesanTautan] = useState<PesanTautan | null>(null);
  // `gantiPemilik`: browser sudah memegang portofolio lain (teks dialognya beda).
  const [kunciTertunda, setKunciTertunda] = useState<{ kunci: string; gantiPemilik: boolean } | null>(null);
  const [putaran, setPutaran] = useState(0);
  // Dibaca SEKALI per kunjungan: ref bertahan saat effect diulang (StrictMode,
  // atau muat ulang setelah ganti pemilik), padahal hash sudah dihapus.
  const tautan = useRef<KunciTautan | null>(null);
  // Dialog tautan rahasia (tiket 24): muncul sendiri sekali, saat portofolio
  // pertama kali tersimpan di server; setelah itu lewat tombol "Lihat tautan".
  const [dialogTautan, setDialogTautan] = useState(false);

  const siap = useRef(false);
  const noCek = useRef(0);

  async function periksaData(s: string) {
    const ada = await cekAdaData(s);
    setAdaData((m) => ({ ...m, [s]: ada }));
  }

  // ----- muat awal: tautan rahasia, token, portofolio (lokal → server), alarm (lokal → server), kotak masuk
  useEffect(() => {
    (async () => {
      if (!tautan.current) {
        tautan.current = bacaKunciTautan(window.location.hash);
        if (tautan.current.jenis !== "tidak-ada") bersihkanHash();
      }
      let dariTautan = false;
      if (tautan.current.jenis === "tidak-sah") setPesanTautan(pesanTautan("tidakSah"));
      else if (tautan.current.jenis === "sah") {
        const kunci = tautan.current.kunci;
        const kini = tokenPemilikAda();
        // Selalu ditanya dulu, juga di browser yang belum punya portofolio:
        // memakai kunci orang lain tanpa sadar berarti semua yang ditambahkan
        // sesudahnya ikut terlihat dan bisa diubah pengirim tautan.
        if (kini === kunci) dariTautan = true;
        else setKunciTertunda({ kunci, gantiPemilik: Boolean(kini) });
      }

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
        if (dariTautan) {
          if (rp.ok) setPesanTautan(pesanTautan(rp.data.portofolio ? "pulih" : "pulihKosong"));
          else if (rp.galat.kode === KODE_TANPA_DB || rp.galat.status === 501) setPesanTautan(pesanTautan("tanpaDb"));
          else setPesanTautan({ jenis: "gagalMuat", teks: TEKS_TAUTAN.gagalMuat(rp.galat.pesan), nada: "crit" });
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
  }, [putaran]);

  // Tautan yang ditempel ke bilah alamat saat /pasang SUDAH terbuka hanya
  // mengganti hash (tanpa memuat ulang halaman), jadi effect di atas tidak
  // berjalan lagi. Tangkap di sini.
  useEffect(() => {
    function onHash() {
      const k = bacaKunciTautan(window.location.hash);
      if (k.jenis === "tidak-ada") return;
      bersihkanHash();
      if (k.jenis === "tidak-sah") setPesanTautan(pesanTautan("tidakSah"));
      else if (tokenPemilikAda() === k.kunci) setPesanTautan(pesanTautan("sama"));
      else setKunciTertunda({ kunci: k.kunci, gantiPemilik: true });
    }
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  function gantiKePemilikTautan(kunci: string) {
    if (!gantiTokenPemilik(kunci)) {
      setKunciTertunda(null);
      setPesanTautan(pesanTautan("gagalSimpan"));
      return;
    }
    lupakanPortofolioLokal();
    tautan.current = { jenis: "sah", kunci };
    noCek.current++;
    siap.current = false;
    setKunciTertunda(null);
    setPesanTautan(null);
    setToken(null);
    setPenyimpanan("memuat");
    setSymbols([]);
    setAdaData({});
    setHasil(null);
    setSedangCek(false);
    setGalatCek(null);
    setKotak([]);
    setIdPortofolio(null);
    setPutaran((p) => p + 1);
  }

  function batalGantiPemilik() {
    setPesanTautan(pesanTautan(kunciTertunda?.gantiPemilik === false ? "batalBaru" : "batal"));
    setKunciTertunda(null);
  }

  // ----- simpan setiap kali portofolio/alarm aktif berubah (setelah muat awal)
  async function simpan(daftar: string[], aktifIds: Set<string>) {
    simpanPortofolioLokal(daftar, [...aktifIds]);
    if (token && penyimpanan === "server") {
      const r = await simpanPortofolioServer(token, { symbols: daftar, alarmIds: [...aktifIds] });
      if (r.ok) {
        if (!idPortofolio) setDialogTautan(true);
        setIdPortofolio(r.data.portofolio.id);
      } else if (r.galat.status === 501 || r.galat.kode === KODE_TANPA_DB) setPenyimpanan("lokal");
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
    // Free float dibuang dari layar (tiket 26): snapshot seluruh bursa seharga
    // 10 kredit hanya untuk satu angka per saham yang tidak bisa diuji ke masa lalu.
    const blokB: BlokBKind[] | undefined = kelasB ? BLOK_B_LAYAR : undefined;
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
          {penyimpanan === "server" && token && idPortofolio ? (
            <>
              {" "}
              <button
                type="button"
                onClick={() => setDialogTautan(true)}
                data-testid="tombol-lihat-tautan"
                className="font-semibold text-accent underline underline-offset-2"
              >
                {TEKS.tombolLihatTautan}
              </button>
            </>
          ) : null}
        </p>
        {dialogTautan && token ? (
          <DialogTautan tautan={tautanPemilik(window.location.origin, token)} onTutup={() => setDialogTautan(false)} />
        ) : null}
        {pesanTautanKini ? (
          <p
            role={pesanTautanKini.nada === "crit" ? "alert" : "status"}
            data-testid="pesan-tautan"
            data-jenis={pesanTautanKini.jenis}
            className={`mb-2.5 rounded-lg border-l-[3px] px-3 py-2 text-[13px] ${KELAS_NADA[pesanTautanKini.nada]}`}
          >
            {pesanTautanKini.teks}
          </p>
        ) : null}
        {kunciTertunda ? (
          <Dialog judul={TEKS_TAUTAN.konfirmasiJudul} onTutup={batalGantiPemilik} testId="dialog-ganti-pemilik">
            <p className="m-0 mb-4 text-[14px] leading-relaxed text-ink-2">
              {kunciTertunda.gantiPemilik ? TEKS_TAUTAN.konfirmasiTeks : TEKS_TAUTAN.konfirmasiTeksBaru}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                data-testid="tombol-ganti-pemilik"
                onClick={() => gantiKePemilikTautan(kunciTertunda.kunci)}
                className="rounded-lg bg-accent px-4 py-2 text-[13px] font-semibold text-accent-ink"
              >
                {kunciTertunda.gantiPemilik ? TEKS_TAUTAN.tombolGanti : TEKS_TAUTAN.tombolBuka}
              </button>
              <button
                type="button"
                data-testid="tombol-batal-ganti"
                onClick={batalGantiPemilik}
                className="rounded-lg border border-line-strong px-4 py-2 text-[13px] font-semibold hover:bg-surface-2"
              >
                {kunciTertunda.gantiPemilik ? TEKS_TAUTAN.tombolBatal : TEKS_TAUTAN.tombolBatalBaru}
              </button>
            </div>
          </Dialog>
        ) : null}
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
        {hasil && hasil.saham.some((s) => dilewatiKarenaServer(s.kelasB)) ? (
          // Alasan yang sama untuk semua saham disebut sekali di sini, bukan per saham.
          <p data-testid="kelas-b-server" className="mb-2 ml-6 text-[12px] text-ink-2">
            {TEKS.kelasBServer}
          </p>
        ) : null}
        <PetaPortofolio symbols={symbols} hasil={petaHasil} adaData={adaData} onHapus={hapus} sedangCek={sedangCek} />
        {galatCek ? (
          <p role="alert" data-testid="galat-cek" className="mt-2 rounded-lg border-l-[3px] border-crit bg-crit-soft px-3 py-2 text-[13px]">
            {galatCek}
          </p>
        ) : null}
        {hasil ? (
          <p className="mt-2.5 text-xs text-ink-3" data-testid="ringkasan-cek">
            Dicek {fmtTanggal(hasil.today)} dengan{" "}
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
        <PesanPenjelasan saham={hasil?.saham ?? []} penjelasan={hasil?.penjelasan ?? []} />
      </section>

      <div className="flex flex-col gap-4">
        <section aria-labelledby="judul-alarm" className="rounded-[14px] border border-line bg-surface p-3.5">
          <h3 id="judul-alarm" className="font-display text-[15px] font-bold">
            {TEKS.alarmJudul}
          </h3>
          <KartuAlarm alarms={alarms} aktif={aktif} onToggle={toggleAlarm} />
          <p className="mt-2.5 text-[11.5px] leading-snug text-ink-3">
            Alarm baru dibuat di layar <a href="/rakit" className="underline">Rakit alarm</a>.
          </p>
        </section>
        <KotakMasuk pesan={kotak} onTandaiDibaca={tandaiDibaca} kodePortofolio={idPortofolio} telegramAktif={telegramAktif} />
      </div>
    </div>
  );
}
