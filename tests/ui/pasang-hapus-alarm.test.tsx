// Hapus alarm buatan sendiri di /pasang (tiket 33), jsdom. Server ditiru:
// DELETE /api/alarms dicatat supaya tes bisa memeriksa token dan id-nya.
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PanelPasang } from "../../src/components/pasang/PanelPasang";
import { ID_ALARM_JEBAKAN } from "../../src/lib/jaga/bawaan";
import { KUNCI_ALARM, KUNCI_PEMILIK } from "../../src/lib/rakit/simpan";

const TOKEN = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa";
const ID_BUATAN = "11111111-2222-4333-8444-555555555555";
const RULE = { name: "Buatanku", combine: "any", blocks: [{ kind: "suspensi", threshold: "longgar" }] };

let adaDb = true;
let jawabHapus = 200;
const hapusDiminta: { id: string | null; token: string | null }[] = [];

function json(status: number, isi: unknown): Response {
  return new Response(JSON.stringify(isi), { status, headers: { "content-type": "application/json" } });
}

beforeEach(() => {
  adaDb = true;
  jawabHapus = 200;
  hapusDiminta.length = 0;
  window.localStorage.clear();
  window.localStorage.setItem(KUNCI_PEMILIK, TOKEN);
  window.localStorage.setItem(
    KUNCI_ALARM,
    JSON.stringify([{ id: ID_BUATAN, name: "Buatanku", rule: RULE, lastScore: null, disimpanPada: "x", di: "db" }]),
  );
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const u = String(url);
      const metode = init?.method ?? "GET";
      if (u.startsWith("/api/emiten/")) return json(200, {});
      if (!adaDb) return json(501, { error: { kode: "DB_TIDAK_TERSEDIA", pesan: "tanpa DB" } });
      if (u.startsWith("/api/alarms") && metode === "DELETE") {
        hapusDiminta.push({ id: new URL(u, "http://x").searchParams.get("id"), token: new Headers(init?.headers).get("x-owner-token") });
        return jawabHapus === 200
          ? json(200, { dihapus: ID_BUATAN })
          : json(jawabHapus, { error: { kode: "GALAT_INTERNAL", pesan: "server sibuk" } });
      }
      if (u === "/api/portofolio" && metode === "GET") return json(200, { portofolio: { id: "p1", symbols: [], alarmIds: [ID_BUATAN] } });
      if (u === "/api/portofolio") return json(200, { portofolio: { id: "p1", symbols: [], alarmIds: [] } });
      if (u === "/api/alarms") return json(200, { alarms: [] });
      if (u === "/api/inbox") return json(200, { pesan: [], belumDibaca: 0 });
      return json(404, { error: { kode: "TIDAK_ADA", pesan: u } });
    }),
  );
});

afterEach(() => vi.unstubAllGlobals());

async function siap() {
  render(<PanelPasang />);
  await waitFor(() => expect(screen.getByTestId("label-penyimpanan")).not.toHaveTextContent("memuat"));
  await screen.findByTestId(`alarm-${ID_BUATAN}`);
}

describe("hapus alarm (tiket 33)", () => {
  it("hanya alarm buatan sendiri yang punya tombol hapus", async () => {
    await siap();
    expect(within(screen.getByTestId(`alarm-${ID_BUATAN}`)).getByRole("button", { name: "Hapus alarm Buatanku" })).toBeInTheDocument();
    expect(within(screen.getByTestId(`alarm-${ID_ALARM_JEBAKAN}`)).queryByRole("button", { name: /Hapus/ })).toBeNull();
  });

  it("Batal di dialog konfirmasi tidak menghapus apa pun", async () => {
    await siap();
    fireEvent.click(screen.getByTestId(`hapus-alarm-${ID_BUATAN}`));
    expect(screen.getByRole("dialog", { name: "Hapus alarm “Buatanku”?" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Batal" }));
    expect(screen.getByTestId(`alarm-${ID_BUATAN}`)).toBeInTheDocument();
    expect(hapusDiminta).toHaveLength(0);
  });

  it("konfirmasi menghapus di server (dengan token pemilik) dan di browser", async () => {
    await siap();
    fireEvent.click(screen.getByTestId(`hapus-alarm-${ID_BUATAN}`));
    fireEvent.click(screen.getByTestId("tombol-ya-hapus-alarm"));
    await waitFor(() => expect(screen.queryByTestId(`alarm-${ID_BUATAN}`)).toBeNull());
    expect(hapusDiminta).toEqual([{ id: ID_BUATAN, token: TOKEN }]);
    expect(JSON.parse(window.localStorage.getItem(KUNCI_ALARM) ?? "[]")).toEqual([]);
    expect(screen.getByTestId("pesan-alarm")).toHaveTextContent("Alarm “Buatanku” dihapus.");
  });

  it("server gagal: alarm tetap ada di mana-mana dan galatnya dikatakan", async () => {
    jawabHapus = 500;
    await siap();
    fireEvent.click(screen.getByTestId(`hapus-alarm-${ID_BUATAN}`));
    fireEvent.click(screen.getByTestId("tombol-ya-hapus-alarm"));
    await waitFor(() => expect(screen.getByTestId("pesan-alarm")).toHaveTextContent("Alarm belum terhapus: server sibuk"));
    expect(screen.getByTestId(`alarm-${ID_BUATAN}`)).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem(KUNCI_ALARM) ?? "[]")).toHaveLength(1);
  });

  it("server tanpa database: alarm dihapus dari browser tanpa memanggil server", async () => {
    adaDb = false;
    await siap();
    fireEvent.click(screen.getByTestId(`hapus-alarm-${ID_BUATAN}`));
    fireEvent.click(screen.getByTestId("tombol-ya-hapus-alarm"));
    await waitFor(() => expect(screen.queryByTestId(`alarm-${ID_BUATAN}`)).toBeNull());
    expect(hapusDiminta).toHaveLength(0);
    expect(JSON.parse(window.localStorage.getItem(KUNCI_ALARM) ?? "[]")).toEqual([]);
  });
});
