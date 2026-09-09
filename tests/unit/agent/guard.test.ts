import { describe, expect, it } from "vitest";

import { sensorObjek, sensorTeks } from "../../../src/lib/agent/guard";
import {
  DISCLAIMER,
  INSTRUKSI_DASAR,
  INSTRUKSI_DIAGNOSIS,
  INSTRUKSI_PERAKIT,
  KATA_ANJURAN,
  KATA_TERLARANG,
  POLA_ANJURAN_MANDIRI,
} from "../../../src/lib/agent/instructions";

describe("sensorTeks", () => {
  it("mengganti kata rekomendasi dengan [dihapus] dan mencatatnya", () => {
    const r = sensorTeks("Blok suspensi berbunyi 2021-05-18, lalu hold sampai jelas.");
    expect(r.teks).toBe("Blok suspensi berbunyi 2021-05-18, lalu [dihapus] sampai jelas.");
    expect(r.kata).toEqual(["hold"]);
  });

  it("membuang SELURUH kalimat bila kata terlarang dibingkai anjuran", () => {
    // Mengganti katanya saja menyisakan "Sebaiknya [dihapus] sekarang" — masih
    // terbaca sebagai saran, jadi kalimatnya harus hilang seluruhnya.
    const r = sensorTeks("Sebaiknya BELI sekarang lalu jual di target harga 500, atau hold.");
    expect(r.teks).toBe("[kalimat saran dihapus].");
    expect(r.kata.sort()).toEqual(["beli", "hold", "jual", "target harga"]);
  });

  it("kalimat fakta di sebelah kalimat anjuran tetap selamat", () => {
    const r = sensorTeks("Ekuitas negatif sejak 2023-09-30. Sebaiknya cut loss sekarang. Suspensi masih aktif.");
    expect(r.teks).toBe("Ekuitas negatif sejak 2023-09-30. [kalimat saran dihapus]. Suspensi masih aktif.");
    expect(r.kata).toEqual(["cut loss"]);
  });

  it("frasa larangan yang disebut instruksi sistem ikut tersensor", () => {
    for (const frasa of ["cut loss", "take profit", "saatnya masuk", "layak dikoleksi"]) {
      const r = sensorTeks(`Menurut data, ${frasa} untuk SRIL.`);
      expect(r.kata.length, frasa).toBeGreaterThan(0);
      expect(r.teks, frasa).toContain("[dihapus]");
    }
  });

  it("kalimat disclaimer wajib tidak pernah ikut terbuang", () => {
    const teks = "Alarm Saham adalah alat informasi, bukan saran investasi.";
    expect(sensorTeks(teks)).toEqual({ teks, kata: [], kalimatDibuang: 0 });
  });

  it("membiarkan kata berimbuhan dan frasa faktual dari data", () => {
    const teks =
      "Orang dalam menjual sahamnya (2 filing jual oleh insider), blok insider_jual longgar; pembelian tidak ada.";
    const r = sensorTeks(teks);
    expect(r.teks).toBe(teks);
    expect(r.kata).toEqual([]);
  });

  it("tidak merusak angka dan tanggal di sekitar frasa terlindung", () => {
    const teks = "Ada 1 filing jual pada 2024-12-27 dan 12 bulan kemudian tidak ada transaksi jual.";
    expect(sensorTeks(teks).teks).toBe(teks);
  });

  it("teks bersih dikembalikan apa adanya", () => {
    const teks = "Suspensi 2024-12-27 karena belum menyampaikan laporan keuangan.";
    expect(sensorTeks(teks)).toEqual({ teks, kata: [], kalimatDibuang: 0 });
  });

  // ---------------------------------------------------------------------
  // Keberatan 5: anjuran TANPA kata terlarang harus tetap dibuang.
  // Sebelum perbaikan, keempat kalimat ini lolos utuh (kata = []) sehingga
  // penjelasan.ts menganggapnya bersih dan mengirimkannya ke kotak masuk
  // serta Telegram dengan perluTinjau = false.
  // ---------------------------------------------------------------------
  const ANJURAN_TANPA_KATA_TERLARANG = [
    "Sebaiknya kamu kurangi eksposur di saham ini.",
    "Sebaiknya keluar sekarang sebelum makin dalam.",
    "Saran saya tahan dulu sampai laporan berikutnya.",
    "Rekomendasi kami: kurangi porsinya bertahap.",
    "Kalau saya jadi kamu, aku lepas pelan-pelan.",
    "Posisi terbaik sekarang adalah menunggu di luar.",
  ];

  it.each(ANJURAN_TANPA_KATA_TERLARANG)("membuang kalimat beranjuran tanpa kata terlarang: %s", (kalimat) => {
    const r = sensorTeks(`Ekuitas negatif sejak 2023-09-30. ${kalimat} Suspensi masih aktif.`);
    expect(r.teks).toBe("Ekuitas negatif sejak 2023-09-30. [kalimat saran dihapus]. Suspensi masih aktif.");
    expect(r.kalimatDibuang).toBe(1);
  });

  const PENILAIAN_TANPA_KATA_TERLARANG = [
    "Saham ini masih menarik untuk jangka panjang.",
    "Menurut kami prospeknya cerah dan berpotensi naik.",
    "Harganya kemungkinan akan rebound dalam beberapa bulan.",
  ];

  it.each(PENILAIAN_TANPA_KATA_TERLARANG)("membuang kalimat penilaian/prediksi harga: %s", (kalimat) => {
    const r = sensorTeks(kalimat);
    expect(r.teks).toBe("[kalimat saran dihapus].");
    expect(r.kalimatDibuang).toBe(1);
  });

  // ---------------------------------------------------------------------
  // Keberatan 6: bingkai anjuran yang paling lazim dalam Bahasa Indonesia
  // dulu tidak ada di KATA_ANJURAN, sehingga kalimatnya tetap utuh dan hanya
  // verbanya yang diganti ("Saran: [dihapus] sekarang." — masih terbaca saran).
  // ---------------------------------------------------------------------
  const BINGKAI_ANJURAN = [
    ["Alarm bolong. Saran: sell sekarang.", "sell"],
    ["Rekomendasi kami: beli SRIL di harga ini.", "beli"],
    ["Kalau saya jadi kamu, saya akan jual SRIL hari ini.", "jual"],
    ["Posisi terbaik: akumulasi bertahap.", "akumulasi"],
  ] as const;

  it.each(BINGKAI_ANJURAN)("membuang seluruh kalimat berbingkai anjuran: %s", (masukan, kata) => {
    const r = sensorTeks(masukan);
    expect(r.teks).not.toContain("[dihapus]");
    expect(r.teks).toContain("[kalimat saran dihapus]");
    expect(r.teks).not.toMatch(/Saran|Rekomendasi|saya akan|Posisi terbaik/);
    expect(r.kata).toContain(kata);
    expect(r.kalimatDibuang).toBe(1);
  });

  it("kalimat pelindung ('bukan saran investasi', 'bukan rekomendasi') tidak ikut dibuang", () => {
    for (const teks of [
      "Alarm Saham adalah alat informasi dan analisis, bukan saran investasi.",
      "Ini bukan rekomendasi dan kami tidak memberi saran apa pun.",
      "Halaman ini tanpa anjuran; hanya fakta dan tanggalnya.",
    ]) {
      const r = sensorTeks(teks);
      expect(r.teks, teks).toBe(teks);
      expect(r.kalimatDibuang, teks).toBe(0);
    }
  });

  it("kalimat fakta yang memakai kata netral ('harus', 'segera') tetap utuh tanpa kata terlarang", () => {
    const teks = "Emiten harus menyampaikan laporan kuartal 120 hari setelah periode berakhir.";
    expect(sensorTeks(teks)).toEqual({ teks, kata: [], kalimatDibuang: 0 });
  });
});

describe("sensorObjek", () => {
  it("menyensor string bersarang, melewati kunci data, dan menandai perluTinjau", () => {
    const masukan = {
      ringkasan: "Alarm bolong. Sebaiknya sell sekarang.",
      emitenDibahas: [{ symbol: "TELE", sebab: "ekuitas negatif; akumulasi disarankan", buktiTanggal: ["2024-12-27"] }],
      usulanBlok: [{ kind: "insider_jual", threshold: "longgar", alasan: "orang dalam menjual" }],
    };
    const r = sensorObjek(masukan, ["kind", "threshold", "symbol", "buktiTanggal"]);
    expect(r.perluTinjau).toBe(true);
    expect(r.kataDisensor.sort()).toEqual(["akumulasi", "sell"]);
    // "Alarm bolong." fakta → tetap; kalimat setelahnya berbingkai saran → dibuang.
    expect(r.hasil.ringkasan).toBe("Alarm bolong. [kalimat saran dihapus].");
    // Klausa fakta sebelum titik koma selamat, klausa anjuran dibuang.
    expect(r.hasil.emitenDibahas[0].sebab).toBe("ekuitas negatif; [kalimat saran dihapus]");
    expect(r.hasil.usulanBlok[0]).toEqual({ kind: "insider_jual", threshold: "longgar", alasan: "orang dalam menjual" });
    // masukan asli tidak diubah
    expect(masukan.ringkasan).toContain("sell");
    expect(r.hasil.ringkasan).not.toContain("sell");
  });

  it("objek bersih → perluTinjau false", () => {
    const r = sensorObjek({ a: "aman", b: ["juga aman"] });
    expect(r).toEqual({
      hasil: { a: "aman", b: ["juga aman"] },
      perluTinjau: false,
      kataDisensor: [],
      kalimatDibuang: 0,
    });
  });

  it("anjuran tanpa kata terlarang tetap menandai perluTinjau (keberatan 5)", () => {
    const r = sensorObjek({ ringkasan: "Alarm bolong di TELE. Sebaiknya kamu kurangi eksposurnya." });
    expect(r.kataDisensor).toEqual([]);
    expect(r.kalimatDibuang).toBe(1);
    expect(r.perluTinjau).toBe(true);
    expect(r.hasil.ringkasan).toBe("Alarm bolong di TELE. [kalimat saran dihapus].");
  });
});

describe("instruksi sistem", () => {
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

  it("setiap pola anjuran mandiri juga disebut instruksi sistem (lewat KATA_ANJURAN)", () => {
    for (const p of POLA_ANJURAN_MANDIRI) expect(KATA_ANJURAN as readonly string[]).toContain(p);
    expect(INSTRUKSI_DASAR).toMatch(/menilai atau meramal harga/i);
  });
});
