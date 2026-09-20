// Halaman /cara-kami-menghitung (jsdom + Testing Library): angka yang tampil
// harus sama dengan snapshot docs/skor-nyata.json dan konstanta mesin uji.
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import HalamanCaraKamiMenghitung from "../../src/app/cara-kami-menghitung/page";
import { FooterDisclaimer } from "../../src/components/panduan/FooterDisclaimer";
import { TENGGAT_LAPORAN_HARI } from "../../src/lib/engine/evaluate";
import { BLOCK_KINDS, LABEL_BLOK } from "../../src/lib/engine/rules";
import { KORPUS_PENJAGA, PENJAGA_FRASA, PERINTAH_UKUR_PENJAGA } from "../../src/lib/metodologi/penjaga";
import { KREDIT_ANGGARAN, KREDIT_TOTAL_LEDGER, PERINTAH_SNAPSHOT, ringkasSkor, SKOR_NYATA } from "../../src/lib/metodologi/skor";
import { fmtTanggal } from "../../src/lib/putar-ulang/ringkas";

describe("/cara-kami-menghitung", () => {
  it("menampilkan skor nyata dari snapshot: tertangkap, per kelompok, lebih awal, alarm palsu, dilewati", () => {
    render(<HalamanCaraKamiMenghitung />);
    const s = ringkasSkor(SKOR_NYATA);

    expect(screen.getByRole("heading", { level: 1, name: "Cara kami menghitung" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: new RegExp(`snapshot ${SKOR_NYATA.today}`) })).toBeInTheDocument();

    expect(screen.getByTestId("stat-tertangkap")).toHaveTextContent(`${s.hits}/${s.total}`);
    expect(screen.getByTestId("stat-tertangkap")).toHaveTextContent(
      `delisting ${s.delisting.hits}/${s.delisting.total} · berpotensi delisting ${s.watchlist.hits}/${s.watchlist.total}`,
    );
    expect(screen.getByTestId("stat-lebih-awal")).toHaveTextContent(`${s.leadMedian} bln`);
    // Angka desimal ditulis dengan koma di layar (7,56), bukan titik.
    expect(screen.getByTestId("stat-lebih-awal")).toHaveTextContent(`rata-rata ${String(s.leadAvg).replace(".", ",")} bln`);
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
    // Disclaimer datang dari footer layout akar (tiket 13), bukan dari halaman ini.
    expect(screen.queryByTestId("disclaimer")).not.toBeInTheDocument();
    render(<FooterDisclaimer sumberNyata />);
    expect(screen.getByTestId("disclaimer")).toHaveTextContent("bukan saran investasi");
    expect(document.body.textContent).not.toMatch(/berbahaya|gorengan|akan pailit/i);
  });

  it("bab penjaga aturan lomba (b): tiga lapis, angka dari snapshot, batas yang diakui", () => {
    render(<HalamanCaraKamiMenghitung />);
    const s = PENJAGA_FRASA.sesudah;
    const l = PENJAGA_FRASA.sebelum;

    expect(
      screen.getByRole("heading", { level: 2, name: /Bagaimana kami menjaga keluaran AI bukan saran investasi/ }),
    ).toBeInTheDocument();

    // Tiga lapis dengan peran yang jelas, urut dari kontrol utama.
    const lapis = within(screen.getByTestId("lapis-penjaga")).getAllByRole("listitem");
    expect(lapis).toHaveLength(3);
    expect(lapis[0]).toHaveTextContent(/Instruksi sistem/);
    expect(lapis[0]).toHaveTextContent(/kontrol utama/);
    expect(lapis[1]).toHaveTextContent(/Keluaran terstruktur/);
    expect(lapis[2]).toHaveTextContent(/cadangan terakhir/);
    // Alasan usulan blok tidak pernah digunting — janji ke pengguna, bukan cuma kode.
    expect(lapis[2]).toHaveTextContent(/tidak\s+pernah digunting/);

    // Angka dari docs/penjaga-frasa.json, bukan diketik ulang di halaman.
    expect(screen.getByTestId("penjaga-presisi")).toHaveTextContent(
      `${s.harusUtuhTotal - s.harusUtuhBerubah}/${s.harusUtuhTotal} = ${s.presisiPersen}%`,
    );
    expect(screen.getByTestId("penjaga-recall")).toHaveTextContent(
      `${s.harusDitandaiKena}/${s.harusDitandaiTotal} = ${s.recallPersen}%`,
    );
    const tabel = screen.getByTestId("tabel-penjaga");
    expect(tabel).toHaveTextContent(l.commit);
    expect(tabel).toHaveTextContent(`${l.harusUtuhTotal - l.harusUtuhBerubah}/${l.harusUtuhTotal} = ${l.presisiPersen}%`);

    // Batas diakui terang-terangan, termasuk kalimat "TIDAK menjamin".
    const batasPenjaga = within(screen.getByTestId("batas-penjaga")).getAllByRole("listitem");
    expect(batasPenjaga).toHaveLength(PENJAGA_FRASA.batasYangDiakui.length);
    expect(document.body.textContent).toMatch(/tidak menjamin/i);
    // Tolok ukurnya disebut dengan kata-kata, bukan nama berkas (tiket 27).
    expect(document.body.textContent).not.toContain(KORPUS_PENJAGA);
    expect(document.body.textContent).toMatch(/kumpulan kalimat uji/);
    expect(document.body.textContent).toContain(PENJAGA_FRASA.tanggal);
    // Tidak ada klaim bahwa penjaga memblokir semua kalimat beranjuran.
    expect(document.body.textContent).not.toMatch(/memblokir semua kalimat beranjuran(?![^.]*tidak)/i);
    expect(document.body.textContent).toMatch(/tidak<\/strong> mengklaim|tidak\s+mengklaim/i);
  });

  it("tanpa path berkas repositori dan tanpa perintah baris perintah; pernyataan 'hasil simpanan' tetap ada (tiket 27)", () => {
    render(<HalamanCaraKamiMenghitung />);
    const teks = screen.getByTestId("metodologi").textContent ?? "";
    expect(teks).not.toMatch(/\b(docs|tests|scripts|src)\/[\w./-]+/);
    expect(teks).not.toMatch(/\b(npm|npx|node)\s+(run|test|--import)\b|\bnpm test\b/);
    expect(teks).not.toContain(PERINTAH_SNAPSHOT);
    expect(teks).not.toContain(PERINTAH_UKUR_PENJAGA);
    expect(teks).not.toMatch(/api_ledger|PLAN §/);
    // Pernyataan kejujuran yang membolehkan angka universe nyata di server data contoh.
    expect(teks).toMatch(
      new RegExp(`hasil uji yang kami simpan\\s+pada ${fmtTanggal(SKOR_NYATA.today)}[\\s\\S]{0,400}bukan hasil hitung ulang dari sumber data yang sedang dipakai server ini`),
    );
    // Rincian teknis diarahkan ke README, dan README memang memuatnya.
    expect(teks).toMatch(/README repositori/);
  });
});
