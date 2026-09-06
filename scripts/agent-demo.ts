#!/usr/bin/env node
// Demo agent AI (tiket 08) — MEMANGGIL API ANTHROPIC SUNGGUHAN (berbiaya).
//
//   npm run agent:demo -- tele
//     Aturan hanya `laporan_hilang` longgar pada fixture universe-kecil →
//     backtest (TELE/WIKA terlewat) → diagnosis; cetak ringkasan, usulan blok,
//     trace, dan pemakaian token.
//   npm run agent:demo -- rakit "aku mau alarm buat saham yang mau pailit"
//     Perakit blok: kalimat → aturan (atau penolakan).
//   Opsi: --json (cetak JSON lengkap), --db (pakai DATABASE_URL bila ada),
//         --symbol=TELE (fokus emiten), --today=YYYY-MM-DD
//
// Kunci dibaca dari .env.local lewat `node --env-file-if-exists=.env.local`.
import {
  AiKeyMissingError,
  diagnosis,
  hasAiKey,
  MODEL_ID,
  pilihSumber,
  rakitAturan,
  RakitError,
  type DiagnosisResult,
  type HasilRakit,
} from "../src/lib/agent";
import { formatBacktest, parseRule, ringkasAturan, runBacktest, type Rule } from "../src/lib/engine";

function bantuan(): string {
  return [
    "Pemakaian:",
    "  npm run agent:demo -- tele [--symbol=TELE] [--today=YYYY-MM-DD] [--db] [--json]",
    "  npm run agent:demo -- rakit \"<kalimat>\" [--json]",
    "",
    `Model: diagnosis/perakit ${MODEL_ID.diagnosis}. Butuh ANTHROPIC_API_KEY di .env.local (memanggil API sungguhan).`,
  ].join("\n");
}

interface Argumen {
  posisi: string[];
  opsi: Record<string, string>;
}

function urai(argv: string[]): Argumen {
  const posisi: string[] = [];
  const opsi: Record<string, string> = {};
  for (const a of argv) {
    if (a.startsWith("--")) {
      const [k, ...v] = a.slice(2).split("=");
      opsi[k] = v.length ? v.join("=") : "1";
    } else {
      posisi.push(a);
    }
  }
  return { posisi, opsi };
}

function cetakUsage(u: { inputTokens: number; outputTokens: number; totalTokens: number; cacheReadTokens: number; cacheWriteTokens: number }) {
  console.log(
    `Token    : input ${u.inputTokens} (cache read ${u.cacheReadTokens}, cache write ${u.cacheWriteTokens}), output ${u.outputTokens}, total ${u.totalTokens}`,
  );
}

function cetakDiagnosis(hasil: DiagnosisResult) {
  console.log("");
  console.log("=== RINGKASAN ===");
  console.log(hasil.ringkasan);
  console.log("");
  console.log("=== EMITEN DIBAHAS ===");
  for (const e of hasil.emitenDibahas) {
    console.log(`- ${e.symbol}: ${e.sebab}`);
    if (e.buktiTanggal.length) console.log(`  bukti: ${e.buktiTanggal.join(", ")}`);
  }
  console.log("");
  console.log("=== USULAN BLOK ===");
  if (!hasil.usulanBlok.length) console.log("(tidak ada)");
  for (const u of hasil.usulanBlok) console.log(`- ${u.kind} (${u.threshold}): ${u.alasan}`);
  console.log("");
  console.log(`=== TRACE (${hasil.langkah} langkah, ${hasil.trace.length} tool call) ===`);
  for (const t of hasil.trace) {
    console.log(`[${t.step}] ${t.tool}(${JSON.stringify(t.input)}) → ${t.ringkasanHasil}`);
  }
  console.log("");
  cetakUsage(hasil.usage);
  if (hasil.perluTinjau) console.log(`PERLU TINJAU: kata rekomendasi disensor: ${hasil.kataDisensor.join(", ")}`);
  if (hasil.runId) console.log(`Trace tersimpan di runs.id = ${hasil.runId}`);
}

function cetakRakit(hasil: HasilRakit) {
  console.log("");
  if (hasil.ditolak) {
    console.log("DITOLAK  :", hasil.pesan);
  } else {
    console.log("Aturan   :", hasil.rule.name);
    console.log("Blok     :", ringkasAturan(hasil.rule));
    console.log("Alasan   :", hasil.alasan);
    console.log("JSON     :", JSON.stringify(hasil.rule));
  }
  cetakUsage(hasil.usage);
  if (hasil.perluTinjau) console.log(`PERLU TINJAU: kata rekomendasi disensor: ${hasil.kataDisensor.join(", ")}`);
}

async function kasusTele(arg: Argumen): Promise<number> {
  const rule: Rule = parseRule({
    name: "Laporan hilang saja",
    combine: "any",
    blocks: [{ kind: "laporan_hilang", threshold: "longgar" }],
  });
  const { source, universe, keterangan } = await pilihSumber(!arg.opsi.db);
  console.log(`Sumber   : ${keterangan}`);
  const backtest = await runBacktest(rule, universe, source, { today: arg.opsi.today });
  console.log(formatBacktest(rule, backtest));
  const terlewat = backtest.perSymbol.filter((r) => r.group !== "control" && !r.fired).map((r) => r.symbol);
  console.log(`Terlewat : ${terlewat.join(", ") || "-"}`);
  console.log("");
  console.log(`Menjalankan diagnosis dengan ${MODEL_ID.diagnosis} ...`);
  const mulai = Date.now();
  const hasil = await diagnosis({ rule, backtest, source, targetSymbol: arg.opsi.symbol });
  console.log(`Selesai dalam ${((Date.now() - mulai) / 1000).toFixed(1)} detik.`);
  if (arg.opsi.json) console.log(JSON.stringify(hasil, null, 2));
  else cetakDiagnosis(hasil);
  return 0;
}

async function kasusRakit(arg: Argumen): Promise<number> {
  const kalimat = arg.posisi.slice(1).join(" ").trim();
  if (!kalimat) {
    console.error('Kalimat kosong. Contoh: npm run agent:demo -- rakit "aku mau alarm buat saham yang mau pailit"');
    return 1;
  }
  console.log(`Kalimat  : ${kalimat}`);
  console.log(`Menjalankan perakit dengan ${MODEL_ID.perakit} ...`);
  const hasil = await rakitAturan(kalimat);
  if (arg.opsi.json) console.log(JSON.stringify(hasil, null, 2));
  else cetakRakit(hasil);
  return 0;
}

async function main(): Promise<number> {
  const arg = urai(process.argv.slice(2));
  const kasus = arg.posisi[0];
  if (!kasus || arg.opsi.help) {
    console.log(bantuan());
    return arg.opsi.help ? 0 : 1;
  }
  if (!hasAiKey()) {
    console.error(new AiKeyMissingError().message);
    return 2;
  }
  switch (kasus) {
    case "tele":
      return kasusTele(arg);
    case "rakit":
      return kasusRakit(arg);
    default:
      console.error(`Kasus tidak dikenal: ${kasus}\n\n${bantuan()}`);
      return 1;
  }
}

main()
  .then((kode) => process.exit(kode))
  .catch((err: unknown) => {
    if (err instanceof RakitError || err instanceof AiKeyMissingError) console.error(err.message);
    else console.error(`Gagal: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`);
    process.exit(1);
  });
