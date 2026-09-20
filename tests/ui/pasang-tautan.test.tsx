// Tautan rahasia `/pasang#kunci=...` (tiket 23), jsdom + Testing Library.
// Server ditiru per URL: portofolio disimpan per token di peta, persis seperti
// /api/portofolio membedakan pemilik lewat header x-owner-token. Nol kredit.
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PanelPasang } from "../../src/components/pasang/PanelPasang";
import { TEKS_TAUTAN } from "../../src/components/pasang/teks";
import { KUNCI_PORTOFOLIO } from "../../src/lib/jaga/simpan";
import { bacaKunciTautan, KUNCI_ALARM, KUNCI_PEMILIK, tautanPemilik } from "../../src/lib/rakit/simpan";

const KUNCI_A = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa";
const KUNCI_B = "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb";

let adaDb = true;
const portofolioServer = new Map<string, string[]>();

function json(status: number, isi: unknown): Response {
  return new Response(JSON.stringify(isi), { status, headers: { "content-type": "application/json" } });
}

beforeEach(() => {
  adaDb = true;
  portofolioServer.clear();
  portofolioServer.set(KUNCI_A, ["BBCA", "SRIL"]);
  portofolioServer.set(KUNCI_B, ["TLKM"]);
  window.localStorage.clear();
  window.history.replaceState(null, "", "/pasang");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const u = String(url);
      const token = new Headers(init?.headers).get("x-owner-token");
      if (u.startsWith("/api/emiten/")) return json(200, {});
      if (!adaDb) return json(501, { error: { kode: "DB_TIDAK_TERSEDIA", pesan: "tanpa DB" } });
      if (u === "/api/portofolio" && (init?.method ?? "GET") === "GET") {
        const s = token ? portofolioServer.get(token) : undefined;
        return json(200, { portofolio: s ? { id: `p-${token!.slice(0, 4)}`, symbols: s, alarmIds: [] } : null });
      }
      if (u === "/api/portofolio") return json(200, { portofolio: { id: "p-baru", symbols: [], alarmIds: [] } });
      if (u === "/api/alarms") return json(200, { alarms: [] });
      if (u === "/api/inbox") return json(200, { pesan: [], belumDibaca: 0 });
      return json(404, { error: { kode: "TIDAK_ADA", pesan: u } });
    }),
  );
});

afterEach(() => vi.unstubAllGlobals());

async function tungguMuat() {
  await waitFor(() => expect(screen.getByTestId("label-penyimpanan")).not.toHaveTextContent("memuat"));
}

describe("bacaKunciTautan dan tautanPemilik", () => {
  it("tautan yang dibuat bisa dibaca kembali menjadi kunci yang sama; kunci ada di fragment", () => {
    const t = tautanPemilik("https://contoh.id", KUNCI_A);
    expect(t).toBe(`https://contoh.id/pasang#kunci=${KUNCI_A}`);
    expect(bacaKunciTautan(new URL(t).hash)).toEqual({ jenis: "sah", kunci: KUNCI_A });
    expect(new URL(t).search).toBe("");
  });

  it("kunci yang terpotong, kosong, atau berisi karakter asing ditolak", () => {
    expect(bacaKunciTautan("#kunci=abc")).toEqual({ jenis: "tidak-sah" });
    expect(bacaKunciTautan("#kunci=")).toEqual({ jenis: "tidak-sah" });
    expect(bacaKunciTautan(`#kunci=${KUNCI_A.slice(0, 20)}<script>`)).toEqual({ jenis: "tidak-sah" });
    expect(bacaKunciTautan("#lain=1")).toEqual({ jenis: "tidak-ada" });
    expect(bacaKunciTautan("")).toEqual({ jenis: "tidak-ada" });
  });
});

describe("PanelPasang dibuka lewat tautan rahasia", () => {
  it("browser tanpa kunci juga ditanya dulu, dengan peringatan; Buka memakai kunci dari tautan", async () => {
    // Temuan security review: dulu kunci dipakai diam-diam di browser tanpa
    // kunci, sehingga pengirim tautan ikut melihat semua yang ditambahkan sesudahnya.
    window.history.replaceState(null, "", `/pasang#kunci=${KUNCI_A}`);
    render(<PanelPasang />);
    const dialog = await screen.findByTestId("dialog-ganti-pemilik");
    expect(dialog).toHaveTextContent(TEKS_TAUTAN.konfirmasiTeksBaru);
    expect(window.localStorage.getItem(KUNCI_PEMILIK)).not.toBe(KUNCI_A);
    expect(window.location.hash).toBe("");
    fireEvent.click(screen.getByRole("button", { name: TEKS_TAUTAN.tombolBuka }));
    await tungguMuat();
    expect(await screen.findByTestId("tile-BBCA")).toBeInTheDocument();
    expect(screen.getByTestId("tile-SRIL")).toBeInTheDocument();
    expect(window.localStorage.getItem(KUNCI_PEMILIK)).toBe(KUNCI_A);
    expect(screen.getByTestId("pesan-tautan")).toHaveTextContent(TEKS_TAUTAN.pulih);
    expect(window.location.hash).toBe("");
    expect(window.location.pathname).toBe("/pasang");
    expect(screen.queryByTestId("dialog-ganti-pemilik")).toBeNull();
  });

  it("browser tanpa kunci yang membatalkan memulai portofolionya sendiri", async () => {
    window.history.replaceState(null, "", `/pasang#kunci=${KUNCI_A}`);
    render(<PanelPasang />);
    await screen.findByTestId("dialog-ganti-pemilik");
    fireEvent.click(screen.getByRole("button", { name: TEKS_TAUTAN.tombolBatalBaru }));
    await tungguMuat();
    expect(window.localStorage.getItem(KUNCI_PEMILIK)).not.toBe(KUNCI_A);
    expect(screen.queryByTestId("tile-BBCA")).toBeNull();
    expect(screen.getByTestId("pesan-tautan")).toHaveAttribute("data-jenis", "batalBaru");
  });

  it("browser dengan kunci lain bertanya dulu; Batal tidak mengubah apa pun", async () => {
    window.localStorage.setItem(KUNCI_PEMILIK, KUNCI_B);
    window.history.replaceState(null, "", `/pasang#kunci=${KUNCI_A}`);
    render(<PanelPasang />);
    await tungguMuat();
    const dialog = await screen.findByTestId("dialog-ganti-pemilik");
    expect(dialog).toHaveAttribute("role", "dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(window.location.hash).toBe("");

    // Portofolio yang tampil di belakang dialog tetap milik kunci lama.
    expect(await screen.findByTestId("tile-TLKM")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("tombol-batal-ganti"));

    expect(screen.queryByTestId("dialog-ganti-pemilik")).toBeNull();
    expect(window.localStorage.getItem(KUNCI_PEMILIK)).toBe(KUNCI_B);
    expect(screen.getByTestId("tile-TLKM")).toBeInTheDocument();
    expect(screen.queryByTestId("tile-BBCA")).toBeNull();
    expect(screen.getByTestId("pesan-tautan")).toHaveAttribute("data-jenis", "batal");
  });

  it("Escape sama dengan Batal", async () => {
    window.localStorage.setItem(KUNCI_PEMILIK, KUNCI_B);
    window.history.replaceState(null, "", `/pasang#kunci=${KUNCI_A}`);
    render(<PanelPasang />);
    await screen.findByTestId("dialog-ganti-pemilik");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByTestId("dialog-ganti-pemilik")).toBeNull();
    expect(window.localStorage.getItem(KUNCI_PEMILIK)).toBe(KUNCI_B);
  });

  it("Ganti memakai kunci dari tautan dan membuang salinan milik pemilik lama dari browser", async () => {
    window.localStorage.setItem(KUNCI_PEMILIK, KUNCI_B);
    window.localStorage.setItem(KUNCI_PORTOFOLIO, JSON.stringify({ symbols: ["TLKM"], alarmIds: [], disimpanPada: "x" }));
    const rule = { name: "Uji", combine: "any", blocks: [{ kind: "suspensi", threshold: "longgar" }] };
    window.localStorage.setItem(
      KUNCI_ALARM,
      JSON.stringify([
        { id: "server-lama", name: "Di server", rule, lastScore: null, disimpanPada: "x", di: "db" },
        { id: "hanya-lokal", name: "Hanya di sini", rule, lastScore: null, disimpanPada: "x", di: "lokal" },
      ]),
    );
    window.history.replaceState(null, "", `/pasang#kunci=${KUNCI_A}`);
    render(<PanelPasang />);
    await screen.findByTestId("dialog-ganti-pemilik");
    fireEvent.click(screen.getByTestId("tombol-ganti-pemilik"));

    expect(await screen.findByTestId("tile-BBCA")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId("pesan-tautan")).toHaveAttribute("data-jenis", "pulih"));
    expect(screen.queryByTestId("tile-TLKM")).toBeNull();
    expect(window.localStorage.getItem(KUNCI_PEMILIK)).toBe(KUNCI_A);
    const alarm = JSON.parse(window.localStorage.getItem(KUNCI_ALARM) ?? "[]") as { id: string }[];
    expect(alarm.map((a) => a.id)).toEqual(["hanya-lokal"]);
  });

  it("kunci yang tidak sah ditolak dengan pesan dan tidak disimpan", async () => {
    window.history.replaceState(null, "", "/pasang#kunci=pendek");
    render(<PanelPasang />);
    await tungguMuat();
    const pesan = screen.getByTestId("pesan-tautan");
    expect(pesan).toHaveTextContent(TEKS_TAUTAN.tidakSah);
    expect(pesan).toHaveAttribute("role", "alert");
    expect(window.localStorage.getItem(KUNCI_PEMILIK)).not.toBe("pendek");
    expect(window.location.hash).toBe("");
  });

  it("server tanpa database mengatakan terus terang bahwa tidak ada yang bisa dipulihkan", async () => {
    adaDb = false;
    window.history.replaceState(null, "", `/pasang#kunci=${KUNCI_A}`);
    render(<PanelPasang />);
    await screen.findByTestId("dialog-ganti-pemilik");
    fireEvent.click(screen.getByTestId("tombol-ganti-pemilik"));
    await tungguMuat();
    await waitFor(() => expect(screen.getByTestId("pesan-tautan")).toHaveTextContent(TEKS_TAUTAN.tanpaDb));
    expect(screen.queryByTestId("tile-BBCA")).toBeNull();
  });

  it("tautan yang ditempel saat /pasang sudah terbuka (hanya hash berubah) tetap ditangani", async () => {
    window.localStorage.setItem(KUNCI_PEMILIK, KUNCI_B);
    render(<PanelPasang />);
    await tungguMuat();
    expect(screen.queryByTestId("dialog-ganti-pemilik")).toBeNull();
    act(() => {
      window.history.replaceState(null, "", `/pasang#kunci=${KUNCI_A}`);
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(await screen.findByTestId("dialog-ganti-pemilik")).toBeInTheDocument();
    expect(window.location.hash).toBe("");
  });
});
