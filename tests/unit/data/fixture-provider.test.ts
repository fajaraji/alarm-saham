import { describe, expect, it } from "vitest";
import { FixtureProvider } from "../../../src/lib/data";
import { ujiKontrakDataProvider } from "./kontrak";

ujiKontrakDataProvider("FixtureProvider", async () => new FixtureProvider());

describe("FixtureProvider khusus", () => {
  it("menyediakan SRIL dan BBCA", () => {
    expect(new FixtureProvider().simbolTersedia().sort()).toEqual(["BBCA", "SRIL"]);
  });
});
