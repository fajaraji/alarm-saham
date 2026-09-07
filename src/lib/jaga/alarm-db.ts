// Alarm kelas A milik pemilik di tabel `alarms` (tiket 09) → AlarmJaga, satu
// per aturan. Dipakai route "cek sekarang" (tiket 11) dan cron harian (tiket 12)
// agar keduanya menilai alarm yang persis sama.
import { eq } from "drizzle-orm";

import type { Db } from "../db/client";
import { alarms as tabelAlarm } from "../db/schema";
import { RuleSchema } from "../engine/rules";
import type { AlarmJaga } from "./bawaan";

export async function alarmDariDb(db: Db, owner: string): Promise<AlarmJaga[]> {
  const rows = await db
    .select({ id: tabelAlarm.id, name: tabelAlarm.name, rules: tabelAlarm.rules })
    .from(tabelAlarm)
    .where(eq(tabelAlarm.ownerToken, owner));
  const hasil: AlarmJaga[] = [];
  for (const r of rows) {
    const aturan = r.rules.map((x) => RuleSchema.safeParse(x)).filter((p) => p.success).map((p) => p.data);
    aturan.forEach((rule, i) => {
      hasil.push({ id: r.id, name: aturan.length > 1 ? `${r.name} (${i + 1})` : r.name, kelas: "A", rule, bawaan: false });
    });
  }
  return hasil;
}
