// Pesan penjelasan per saham (mode jaga): syarat mana terpenuhi + tanggal +
// sumber + disclaimer, dalam bahasa awam.
//
// Dua jalur: template deterministik (selalu ada) dan, bila kunci LLM tersedia,
// model peran 'ringan' merapikan bahasanya TANPA menambah fakta. Keluaran model
// disensor kata rekomendasi (guard.ts) dan dipastikan ditutup disclaimer; bila
// model gagal/tidak ada kunci, template dipakai apa adanya.
import { generateText, type LanguageModel } from "ai";

import { sensorTeks } from "../agent/guard";
import { DISCLAIMER, INSTRUKSI_DASAR } from "../agent/instructions";
import { AiKeyMissingError, hasAiKey, instruksiSistem, opsiProvider, pilihModel, providerDari } from "../agent/model";
import type { HasilPortofolio, HasilSaham } from "./evaluasi";

export interface Penjelasan {
  symbol: string;
  teks: string;
  /** true bila teks hasil rapian model (bukan template). */
  olehAi: boolean;
  /** true bila ada kata terlarang yang disensor dari keluaran model. */
  perluTinjau: boolean;
}

export const INSTRUKSI_PENJELASAN_JAGA = `${INSTRUKSI_DASAR}

Tugasmu: MERAPIKAN pesan alarm untuk satu saham dalam portofolio pengguna. Kamu menerima teks pesan yang sudah berisi semua fakta (syarat yang terpenuhi, tanggal, sumber). Tulis ulang menjadi 2–4 kalimat awam yang enak dibaca: pertahankan SEMUA angka, tanggal, nama blok, dan sumber; jangan menambah fakta, tebakan, atau penilaian; jangan memberi saran apa pun. Tutup dengan kalimat persis: "${DISCLAIMER}"`;

const LABEL_STATUS: Record<HasilSaham["status"], string> = {
  hijau: "aman menurut alarmmu",
  kuning: "satu tanda terlihat",
  merah: "alarm berbunyi",
};

function fmtTanggal(t: string): string {
  const [y, m, d] = t.split("-").map(Number);
  const bulan = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  return `${d} ${bulan[(m || 1) - 1]} ${y}`;
}

/** Template deterministik — sumber kebenaran; jalur AI hanya merapikannya. */
export function templatePenjelasan(h: HasilSaham, today: string): string {
  const kalimat: string[] = [];
  const alarm = h.alarmBerbunyi.map((a) => `“${a.name}”`).join(", ");
  if (h.alasan.length === 0) {
    kalimat.push(
      `${h.symbol} — ${LABEL_STATUS[h.status]}: tidak ada satu pun syarat yang terpenuhi pada ${fmtTanggal(today)}.`,
    );
  } else {
    const daftar = h.alasan
      .map(
        (a, i) =>
          `(${i + 1}) ${a.label}: ${a.detail}${a.tanggal ? ` [tanggal ${a.tanggal}]` : ""} [sumber: ${a.sumber}]`,
      )
      .join("; ");
    kalimat.push(
      `${h.symbol} — ${LABEL_STATUS[h.status]}: ${h.alasan.length} syarat terpenuhi pada ${fmtTanggal(today)}: ${daftar}.`,
    );
    if (alarm) kalimat.push(`Alarm yang berbunyi: ${alarm}.`);
  }
  if (h.suspensiAktif) {
    kalimat.push(`Saham ini masih tersuspensi menurut data kami (sejak ${fmtTanggal(h.suspensiAktif)}), sehingga statusnya merah.`);
  }
  if (h.kelasB.status === "dijalankan") {
    const tidak = h.kelasB.blok.filter((b) => !b.terpenuhi);
    if (tidak.length) {
      kalimat.push(
        `Data terkini yang dicek dan tidak terpenuhi: ${tidak.map((b) => `${b.kind} (${b.detail})`).join("; ")}.`,
      );
    }
  } else if (h.kelasB.status === "dilewati") {
    kalimat.push(`Data terkini ${h.kelasB.keterangan}.`);
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
}

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
    });
    const teks = hasil.text.trim();
    if (!teks) return { symbol: h.symbol, teks: template, olehAi: false, perluTinjau: false };
    const sensor = sensorTeks(teks);
    // Pesan ini dikirim ke kotak masuk & Telegram pengguna. Kalau model sampai
    // memakai kata rekomendasi ATAU membingkai kalimatnya sebagai anjuran/
    // penilaian (yang bisa terjadi tanpa satu pun kata terlarang), teks
    // rapiannya TIDAK dipakai sama sekali — kembali ke template deterministik.
    if (sensor.kata.length > 0 || sensor.kalimatDibuang > 0) {
      const sebab = sensor.kata.length
        ? `kata terlarang (${sensor.kata.join(", ")})`
        : `${sensor.kalimatDibuang} kalimat beranjuran/penilaian`;
      console.warn(`[jaga] penjelasan AI ${h.symbol} memuat ${sebab}; memakai template.`);
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
  opsi: Omit<OpsiPenjelasan, "today"> = {},
): Promise<Penjelasan[]> {
  const keluar: Penjelasan[] = [];
  for (const h of hasil.saham) keluar.push(await penjelasanSaham(h, { ...opsi, today: hasil.today }));
  return keluar;
}
