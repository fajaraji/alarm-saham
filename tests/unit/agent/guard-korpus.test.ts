// TOLOK UKUR PERMANEN penjaga frasa — dua bagian dengan status berbeda.
//
//   harusUtuh     : GERBANG KERAS. Presisi wajib 100%. Satu kalimat sah yang
//                   berubah isinya = tes merah. Ini kriteria lulus yang
//                   ditetapkan koordinator setelah putaran 4: prioritas mutlak
//                   presisi di atas recall.
//   harusDitandai : DIUKUR DAN DILAPORKAN saja. Recall backstop rendah dengan
//                   sengaja dan tidak pernah membuat tes merah — kontrol utama
//                   aturan lomba (b) adalah instruksi sistem + keluaran
//                   terstruktur + disclaimer, bukan daftar frasa.
//
// Korpusnya ada di tests/fixtures/korpus-anjuran.json supaya bisa dijalankan di
// luar Vitest juga (`node --import tsx scripts/ukur-penjaga.ts --rinci`) — itu
// cara angka sebelum/sesudah rancang-ulang dikumpulkan pada commit yang sama.
//
// CATATAN PERUBAHAN TES: berkas ini dulu memuat tabel `KORPUS` dengan medan
// `harusDibuang` dan menuntut setiap baris sisi A menjadi persis
// "[kalimat saran dihapus]". Tuntutan itu DIHAPUS karena perilakunya
// ditinggalkan, bukan karena tesnya dilonggarkan — dan sisi B tabel lama
// (kalimat yang wajib selamat) justru DIPERKUAT: seluruh 39 barisnya pindah ke
// `harusUtuh` di fixture, bergabung dengan 52 kalimat sah temuan penyerang dan
// 15 teks wajib produk, dan semuanya kini gerbang keras. Sisi A pindah ke
// `harusDitandai` dan tetap diukur, hanya tidak lagi menjadi gerbang.
import { describe, expect, it } from "vitest";

import { PENGGANTI, periksaFrasa, sensorObjek, sensorTeks } from "../../../src/lib/agent/guard";
import { bacaKorpus, ukur } from "../../../scripts/ukur-penjaga";

const KORPUS = bacaKorpus(process.cwd());
const ANGKA = ukur(KORPUS);

describe("korpus anjuran — bentuk fixture", () => {
  it("cukup besar dan setiap baris punya sumber + catatan", () => {
    expect(KORPUS.harusUtuh.length).toBeGreaterThanOrEqual(90);
    expect(KORPUS.harusDitandai.length).toBeGreaterThanOrEqual(90);
    for (const b of [...KORPUS.harusUtuh, ...KORPUS.harusDitandai]) {
      expect(b.kalimat.trim().length, b.kalimat).toBeGreaterThan(5);
      expect(b.sumber.length, b.kalimat).toBeGreaterThan(3);
      expect(b.catatan.length, b.kalimat).toBeGreaterThan(10);
    }
  });

  it("memuat kalimat yang dilaporkan kedua penyerang putaran 4", () => {
    const sumberUtuh = new Set(KORPUS.harusUtuh.map((b) => b.sumber));
    const sumberTandai = new Set(KORPUS.harusDitandai.map((b) => b.sumber));
    expect(sumberUtuh).toContain("serang:pemburu-rakus");
    expect(sumberTandai).toContain("serang:pemburu-bocor");
    // 41 kalimat sah yang dulu dimakan + 5 kontrol negatif + paragraf diagnosis.
    expect(KORPUS.harusUtuh.filter((b) => b.sumber === "serang:pemburu-rakus").length).toBeGreaterThanOrEqual(45);
    expect(KORPUS.harusDitandai.filter((b) => b.sumber === "serang:pemburu-bocor").length).toBeGreaterThanOrEqual(25);
  });

  it("tidak ada baris yang muncul di kedua sisi", () => {
    const utuh = new Set(KORPUS.harusUtuh.map((b) => b.kalimat));
    for (const b of KORPUS.harusDitandai) expect(utuh.has(b.kalimat), b.kalimat).toBe(false);
  });
});

describe("GERBANG PRESISI — nol kalimat sah yang berubah isinya", () => {
  it.each(KORPUS.harusUtuh)("$kalimat", ({ kalimat }) => {
    const r = sensorTeks(kalimat);
    expect(r.teks).toBe(kalimat);
    expect(r.kata).toEqual([]);
    expect(r.perluTinjau).toBe(false);
  });

  it("presisi 100% pada seluruh korpus (kriteria lulus keras)", () => {
    expect(
      ANGKA.berubah.map((b) => b.kalimat),
      "kalimat sah yang berubah isinya — presisi WAJIB 100%",
    ).toEqual([]);
    expect(ANGKA.presisiPersen).toBe(100);
  });
});

describe("RECALL — diukur dan dilaporkan, bukan gerbang", () => {
  it("mencetak angka presisi & recall (tidak pernah gagal karena recall rendah)", () => {
    const baris = [
      "",
      "  ===== TOLOK UKUR PENJAGA FRASA (tests/fixtures/korpus-anjuran.json) =====",
      `  PRESISI  ${ANGKA.utuhTotal - ANGKA.utuhBerubah}/${ANGKA.utuhTotal} = ${ANGKA.presisiPersen.toFixed(1)}%  (kalimat sah yang TIDAK berubah — gerbang keras 100%)`,
      `  RECALL   ${ANGKA.ditandaiKena}/${ANGKA.ditandaiTotal} = ${ANGKA.recallPersen.toFixed(1)}%  (anjuran yang ditandai — dilaporkan apa adanya)`,
      `  BOCOR    ${ANGKA.lolos.length} anjuran lewat tanpa penanda; backstop TIDAK menjamin semuanya tertangkap.`,
      "  Kontrol utama aturan lomba (b): instruksi sistem + keluaran terstruktur + disclaimer.",
      "",
    ];
    // process.stdout.write (bukan console.*) supaya angkanya benar-benar muncul
    // di keluaran `npm test`, bukan tertahan intersepsi konsol Vitest.
    process.stdout.write(`${baris.join("\n")}\n`);
    expect(ANGKA.ditandaiTotal).toBeGreaterThan(0);
  });

  it("istilah transaksi yang tidak mungkin bermakna lain tetap tertangkap", () => {
    // Ini pemeriksaan PERILAKU backstop (bukan gerbang recall): bila salah satu
    // dari frasa ini berhenti menyala, yang rusak polanya, bukan recall-nya.
    const WAJIB = [
      "Cut loss saja daripada nyangkut lebih dalam.",
      "Cut-loss aja sekarang, sudah kelewat batas.",
      "Sebaiknya average down di harga sekarang.",
      "Menurut data, take profit untuk SRIL.",
      "Menurut kami target harga wajarnya 120 rupiah.",
      "Menurut data, layak dikoleksi untuk SRIL.",
      "Simpan saja dulu, jangan dilepas.",
      "Blok suspensi berbunyi 2021-05-18, lalu hold sampai jelas.",
      "Kosongkan portofoliomu sekarang.",
      "Tutup posisi itu hari ini juga.",
      "Kurangi posisimu di SRIL sebelum akhir bulan.",
      "Uangmu lebih aman di deposito daripada di saham ini.",
      "Kalau saya jadi kamu, aku lepas pelan-pelan.",
    ];
    for (const kalimat of WAJIB) {
      expect(sensorTeks(kalimat).kata, kalimat).not.toEqual([]);
    }
  });
});

describe("redaksi bersifat LOKAL — kalimat tetangga & fakta tidak ikut hilang", () => {
  it.each(KORPUS.harusDitandai.filter((b) => periksaFrasa(b.kalimat).length > 0))(
    "menyisakan isi kalimat: $kalimat",
    ({ kalimat }) => {
      const r = sensorTeks(kalimat);
      // Bukan seluruh kalimat yang hilang: masih ada isi di luar penggantinya.
      const sisa = r.teks.split(PENGGANTI).join("").replace(/[\s.,;:!?•\-()]/g, "");
      expect(sisa.length, r.teks).toBeGreaterThan(0);
      expect(r.teks).not.toBe(PENGGANTI);
    },
  );

  it("kalimat campur: fakta + usulan blok selamat, hanya frasa anjuran diredaksi", () => {
    const teks =
      "Ekuitas TELE minus Rp1,1 triliun pada kuartal 4 2019; sebaiknya tambahkan blok ekuitas_negatif ambang longgar; kurangi porsimu di TELE sekarang.";
    const r = sensorTeks(teks);
    expect(r.teks).toContain("Ekuitas TELE minus Rp1,1 triliun pada kuartal 4 2019");
    expect(r.teks).toContain("sebaiknya tambahkan blok ekuitas_negatif ambang longgar");
    expect(r.teks).not.toMatch(/porsimu/);
    expect(r.perluTinjau).toBe(true);
  });

  it("paragraf diagnosis nyata: satu frasa tidak lagi membatalkan kalimat lain", () => {
    const teks = [
      "TELE terlewat karena alarmnya cuma memakai blok suspensi.",
      "Laporan kuartalnya masih lengkap sampai 31 Maret 2019.",
      "Sebaiknya tambahkan blok ekuitas_negatif ambang longgar dan jalankan uji ulang.",
      "Jumlah temuan akan naik dari 26 ke 31.",
      "Tapi kalau saya jadi kamu, cut loss saja.",
    ].join(" ");
    const r = sensorTeks(teks);
    for (const kalimat of [
      "TELE terlewat karena alarmnya cuma memakai blok suspensi.",
      "Laporan kuartalnya masih lengkap sampai 31 Maret 2019.",
      "Sebaiknya tambahkan blok ekuitas_negatif ambang longgar dan jalankan uji ulang.",
      "Jumlah temuan akan naik dari 26 ke 31.",
    ]) {
      expect(r.teks, kalimat).toContain(kalimat);
    }
    expect(r.kata.sort()).toEqual(["cut loss", "kalau saya jadi kamu"]);
  });

  it("daftar berpoin: butir usulan blok tidak pernah tersentuh", () => {
    const teks = [
      "Alarm bolong di TELE karena blok suspensi baru berbunyi di bulan kejadian.",
      "- Tambahkan blok laporan_hilang dengan ambang longgar.",
      "- Jalankan uji ke masa lalu lagi sesudahnya.",
      "- Tutup posisi itu hari ini juga.",
    ].join("\n");
    const r = sensorTeks(teks);
    expect(r.teks).toBe(
      [
        "Alarm bolong di TELE karena blok suspensi baru berbunyi di bulan kejadian.",
        "- Tambahkan blok laporan_hilang dengan ambang longgar.",
        "- Jalankan uji ke masa lalu lagi sesudahnya.",
        `- ${PENGGANTI} itu hari ini juga.`,
      ].join("\n"),
    );
  });
});

describe("usulanBlok — kontrol struktural, bukan penyensor kalimat", () => {
  const OPSI = { lewati: ["kind", "threshold", "symbol", "buktiTanggal"], tandaiSaja: ["alasan"] };

  it("kind/threshold/symbol/tanggal kembali persis, apa pun isinya", () => {
    const masukan = {
      emitenDibahas: [{ symbol: "SRIL", sebab: "ekuitas negatif sejak 2023-09-30", buktiTanggal: ["2024-12-27"] }],
      usulanBlok: [
        { kind: "insider_jual", threshold: "ketat", alasan: "orang dalam melepas sahamnya sejak Juli 2024" },
        { kind: "laporan_hilang", threshold: "longgar", alasan: "Ambang 180 hari disarankan diturunkan ke 120 hari" },
      ],
    };
    const r = sensorObjek(masukan, OPSI);
    expect(r.hasil).toEqual(masukan);
    expect(r.perluTinjau).toBe(false);
    expect(r.kataDisensor).toEqual([]);
  });

  it("KEDUA alasan pada objek diagnosis penyerang bertahan utuh (penghalang putaran 4)", () => {
    // Bentuk persis yang dilaporkan serang:pemburu-rakus: kedua alasan hilang
    // sekaligus sehingga panel memasang dua usulan blok tanpa satu pun alasan.
    const masukan = {
      ringkasan: "TELE terlewat karena alarmnya cuma memakai blok suspensi.",
      emitenDibahas: [{ symbol: "TELE", sebab: "Suspensi baru mulai 30 Juni 2019", buktiTanggal: ["2019-06-30"] }],
      usulanBlok: [
        { kind: "ekuitas_negatif", threshold: "longgar", alasan: "Dengan blok ini, jumlah emiten terlewat akan turun dari 74 menjadi 60." },
        { kind: "laporan_hilang", threshold: "ketat", alasan: "Ambang ketat belum cocok untuk emiten yang datanya cuma dua kuartal, jadi pakai longgar dulu." },
      ],
    };
    const r = sensorObjek(masukan, OPSI);
    expect(r.hasil).toEqual(masukan);
    expect(r.perluTinjau).toBe(false);
  });

  it("anjuran yang diselundupkan ke alasan: teks DIBIARKAN, usulan ditandai", () => {
    const alasan = "Kurangi posisimu di SRIL sebelum akhir bulan.";
    const r = sensorObjek({ usulanBlok: [{ kind: "suspensi", threshold: "longgar", alasan }] }, OPSI);
    // Tidak digunting — usulan blok tanpa alasan menghapus inti fitur.
    expect(r.hasil.usulanBlok[0].alasan).toBe(alasan);
    expect(r.perluTinjau).toBe(true);
    expect(r.kataDisensor.sort()).toEqual(["kurangi porsi", "porsimu"]);
  });
});
