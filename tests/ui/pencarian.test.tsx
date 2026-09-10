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
    render(<Pencarian kode={null} cakupan={{ jumlah: 8, contoh: true }} />);
    const hint = screen.getByTestId("cakupan-cari");
    expect(hint).toHaveAttribute("data-sumber", "fixture");
    expect(hint).toHaveTextContent("8 emiten data contoh");
    expect(hint.textContent).not.toMatch(/\b107\b/);
    expect(hint.textContent).not.toMatch(/universe uji/i);
    expect(hint.textContent).not.toMatch(/feed suspensi/i);
  });

  it("jalur data nyata: menyebut universe uji dan feed suspensi bursa", () => {
    render(<Pencarian kode={null} cakupan={{ jumlah: 107, contoh: false }} />);
    const hint = screen.getByTestId("cakupan-cari");
    expect(hint).toHaveAttribute("data-sumber", "db");
    expect(hint).toHaveTextContent("107 emiten universe uji");
    expect(hint.textContent).toMatch(/feed suspensi/i);
  });
});
