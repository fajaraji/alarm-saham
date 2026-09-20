// Tanggal data kelas A dibaca dari buku kredit, bukan diketik tangan (tiket 42).
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { tanggalTarikData } from "../../src/lib/data/tanggal-tarik";
import { apiLedger } from "../../src/lib/db/schema";
import { makeTestDb, type TestDb } from "./test-db";

const adaPglite = await import("@electric-sql/pglite").then(
  () => true,
  () => false,
);

let t: TestDb;

beforeAll(async () => {
  if (!adaPglite) return;
  t = await makeTestDb();
  await t.migrate();
}, 120_000);

afterAll(async () => {
  await t?.close();
});

describe.skipIf(!adaPglite)("tanggalTarikData", () => {
  it("null tanpa database, dan null selama belum ada panggilan API tercatat", async () => {
    expect(await tanggalTarikData(null)).toBeNull();
    expect(await tanggalTarikData(t.db)).toBeNull();
  });

  it("memakai panggilan API terakhir, bukan yang pertama", async () => {
    await t.db.insert(apiLedger).values([
      { at: new Date("2026-09-04T03:00:00Z"), endpoint: "/v2/suspensions/", status: 200, credits: 1 },
      { at: new Date("2026-09-07T22:10:00Z"), endpoint: "/v2/quarterly-financial-dates/", status: 200, credits: 1 },
      { at: new Date("2026-09-05T09:00:00Z"), endpoint: "/v2/filings/", status: 200, credits: 1 },
    ]);
    expect(await tanggalTarikData(t.db)).toBe("2026-09-07");
  });
})
;
