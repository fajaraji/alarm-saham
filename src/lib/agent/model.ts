// Pemilih provider & model AI (Vercel AI SDK v7).
//
// Provider yang didukung: DeepSeek (default; murah, prabayar) dan Anthropic.
// Dipilih lewat LLM_PROVIDER, atau otomatis dari kunci yang tersedia
// (DEEPSEEK_API_KEY diutamakan, lalu ANTHROPIC_API_KEY).
//
// Peran model:
// - 'penalaran': diagnosis & perakit blok (tool-use + structured output).
// - 'ringan'   : penjelasan singkat (mis. teks harian) — belum dipakai.
//
// Model DeepSeek (alias lama `deepseek-chat`/`deepseek-reasoner` dipensiunkan
// DeepSeek pada 2026-07-24; lihat README "Otak AI"):
// - `deepseek-v4-flash` (default kedua peran; ubah lewat DEEPSEEK_MODEL).
// - `deepseek-v4-pro` untuk 'penalaran' bila DEEPSEEK_REASONER=1 — thinking
//   mode DeepSeek mendukung tool calls (dokumen resmi "Thinking Mode").
// Model Anthropic: `claude-opus-5` (penalaran), `claude-sonnet-5` (ringan).
//
// Tidak ada klien yang dibuat di module scope: `next build` mengimpor modul
// route saat kunci mungkin kosong. Fungsi melempar `AiKeyMissingError` (bukan
// crash saat import) bila kunci tidak ada, dan setiap pemanggil boleh
// menyuntikkan model sendiri (tes memakai model tiruan).
import { createAnthropic, type AnthropicLanguageModelOptions } from "@ai-sdk/anthropic";
import { createDeepSeek, type DeepSeekLanguageModelOptions } from "@ai-sdk/deepseek";
import type { generateText, Instructions, LanguageModel } from "ai";

/** Tipe providerOptions milik generateText (`ai` tidak mengekspor `ProviderOptions` langsung). */
type ProviderOptions = NonNullable<Parameters<typeof generateText>[0]["providerOptions"]>;

export const PROVIDERS = ["deepseek", "anthropic"] as const;
export type Provider = (typeof PROVIDERS)[number];
export type PeranModel = "penalaran" | "ringan";

/** Nama variabel lingkungan yang menyimpan kunci tiap provider. */
export const ENV_KUNCI: Record<Provider, string> = {
  deepseek: "DEEPSEEK_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
};

export const DEEPSEEK_MODEL_DEFAULT = "deepseek-v4-flash";
export const DEEPSEEK_MODEL_PENALARAN = "deepseek-v4-pro";

export const MODEL_ID = {
  anthropic: { penalaran: "claude-opus-5", ringan: "claude-sonnet-5" },
  deepseek: { penalaran: DEEPSEEK_MODEL_DEFAULT, ringan: DEEPSEEK_MODEL_DEFAULT },
} as const satisfies Record<Provider, Record<PeranModel, string>>;

export class AiKeyMissingError extends Error {
  constructor(pesan?: string) {
    super(
      pesan ??
        "Kunci AI belum diset. Isi LLM_API_KEY (kunci gateway OpenAI-compatible, mis. Command Code — sekalian set LLM_BASE_URL dan LLM_MODEL), atau DEEPSEEK_API_KEY, atau ANTHROPIC_API_KEY di .env.local (lihat .env.example) agar fitur AI (perakit blok & diagnosis) bisa dipakai. Provider bisa dipaksa lewat LLM_PROVIDER=deepseek|anthropic.",
    );
    this.name = "AiKeyMissingError";
  }
}

function env(nama: string): string | undefined {
  const v = process.env[nama]?.trim();
  return v || undefined;
}

function isProvider(s: string): s is Provider {
  return (PROVIDERS as readonly string[]).includes(s);
}

/**
 * Apakah jalur DeepSeek dialihkan ke gateway pihak ketiga yang OpenAI-compatible
 * (mis. Command Code: `https://api.commandcode.ai/provider/v1`). `createDeepSeek`
 * menerima `baseURL`, jadi tidak perlu provider terpisah — cukup arahkan
 * endpointnya dan pakai nama model milik gateway itu.
 */
export function pakaiGateway(): boolean {
  return Boolean(env("LLM_BASE_URL"));
}

/**
 * Kunci API provider dari lingkungan proses (undefined bila kosong).
 * Jalur DeepSeek menerima `LLM_API_KEY` (kunci gateway) lebih dulu, lalu
 * `DEEPSEEK_API_KEY` (kunci DeepSeek langsung).
 */
export function kunciProvider(provider: Provider): string | undefined {
  if (provider === "deepseek") return env("LLM_API_KEY") ?? env(ENV_KUNCI.deepseek);
  return env(ENV_KUNCI[provider]);
}

/**
 * Provider yang dipakai: LLM_PROVIDER bila diisi; bila kosong, DeepSeek jika
 * DEEPSEEK_API_KEY ada, lalu Anthropic jika ANTHROPIC_API_KEY ada. Melempar
 * `AiKeyMissingError` bila tidak ada satu pun (atau nilai LLM_PROVIDER asing).
 */
export function pilihProvider(): Provider {
  const eksplisit = env("LLM_PROVIDER")?.toLowerCase();
  if (eksplisit) {
    if (!isProvider(eksplisit)) {
      throw new AiKeyMissingError(
        `LLM_PROVIDER="${eksplisit}" tidak dikenal. Pilih "deepseek" (isi DEEPSEEK_API_KEY) atau "anthropic" (isi ANTHROPIC_API_KEY).`,
      );
    }
    return eksplisit;
  }
  if (kunciProvider("deepseek")) return "deepseek";
  if (kunciProvider("anthropic")) return "anthropic";
  throw new AiKeyMissingError();
}

/** Apakah ada provider yang bisa dipakai (provider terpilih DAN kuncinya terisi). */
export function hasAiKey(): boolean {
  try {
    return Boolean(kunciProvider(pilihProvider()));
  } catch {
    return false;
  }
}

/**
 * ID model untuk provider + peran. Urutan pada jalur DeepSeek:
 * `LLM_MODEL_RINGAN` (peran ringan) → `LLM_MODEL` → `DEEPSEEK_REASONER=1` →
 * `DEEPSEEK_MODEL` → default. Nama model gateway berbeda dari nama DeepSeek
 * langsung (mis. `deepseek/deepseek-v4-flash` vs `deepseek-v4-flash`), jadi
 * saat memakai gateway WAJIB set `LLM_MODEL`.
 */
export function idModel(provider: Provider, peran: PeranModel): string {
  if (provider === "anthropic") return MODEL_ID.anthropic[peran];
  if (peran === "ringan") {
    const ringan = env("LLM_MODEL_RINGAN") ?? env("LLM_MODEL");
    if (ringan) return ringan;
  } else {
    const penalaran = env("LLM_MODEL");
    if (penalaran) return penalaran;
  }
  if (peran === "penalaran" && env("DEEPSEEK_REASONER") === "1") return DEEPSEEK_MODEL_PENALARAN;
  return env("DEEPSEEK_MODEL") ?? MODEL_ID.deepseek[peran];
}

/**
 * Kembalikan model untuk peran tertentu. `override` (mis. MockLanguageModelV4
 * di tes) selalu menang dan tidak menyentuh kunci API.
 */
export function pilihModel(peran: PeranModel, override?: LanguageModel): LanguageModel {
  if (override) return override;
  const provider = pilihProvider();
  const apiKey = kunciProvider(provider);
  if (!apiKey) {
    throw new AiKeyMissingError(
      `LLM_PROVIDER=${provider} tetapi ${ENV_KUNCI[provider]} kosong. Isi di .env.local (lihat .env.example).`,
    );
  }
  const id = idModel(provider, peran);
  if (provider === "anthropic") return createAnthropic({ apiKey })(id);
  const baseURL = env("LLM_BASE_URL");
  return createDeepSeek(baseURL ? { apiKey, baseURL } : { apiKey })(id);
}

/**
 * Provider di balik sebuah model, dibaca dari `model.provider` (mis.
 * "deepseek.chat", "anthropic.messages"). Untuk model yang tidak dikenal
 * (model tiruan di tes, ID gateway) ikut LLM_PROVIDER/kunci di env; bila itu
 * pun tidak ada, DeepSeek (default proyek) — tidak pernah melempar.
 */
export function providerDari(model: LanguageModel): Provider {
  const nama = typeof model === "string" ? "" : model.provider;
  if (nama.startsWith("anthropic")) return "anthropic";
  if (nama.startsWith("deepseek")) return "deepseek";
  try {
    return pilihProvider();
  } catch {
    return "deepseek";
  }
}

export type Effort = NonNullable<AnthropicLanguageModelOptions["effort"]>;

/** Pemetaan effort Anthropic → reasoning_effort DeepSeek (low | high | max; DeepSeek memetakan medium→high). */
const EFFORT_DEEPSEEK: Record<Effort, NonNullable<DeepSeekLanguageModelOptions["reasoningEffort"]>> = {
  low: "low",
  medium: "high",
  high: "high",
  xhigh: "max",
  max: "max",
};

/**
 * providerOptions per provider untuk panggilan generateText:
 * - Anthropic: thinking adaptive (Opus 5 / Sonnet 5 menolak budgetTokens) + effort.
 * - DeepSeek : thinking enabled + reasoning_effort (thinking mode mendukung tool calls).
 * Hanya kunci provider terpilih yang dikembalikan.
 */
export function opsiProvider(provider: Provider, effort: Effort = "high"): ProviderOptions {
  // `satisfies` menjaga tipe literal (JSON murni) sekaligus memvalidasi nama opsi.
  if (provider === "anthropic") {
    return { anthropic: { thinking: { type: "adaptive" }, effort } satisfies AnthropicLanguageModelOptions };
  }
  // Lewat gateway: JANGAN kirim opsi khusus DeepSeek (thinking/reasoning_effort).
  // Gateway meneruskan body ke hulu dan bisa menolak field yang tidak dikenalnya
  // dengan HTTP 400 — yang hilang cuma penyetelan kedalaman berpikir, sementara
  // tool calling dan structured output tetap jalan.
  if (pakaiGateway()) return {};
  return {
    deepseek: { thinking: { type: "enabled" }, reasoningEffort: EFFORT_DEEPSEEK[effort] } satisfies DeepSeekLanguageModelOptions,
  };
}

/**
 * Bungkus instruksi sistem sebagai pesan `system`. Untuk Anthropic disertai
 * breakpoint prompt caching (ephemeral, 1 jam); DeepSeek meng-cache prefix
 * secara otomatis tanpa opsi apa pun. Teks instruksi harus stabil
 * byte-per-byte — jangan menyisipkan tanggal/ID dinamis di sini; letakkan di
 * pesan pengguna.
 */
export function instruksiSistem(teks: string, provider: Provider): Instructions {
  return [
    {
      role: "system",
      content: teks,
      ...(provider === "anthropic"
        ? { providerOptions: { anthropic: { cacheControl: { type: "ephemeral", ttl: "1h" } } } }
        : {}),
    },
  ];
}
