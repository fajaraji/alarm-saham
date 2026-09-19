// Dialog tautan rahasia (tiket 24), jsdom. Clipboard ditiru; salin sungguhan
// dan fokus keyboard di browser nyata diuji di tests/e2e/tautan.spec.ts.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DialogTautan, TEKS_DIALOG_TAUTAN } from "../../src/components/ui/DialogTautan";

const TAUTAN = "https://contoh.id/pasang#kunci=aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa";

function pasangClipboard(writeText: (t: string) => Promise<void>) {
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
}

afterEach(() => {
  Reflect.deleteProperty(navigator, "clipboard");
  vi.restoreAllMocks();
});

/** Induk kecil: tombol pembuka + dialog, untuk menguji fokus kembali. */
function Pembuka({ tautan }: { tautan: string | null }) {
  const [buka, setBuka] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setBuka(true)}>
        Buka tautan
      </button>
      {buka ? <DialogTautan tautan={tautan} onTutup={() => setBuka(false)} /> : null}
    </>
  );
}

describe("DialogTautan", () => {
  it("menampilkan tautan, penjelasan satu-satunya jalan, dan Salin memberi umpan balik", async () => {
    const tulis = vi.fn(async () => {});
    pasangClipboard(tulis);
    render(<DialogTautan tautan={TAUTAN} onTutup={() => {}} />);
    const dialog = screen.getByRole("dialog", { name: TEKS_DIALOG_TAUTAN.judul });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveTextContent("satu-satunya cara");
    expect(screen.getByLabelText(TEKS_DIALOG_TAUTAN.label)).toHaveValue(TAUTAN);

    fireEvent.click(screen.getByRole("button", { name: TEKS_DIALOG_TAUTAN.tombolSalin }));
    await waitFor(() => expect(screen.getByTestId("status-salin")).toHaveTextContent(TEKS_DIALOG_TAUTAN.tersalin));
    expect(tulis).toHaveBeenCalledWith(TAUTAN);
    expect(screen.getByTestId("status-salin")).toHaveAttribute("role", "status");
  });

  it("clipboard ditolak dan salin cadangan gagal: tautan ditandai dan pengguna diminta menyalin sendiri", async () => {
    pasangClipboard(async () => {
      throw new Error("ditolak");
    });
    Object.defineProperty(document, "execCommand", { value: () => false, configurable: true });
    render(<DialogTautan tautan={TAUTAN} onTutup={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: TEKS_DIALOG_TAUTAN.tombolSalin }));
    await waitFor(() => expect(screen.getByTestId("status-salin")).toHaveTextContent("Ctrl+C"));
    expect(document.activeElement).toBe(screen.getByTestId("kotak-tautan"));
    Reflect.deleteProperty(document, "execCommand");
  });

  it("server tanpa database: tidak ada tautan, dialog berkata alarm hanya di browser ini", () => {
    render(<DialogTautan tautan={null} onTutup={() => {}} />);
    expect(screen.getByRole("dialog", { name: TEKS_DIALOG_TAUTAN.judulLokal })).toBeInTheDocument();
    expect(screen.getByTestId("dialog-tautan-lokal")).toHaveTextContent("belum punya database");
    expect(screen.queryByTestId("kotak-tautan")).toBeNull();
    expect(screen.queryByRole("button", { name: TEKS_DIALOG_TAUTAN.tombolSalin })).toBeNull();
  });

  it("Escape dan tombol Tutup menutup; fokus kembali ke tombol yang membukanya", () => {
    render(<Pembuka tautan={TAUTAN} />);
    const pembuka = screen.getByRole("button", { name: "Buka tautan" });

    pembuka.focus();
    fireEvent.click(pembuka);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(pembuka);

    pembuka.focus();
    fireEvent.click(pembuka);
    fireEvent.click(screen.getByRole("button", { name: TEKS_DIALOG_TAUTAN.tombolTutup }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(pembuka);
  });
});
