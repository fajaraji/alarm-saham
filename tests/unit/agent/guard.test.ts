import { describe, expect, it } from "vitest";

import { sensorObjek, sensorTeks } from "../../../src/lib/agent/guard";
import {
  DISCLAIMER,
  INSTRUKSI_DASAR,
  INSTRUKSI_DIAGNOSIS,
  INSTRUKSI_PERAKIT,
  KATA_ANJURAN,
  KATA_TERLARANG,
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
    expect(sensorTeks(teks)).toEqual({ teks, kata: [] });
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
    expect(sensorTeks(teks)).toEqual({ teks, kata: [] });
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
    expect(r).toEqual({ hasil: { a: "aman", b: ["juga aman"] }, perluTinjau: false, kataDisensor: [] });
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
});
