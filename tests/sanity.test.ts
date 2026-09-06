import { describe, expect, it } from "vitest";

// Tes sanity: memastikan pipeline Vitest + TypeScript berjalan.
describe("sanity", () => {
  it("aritmatika dasar bekerja", () => {
    expect(1 + 1).toBe(2);
  });

  it("nama proyek konsisten", () => {
    expect("alarm-saham").toMatch(/^alarm-saham$/);
  });
});
