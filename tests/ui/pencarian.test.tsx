// Kotak cari /putar-ulang: kalimat cakupannya WAJIB mengikuti sumber data yang
// benar-benar dipakai server.
//
// Cacat yang ditutup: komponen ini dulu tidak punya satu pun prop sumber dan
// merender tanpa syarat "Yang tampil hanya data yang benar-benar ada di data
// kami (107 emiten universe uji + feed suspensi seluruh bursa)" — tiga baris di
// bawah lede halaman yang sama yang mengaku "data contoh (8 emiten)".
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Pencarian } from "../../src/components/putar-ulang/Pencarian";

describe("Pencarian — klaim cakupan mengikuti sumber", () => {
  it("jalur data contoh: menyebut jumlah nyata fixture, tanpa janji universe/feed Sectors", () => {
    render(<Pencarian kode={null} cakupan={{ jumlah: 8, contoh: true }} opsi={[]} />);
    const hint = screen.getByTestId("cakupan-cari");
    expect(hint).toHaveAttribute("data-sumber", "fixture");
    expect(hint).toHaveTextContent("8 emiten data contoh");
    expect(hint.textContent).not.toMatch(/\b107\b/);
    expect(hint.textContent).not.toMatch(/universe uji/i);
    expect(hint.textContent).not.toMatch(/feed suspensi/i);
  });

  it("jalur data nyata: menyebut universe uji dan feed suspensi bursa", () => {
    render(<Pencarian kode={null} cakupan={{ jumlah: 107, contoh: false }} opsi={[]} />);
    const hint = screen.getByTestId("cakupan-cari");
    expect(hint).toHaveAttribute("data-sumber", "db");
    expect(hint).toHaveTextContent("107 emiten universe uji");
    expect(hint.textContent).toMatch(/feed suspensi/i);
  });
});

describe("Pencarian — saran ketik", () => {
  const OPSI = [
    { symbol: "BBCA", nama: "PT Bank Central Asia Tbk." },
    { symbol: "BAJA", nama: null },
    { symbol: "SRIL", nama: "PT Sri Rejeki Isman Tbk" },
  ];

  it("input tertaut ke <datalist>; tiap emiten jadi satu opsi, nama dipakai bila ada", () => {
    // Pemilik membaca enam chip "Kasus nyata" sebagai satu-satunya isi database,
    // padahal jalur database memuat 363 emiten. Saran ketik memakai <datalist>
    // bawaan peramban supaya tetap bekerja tanpa JavaScript di form GET ini.
    render(<Pencarian kode={null} cakupan={{ jumlah: 107, contoh: false }} opsi={OPSI} />);
    const input = screen.getByTestId("kotak-kode");
    const daftar = screen.getByTestId("saran-emiten");
    expect(input).toHaveAttribute("list", daftar.id);
    const opsi = [...daftar.querySelectorAll("option")];
    expect(opsi.map((o) => o.getAttribute("value"))).toEqual(["BBCA", "BAJA", "SRIL"]);
    // Emiten tanpa nama (hanya muncul di feed suspensi) menampilkan kodenya.
    expect(opsi.map((o) => o.textContent)).toEqual(["PT Bank Central Asia Tbk.", "BAJA", "PT Sri Rejeki Isman Tbk"]);
  });

  it("placeholder menyebut berapa emiten yang bisa dicari, dari opsi yang benar-benar dikirim", () => {
    render(<Pencarian kode={null} cakupan={{ jumlah: 107, contoh: false }} opsi={OPSI} />);
    expect(screen.getByTestId("kotak-kode")).toHaveAttribute("placeholder", expect.stringContaining("3 emiten"));
  });
});
