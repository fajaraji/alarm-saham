// Halaman /cara-kami-menghitung (jsdom + Testing Library): angka yang tampil
// harus sama dengan snapshot docs/skor-nyata.json dan konstanta mesin uji.
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import HalamanCaraKamiMenghitung from "../../src/app/cara-kami-menghitung/page";
import { TENGGAT_LAPORAN_HARI } from "../../src/lib/engine/evaluate";
import { BLOCK_KINDS, LABEL_BLOK } from "../../src/lib/engine/rules";
import { KREDIT_ANGGARAN, KREDIT_TOTAL_LEDGER, ringkasSkor, SKOR_NYATA } from "../../src/lib/metodologi/skor";

describe("/cara-kami-menghitung", () => {
  it("menampilkan skor nyata dari snapshot: tertangkap, per kelompok, lebih awal, alarm palsu, dilewati", () => {
    render(<HalamanCaraKamiMenghitung />);
    const s = ringkasSkor(SKOR_NYATA);

    expect(screen.getByRole("heading", { level: 1, name: "Cara kami menghitung" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: new RegExp(`snapshot ${SKOR_NYATA.today}`) })).toBeInTheDocument();

    expect(screen.getByTestId("stat-tertangkap")).toHaveTextContent(`${s.hits}/${s.total}`);
    expect(screen.getByTestId("stat-tertangkap")).toHaveTextContent(
      `delisting ${s.delisting.hits}/${s.delisting.total} · pemantauan khusus ${s.watchlist.hits}/${s.watchlist.total}`,
    );
    expect(screen.getByTestId("stat-lebih-awal")).toHaveTextContent(`${s.leadAvg} bln`);
    expect(screen.getByTestId("stat-lebih-awal")).toHaveTextContent(`median ${s.leadMedian} bln`);
    expect(screen.getByTestId("stat-alarm-palsu")).toHaveTextContent(`${s.falseAlarms}/${s.controls}`);
    expect(screen.getByTestId("stat-dilewati")).toHaveTextContent(String(s.skipped.length));
    for (const k of s.skipped) expect(screen.getByTestId("stat-dilewati")).toHaveTextContent(k);
  });

  it("tabel per emiten memuat semua baris snapshot dengan status yang benar", () => {
    render(<HalamanCaraKamiMenghitung />);
    for (const g of ["delisting", "watchlist", "control"] as const) {
      const tabel = within(screen.getByTestId(`tabel-${g}`));
      const baris = tabel.getAllByTestId("baris-emiten");
      expect(baris).toHaveLength(SKOR_NYATA.perGroup[g].perSymbol.length);
    }
    const semua = screen.getAllByTestId("baris-emiten");
    expect(semua).toHaveLength(SKOR_NYATA.perSymbol.length);
    for (const r of SKOR_NYATA.perSymbol) {
      const el = semua.find((b) => b.dataset.symbol === r.symbol)!;
      const harap = r.group === "control" ? (r.fired ? "alarm palsu" : "bersih") : r.fired ? "tertangkap" : "terlewat";
      expect(el, r.symbol).toHaveTextContent(harap);
      if (r.firstFireDate) expect(el).toHaveTextContent(r.firstFireDate);
    }
  });

  it("definisi kelima blok dan ambangnya berasal dari konstanta mesin uji", () => {
    render(<HalamanCaraKamiMenghitung />);
    for (const k of BLOCK_KINDS) {
      const blok = screen.getByTestId(`blok-${k}`);
      expect(blok).toHaveTextContent(LABEL_BLOK[k]);
      expect(blok).toHaveTextContent("Longgar");
      expect(blok).toHaveTextContent("Ketat");
    }
    expect(screen.getByTestId("blok-laporan_hilang")).toHaveTextContent(`${TENGGAT_LAPORAN_HARI.longgar} hari`);
    expect(screen.getByTestId("blok-laporan_hilang")).toHaveTextContent(`${TENGGAT_LAPORAN_HARI.ketat} hari`);
  });

  it("memuat keterbatasan jujur, kredit terpakai, dan disclaimer tanpa kata penilaian", () => {
    render(<HalamanCaraKamiMenghitung />);
    const batas = screen.getByTestId("keterbatasan");
    expect(batas).toHaveTextContent("2020 kuartal 1");
    expect(batas).toHaveTextContent("8 emiten mengembalikan 404");
    expect(batas).toHaveTextContent("sejak 2024");
    expect(batas).toHaveTextContent("Survivorship");
    expect(screen.getByTestId("kredit-total")).toHaveTextContent(`${KREDIT_TOTAL_LEDGER} dari ${KREDIT_ANGGARAN}`);
    expect(screen.getByTestId("disclaimer")).toHaveTextContent("bukan saran investasi");
    expect(document.body.textContent).not.toMatch(/berbahaya|gorengan|akan pailit/i);
  });
});
