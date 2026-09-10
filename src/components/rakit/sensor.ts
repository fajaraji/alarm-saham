"use client";
// Sensor penunjuk papan rakit: PointerSensor bawaan dnd-kit, tetapi peredam
// klik pasca-seret ditutup tepat waktu.
//
// MASALAHNYA. Begitu sebuah seret penunjuk aktif, @dnd-kit/core memasang
//
//     document.addEventListener("click", stopPropagation, { capture: true })
//
// (AbstractPointerSensor.handleStart) dan baru mencabutnya lewat
// `setTimeout(..., 50)` di `detach()`. Selama 50 ms setelah tombol tetikus
// dilepas, SETIAP klik di seluruh halaman berhenti di `document` pada fase
// capture — tidak pernah turun ke akar React, jadi tidak ada onClick yang
// jalan dan tidak ada pesan galat apa pun. Kliknya hilang diam-diam.
//
// KENAPA PEREDAMNYA MEMANG PERLU. Blok di palet adalah <button> yang bisa
// diseret SEKALIGUS punya onClick "tambah blok" (Palet.tsx: seret = salin ke
// papan, klik = tambah). Setelah seret pendek yang berakhir di atas tombol itu
// sendiri, peramban tetap mengirim satu klik kompatibilitas ke tombol tersebut.
// Tanpa peredam, seret yang dibatalkan pengguna akan tetap menambah blok.
// Jadi peredamnya benar; yang salah cuma UMURNYA.
//
// KENAPA 50 ms ITU NYATA, BUKAN TEORI. Di CI (run 34427424551), klik berikutnya
// tiba 4–45 ms setelah `mouse.up()` — di dalam jendela itu — dan hilang: papan
// tidak pernah berubah ATAU → DAN. Di laptop Windows perjalanan bolak-balik
// Playwright ke peramban ~3× lebih lambat (148 ms vs 41 ms), jadi kliknya
// selalu tiba SESUDAH jendela tertutup dan bugnya tidak pernah terlihat.
//
// PERBAIKANNYA. Klik kompatibilitas milik seret tetikus/pen selalu dikirim
// peramban pada TASK yang sama dengan `pointerup` (pointerup → mouseup → click,
// satu penanganan input). Karena `detach()` dipanggil dari dalam penanganan
// `pointerup` itu, satu `setTimeout(..., 0)` sudah pasti berjalan SESUDAH klik
// tersebut selesai disebar — peredam sempat menelan klik yang memang harus
// ditelan, lalu langsung berhenti. Bukan menebak durasi: menumpang urutan
// task yang dijamin peramban.
//
// Sentuh sengaja dibiarkan memakai perilaku bawaan dnd-kit: klik kompatibilitas
// sentuh bisa datang jauh belakangan, jadi menutup lebih awal di sana justru
// bisa melewatkan klik yang seharusnya diredam.
import { PointerSensor } from "@dnd-kit/core";

/**
 * Bagian dalam AbstractPointerSensor yang dipakai penutup peredam. Semuanya
 * `private` di berkas .d.ts dnd-kit tetapi berupa properti biasa saat runtime.
 * Setiap bidang diperiksa dulu sebelum dipakai: kalau bentuk internalnya
 * berubah di versi dnd-kit berikutnya, penutup ini diam-diam tidak aktif dan
 * sensornya kembali ke perilaku bawaan (peredam 50 ms) — bukan crash.
 */
interface BagianDalamSensor {
  detach?: () => void;
  documentListeners?: { removeAll?: () => void };
  props?: { event?: { pointerType?: string } };
}

function pasangPenutupPeredam(sensor: object): void {
  const dalam = sensor as BagianDalamSensor;
  const detachAsli = dalam.detach;
  const peredam = dalam.documentListeners;
  if (typeof detachAsli !== "function" || typeof peredam?.removeAll !== "function") return;

  const tutup = peredam.removeAll;
  // Properti sendiri pada instance menutupi metode prototipe; `handleEnd`
  // memanggil `this.detach()` sehingga versi ini yang jalan.
  dalam.detach = function detachLaluTutupPeredam(this: unknown) {
    detachAsli.call(this);
    if (dalam.props?.event?.pointerType === "touch") return;
    setTimeout(tutup, 0);
  };
}

/**
 * PointerSensor yang tidak meninggalkan halaman "tuli" selama 50 ms setiap kali
 * seret selesai. Perilaku seretnya sendiri sama persis dengan bawaan dnd-kit.
 */
export class SensorPenunjuk extends PointerSensor {
  constructor(props: ConstructorParameters<typeof PointerSensor>[0]) {
    super(props);
    pasangPenutupPeredam(this);
  }
}
