// Regresi: tiap elemen dalam array `langkah` harus punya `key`, atau React
// mengeluarkan "Each child in a list should have a unique key prop". Peringatan
// itu hanya muncul di console.error (tidak membuat tes gagal), jadi di sini
// dipasang pengintai console.error untuk menguncinya.
import { render, screen, cleanup } from "@testing-library/react";
import { Fragment } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PetunjukLayar } from "@/components/panduan/PetunjukLayar";

function intaiConsole() {
  const galat = vi.spyOn(console, "error").mockImplementation(() => {});
  return galat;
}

function adaPesanKunci(galat: ReturnType<typeof vi.spyOn>): boolean {
  return galat.mock.calls.some((args: unknown[]) =>
    args.some((a: unknown) => typeof a === "string" && /key prop/i.test(a)),
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("PetunjukLayar: array langkah bebas peringatan key", () => {
  it("string polos (tanpa elemen) tidak memicu peringatan key", () => {
    const galat = intaiConsole();
    render(<PetunjukLayar langkah={["Langkah pertama.", "Langkah kedua."]} />);
    expect(screen.getAllByTestId("petunjuk")).toHaveLength(2);
    expect(adaPesanKunci(galat)).toBe(false);
  });

  it("elemen JSX dengan key (Fragment) tidak memicu peringatan key", () => {
    const galat = intaiConsole();
    render(
      <PetunjukLayar
        langkah={[
          <Fragment key="a">
            <strong>Seret</strong> blok.
          </Fragment>,
          <Fragment key="b">Klik tombol.</Fragment>,
        ]}
      />,
    );
    expect(screen.getAllByTestId("petunjuk")).toHaveLength(2);
    expect(adaPesanKunci(galat)).toBe(false);
  });
});
