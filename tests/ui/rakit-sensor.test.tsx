// Regresi: sensor penunjuk papan rakit tidak boleh meninggalkan halaman "tuli".
//
// @dnd-kit/core memasang `click` (capture) → stopPropagation di `document`
// selama sebuah seret, lalu mencabutnya lewat `setTimeout(..., 50)`. Selama
// 50 ms sesudah seret, setiap klik di seluruh halaman berhenti di `document`
// dan tidak pernah sampai ke React — klik hilang tanpa galat. Itu yang membuat
// tes e2e "ATAU → DAN" gagal di CI (klik tiba 4–45 ms setelah seret) sementara
// lulus di laptop yang perjalanan bolak-baliknya lebih lambat.
//
// Memperpendek jendelanya jadi `setTimeout(..., 0)` TIDAK cukup: task timer
// kalah prioritas dari task input, jadi klik yang disuntikkan masih bisa
// menyalip callback timer (CI run 34437835563). Karena itu penutup di
// src/components/rakit/sensor.ts tidak memakai timer sama sekali — ia listener
// `click` yang mencabut dirinya sendiri pada klik pertama sesudah seret, dan
// memilah "milik seret / bukan" dari stempel rangkaian input, bukan durasi.
//
// Berkas ini mengunci KETIGA sisi kontraknya, semuanya DENGAN TIMER PALSU YANG
// TIDAK PERNAH DIJALANKAN — kalau penutupnya diam-diam kembali bergantung pada
// setTimeout, tes di bawah langsung merah:
//   1. klik kompatibilitas milik seret itu sendiri TETAP diredam (blok palet
//      adalah tombol yang bisa diseret sekaligus punya onClick "tambah"),
//   2. klik sesudahnya lolos — peredamnya benar-benar tercabut, dan
//   3. kalau klik kompatibilitas itu tidak pernah datang, klik pengguna
//      berikutnya tetap lolos (jendela rentannya nol, bukan sekadar kecil).
// Perilaku bawaan dnd-kit ikut diuji sebagai pembanding: kalau suatu saat
// upstream memperbaikinya sendiri, tes pembanding itulah yang gagal lebih dulu
// dan memberi tahu bahwa penutup di sensor.ts sudah usang.
//
// Catatan tentang stempel: jsdom mengisi `Event.timeStamp` dari `Date.now()`,
// dan `vi.useFakeTimers()` membekukan `Date`. Jadi event yang dibuat pada jam
// beku yang sama punya timeStamp identik — persis seperti klik kompatibilitas
// tetikus sungguhan, yang lahir dari platform event yang sama dengan
// `pointerup` (diukur di Chromium: selisih 0 ms, 20 dari 20 putaran).
// `vi.setSystemTime` memajukan jam TANPA menjalankan timer mana pun, jadi
// "klik yang datang belakangan" bisa dimodelkan tanpa menyentuh penjadwal.
import { PointerSensor } from "@dnd-kit/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SensorPenunjuk } from "@/components/rakit/sensor";

type Sensor = typeof PointerSensor;

/** Pasang sensor pada sebuah tombol dan bawa ia sampai lewat seret aktif. */
function mulaiSeret(Kelas: Sensor) {
  const tombol = document.createElement("button");
  document.body.append(tombol);

  let awal: MouseEvent | undefined;
  tombol.addEventListener("pointerdown", (e) => (awal = e as MouseEvent), { once: true });
  tombol.dispatchEvent(new MouseEvent("pointerdown", { clientX: 0, clientY: 0, bubbles: true }));
  if (!awal) throw new Error("pointerdown tidak tertangkap");

  const sensor = new Kelas({
    active: "blok",
    activeNode: { id: "blok", key: "blok", node: { current: tombol }, activatorNode: { current: tombol }, rect: { current: null } },
    event: awal,
    options: { activationConstraint: { distance: 4 } },
    context: { current: {} },
    onAbort: vi.fn(),
    onPending: vi.fn(),
    onStart: vi.fn(),
    onMove: vi.fn(),
    onEnd: vi.fn(),
    onCancel: vi.fn(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- props sensor dnd-kit tidak diekspor sebagai tipe publik
  } as any);

  // Lewati jarak aktivasi (4 px) → dnd-kit memasang peredam kliknya.
  document.dispatchEvent(new MouseEvent("pointermove", { clientX: 40, clientY: 40, bubbles: true }));
  return { sensor, tombol };
}

/** true bila klik pada `tombol` sampai ke `document` (tidak diredam). */
function klikSampaiKeDocument(tombol: HTMLElement): boolean {
  let sampai = false;
  const dengar = () => (sampai = true);
  document.addEventListener("click", dengar);
  tombol.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  document.removeEventListener("click", dengar);
  return sampai;
}

/** Selesaikan seret (pointerup) — memicu detach() di sensor. */
function lepasSeret() {
  document.dispatchEvent(new MouseEvent("pointerup", { clientX: 40, clientY: 40, bubbles: true }));
}

/** Majukan jam tanpa menjalankan satu timer pun (klik yang datang belakangan). */
function majukanJamTanpaTimer(ms: number) {
  vi.setSystemTime(Date.now() + ms);
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = "";
});

describe("SensorPenunjuk", () => {
  it("menelan klik kompatibilitas milik seret itu sendiri (proteksi klik-tambah palet)", () => {
    const { tombol } = mulaiSeret(SensorPenunjuk);
    lepasSeret();

    // Klik dengan stempel yang sama dengan pointerup adalah klik kompatibilitas
    // peramban: ia harus tetap ditelan, kalau tidak seret pendek yang dibatalkan
    // di atas blok palet tetap memicu onClick "tambah".
    expect(klikSampaiKeDocument(tombol)).toBe(false);
  });

  it("mencabut peredam pada klik pertama itu juga — klik berikutnya lolos", () => {
    const { tombol } = mulaiSeret(SensorPenunjuk);
    lepasSeret();
    expect(klikSampaiKeDocument(tombol)).toBe(false); // klik milik seret

    majukanJamTanpaTimer(5);
    expect(klikSampaiKeDocument(tombol)).toBe(true);
    // Peredam 50 ms milik dnd-kit MASIH menunggu di penjadwal: yang membuka
    // halaman adalah klik pertama tadi, bukan sebuah timer.
    expect(vi.getTimerCount()).toBeGreaterThan(0);
  });

  it("tanpa klik kompatibilitas pun, klik pengguna berikutnya langsung lolos", () => {
    // Seret yang berakhir tanpa klik kompatibilitas (tetikus dilepas di luar
    // jendela, seret dibatalkan) tidak boleh menyisakan peredam yang menunggu
    // korban. Ini sisi yang tidak bisa dijamin oleh penutupan berbasis timer.
    const { tombol } = mulaiSeret(SensorPenunjuk);
    lepasSeret();

    majukanJamTanpaTimer(5);
    expect(klikSampaiKeDocument(tombol)).toBe(true);
    expect(vi.getTimerCount()).toBeGreaterThan(0);
  });

  it("PointerSensor bawaan masih meredam sampai 50 ms (alasan penutup ini ada)", async () => {
    const { tombol } = mulaiSeret(PointerSensor);
    lepasSeret();

    majukanJamTanpaTimer(5);
    await vi.advanceTimersByTimeAsync(0);
    expect(klikSampaiKeDocument(tombol), "perilaku upstream berubah — tinjau ulang sensor.ts").toBe(false);

    await vi.advanceTimersByTimeAsync(50);
    expect(klikSampaiKeDocument(tombol)).toBe(true);
  });
});
