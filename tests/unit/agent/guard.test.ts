// Perilaku backstop frasa (lapis 3) dan instruksi sistem (lapis 1).
//
// PERUBAHAN PERILAKU YANG DISENGAJA (rancang-ulang tiket 15 putaran 5):
// penjaga TIDAK LAGI membuang seluruh kalimat. Assertion lama yang menuntut
// "[kalimat saran dihapus]" sudah dihapus dari berkas ini karena perilaku itu
// ditinggalkan, bukan karena tesnya dilonggarkan: dua penyerang membuktikan
// pemenggalan kalimat memakan 41 dari 83 kalimat sah (termasuk kedua
// `usulanBlok[].alasan` pada satu objek diagnosis) sementara 60 dari 65 anjuran
// baru tetap lolos. Gantinya: redaksi frasa + penandaan, dengan gerbang presisi
// keras di tests/unit/agent/guard-korpus.test.ts.
import { describe, expect, it } from "vitest";

import { PENGGANTI, cariFrasa, normalisasi, periksaFrasa, sensorObjek, sensorTeks } from "../../../src/lib/agent/guard";
import {
  CONTOH_NEGATIF,
  DISCLAIMER,
  FRASA_BACKSTOP,
  INSTRUKSI_DASAR,
  INSTRUKSI_DIAGNOSIS,
  INSTRUKSI_PERAKIT,
  KATA_ANJURAN,
  KATA_TERLARANG,
} from "../../../src/lib/agent/instructions";

describe("normalisasi", () => {
  it("mempertahankan panjang string supaya indeks masih menunjuk teks asli", () => {
    for (const teks of [
      "Cut-loss aja sekarang",
      "TAKE—PROFIT sekarang",
      "spasi  ganda  di  tengah",
      "İstanbul (huruf yang huruf kecilnya dua satuan)",
      "tanpa apa pun",
    ]) {
      expect(normalisasi(teks).length, teks).toBe(teks.length);
    }
  });

  it("tanda hubung, en/em dash, dan spasi tak-putus jadi spasi biasa", () => {
    expect(normalisasi("cut-loss")).toBe("cut loss");
    expect(normalisasi("take–profit")).toBe("take profit");
    expect(normalisasi("stop loss")).toBe("stop loss");
  });
});

describe("sensorTeks — redaksi frasa, bukan pemenggalan kalimat", () => {
  it("hanya frasa yang cocok diganti; sisa kalimat utuh", () => {
    const r = sensorTeks("Blok suspensi berbunyi 2021-05-18, lalu hold sampai jelas.");
    expect(r.teks).toBe("Blok suspensi berbunyi 2021-05-18, lalu [dihapus] sampai jelas.");
    expect(r.kata).toEqual(["hold"]);
    expect(r.perluTinjau).toBe(true);
  });

  it("fakta di dalam kalimat yang sama TIDAK ikut hilang — inti perbaikan putaran 5", () => {
    // Versi lama membuang seluruh klausa, sehingga tanggal & angka di sekitarnya
    // hilang bersama frasanya.
    const r = sensorTeks("Ekuitas TELE minus Rp1,1 triliun pada kuartal 4 2019, jadi cut loss saja sekarang.");
    expect(r.teks).toBe("Ekuitas TELE minus Rp1,1 triliun pada kuartal 4 2019, jadi [dihapus] saja sekarang.");
    expect(r.kata).toEqual(["cut loss"]);
  });

  it("beberapa frasa dalam satu teks diredaksi satu per satu", () => {
    const r = sensorTeks("Take profit dulu, lalu average down kalau turun, jangan dilepas semuanya.");
    expect(r.teks).toBe("[dihapus] dulu, lalu [dihapus] kalau turun, [dihapus] semuanya.");
    expect(r.kata.sort()).toEqual(["average down", "jangan dilepas", "take profit"]);
  });

  it("tanda hubung dan spasi ganda tidak lagi meloloskan istilah transaksi", () => {
    for (const varian of ["cut loss", "cut-loss", "cut  loss", "Cut-Loss", "cutloss", "CUTLOSS"]) {
      const r = sensorTeks(`Menurut data, ${varian} untuk emiten itu.`);
      expect(r.kata, varian).toEqual(["cut loss"]);
      expect(r.teks, varian).toBe(`Menurut data, ${PENGGANTI} untuk emiten itu.`);
    }
  });

  it("teks bersih dikembalikan apa adanya", () => {
    for (const teks of [
      "Suspensi 2024-12-27 karena belum menyampaikan laporan keuangan.",
      "Alarm Saham adalah alat informasi, bukan saran investasi.",
      "Orang dalam menjual sahamnya (2 filing jual oleh insider), blok insider_jual longgar.",
      "Ada 1 filing jual pada 2024-12-27 dan 12 bulan kemudian tidak ada transaksi jual.",
      "Emiten harus menyampaikan laporan kuartal 120 hari setelah periode berakhir.",
    ]) {
      expect(sensorTeks(teks), teks).toEqual({ teks, kata: [], perluTinjau: false });
    }
  });

  it("periksaFrasa melaporkan tanpa mengubah satu karakter pun", () => {
    const teks = "Kurangi porsimu di TELE sekarang.";
    expect(periksaFrasa(teks)).toEqual(["kurangi porsi", "porsimu"]);
    // Teks aslinya tidak disentuh — dipakai untuk usulanBlok[].alasan.
    expect(teks).toBe("Kurangi porsimu di TELE sekarang.");
  });

  it("rentang frasa yang bertumpang-tindih digabung jadi satu redaksi", () => {
    const r = sensorTeks("Kurangi porsimu sekarang.");
    // "kurangi porsi" dan "porsimu" saling menumpuk; hasilnya satu [dihapus].
    expect(r.teks.match(/\[dihapus\]/g)).toHaveLength(1);
    expect(r.kata.sort()).toEqual(["kurangi porsi", "porsimu"]);
  });

  // -------------------------------------------------------------------------
  // Batas yang DIAKUI, bukan bug. Baris-baris ini mengunci janji yang dibuat
  // README & /cara-kami-menghitung: backstop TIDAK menangkap semua anjuran, dan
  // frasa-frasa berikut sengaja tidak didaftar karena bentrok dengan kalimat
  // sah yang wajib selamat. Kalau nanti ada yang ingin menambahnya, gerbang
  // presisi di guard-korpus.test.ts akan menolaknya.
  // -------------------------------------------------------------------------
  const BATAS_DIAKUI: [string, string][] = [
    ["Juall dulu separuhnya biar aman.", "salah ketik/slang tidak dikejar (aturan 3 FRASA_BACKSTOP)"],
    ["Lego separuh barangnya minggu ini.", "slang bursa tidak didaftar"],
    ["Menurut kami harga wajarnya 120 rupiah.", "'harga wajar' bentrok dengan 'harga wajarnya tidak pernah kami hitung'"],
    ["Alokasi dana sebaiknya dipindahkan ke emiten lain.", "'alokasi dana' bentrok dengan alokasi dana rights issue"],
    ["Harganya kemungkinan akan rebound dalam beberapa bulan.", "'akan naik/rebound' bentrok dengan angka backtest"],
    ["Rekomendasi kami: beli SRIL di harga ini.", "kata 'beli' telanjang bentrok dengan 'volume beli bersih ritel'"],
    ["Hindari SRIL sampai laporannya terbit.", "kode emiten tidak dinormalkan menjadi kata 'saham'"],
  ];

  it.each(BATAS_DIAKUI)("BATAS: %s tidak tertangkap backstop (%s)", (kalimat) => {
    expect(sensorTeks(kalimat)).toEqual({ teks: kalimat, kata: [], perluTinjau: false });
  });
});

describe("sensorObjek", () => {
  const LEWATI = ["kind", "threshold", "symbol", "buktiTanggal"];

  it("memeriksa string bersarang, melewati kunci data, menandai perluTinjau", () => {
    const masukan = {
      ringkasan: "Alarm bolong. Take profit sekarang.",
      emitenDibahas: [{ symbol: "TELE", sebab: "ekuitas negatif; cut loss saja", buktiTanggal: ["2024-12-27"] }],
      usulanBlok: [{ kind: "insider_jual", threshold: "longgar", alasan: "orang dalam menjual" }],
    };
    const r = sensorObjek(masukan, LEWATI);
    expect(r.perluTinjau).toBe(true);
    expect(r.kataDisensor.sort()).toEqual(["cut loss", "take profit"]);
    expect(r.hasil.ringkasan).toBe("Alarm bolong. [dihapus] sekarang.");
    // Klausa fakta sebelum titik koma selamat — dan sekarang juga kata-kata
    // lain di klausa yang sama ("saja").
    expect(r.hasil.emitenDibahas[0].sebab).toBe("ekuitas negatif; [dihapus] saja");
    expect(r.hasil.usulanBlok[0]).toEqual({ kind: "insider_jual", threshold: "longgar", alasan: "orang dalam menjual" });
    // masukan asli tidak diubah
    expect(masukan.ringkasan).toContain("Take profit");
  });

  it("objek bersih → perluTinjau false", () => {
    const r = sensorObjek({ a: "aman", b: ["juga aman"] });
    expect(r).toEqual({ hasil: { a: "aman", b: ["juga aman"] }, perluTinjau: false, kataDisensor: [] });
  });

  it("kunci `tandaiSaja`: teks dibiarkan UTUH, temuannya tetap dilaporkan", () => {
    // Ini kontrak struktural yang menggantikan pemenggalan kalimat pada
    // usulanBlok[].alasan: lebih baik pengguna melihat kalimat bermasalah yang
    // ditandai daripada usulan blok tanpa alasan sama sekali.
    const alasan = "Cut loss saja, ekuitas TELE minus Rp1,1 triliun pada kuartal 4 2019.";
    const r = sensorObjek({ usulanBlok: [{ kind: "suspensi", threshold: "longgar", alasan }] }, {
      lewati: LEWATI,
      tandaiSaja: ["alasan"],
    });
    expect(r.hasil.usulanBlok[0].alasan).toBe(alasan);
    expect(r.kataDisensor).toEqual(["cut loss"]);
    expect(r.perluTinjau).toBe(true);
  });

  it("usulan blok & alasannya selamat utuh — keluaran inti agent diagnosis", () => {
    const masukan = {
      ringkasan:
        "Alarm bolong di TELE karena ambang ekuitas terlalu ketat. Saran perbaikan: tambahkan blok laporan_hilang ambang longgar.",
      emitenDibahas: [
        { symbol: "TELE", sebab: "Laporan kuartal 2 seharusnya terbit 31 Juli 2024, tetapi tidak pernah muncul", buktiTanggal: ["2024-07-31"] },
      ],
      usulanBlok: [
        { kind: "laporan_hilang", threshold: "longgar", alasan: "Ambang 180 hari disarankan diturunkan ke 120 hari agar TELE tertangkap lebih awal" },
      ],
    };
    const r = sensorObjek(masukan, LEWATI);
    expect(r.perluTinjau).toBe(false);
    expect(r.kataDisensor).toEqual([]);
    expect(r.hasil).toEqual(masukan);
  });
});

describe("instruksi sistem — kontrol UTAMA", () => {
  it("memuat disclaimer dan larangan kata rekomendasi", () => {
    for (const teks of [INSTRUKSI_DASAR, INSTRUKSI_PERAKIT, INSTRUKSI_DIAGNOSIS]) {
      expect(teks).toContain(DISCLAIMER);
      expect(teks).toContain("Alarm Saham adalah alat informasi, bukan saran investasi");
      for (const k of KATA_TERLARANG) expect(teks).toContain(`"${k}"`);
      for (const k of KATA_ANJURAN) expect(teks).toContain(`"${k}"`);
      expect(teks).toMatch(/perumpamaan/i);
      expect(teks).toMatch(/sumber/i);
    }
  });

  it("stabil (tanpa tanggal dinamis) agar bisa di-cache", () => {
    expect(INSTRUKSI_DIAGNOSIS).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it("melarang POKOK BAHASAN, bukan sekadar sederet kata", () => {
    expect(INSTRUKSI_DASAR).toMatch(/pokok bahasan/i);
    expect(INSTRUKSI_DASAR).toMatch(/posisi, porsi, lot, dana, atau modal pengguna/i);
    expect(INSTRUKSI_DASAR).toMatch(/pengingkar/i);
    expect(INSTRUKSI_DASAR).toMatch(/menilai atau meramal harga/i);
  });

  it("menyatakan terang-terangan bahwa penyaring hilir hanya cadangan sempit", () => {
    // Kalau instruksi menjanjikan penyaring yang menangkap semuanya, model boleh
    // menganggap kepatuhannya opsional. Itu justru cara penyensor lama gagal.
    expect(INSTRUKSI_DASAR).toMatch(/penyaring frasa di hilir hanya cadangan sempit/i);
    expect(INSTRUKSI_DASAR).toMatch(/tidak menangkap semua bentuk/i);
  });

  it("memisahkan yang dilarang dari yang justru boleh diusulkan (butir 1b)", () => {
    expect(INSTRUKSI_DASAR).toMatch(/ATURAN ALARM/);
    expect(INSTRUKSI_DASAR).toMatch(/LANGKAH PEMERIKSAAN/);
    expect(INSTRUKSI_DASAR).toMatch(/jumlah temuan akan naik dari 26 menjadi 41/);
    expect(INSTRUKSI_DASAR).toMatch(/ambang ketat belum cocok/i);
  });

  it("memuat few-shot negatif (pasangan JANGAN → TULIS)", () => {
    expect(CONTOH_NEGATIF.length).toBeGreaterThanOrEqual(3);
    for (const c of CONTOH_NEGATIF) {
      expect(INSTRUKSI_DASAR).toContain(c.salah);
      expect(INSTRUKSI_DASAR).toContain(c.benar);
      // Contoh yang BENAR wajib bebas backstop, kalau tidak kita mengajari model
      // bentuk yang akan ditandai penjaga sendiri.
      expect(periksaFrasa(c.benar), c.benar).toEqual([]);
    }
    expect(INSTRUKSI_DASAR).toMatch(/JANGAN: /);
    expect(INSTRUKSI_DASAR).toMatch(/TULIS: /);
  });

  it("INSTRUKSI_DIAGNOSIS masih meminta usulan blok + pengetatan", () => {
    expect(INSTRUKSI_DIAGNOSIS).toMatch(/usulkan perbaikan/i);
    expect(INSTRUKSI_DIAGNOSIS).toMatch(/Usulkan MAKSIMAL 2 blok tambahan atau pengetatan/i);
    expect(INSTRUKSI_DIAGNOSIS).toContain("usulanBlok");
  });

  it("INSTRUKSI_PERAKIT masih meminta model menyusun blok", () => {
    expect(INSTRUKSI_PERAKIT).toMatch(/PERAKIT BLOK/);
    expect(INSTRUKSI_PERAKIT).toContain("blocks: [{ kind, threshold }]");
  });
});

describe("FRASA_BACKSTOP — bentuk daftarnya", () => {
  it("setiap baris punya label, pola yang bisa dikompilasi, dan alasan", () => {
    for (const f of FRASA_BACKSTOP) {
      expect(f.label.length, f.label).toBeGreaterThan(2);
      expect(f.alasan.length, f.label).toBeGreaterThan(20);
      expect(() => new RegExp(f.pola, "g"), f.label).not.toThrow();
      // Polanya dicocokkan pada teks yang sudah dikecilkan; huruf kapital di
      // pola akan membuatnya tidak pernah cocok.
      expect(f.pola, f.label).toBe(f.pola.toLowerCase());
    }
  });

  it("label unik dan daftarnya tetap pendek (presisi di atas recall)", () => {
    const label = FRASA_BACKSTOP.map((f) => f.label);
    expect(new Set(label).size).toBe(label.length);
    expect(label.length).toBeLessThanOrEqual(40);
  });

  it("setiap frasa benar-benar menyala pada contoh yang jelas melanggar", () => {
    const contoh: Record<string, string> = {
      "cut loss": "cut loss saja",
      "stop loss": "pasang stop loss di 90",
      "take profit": "take profit dulu",
      "average down": "average down di harga sekarang",
      switching: "switching ke emiten lain",
      "target harga": "target harga 500",
      "ambil untung": "ambil untungnya sekarang",
      hold: "hold sampai jelas",
      "saatnya masuk": "saatnya masuk lagi",
      "hajar kanan": "hajar kanan besok pagi",
      "jual saham ini": "jual saham ini besok",
      "jual sekarang": "jual sekarang saja",
      "layak dibeli": "sudah tidak layak dipertahankan",
      "jangan dilepas": "jangan dilepas dulu",
      "tutup posisi": "tutup posisinya hari ini",
      "kosongkan portofolio": "kosongkan portofoliomu sekarang",
      "keluar dari posisi": "keluar dulu dari posisi ini",
      "tahan dulu": "tahan dulu sampai laporan berikutnya",
      "alihkan dana": "alihkan dananya ke yang lain",
      "kurangi porsi": "kurangi porsinya bertahap",
      "akumulasi bertahap": "akumulasi bertahap saja",
      "menunggu di luar": "lebih baik menunggu di luar",
      porsimu: "porsimu terlalu besar",
      uangmu: "uangmu lebih aman di deposito",
      cuanmu: "amankan cuan kamu",
      "kalau saya jadi kamu": "kalau saya jadi kamu",
    };
    for (const f of FRASA_BACKSTOP) {
      const c = contoh[f.label];
      expect(c, `contoh untuk "${f.label}" belum ditulis`).toBeTypeOf("string");
      expect(cariFrasa(c).map((x) => x.label), f.label).toContain(f.label);
    }
  });
});
