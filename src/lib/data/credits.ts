// Aturan biaya kredit Sectors (dokumentasi docs.sectors.app, dibaca 7 Sep 2026):
// - 2xx dikenai kredit; hasil kosong tetap 200 dan tetap dikenai kredit.
// - 404 (simbol tak dikenal) tetap dikenai 1 kredit.
// - 400/401/403/429/5xx GRATIS.
// - financials/quarterly: 1 per kuartal yang dikembalikan.
// - free-float: 1 per 100 emiten yang dikembalikan.
// - feed berpaginasi: 1 per halaman (= 1 per request).

export type AturanKredit = "per-request" | "per-kuartal" | "per-100-emiten";

/** Total kredit tim (hackathon) — dapat ditimpa lewat SECTORS_CREDIT_BUDGET. */
export const ANGGARAN_KREDIT_DEFAULT = 1000;
/** Cadangan wajib untuk video & demo juri (PLAN.md §5). */
export const CADANGAN_KREDIT_DEFAULT = 250;

function jumlahItem(body: unknown): number {
  if (Array.isArray(body)) return body.length;
  if (body && typeof body === "object") {
    const results = (body as { results?: unknown }).results;
    if (Array.isArray(results)) return results.length;
  }
  return 1;
}

/**
 * Hitung kredit yang ditagih untuk satu respons HTTP.
 * Untuk aturan berbasis jumlah, hasil kosong dihitung minimal 1 (konservatif:
 * lebih baik melebih-lebihkan pemakaian daripada menggerus cadangan tanpa sadar).
 */
export function hitungKredit(aturan: AturanKredit, status: number, body: unknown): number {
  if (status === 404) return 1;
  if (status < 200 || status >= 300) return 0;
  switch (aturan) {
    case "per-request":
      return 1;
    case "per-kuartal":
      return Math.max(1, jumlahItem(body));
    case "per-100-emiten":
      return Math.max(1, Math.ceil(jumlahItem(body) / 100));
  }
}
