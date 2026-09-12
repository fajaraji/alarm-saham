// Komponen layar "Rakit alarm" (jsdom + Testing Library). `fetch` ditiru per
// URL: tanpa jaringan, tanpa kunci AI. Seret-lepas nyata diuji di Playwright;
// di sini jalur klik/keyboard (fallback) dan alur API.
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PapanRakit } from "../../src/components/rakit/PapanRakit";
import { TEKS } from "../../src/components/rakit/teks";
import { fromFixture, runBacktest, type BacktestResult } from "../../src/lib/engine";
import universeKecil from "../../src/lib/engine/fixtures/universe-kecil.json";
import type { Rule } from "../../src/lib/engine/rules";
import { PESAN_AI_NONAKTIF } from "../../src/lib/rakit/api";

type Penjawab = (body: unknown) => { status: number; json: unknown } | Promise<{ status: number; json: unknown }>;

const rute: Record<string, Penjawab> = {};
const panggilan: { url: string; body: unknown }[] = [];

function jawabAiNonaktif() {
  return { status: 503, json: { error: { kode: "AI_TIDAK_TERSEDIA", pesan: "ANTHROPIC_API_KEY belum diset." } } };
}

async function backtestNyata(rule: Rule): Promise<BacktestResult> {
  const fx = fromFixture(universeKecil);
  return runBacktest(rule, fx.universe, fx, { today: "2026-01-31" });
}

beforeEach(() => {
  panggilan.length = 0;
  for (const k of Object.keys(rute)) delete rute[k];
  rute["/api/backtest"] = async (body) => {
    const { rule } = body as { rule: Rule };
    return { status: 200, json: { sumber: "fixture", keterangan: "fixture universe-kecil.json", hasil: await backtestNyata(rule) } };
  };
  rute["/api/agent/rakit"] = jawabAiNonaktif;
  rute["/api/agent/diagnosis"] = jawabAiNonaktif;
  rute["/api/alarms"] = () => ({ status: 503, json: { error: { kode: "DB_TIDAK_TERSEDIA", pesan: "tanpa DB" } } });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const path = String(url);
      const body = init?.body ? JSON.parse(String(init.body)) : null;
      panggilan.push({ url: path, body });
      const p = rute[path];
      if (!p) return new Response(JSON.stringify({ error: { kode: "TIDAK_ADA", pesan: path } }), { status: 404 });
      const r = await p(body);
      return new Response(JSON.stringify(r.json), { status: r.status, headers: { "content-type": "application/json" } });
    }),
  );
  window.localStorage.clear();
});

afterEach(() => vi.unstubAllGlobals());

function papan() {
  return screen.getByTestId("papan-dropzone");
}

/**
 * Klik tombol "Minta diagnosis AI".
 *
 * Sejak diagnosis tidak lagi dipanggil otomatis oleh `uji` (lihat komentar di
 * PapanRakit), setiap tes yang menguji panel AI harus menekan tombolnya
 * sendiri — persis seperti pengguna. `findByRole` sekalian menunggu hasil uji
 * tiba, karena tombolnya baru dirender saat `adaHasil` true.
 */
async function klikMintaDiagnosis() {
  fireEvent.click(await screen.findByRole("button", { name: /Minta diagnosis (AI|ulang)/ }));
}

describe("PapanRakit", () => {
  it("merender palet lima blok, papan kosong, KALAU/MAKA, dan area buang", () => {
    render(<PapanRakit />);
    expect(screen.getByRole("heading", { name: TEKS.paletJudul })).toBeInTheDocument();
    const daftar = screen.getByRole("list", { name: /Blok syarat yang tersedia/ });
    expect(within(daftar).getAllByRole("listitem")).toHaveLength(5);
    expect(screen.getByTestId("palet-insider_jual")).toHaveTextContent("hanya 2024+");
    expect(screen.getByTestId("palet-suspensi")).toHaveTextContent("data sejak 2020");
    expect(screen.getByTestId("palet-suspensi")).toHaveAttribute("title", expect.stringMatching(/Bursa menghentikan/));
    expect(within(papan()).getByText(TEKS.papanKosongJudul)).toBeInTheDocument();
    expect(screen.getByText(TEKS.kalau)).toBeInTheDocument();
    expect(screen.getByText(TEKS.maka)).toBeInTheDocument();
    expect(screen.getByTestId("area-buang")).toHaveTextContent(TEKS.buang);
    expect(screen.getByText(TEKS.aiBelum)).toBeInTheDocument();
  });

  it("klik palet menambah blok; blok yang sama tidak bisa ditambah dua kali; × membuang", () => {
    render(<PapanRakit />);
    fireEvent.click(screen.getByTestId("palet-suspensi"));
    expect(within(papan()).getByTestId("blok-suspensi")).toBeInTheDocument();
    expect(screen.getByTestId("palet-suspensi")).toBeDisabled();
    fireEvent.click(screen.getByTestId("palet-laporan_hilang"));
    expect(papan().querySelectorAll("li[data-testid^='blok-']")).toHaveLength(2);
    expect(screen.getByTestId("ringkasan-aturan")).toHaveTextContent("Saham disuspensi ATAU Laporan keuangan hilang/berhenti");
    fireEvent.click(screen.getByRole("button", { name: /Buang blok Saham disuspensi/ }));
    expect(screen.queryByTestId("blok-suspensi")).not.toBeInTheDocument();
    expect(screen.getByTestId("palet-suspensi")).toBeEnabled();
  });

  it("tombol ATAU/DAN di antara blok dan chip ambang longgar↔ketat", () => {
    render(<PapanRakit />);
    fireEvent.click(screen.getByTestId("palet-suspensi"));
    expect(screen.queryByTestId("tombol-gabung")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("palet-ekuitas_negatif"));
    const gabung = screen.getByTestId("tombol-gabung");
    expect(gabung).toHaveTextContent("ATAU");
    fireEvent.click(gabung);
    expect(screen.getByTestId("tombol-gabung")).toHaveTextContent("DAN");
    expect(screen.getByTestId("ringkasan-aturan")).toHaveTextContent(" DAN ");

    const blok = screen.getByTestId("blok-suspensi");
    expect(blok).toHaveAttribute("data-threshold", "longgar");
    const chip = within(blok).getByRole("button", { name: /^Ambang/ });
    expect(chip).toHaveTextContent("pernah 12 bln terakhir");
    fireEvent.click(chip);
    expect(screen.getByTestId("blok-suspensi")).toHaveAttribute("data-threshold", "ketat");
    expect(within(screen.getByTestId("blok-suspensi")).getByRole("button", { name: /^Ambang/ })).toHaveTextContent(
      "masih berlaku > 6 bln",
    );
  });

  it("Uji ke masa lalu pada papan kosong → pesan awam, tanpa panggilan API", () => {
    render(<PapanRakit />);
    fireEvent.click(screen.getByRole("button", { name: TEKS.tombolUji }));
    expect(screen.getByRole("alert")).toHaveTextContent(TEKS.papanKosongUji);
    expect(panggilan).toHaveLength(0);
  });

  it("Minta AI rakit → 503 → banner sopan, papan tetap bisa dirakit sendiri", async () => {
    render(<PapanRakit />);
    fireEvent.change(screen.getByRole("textbox", { name: /Ceritakan alarm/ }), {
      target: { value: "aku mau alarm buat saham yang mau pailit" },
    });
    fireEvent.click(screen.getByRole("button", { name: TEKS.tombolAi }));
    await waitFor(() => expect(screen.getByTestId("catatan-rakit")).toHaveTextContent(PESAN_AI_NONAKTIF));
    expect(panggilan[0]).toEqual({ url: "/api/agent/rakit", body: { kalimat: "aku mau alarm buat saham yang mau pailit" } });
    expect(screen.getByTestId("banner-ai-diagnosis")).toHaveTextContent(PESAN_AI_NONAKTIF);
    fireEvent.click(screen.getByTestId("palet-suspensi"));
    expect(screen.getByTestId("blok-suspensi")).toBeInTheDocument();
  });

  it("Minta AI rakit diterima → blok masuk satu per satu; ditolak → pesan tampil", async () => {
    rute["/api/agent/rakit"] = (body) => {
      const { kalimat } = body as { kalimat: string };
      if (/beli/.test(kalimat)) return { status: 200, json: { ditolak: true, pesan: "Alarm Saham tidak memberi rekomendasi beli." } };
      return {
        status: 200,
        json: {
          ditolak: false,
          alasan: "Tiga tanda paling sering muncul sebelum tumbang.",
          rule: {
            name: "Mau pailit",
            combine: "any",
            blocks: [
              { kind: "laporan_hilang", threshold: "longgar" },
              { kind: "suspensi", threshold: "ketat" },
            ],
          },
        },
      };
    };
    render(<PapanRakit />);
    const input = screen.getByRole("textbox", { name: /Ceritakan alarm/ });
    fireEvent.change(input, { target: { value: "saham yang mau pailit" } });
    fireEvent.click(screen.getByRole("button", { name: TEKS.tombolAi }));
    await waitFor(() => expect(screen.getByTestId("blok-laporan_hilang")).toBeInTheDocument());
    expect(screen.queryByTestId("blok-suspensi")).not.toBeInTheDocument(); // masih dianimasikan
    await waitFor(() => expect(screen.getByTestId("blok-suspensi")).toHaveAttribute("data-threshold", "ketat"));
    await waitFor(() => expect(screen.getByTestId("catatan-rakit")).toHaveTextContent(/Blok sudah jadi/));
    expect(screen.getByDisplayValue("Mau pailit")).toBeInTheDocument();

    fireEvent.change(input, { target: { value: "saham apa yang harus kubeli" } });
    fireEvent.click(screen.getByRole("button", { name: TEKS.tombolAi }));
    await waitFor(() => expect(screen.getByTestId("catatan-rakit")).toHaveTextContent(/tidak memberi rekomendasi/));
  });

  it("Uji ke masa lalu → tiga angka, baris kotak per kelompok, label sumber contoh, panel AI 503", async () => {
    render(<PapanRakit />);
    fireEvent.click(screen.getByTestId("palet-suspensi"));
    fireEvent.click(screen.getByTestId("palet-laporan_hilang"));
    fireEvent.click(screen.getByRole("button", { name: TEKS.tombolUji }));
    await waitFor(() => expect(screen.getByTestId("skor-tertangkap")).not.toHaveTextContent("–"));
    expect(screen.getByTestId("skor-tertangkap")).toHaveTextContent(/^\d\/3$/);
    expect(screen.getByTestId("skor-palsu")).toHaveTextContent(/^\d\/4$/);
    expect(screen.getByTestId("label-sumber")).toHaveTextContent(TEKS.sumberFixture);
    expect(screen.getByTestId("kelompok-delisting")).toBeInTheDocument();
    expect(screen.getByTestId("kelompok-watchlist")).toBeInTheDocument();
    expect(screen.getByTestId("kelompok-control")).toBeInTheDocument();
    expect(screen.getByTestId("sel-SRIL")).toHaveAttribute("data-fired", "true");
    expect(screen.getByTestId("sel-SRIL")).toHaveAttribute("title", expect.stringMatching(/tertangkap/));
    expect(screen.getByTestId("sel-BBCA")).toHaveAttribute("title", expect.stringMatching(/SRIL|bersih|alarm palsu/));
    // Uji ke masa lalu TIDAK memanggil AI sendiri (keputusan sesudah deploy
    // pertama); bannernya baru muncul setelah tombolnya ditekan dan 503 tiba.
    expect(panggilan.some((x) => x.url === "/api/agent/diagnosis")).toBe(false);
    await klikMintaDiagnosis();
    await waitFor(() => expect(screen.getByTestId("banner-ai-diagnosis")).toHaveTextContent(PESAN_AI_NONAKTIF));
    const diag = panggilan.find((p) => p.url === "/api/agent/diagnosis");
    expect(diag?.body).toMatchObject({ rule: { combine: "any" }, backtest: { today: "2026-01-31" } });
    // Papan berubah → hasil ditandai basi
    fireEvent.click(screen.getByTestId("tombol-gabung"));
    expect(screen.getByTestId("hasil-uji")).toHaveAttribute("data-basi", "true");
  });

  it("uji ke masa lalu TIDAK memanggil diagnosis AI sampai tombolnya diklik", async () => {
    // Regresi keputusan sesudah deploy production pertama. Versi lama
    // memanggil jalankanDiagnosis otomatis di akhir `uji`; efeknya tak
    // pernah terlihat karena e2e lokal & CI berjalan tanpa kunci AI, lalu di
    // produksi tiap klik membakar ~55-66 ribu token, menahan panel 50-240
    // detik, dan memunculkan galat AI walau backtest-nya sendiri sukses.
    render(<PapanRakit />);
    fireEvent.click(screen.getByTestId("palet-laporan_hilang"));
    fireEvent.click(screen.getByRole("button", { name: TEKS.tombolUji }));
    await waitFor(() => expect(screen.getByTestId("skor-tertangkap")).not.toHaveTextContent("–"));

    // Backtest jalan, diagnosis tidak.
    expect(panggilan.filter((x) => x.url === "/api/backtest")).toHaveLength(1);
    expect(panggilan.filter((x) => x.url === "/api/agent/diagnosis")).toHaveLength(0);

    // Baru setelah tombolnya ditekan.
    await klikMintaDiagnosis();
    await waitFor(() => expect(panggilan.filter((x) => x.url === "/api/agent/diagnosis")).toHaveLength(1));
    expect(panggilan.filter((x) => x.url === "/api/backtest")).toHaveLength(1);
  });

  it("diagnosis AI: ringkasan, emiten, trace bernomor; '+ Tambahkan blok' mengubah papan lalu uji ulang", async () => {
    rute["/api/agent/diagnosis"] = () => ({
      status: 200,
      json: {
        sumber: "fixture",
        backtest: { hits: 1, total: 4, falseAlarms: 0, controls: 4 },
        ringkasan: "Alarm bolong di TELE karena tidak pernah telat laporan.",
        emitenDibahas: [{ symbol: "TELE", sebab: "Laporan selalu tepat waktu.", buktiTanggal: ["2024-12-27"] }],
        usulanBlok: [{ kind: "ekuitas_negatif", threshold: "longgar", alasan: "Ekuitas TELE negatif sejak 2024." }],
        trace: [
          { step: 0, tool: "listMissed", input: {}, ringkasanHasil: "1 emiten terlewat" },
          { step: 1, tool: "getFinancials", input: { symbol: "TELE" }, ringkasanHasil: "ekuitas negatif" },
        ],
        langkah: 3,
        perluTinjau: false,
        kataDisensor: [],
        usage: {},
      },
    });
    render(<PapanRakit />);
    fireEvent.click(screen.getByTestId("palet-laporan_hilang"));
    fireEvent.click(screen.getByRole("button", { name: TEKS.tombolUji }));
    await klikMintaDiagnosis();
    await waitFor(() => expect(screen.getByText(/Alarm bolong di TELE/)).toBeInTheDocument());
    expect(screen.getByRole("list", { name: /Emiten yang dibahas/ })).toHaveTextContent("TELE");
    const jejak = screen.getByRole("list", { name: /Jejak pemeriksaan AI/ });
    expect(within(jejak).getAllByRole("listitem")).toHaveLength(2);
    expect(jejak).toHaveTextContent("getFinancials");

    const sebelum = panggilan.filter((p) => p.url === "/api/backtest").length;
    fireEvent.click(screen.getByTestId("usulan-ekuitas_negatif"));
    expect(screen.getByTestId("blok-ekuitas_negatif")).toBeInTheDocument();
    await waitFor(() => expect(panggilan.filter((p) => p.url === "/api/backtest").length).toBe(sebelum + 1));
    const terakhir = panggilan.filter((p) => p.url === "/api/backtest").at(-1)!.body as { rule: Rule };
    expect(terakhir.rule.blocks.map((b) => b.kind)).toEqual(["laporan_hilang", "ekuitas_negatif"]);
    await waitFor(() => expect(screen.getByTestId("hasil-uji")).toHaveAttribute("data-basi", "false"));
  });

  it("usulan blok yang ditandai penjaga: alasannya TETAP TAMPIL, dengan tanda peringatan", async () => {
    // Kontrak struktural rancang-ulang putaran 5. Sebelum ini, alasan yang
    // menyalakan penyensor diganti "[kalimat saran dihapus]" sehingga panel
    // memasang tombol usulan blok tanpa satu pun alasan — penyerang membuktikan
    // kedua alasan bisa hilang sekaligus. Sekarang teksnya dibiarkan dan diberi
    // tanda supaya pengguna menilainya sendiri.
    const alasan = "Ekuitas TELE minus Rp1,1 triliun pada kuartal 4 2019; kurangi porsimu di TELE.";
    rute["/api/agent/diagnosis"] = () => ({
      status: 200,
      json: {
        sumber: "fixture",
        backtest: { hits: 1, total: 4, falseAlarms: 0, controls: 4 },
        ringkasan: "Alarm bolong di TELE. Sebaiknya [dihapus].",
        emitenDibahas: [],
        usulanBlok: [{ kind: "ekuitas_negatif", threshold: "longgar", alasan, perluTinjau: true }],
        trace: [],
        langkah: 2,
        perluTinjau: true,
        kataDisensor: ["kurangi porsi", "porsimu"],
        usage: {},
      },
    });
    render(<PapanRakit />);
    fireEvent.click(screen.getByTestId("palet-laporan_hilang"));
    fireEvent.click(screen.getByRole("button", { name: TEKS.tombolUji }));
    await klikMintaDiagnosis();
    await waitFor(() => expect(screen.getByTestId("usulan-ekuitas_negatif")).toBeInTheDocument());
    const tombol = screen.getByTestId("usulan-ekuitas_negatif");
    // Teks alasan utuh — termasuk angka & tanggalnya.
    expect(tombol).toHaveTextContent("Ekuitas TELE minus Rp1,1 triliun pada kuartal 4 2019");
    expect(screen.getByTestId("tinjau-usulan-ekuitas_negatif")).toBeInTheDocument();
    // Penanda seluruh jawaban menyebut frasa yang ditemukan.
    expect(screen.getByTestId("tinjau-diagnosis")).toHaveTextContent("porsimu");
  });

  it("Simpan alarm: server 503 (tanpa DB) → tersimpan di localStorage dengan token pemilik", async () => {
    render(<PapanRakit />);
    expect(screen.getByRole("button", { name: TEKS.tombolSimpan })).toBeDisabled();
    fireEvent.click(screen.getByTestId("palet-aksi_dilutif"));
    fireEvent.click(screen.getByRole("button", { name: TEKS.tombolSimpan }));
    await waitFor(() => expect(screen.getByTestId("catatan-simpan")).toHaveTextContent(/tersimpan di browser ini/));
    const kirim = panggilan.find((p) => p.url === "/api/alarms")!.body as { owner_token: string; rules: Rule[] };
    expect(kirim.owner_token).toBe(window.localStorage.getItem("alarm-saham.pemilik"));
    expect(kirim.rules[0].blocks[0].kind).toBe("aksi_dilutif");
    const lokal = JSON.parse(window.localStorage.getItem("alarm-saham.alarm")!);
    expect(lokal).toHaveLength(1);
    expect(lokal[0]).toMatchObject({ di: "lokal", rule: { blocks: [{ kind: "aksi_dilutif", threshold: "longgar" }] } });
  });
});
