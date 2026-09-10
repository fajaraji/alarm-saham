"use client";
// Sensor penunjuk papan rakit: PointerSensor bawaan dnd-kit, tetapi peredam
// klik pasca-seret ditutup oleh KLIK ITU SENDIRI — tanpa timer sama sekali.
//
// MASALAHNYA. Begitu sebuah seret penunjuk aktif, @dnd-kit/core memasang
//
//     document.addEventListener("click", stopPropagation, { capture: true })
//
// (AbstractPointerSensor.handleStart) dan baru mencabutnya lewat
// `setTimeout(..., 50)` di `detach()`. Selama 50 ms setelah tombol tetikus
// dilepas, SETIAP klik di seluruh halaman berhenti di `document` pada fase
// capture. Akar React App Router adalah `document` sendiri: listener bubble
// milik React tidak pernah kebagian karena eventnya sudah dihentikan sebelum
// turun ke target. Jadi tidak ada onClick yang jalan dan tidak ada galat apa
// pun — kliknya hilang diam-diam.
//
// KENAPA PEREDAMNYA MEMANG PERLU. Blok di palet adalah <button> yang bisa
// diseret SEKALIGUS punya onClick "tambah blok" (Palet.tsx: seret = salin ke
// papan, klik = tambah). Sesudah seret pendek yang dibatalkan di atas tombol
// itu sendiri, peramban tetap mengirim satu klik kompatibilitas ke tombol
// tersebut. Tanpa peredam, seret yang dibatalkan pengguna tetap menambah blok.
// Jadi peredamnya benar; yang salah cuma cara ia berhenti.
//
// KENAPA TIMER TIDAK BISA DIPAKAI — TERMASUK `setTimeout(..., 0)`. Percobaan
// sebelumnya memperpendek jendela 50 ms itu jadi satu task (`setTimeout(..., 0)`)
// dengan alasan klik kompatibilitas dikirim di task yang sama dengan
// `pointerup`. Alasannya benar, tapi kesimpulannya tidak: task timer BUKAN
// task berprioritas tinggi. Chromium menjalankan task input lebih dulu, jadi di
// runner Linux yang cepat klik berikutnya bisa tiba SEBELUM callback timer —
// peredam masih terpasang dan kliknya tetap hilang (CI run 34437835563).
// Sepanjang penutupannya berupa timer, jendela rentannya cuma mengecil, tidak
// pernah nol.
//
// PERBAIKANNYA: IDENTITAS EVENT, BUKAN DURASI. Pada `detach()` (yaitu di dalam
// penanganan `pointerup`), peredam mentah dnd-kit ditukar dengan penutup kita:
// listener `click` capture yang MENCABUT DIRINYA SENDIRI pada klik pertama apa
// pun yang tiba sesudah seret. Karena pencabutannya dipicu oleh event yang sama
// yang sedang ditangani, tidak ada urutan penjadwalan yang bisa menyalipnya —
// jendela rentannya nol, bukan kecil.
//
// Yang ditelan hanya klik yang memang milik seret itu, dan itu dikenali dari
// IDENTITAS rangkaian inputnya: klik kompatibilitas tetikus dibuat peramban
// dari platform event `mouseup` yang sama, sehingga `click.timeStamp` PERSIS
// sama dengan `pointerup.timeStamp`. Diukur, bukan ditebak — probe Chromium
// (20 putaran seret + klik langsung, tanpa satu pun perjalanan bolak-balik):
//
//     selisih click-milik-seret − pointerup : 0 ms, 20 dari 20
//     selisih klik berikutnya   − pointerup : 1,2–3,4 ms
//
// 1,2 ms itu klik tercepat yang bisa disuntikkan Playwright; manusia butuh
// puluhan milidetik. Jadi `timeStamp <= stempel pointerup` memisahkan keduanya
// secara pasti, bukan statistik: hanya klik yang lahir dari platform event yang
// sama yang ikut tertelan.
//
// ARAH GAGALNYA JUGA DIPILIH. Kalau suatu peramban ternyata memberi klik
// kompatibilitas stempel yang lebih besar, penutup ini gagal MEMBUKA (kliknya
// lolos) — akibat terburuknya seret yang dibatalkan di atas palet ikut menambah
// blok. Ia tidak pernah gagal MENUTUP (klik hilang tanpa jejak), yang justru
// kelas bug yang sedang diperbaiki.
//
// Sentuh sengaja dibiarkan memakai perilaku bawaan dnd-kit: klik kompatibilitas
// sentuh datang jauh belakangan dan tidak membawa stempel `pointerup`-nya, jadi
// aturan identitas di atas tidak berlaku di sana.
import { PointerSensor } from "@dnd-kit/core";

/** Satu entri pembukuan `Listeners` dnd-kit: `[nama, handler, opsi]`. */
type EntriListener = [string, EventListener, (AddEventListenerOptions | boolean)?];

/**
 * Bagian dalam AbstractPointerSensor yang dipakai penutup peredam. Semuanya
 * `private` di berkas .d.ts dnd-kit tetapi berupa properti biasa saat runtime.
 * Setiap bidang diperiksa dulu sebelum dipakai: kalau bentuk internalnya
 * berubah di versi dnd-kit berikutnya, penutup ini diam-diam tidak aktif dan
 * sensornya kembali ke perilaku bawaan (peredam 50 ms) — bukan crash.
 */
interface BagianDalamSensor {
  detach?: () => void;
  document?: Document;
  documentListeners?: {
    listeners?: EntriListener[];
    add?: (nama: string, handler: EventListener, opsi?: AddEventListenerOptions) => void;
  };
  props?: { event?: { pointerType?: string } };
}

/**
 * Tukar peredam klik mentah dnd-kit dengan penutup sekali-pakai.
 *
 * Dipanggil dari `detach()`, jadi selalu SEBELUM klik kompatibilitas seret ini
 * disebar (peramban mengirim pointerup → mouseup → click, berurutan).
 *
 * @param stempel Pembaca stempel `pointerup` penutup seret — sengaja fungsi,
 *   bukan angka: kalau `pointerup` menyasar `document` sendiri, listener fase
 *   capture dan bubble di sana dijalankan menurut urutan pendaftaran, sehingga
 *   `detach()` milik dnd-kit bisa berjalan lebih dulu daripada pencatat stempel
 *   kita. Dibaca saat klik tiba, stempelnya dijamin sudah terisi.
 */
function ambilAlihPeredam(dok: Document, entri: EntriListener[], stempel: () => number): void {
  const peredam = entri.find((e) => Array.isArray(e) && e[0] === "click" && typeof e[1] === "function");
  // Seret tidak pernah melewati jarak aktivasi → dnd-kit tidak memasang peredam
  // → tidak ada apa pun yang perlu ditutup (dan klik "tambah" di palet harus lewat).
  if (!peredam) return;
  const [, handlerAsli, opsi] = peredam;

  const penutup: EventListener = (event) => {
    // Klik PERTAMA apa pun sesudah seret mencabut peredam. Tidak ada timer,
    // tidak ada durasi: pencabutannya terjadi di dalam penanganan klik itu
    // sendiri, jadi tidak ada klik lain yang bisa terjepit di antaranya.
    dok.removeEventListener("click", penutup, opsi);
    // Hanya klik yang lahir dari platform event yang sama dengan `pointerup`
    // penutup seret yang ikut ditelan.
    if (event.timeStamp <= stempel()) event.stopPropagation();
  };

  dok.removeEventListener("click", handlerAsli, opsi);
  dok.addEventListener("click", penutup, opsi);
  // Tulis balik ke pembukuan dnd-kit supaya `documentListeners.removeAll()`
  // (setTimeout 50 ms di detach) menyapu penutup kita, bukan handler yang sudah
  // tidak terpasang. Timer itu jadi tukang sapu; kebenarannya tidak bergantung
  // padanya — penutup di atas sudah mencabut diri pada klik pertama, dan kalau
  // klik itu tidak pernah datang (seret dibatalkan Escape, tetikus dilepas di
  // luar jendela) klik pengguna berikutnya tetap lolos karena stempelnya lebih
  // besar.
  peredam[1] = penutup;
}

function pasangPenutupPeredam(sensor: object): void {
  const dalam = sensor as BagianDalamSensor;
  const detachAsli = dalam.detach;
  const daftar = dalam.documentListeners;
  const entri = daftar?.listeners;
  const dok = dalam.document;
  if (
    typeof detachAsli !== "function" ||
    typeof daftar?.add !== "function" ||
    !Array.isArray(entri) ||
    typeof dok?.addEventListener !== "function"
  ) {
    return;
  }

  // Stempel `pointerup` yang menutup seret ini. Selama belum ada pointerup
  // (seret dibatalkan Escape/resize/tab disembunyikan) nilainya −∞, sehingga
  // tidak ada klik yang dianggap milik seret dan tidak ada yang ditelan.
  let stempelLepas = Number.NEGATIVE_INFINITY;
  // Didaftarkan lewat `documentListeners` supaya ikut disapu `removeAll()`.
  daftar.add("pointerup", (e: Event) => (stempelLepas = e.timeStamp), { capture: true });

  // Properti sendiri pada instance menutupi metode prototipe; `handleEnd`
  // memanggil `this.detach()` sehingga versi ini yang jalan.
  dalam.detach = function detachLaluAmbilAlihPeredam(this: unknown) {
    detachAsli.call(this);
    if (dalam.props?.event?.pointerType === "touch") return;
    ambilAlihPeredam(dok, entri, () => stempelLepas);
  };
}

/**
 * PointerSensor yang tidak meninggalkan halaman "tuli" sesudah seret selesai.
 * Perilaku seretnya sendiri sama persis dengan bawaan dnd-kit.
 */
export class SensorPenunjuk extends PointerSensor {
  constructor(props: ConstructorParameters<typeof PointerSensor>[0]) {
    super(props);
    pasangPenutupPeredam(this);
  }
}
