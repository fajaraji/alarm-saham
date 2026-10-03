// Kotak kode /pasang (tiket 45): menyatu dengan tombol tambah + saran ketik
// <datalist>, pola yang sama dengan kotak cari /putar-ulang.
//
// Cacat yang ditutup: kotak di layar ini dulu input telanjang + tombol di
// luar, tanpa satu pun saran ketik, sehingga pengguna hanya bisa menebak kode
// yang benar-benar ada di data server. Daftarnya kini datang lewat prop `opsi`
// dari halaman server (bukan dibuka sendiri oleh komponen klien), dan
// jumlahnya TIDAK dipaku di sini: placeholder mengikuti panjang daftar yang
// benar-benar dikirim.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PanelPasang } from "../../src/components/pasang/PanelPasang";
import { TEKS } from "../../src/components/pasang/teks";

const OPSI = [
  { symbol: "BBCA", nama: "PT Bank Central Asia Tbk." },
  { symbol: "BAJA", nama: null },
  { symbol: "SRIL", nama: "PT Sri Rejeki Isman Tbk" },
];

beforeEach(() => {
  window.localStorage.clear();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ error: { kode: "DB_TIDAK_TERSEDIA", pesan: "tanpa DB" } }), { status: 501 })),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe("PanelPasang — kotak kode menyatu dengan saran ketik", () => {
  it("input tertaut ke <datalist>; tiap emiten jadi satu opsi, nama dipakai bila ada", () => {
    render(<PanelPasang opsi={OPSI} />);
    const input = screen.getByTestId("kotak-kode");
    const daftar = screen.getByTestId("saran-emiten");
    expect(input).toHaveAttribute("list", daftar.id);
    const opsi = [...daftar.querySelectorAll("option")];
    expect(opsi.map((o) => o.getAttribute("value"))).toEqual(["BBCA", "BAJA", "SRIL"]);
    // Emiten tanpa nama (hanya muncul di feed suspensi) menampilkan kodenya.
    expect(opsi.map((o) => o.textContent)).toEqual(["PT Bank Central Asia Tbk.", "BAJA", "PT Sri Rejeki Isman Tbk"]);
  });

  it("placeholder menyebut berapa emiten yang bisa dicari, dari opsi yang benar-benar dikirim", () => {
    render(<PanelPasang opsi={OPSI} />);
    expect(screen.getByTestId("kotak-kode")).toHaveAttribute("placeholder", TEKS.placeholderKode(3));
    expect(screen.getByTestId("kotak-kode")).toHaveAttribute("placeholder", expect.stringContaining("3 emiten"));
  });

  it("tanpa saran (server tanpa universe): placeholder tanpa angka, janji jumlah tidak dikarang", () => {
    render(<PanelPasang />);
    expect(screen.getByTestId("kotak-kode")).toHaveAttribute("placeholder", TEKS.placeholderKodeTanpaSaran);
    expect(screen.getByTestId("saran-emiten").querySelectorAll("option")).toHaveLength(0);
  });

  it("tombol tambah duduk di dalam kotak yang sama dengan input (satu wadah)", () => {
    render(<PanelPasang opsi={OPSI} />);
    const kotak = screen.getByTestId("field-kode");
    expect(kotak).toContainElement(screen.getByTestId("kotak-kode"));
    expect(kotak).toContainElement(screen.getByTestId("tombol-tambah"));
    expect(screen.getByTestId("tombol-tambah")).toHaveTextContent(TEKS.tombolTambah);
  });

  it("pilih dari saran lalu kirim form tetap menambah saham ke peta", async () => {
    render(<PanelPasang opsi={OPSI} />);
    await waitFor(() => expect(screen.getByTestId("label-penyimpanan")).not.toHaveTextContent("memuat"));
    fireEvent.change(screen.getByTestId("kotak-kode"), { target: { value: "bbca" } });
    fireEvent.click(screen.getByTestId("tombol-tambah"));
    expect(await screen.findByTestId("tile-BBCA")).toBeInTheDocument();
  });
});