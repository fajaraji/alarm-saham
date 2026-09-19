// Hasil "data terkini" di layar Pasang (tiket 26), jsdom. Hasil kelas B dibuat
// dari evaluator murni dengan data tiruan dan /api/portofolio/cek ditiru:
// tidak ada satu pun panggilan ke Sectors, jadi nol kredit.
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PanelPasang } from "../../src/components/pasang/PanelPasang";
import { PesanPenjelasan } from "../../src/components/pasang/PesanPenjelasan";
import type { DailyBar } from "../../src/lib/data/types";
import { BLOK_B_KINDS, nilaiJatuhDariPuncak, nilaiRitelDominan, petaCohort } from "../../src/lib/jaga/blok-b";
import type { HasilSaham } from "../../src/lib/jaga/evaluasi";
import { kalimatBlokB } from "../../src/lib/jaga/kalimat-b";
import { templatePenjelasan } from "../../src/lib/jaga/penjelasan";

const NAMA_MESIN = new RegExp(BLOK_B_KINDS.join("|"));

const ritel = nilaiRitelDominan(
  {
    start: "2026-08-24",
    end: "2026-09-06",
    data: [
      {
        date: "2026-09-04",
        summary: [
          { broker_code: "YP", bval: 9e9, nval: 1e9 },
          { broker_code: "AK", bval: 1e9, nval: -2e9 },
        ],
      },
    ],
  } as never,
  petaCohort([
    { code: "YP", cohort: "retail", is_foreign: false },
    { code: "AK", cohort: "institutional", is_foreign: true },
  ] as never),
);
const puncak = nilaiJatuhDariPuncak([
  { date: "2026-07-01", close: 500 },
  { date: "2026-09-05", close: 450 },
] as DailyBar[]);

function saham(symbol: string, kelasB: HasilSaham["kelasB"]): HasilSaham {
  return { symbol, status: "hijau", adaData: true, suspensiAktif: null, alasan: [], alarmBerbunyi: [], kelasB, catatan: [] };
}

/** Pesan layar Pasang dengan teks template sungguhan (bukan teks kosong). */
function renderPesan(h: HasilSaham) {
  return render(<PesanPenjelasan saham={[h]} penjelasan={[{ symbol: h.symbol, teks: templatePenjelasan(h, "2026-09-07"), olehAi: false, perluTinjau: false }]} />);
}

describe("PesanPenjelasan: data terkini", () => {
  it("setiap saham menampilkan dua temuan dalam kalimat biasa berikut angkanya, tanpa nama mesin", () => {
    renderPesan(saham("BBCA", { status: "dijalankan", keterangan: "1 dari 2 syarat data terkini terpenuhi", blok: [ritel, puncak] }));
    const kotak = screen.getByTestId("kelas-b-BBCA");
    const temuanRitel = within(kotak).getByTestId("temuan-b-BBCA-ritel_dominan");
    expect(temuanRitel).toHaveAttribute("data-terpenuhi", "true");
    expect(temuanRitel).toHaveTextContent("90% nilai pembelian datang dari broker ritel");
    expect(temuanRitel).toHaveTextContent("melepas bersih Rp2 miliar");
    expect(temuanRitel).toHaveTextContent("memenuhi syarat alarm");
    const temuanPuncak = within(kotak).getByTestId("temuan-b-BBCA-jatuh_dari_puncak");
    expect(temuanPuncak).toHaveTextContent("10% di bawah harga tertinggi 90 hari (Rp500 pada 1 Jul 2026)");
    expect(temuanPuncak).not.toHaveTextContent("memenuhi syarat alarm");
    expect(kotak.textContent).not.toMatch(NAMA_MESIN);
    expect(screen.getByTestId("pesan-BBCA").textContent).not.toMatch(NAMA_MESIN);
  });

  it("setiap kalimat temuan terbaca sekali tanpa membuka apa pun; kotak data terkini ada di lipatan Rincian", () => {
    const h = saham("BBCA", { status: "dijalankan", keterangan: "x", blok: [ritel, puncak] });
    // Temuan yang terpenuhi ikut menjadi alasan, persis seperti keluaran cekPortofolio.
    h.alasan = [{ kind: "ritel_dominan", kelas: "B", label: "Ritel dominan, institusi melepas", detail: kalimatBlokB(ritel), tanggal: "2026-09-04", sumber: "Sectors /v2/broker-summary/ (14 hari)", alarm: [] }];
    renderPesan(h);
    const kartu = screen.getByTestId("pesan-BBCA");
    const kotak = screen.getByTestId("kelas-b-BBCA");
    expect(kotak.closest("details")).not.toBeNull();
    expect(kotak.closest("details")).not.toHaveAttribute("open");
    // Teks yang terlihat = kartu tanpa isi <details> yang tertutup.
    const lipatan = kartu.querySelector("details")!;
    const terlihat = (kartu.textContent ?? "").replace(lipatan.textContent ?? "", "") + (lipatan.querySelector("summary")?.textContent ?? "");
    for (const k of [kalimatBlokB(ritel), kalimatBlokB(puncak)]) {
      expect(terlihat.split(k.replace(/\.$/, "")).length - 1, k).toBe(1);
    }
    // Daftar alasan di lipatan tidak mengulang temuan kelas B (kotaknya sudah memuatnya).
    expect(screen.queryByTestId("alasan-BBCA-ritel_dominan")).toBeNull();
    // Sumber di teks utama cukup namanya; endpoint lengkap hanya di lipatan.
    expect(terlihat).not.toContain("/v2/");
  });

  it("saham yang dilewati menyebut alasannya sekali, dalam satu kalimat", () => {
    renderPesan(saham("SRIL", { status: "dilewati", keterangan: "dilewati: saham ini disuspensi", blok: [] }));
    const kartu = screen.getByTestId("pesan-SRIL");
    expect(kartu).toHaveTextContent("Data terkini tidak ditarik karena saham ini disuspensi.");
    expect(kartu.textContent!.split("tidak ditarik").length - 1).toBe(1);
    expect(screen.queryByTestId("kelas-b-SRIL")).toBeNull();
  });

  it("alasan yang berlaku untuk seluruh server tidak diulang per saham", () => {
    renderPesan(saham("BBCA", { status: "dilewati", keterangan: "dilewati: server ini belum bisa menarik data terkini (butuh kunci Sectors dan database pencatat kredit)", blok: [] }));
    expect(screen.getByTestId("pesan-BBCA")).not.toHaveTextContent(/tidak ditarik|belum bisa menarik/);
  });
});

describe("PanelPasang: opsi data terkini", () => {
  const badanCek: unknown[] = [];

  beforeEach(() => {
    badanCek.length = 0;
    window.localStorage.clear();
    window.localStorage.setItem(
      "alarm-saham.portofolio",
      JSON.stringify({ symbols: ["BBCA"], alarmIds: [], disimpanPada: "2026-09-07T00:00:00Z" }),
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
        const u = String(url);
        if (u === "/api/portofolio/cek") {
          badanCek.push(JSON.parse(String(init?.body)));
          return new Response(
            JSON.stringify({
              today: "2026-09-07",
              sumber: "fixture uji",
              saham: [saham("BBCA", { status: "dijalankan", keterangan: "x", blok: [ritel, puncak] })],
              penjelasan: [],
              kreditTerpakai: 0,
              panggilanApi: 0,
              cacheHit: 0,
              kelasB: true,
            }),
            { status: 200 },
          );
        }
        if (u.startsWith("/api/emiten/")) return new Response("{}", { status: 200 });
        return new Response(JSON.stringify({ error: { kode: "DB_TIDAK_TERSEDIA", pesan: "tanpa DB" } }), { status: 501 });
      }),
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it("tidak ada opsi free float; mencentang data terkini meminta dua temuan saja", async () => {
    render(<PanelPasang />);
    await waitFor(() => expect(screen.getByTestId("label-penyimpanan")).not.toHaveTextContent("memuat"));
    fireEvent.click(screen.getByTestId("toggle-kelas-b"));
    expect(screen.queryByTestId("toggle-free-float")).toBeNull();
    expect(document.body.textContent).not.toMatch(/free float/i);

    fireEvent.click(screen.getByTestId("tombol-cek"));
    await screen.findByTestId("temuan-b-BBCA-ritel_dominan");
    expect(badanCek).toHaveLength(1);
    expect(badanCek[0]).toMatchObject({ kelasB: true, blokB: ["ritel_dominan", "jatuh_dari_puncak"] });
  });
});
