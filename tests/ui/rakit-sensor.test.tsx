// Regresi: sensor penunjuk papan rakit tidak boleh meninggalkan halaman "tuli".
//
// @dnd-kit/core memasang `click` (capture) → stopPropagation di `document`
// selama sebuah seret, lalu mencabutnya lewat `setTimeout(..., 50)`. Selama
// 50 ms sesudah seret, setiap klik di seluruh halaman berhenti di `document`
// dan tidak pernah sampai ke React — klik hilang tanpa galat. Itu yang membuat
// tes e2e "ATAU → DAN" gagal di CI (klik tiba 4–45 ms setelah seret) sementara
// lulus di laptop yang perjalanan bolak-baliknya lebih lambat.
//
// Tes ini mengunci KEDUA sisi kontraknya:
//   1. klik sintetis milik seret itu sendiri TETAP diredam (blok palet adalah
//      tombol yang bisa diseret sekaligus punya onClick "tambah"), dan
//   2. peredamnya berhenti pada task berikutnya, bukan setelah 50 ms.
// Perilaku bawaan dnd-kit ikut diuji sebagai pembanding: kalau suatu saat
// upstream memperbaikinya sendiri, tes pembanding itulah yang gagal lebih dulu
// dan memberi tahu bahwa penutup di src/components/rakit/sensor.ts sudah usang.
import { PointerSensor } from "@dnd-kit/core";
import { afterEach, describe, expect, it, vi } from "vitest";

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

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = "";
});

describe("SensorPenunjuk", () => {
  it("meredam klik sintetis milik seret itu sendiri", () => {
    const { tombol } = mulaiSeret(SensorPenunjuk);
    lepasSeret();
    // Klik yang menyusul pada task yang SAMA dengan pointerup adalah klik
    // kompatibilitas peramban: ia harus tetap ditelan, kalau tidak seret pendek
    // di atas blok palet ikut memicu onClick "tambah".
    expect(klikSampaiKeDocument(tombol)).toBe(false);
  });

  it("berhenti meredam pada task berikutnya, bukan setelah 50 ms", async () => {
    vi.useFakeTimers();
    const { tombol } = mulaiSeret(SensorPenunjuk);
    lepasSeret();

    await vi.advanceTimersByTimeAsync(0);
    expect(klikSampaiKeDocument(tombol)).toBe(true);
  });

  it("PointerSensor bawaan masih meredam sampai 50 ms (alasan penutup ini ada)", async () => {
    vi.useFakeTimers();
    const { tombol } = mulaiSeret(PointerSensor);
    lepasSeret();

    await vi.advanceTimersByTimeAsync(0);
    expect(klikSampaiKeDocument(tombol), "perilaku upstream berubah — tinjau ulang sensor.ts").toBe(false);

    await vi.advanceTimersByTimeAsync(50);
    expect(klikSampaiKeDocument(tombol)).toBe(true);
  });
});
