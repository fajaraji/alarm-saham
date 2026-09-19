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

describe("PesanPenjelasan: data terkini", () => {
  it("setiap saham menampilkan dua temuan dalam kalimat biasa berikut angkanya, tanpa nama mesin", () => {
    render(
      <PesanPenjelasan
        saham={[saham("BBCA", { status: "dijalankan", keterangan: "1 dari 2 syarat data terkini terpenuhi", blok: [ritel, puncak] })]}
        penjelasan={[]}
        today="2026-09-07"
      />,
    );
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
  });

  it("saham yang dilewati menyebut alasannya", () => {
    render(
      <PesanPenjelasan
        saham={[
          saham("SRIL", {
            status: "dilewati",
            keterangan: "dilewati: saham ini sedang disuspensi sejak 2024-11-01, dan data broker saham yang disuspensi kosong padahal tetap memakai kredit",
            blok: [],
          }),
        ]}
        penjelasan={[]}
        today="2026-09-07"
      />,
    );
    expect(screen.getByTestId("kelas-b-dilewati-SRIL")).toHaveTextContent(
      "Data terkini tidak ditarik untuk saham ini: saham ini sedang disuspensi sejak 2024-11-01",
    );
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
