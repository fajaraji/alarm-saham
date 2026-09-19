// Pesan penjelasan per saham (mode jaga): syarat mana terpenuhi + tanggal +
// sumber + disclaimer, dalam bahasa awam.
//
// Dua jalur: template deterministik (selalu ada) dan, bila kunci LLM tersedia,
// model peran 'ringan' merapikan bahasanya TANPA menambah fakta. Keluaran model
// diperiksa backstop frasa (guard.ts) dan dipastikan ditutup disclaimer; bila
// model gagal, tidak ada kunci, atau backstop menyala, template dipakai apa
// adanya — di jalur ini template sudah memuat seluruh fakta, jadi membuang
// rapian model tidak menghilangkan informasi apa pun.
import { generateText, type LanguageModel } from "ai";

import { sensorTeks } from "../agent/guard";
import { DISCLAIMER, INSTRUKSI_DASAR } from "../agent/instructions";
import { AiKeyMissingError, hasAiKey, instruksiSistem, opsiProvider, pilihModel, providerDari } from "../agent/model";
import { fmtTanggal } from "../putar-ulang/ringkas";
import type { HasilPortofolio, HasilSaham } from "./evaluasi";
import { kalimatBlokB, kalimatDilewati } from "./kalimat-b";

export interface Penjelasan {
  symbol: string;
  teks: string;
  /** true bila teks hasil rapian model (bukan template). */
  olehAi: boolean;
  /**
   * true bila keluaran model perlu dilihat manusia: backstop frasa menemukan
   * frasa anjuran, sehingga rapian model dibuang dan teks kembali ke template
   * deterministik.
   */
  perluTinjau: boolean;
}

export const INSTRUKSI_PENJELASAN_JAGA = `${INSTRUKSI_DASAR}

Tugasmu: MERAPIKAN pesan alarm untuk satu saham dalam portofolio pengguna. Kamu menerima teks pesan yang sudah berisi semua fakta (syarat yang terpenuhi, tanggal, sumber). Tulis ulang menjadi 2–4 kalimat awam yang enak dibaca: pertahankan SEMUA angka, tanggal, nama blok, dan sumber; jangan menambah fakta, tebakan, atau penilaian; jangan memberi saran apa pun. Tutup dengan kalimat persis: "${DISCLAIMER}"`;

const LABEL_STATUS: Record<HasilSaham["status"], string> = {
  hijau: "aman menurut alarmmu",
  kuning: "satu tanda terlihat",
  merah: "alarm berbunyi",
};

/** "Sectors /v2/suspensions/ (di DB kami)" → "Sectors"; "data contoh: fixture ..." → "data contoh". */
export function sumberSingkat(sumber: string): string {
  if (/^Sectors\b/i.test(sumber)) return "Sectors";
  if (/^data contoh/i.test(sumber)) return "data contoh";
  return sumber;
}

/** Template deterministik — sumber kebenaran; jalur AI hanya merapikannya. */
export function templatePenjelasan(h: HasilSaham, today: string): string {
  const kalimat: string[] = [];
  const alarm = h.alarmBerbunyi.map((a) => `“${a.name}”`).join(", ");
  if (h.alasan.length === 0) {
    kalimat.push(
      `${h.symbol} (${LABEL_STATUS[h.status]}): tidak ada satu pun syarat yang terpenuhi pada ${fmtTanggal(today)}.`,
    );
  } else {
    // Sumber cukup namanya dan tanggal ditulis "31 Des 2024" (DESIGN.md aturan 8
    // dan 9): teks ini tampil di layar, kotak masuk, dan Telegram. Endpoint
    // lengkapnya tetap ada di rincian terlipat layar Pasang. Kalimat kelas B
    // sudah memuat tanggalnya sendiri, jadi tanggalnya tidak diulang.
    const daftar = h.alasan
      .map((a, i) => {
        const tanggal = a.tanggal && a.kelas !== "B" ? `${fmtTanggal(a.tanggal)}, ` : "";
        return `(${i + 1}) ${a.label}: ${a.detail.replace(/\.$/, "")} (${tanggal}sumber: ${sumberSingkat(a.sumber)})`;
      })
      .join("; ");
    kalimat.push(
      `${h.symbol} (${LABEL_STATUS[h.status]}): ${h.alasan.length} syarat terpenuhi pada ${fmtTanggal(today)}: ${daftar}.`,
    );
    if (alarm) kalimat.push(`Alarm yang berbunyi: ${alarm}.`);
  }
  if (h.suspensiAktif) {
    kalimat.push(`Saham ini masih tersuspensi menurut data kami (sejak ${fmtTanggal(h.suspensiAktif)}), sehingga statusnya merah.`);
  }
  if (h.kelasB.status === "dijalankan") {
    // Yang terpenuhi sudah ada di daftar syarat di atas; di sini sisanya, dalam
    // kalimat biasa (tanpa nama mesin blok, tiket 26).
    const tidak = h.kelasB.blok.filter((b) => !b.terpenuhi);
    if (tidak.length) kalimat.push(`Data terkini lainnya: ${tidak.map((b) => kalimatBlokB(b)).join(" ")}`);
  } else if (h.kelasB.status === "dilewati") {
    // Kosong bila alasannya berlaku untuk seluruh server (disebut sekali di layar).
    const dilewati = kalimatDilewati(h.kelasB);
    if (dilewati) kalimat.push(dilewati);
  }
  for (const c of h.catatan) kalimat.push(c);
  kalimat.push(DISCLAIMER);
  return kalimat.join(" ");
}

export interface OpsiPenjelasan {
  today: string;
  /** Model suntikan (tes: MockLanguageModelV4). Default: peran 'ringan' bila kunci ada. */
  model?: LanguageModel;
  /** Paksa template saja (mis. saat kunci tidak ada). Default: `hasAiKey()` atau ada `model`. */
  pakaiAi?: boolean;
  /** Batas waktu rapian AI satu saham; lewat batas = template (tiket 37). */
  batasMs?: number;
}

/**
 * Batas waktu rapian AI per saham, dan berapa saham dirapikan bersamaan
 * (tiket 37). Dulu rapian berjalan SATU PER SATU tanpa batas waktu: 6–8 saham
 * melewati maxDuration 60 detik /api/portofolio/cek dan pengguna mendapat 504.
 * Dengan 4 jalur paralel dan batas 12 detik, 8 saham paling lama sekitar 24
 * detik untuk bagian ini. Saham yang melewati batas memakai template, yang
 * memang sumber kebenarannya: tidak ada fakta yang hilang.
 */
export const BATAS_AI_PER_SAHAM_MS = 12_000;
export const JALUR_AI_PARALEL = 4;

function pastikanDisclaimer(teks: string): string {
  const rapi = teks.trim();
  return rapi.includes(DISCLAIMER) ? rapi : `${rapi} ${DISCLAIMER}`;
}

/** Rapikan template lewat model ringan; kembali ke template bila apa pun gagal. */
export async function penjelasanSaham(h: HasilSaham, opsi: OpsiPenjelasan): Promise<Penjelasan> {
  const template = templatePenjelasan(h, opsi.today);
  const pakaiAi = opsi.pakaiAi ?? (opsi.model !== undefined || hasAiKey());
  if (!pakaiAi) return { symbol: h.symbol, teks: template, olehAi: false, perluTinjau: false };
  try {
    const model = pilihModel("ringan", opsi.model);
    const provider = providerDari(model);
    const hasil = await generateText({
      model,
      instructions: instruksiSistem(INSTRUKSI_PENJELASAN_JAGA, provider),
      prompt: `Rapikan pesan berikut tanpa mengubah faktanya:\n\n${template}`,
      providerOptions: opsiProvider(provider, "low"),
      abortSignal: AbortSignal.timeout(opsi.batasMs ?? BATAS_AI_PER_SAHAM_MS),
    });
    const teks = hasil.text.trim();
    if (!teks) return { symbol: h.symbol, teks: template, olehAi: false, perluTinjau: false };
    const sensor = sensorTeks(teks);
    // Pesan ini dikirim ke kotak masuk & Telegram pengguna, jadi jalur ini punya
    // pilihan aman yang tidak dimiliki panel diagnosis: template deterministik
    // sudah memuat SEMUA faktanya. Begitu backstop menemukan satu frasa anjuran,
    // rapian model tidak dipakai sama sekali — bukan diredaksi sebagian.
    if (sensor.kata.length > 0) {
      console.warn(
        `[jaga] penjelasan AI ${h.symbol} memuat frasa anjuran (${sensor.kata.join(", ")}); memakai template.`,
      );
      return { symbol: h.symbol, teks: template, olehAi: false, perluTinjau: true };
    }
    return { symbol: h.symbol, teks: pastikanDisclaimer(sensor.teks), olehAi: true, perluTinjau: false };
  } catch (err) {
    if (!(err instanceof AiKeyMissingError)) {
      console.warn(`[jaga] penjelasan AI gagal untuk ${h.symbol}: ${err instanceof Error ? err.message : String(err)}`);
    }
    return { symbol: h.symbol, teks: template, olehAi: false, perluTinjau: false };
  }
}

export async function penjelasanPortofolio(
  hasil: HasilPortofolio,
  opsi: Omit<OpsiPenjelasan, "today"> & { paralel?: number } = {},
): Promise<Penjelasan[]> {
  const { paralel = JALUR_AI_PARALEL, ...opsiSaham } = opsi;
  const keluar: Penjelasan[] = new Array(hasil.saham.length);
  let berikut = 0;
  // Beberapa jalur mengambil saham berikutnya dari antrean yang sama; urutan
  // hasil tetap sama dengan urutan saham.
  async function jalur() {
    while (berikut < hasil.saham.length) {
      const i = berikut++;
      keluar[i] = await penjelasanSaham(hasil.saham[i], { ...opsiSaham, today: hasil.today });
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(paralel, hasil.saham.length)) }, jalur));
  return keluar;
}
