// POST /api/agent/rakit  { kalimat } → aturan alarm (atau penolakan sopan).
import { z } from "zod";

import { AiKeyMissingError, hasAiKey, rakitAturan, RakitError } from "@/lib/agent";

export const maxDuration = 60;

const BodySchema = z.object({
  kalimat: z
    .string({ error: "kalimat harus berupa teks" })
    .trim()
    .min(3, { error: "kalimat minimal 3 karakter" })
    .max(500, { error: "kalimat maksimal 500 karakter" }),
});

function galat(status: number, kode: string, pesan: string, rincian?: unknown) {
  return Response.json({ error: { kode, pesan, ...(rincian !== undefined ? { rincian } : {}) } }, { status });
}

export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return galat(400, "BODY_BUKAN_JSON", "Body harus JSON, mis. { \"kalimat\": \"...\" }");
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return galat(
      400,
      "INPUT_TIDAK_VALID",
      "Input tidak valid",
      parsed.error.issues.map((i) => ({ path: i.path.map(String).join(".") || "(akar)", pesan: i.message })),
    );
  }
  if (!hasAiKey()) {
    return galat(503, "AI_TIDAK_TERSEDIA", new AiKeyMissingError().message);
  }
  try {
    const hasil = await rakitAturan(parsed.data.kalimat);
    return Response.json(hasil);
  } catch (err) {
    if (err instanceof AiKeyMissingError) return galat(503, "AI_TIDAK_TERSEDIA", err.message);
    if (err instanceof RakitError) return galat(502, "RAKIT_GAGAL", err.message);
    console.error("[api/agent/rakit]", err);
    return galat(500, "GALAT_INTERNAL", "Perakit blok gagal; coba lagi sesaat.");
  }
}
