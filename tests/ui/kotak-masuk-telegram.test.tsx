// Petunjuk Telegram hanya saat bot aktif (tiket 25), jsdom. Halaman /pasang
// dirender utuh dengan env bot berisi nilai penanda, lalu HTML-nya diperiksa:
// yang boleh sampai ke browser hanya boolean "aktif", bukan token atau secret.
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { KotakMasuk } from "../../src/components/pasang/KotakMasuk";
import { botAktif } from "../../src/lib/telegram/status";

vi.mock("@/lib/sumber-situs", () => ({ sumberSitus: async () => ({ nyata: true, jenis: "pglite" }) }));

const { default: HalamanPasang } = await import("../../src/app/pasang/page");

const KODE = "0b7e2c1a-3f4d-4e5f-8a9b-0c1d2e3f4a5b";
const TOKEN_PENANDA = "123456789:TOKEN-PENANDA-JANGAN-BOCOR";
const SECRET_PENANDA = "SECRET-PENANDA-JANGAN-BOCOR";

const env = (isi: Record<string, string>) => isi as unknown as NodeJS.ProcessEnv;

describe("botAktif", () => {
  it("aktif hanya bila token DAN secret webhook terisi (spasi saja dianggap kosong)", () => {
    expect(botAktif(env({ TELEGRAM_BOT_TOKEN: "t", TELEGRAM_WEBHOOK_SECRET: "s" }))).toBe(true);
    expect(botAktif(env({ TELEGRAM_BOT_TOKEN: "t" }))).toBe(false);
    expect(botAktif(env({ TELEGRAM_WEBHOOK_SECRET: "s" }))).toBe(false);
    expect(botAktif(env({ TELEGRAM_BOT_TOKEN: "t", TELEGRAM_WEBHOOK_SECRET: "  " }))).toBe(false);
    expect(botAktif(env({}))).toBe(false);
  });
});

describe("KotakMasuk", () => {
  it("bot tidak aktif: tidak menyebut Telegram maupun /mulai, walau kode portofolio ada", () => {
    render(<KotakMasuk pesan={[]} onTandaiDibaca={() => {}} kodePortofolio={KODE} telegramAktif={false} />);
    const kotak = screen.getByTestId("kotak-masuk");
    expect(kotak).not.toHaveTextContent(/Telegram/i);
    expect(kotak).not.toHaveTextContent("/mulai");
    expect(screen.queryByTestId("kode-portofolio")).toBeNull();
  });

  it("bot aktif: petunjuk /mulai beserta kode portofolio tampil", () => {
    render(<KotakMasuk pesan={[]} onTandaiDibaca={() => {}} kodePortofolio={KODE} telegramAktif />);
    expect(screen.getByTestId("petunjuk-telegram")).toHaveTextContent(`/mulai ${KODE}`);
    expect(screen.getByTestId("kode-portofolio")).toHaveTextContent(KODE);
    expect(screen.getByTestId("petunjuk-telegram")).not.toHaveTextContent("bila bot aktif");
  });
});

describe("halaman /pasang", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL | Request) => {
        const u = String(url);
        const isi =
          u === "/api/portofolio"
            ? { portofolio: { id: KODE, symbols: ["BBCA"], alarmIds: [] } }
            : u === "/api/alarms"
              ? { alarms: [] }
              : u === "/api/inbox"
                ? { pesan: [], belumDibaca: 0 }
                : {};
        return new Response(JSON.stringify(isi), { status: 200, headers: { "content-type": "application/json" } });
      }),
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("bot aktif: petunjuk tampil, tetapi token dan secret tidak pernah ada di halaman", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", TOKEN_PENANDA);
    vi.stubEnv("TELEGRAM_WEBHOOK_SECRET", SECRET_PENANDA);
    const { container } = render(await HalamanPasang());
    await waitFor(() => expect(screen.getByTestId("kode-portofolio")).toHaveTextContent(KODE));
    expect(container.innerHTML).not.toContain("TOKEN-PENANDA");
    expect(container.innerHTML).not.toContain("SECRET-PENANDA");
  });

  it("bot mati (secret kosong, seperti situs live sekarang): tidak ada petunjuk Telegram", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", TOKEN_PENANDA);
    vi.stubEnv("TELEGRAM_WEBHOOK_SECRET", "");
    render(await HalamanPasang());
    await waitFor(() => expect(screen.getByTestId("label-penyimpanan")).not.toHaveTextContent("memuat"));
    expect(screen.getByTestId("kotak-masuk")).not.toHaveTextContent(/Telegram/i);
    expect(screen.queryByTestId("petunjuk-telegram")).toBeNull();
  });
});
