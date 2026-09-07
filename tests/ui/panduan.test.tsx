// Lapisan "untuk orang awam" (tiket 13), jsdom + Testing Library:
// overlay panduan kunjungan pertama, tombol Panduan, tooltip <Istilah> yang
// aksesibel, cakupan kamus vs istilah yang dipakai komponen, footer disclaimer.
import { fireEvent, render, screen, within } from "@testing-library/react";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import HalamanCaraKamiMenghitung from "../../src/app/cara-kami-menghitung/page";
import HalamanKamus from "../../src/app/kamus/page";
import HalamanPasang from "../../src/app/pasang/page";
import HalamanRakit from "../../src/app/rakit/page";
import { FooterDisclaimer } from "../../src/components/panduan/FooterDisclaimer";
import { HeaderNav } from "../../src/components/panduan/HeaderNav";
import { Istilah } from "../../src/components/panduan/Istilah";
import { DISCLAIMER, ID_ISTILAH, ISTILAH_BLOK, ISTILAH_BLOK_B, KAMUS, KUNCI_PANDUAN_SELESAI, entriKamus, type IdIstilah } from "../../src/components/panduan/kamus";
import { LANGKAH_PANDUAN, OverlayPanduan } from "../../src/components/panduan/OverlayPanduan";
import { PanduanProvider } from "../../src/components/panduan/PanduanContext";
import { PetunjukLayar } from "../../src/components/panduan/PetunjukLayar";
import { TombolPanduan } from "../../src/components/panduan/TombolPanduan";
import { BLOCK_KINDS } from "../../src/lib/engine/rules";
import { BLOK_B_KINDS } from "../../src/lib/jaga/blok-b";

vi.mock("next/navigation", () => ({ usePathname: () => "/rakit" }));

function Aplikasi({ children }: { children?: React.ReactNode }) {
  return (
    <PanduanProvider>
      <HeaderNav />
      <OverlayPanduan />
      {children}
      <FooterDisclaimer />
    </PanduanProvider>
  );
}

beforeEach(() => {
  window.localStorage.clear();
  // Halaman Pasang memanggil /api/* saat muat; jawab "tanpa DB" agar tanpa jaringan.
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ error: { kode: "DB_TIDAK_TERSEDIA", pesan: "tanpa DB" } }), { status: 501 })),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe("OverlayPanduan", () => {
  it("tampil pada kunjungan pertama; 'Saya sudah paham' menutup & menandai localStorage", () => {
    render(<Aplikasi />);
    const dialog = screen.getByRole("dialog", { name: /cara pakainya dalam 3 langkah/ });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getAllByRole("listitem")).toHaveLength(3);
    for (const l of LANGKAH_PANDUAN) expect(dialog).toHaveTextContent(l.judul);
    expect(screen.getByTestId("panduan-mulai")).toHaveAttribute("href", "/putar-ulang");
    fireEvent.click(screen.getByTestId("panduan-paham"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(window.localStorage.getItem(KUNCI_PANDUAN_SELESAI)).toBe("1");
  });

  it("tidak tampil pada kunjungan kedua; tombol Panduan membukanya lagi; Esc menutup", () => {
    window.localStorage.setItem(KUNCI_PANDUAN_SELESAI, "1");
    render(<Aplikasi />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("tombol-panduan"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("'Mulai dari langkah 1' menandai selesai dan menutup", () => {
    render(<Aplikasi />);
    // jsdom tidak bisa navigasi; cegah default agar tidak ada peringatan "Not implemented".
    document.addEventListener("click", (e) => e.preventDefault(), { once: true });
    fireEvent.click(screen.getByTestId("panduan-mulai"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(window.localStorage.getItem(KUNCI_PANDUAN_SELESAI)).toBe("1");
  });

  it("TombolPanduan di luar provider melempar galat yang jelas", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<TombolPanduan />)).toThrow(/PanduanProvider/);
    vi.restoreAllMocks();
  });
});

describe("Istilah (tooltip kamus)", () => {
  it("tombol ber-aria-describedby ke tooltip; buka saat klik/fokus/hover; Esc menutup", () => {
    render(
      <p>
        Saham ini <Istilah id="suspensi">disuspensi</Istilah>.
      </p>,
    );
    const tombol = screen.getByRole("button", { name: "disuspensi" });
    const tip = screen.getByTestId("tooltip-suspensi");
    expect(tombol).toHaveAttribute("aria-describedby", tip.id);
    expect(tombol).toHaveAttribute("aria-expanded", "false");
    expect(tip).toHaveAttribute("role", "tooltip");
    expect(tip).not.toBeVisible();

    fireEvent.click(tombol);
    expect(tip).toBeVisible();
    expect(tombol).toHaveAttribute("aria-expanded", "true");
    expect(tip).toHaveTextContent(entriKamus("suspensi").definisi);
    expect(tip).toHaveTextContent(entriKamus("suspensi").perumpamaan);
    expect(within(tip).getByRole("link", { name: /Lihat di Kamus/ })).toHaveAttribute("href", "/kamus#suspensi");

    fireEvent.keyDown(document, { key: "Escape" });
    expect(tip).not.toBeVisible();
    expect(tombol).toHaveAttribute("aria-expanded", "false");

    fireEvent.focus(tombol);
    expect(tip).toBeVisible();
    fireEvent.blur(tombol, { relatedTarget: document.body });
    expect(tip).not.toBeVisible();

    fireEvent.mouseEnter(tombol.parentElement!);
    expect(tip).toBeVisible();
    fireEvent.mouseLeave(tombol.parentElement!);
    expect(tip).not.toBeVisible();
  });

  it("klik di luar menutup tooltip yang dikunci klik", () => {
    render(
      <div>
        <button type="button">lain</button>
        <Istilah id="alarm_palsu">alarm palsu</Istilah>
      </div>,
    );
    fireEvent.click(screen.getByRole("button", { name: "alarm palsu" }));
    expect(screen.getByTestId("tooltip-alarm_palsu")).toBeVisible();
    fireEvent.mouseDown(screen.getByRole("button", { name: "lain" }));
    expect(screen.getByTestId("tooltip-alarm_palsu")).not.toBeVisible();
  });
});

describe("Kamus: cakupan istilah", () => {
  const WAJIB: IdIstilah[] = [
    "suspensi",
    "delisting",
    "laporan_hilang",
    "insider_jual",
    "ekuitas_negatif",
    "rights_issue",
    "free_float",
    "ritel_dominan",
    "alarm_palsu",
    "lebih_awal",
    "kontrol_sehat",
    "pemantauan_khusus",
  ];

  it("setiap istilah wajib (tiket 13) punya definisi, perumpamaan, dan tautan halaman", () => {
    for (const id of WAJIB) {
      const e = entriKamus(id);
      expect(e.definisi.length, id).toBeGreaterThan(30);
      expect(e.perumpamaan.length, id).toBeGreaterThan(20);
      expect(e.lihat.length, id).toBeGreaterThan(0);
    }
    expect(new Set(KAMUS.map((e) => e.id)).size).toBe(KAMUS.length);
    expect(KAMUS.map((e) => e.id).sort()).toEqual([...ID_ISTILAH].sort());
  });

  it("setiap blok kelas A dan B dipetakan ke istilah kamus", () => {
    for (const k of BLOCK_KINDS) expect(() => entriKamus(ISTILAH_BLOK[k])).not.toThrow();
    for (const k of BLOK_B_KINDS) expect(() => entriKamus(ISTILAH_BLOK_B[k])).not.toThrow();
  });

  it("semua id yang dipakai <Istilah id=\"…\"> di src/ ada di kamus (pindai berkas)", () => {
    const akar = path.resolve(process.cwd(), "src");
    const berkas: string[] = [];
    (function jelajah(dir: string) {
      for (const nama of readdirSync(dir)) {
        const p = path.join(dir, nama);
        if (statSync(p).isDirectory()) jelajah(p);
        else if (/\.tsx?$/.test(nama)) berkas.push(p);
      }
    })(akar);
    const dipakai = new Set<string>();
    for (const f of berkas) {
      for (const m of readFileSync(f, "utf8").matchAll(/<Istilah\s+id="([a-z_]+)"/g)) dipakai.add(m[1]);
    }
    expect(dipakai.size).toBeGreaterThanOrEqual(10);
    for (const id of dipakai) expect(ID_ISTILAH, id).toContain(id);
  });

  it("halaman /kamus merender semua entri dengan anchor dan tautan 'lihat di halaman'", () => {
    render(<HalamanKamus />);
    for (const e of KAMUS) {
      const kartu = screen.getByTestId(`kamus-${e.id}`);
      expect(kartu).toHaveAttribute("id", e.id);
      expect(kartu).toHaveTextContent(e.istilah);
      expect(kartu).toHaveTextContent(e.perumpamaan);
      for (const l of e.lihat) expect(within(kartu).getByRole("link", { name: l.label })).toHaveAttribute("href", l.href);
    }
  });

  it("layar Rakit, Pasang, dan Cara kami menghitung memuat istilah bertooltip yang semuanya ada di kamus", () => {
    for (const Halaman of [HalamanRakit, HalamanPasang, HalamanCaraKamiMenghitung]) {
      const { container, unmount } = render(<Halaman />);
      const tombol = container.querySelectorAll<HTMLElement>("button[data-istilah]");
      expect(tombol.length, Halaman.name).toBeGreaterThanOrEqual(3);
      for (const b of tombol) {
        expect(ID_ISTILAH).toContain(b.dataset.istilah);
        expect(b).toHaveAttribute("aria-describedby");
      }
      expect(container.querySelectorAll("[data-testid='petunjuk']").length, Halaman.name).toBe(Halaman === HalamanCaraKamiMenghitung ? 0 : 3);
      unmount();
    }
  });
});

describe("Header, petunjuk, dan footer", () => {
  it("header memuat langkah 1–3, Kamus, Cara kami menghitung, tombol Panduan; aria-current mengikuti pathname", () => {
    render(<Aplikasi />);
    const nav = screen.getByRole("navigation", { name: "Langkah" });
    expect(within(nav).getByRole("link", { name: /Rakit alarm/ })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: /Putar ulang/ })).not.toHaveAttribute("aria-current");
    expect(within(nav).getByRole("link", { name: /Kamus/ })).toHaveAttribute("href", "/kamus");
    expect(within(nav).getByRole("link", { name: "Cara kami menghitung" })).toHaveAttribute("href", "/cara-kami-menghitung");
    expect(screen.getByTestId("tombol-panduan")).toHaveTextContent("Panduan");
  });

  it("PetunjukLayar menomori tiga langkah", () => {
    render(<PetunjukLayar langkah={["a", "b", "c"]} />);
    const daftar = screen.getByRole("list", { name: "Cara pakai layar ini" });
    expect(within(daftar).getAllByRole("listitem").map((li) => li.textContent)).toEqual(["1a", "2b", "3c"]);
  });

  it("footer disclaimer memuat kalimat PLAN §2 dan tautan kamus/metodologi", () => {
    render(<FooterDisclaimer />);
    const footer = screen.getByTestId("disclaimer");
    expect(footer).toHaveTextContent(DISCLAIMER);
    expect(footer).toHaveTextContent("bukan saran investasi");
    expect(within(footer).getByRole("link", { name: "Kamus istilah" })).toHaveAttribute("href", "/kamus");
  });
});
