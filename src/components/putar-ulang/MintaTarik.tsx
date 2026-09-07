"use client";
// Tombol "minta ditarik": POST /api/emiten/[symbol] → hanya dicatat (tidak memanggil API Sectors).
import { useState } from "react";

type Status = "diam" | "mengirim" | "tercatat" | "gagal";

export function MintaTarik({ symbol }: { symbol: string }) {
  const [status, setStatus] = useState<Status>("diam");
  const [pesan, setPesan] = useState<string>("");

  async function kirim() {
    setStatus("mengirim");
    try {
      const res = await fetch(`/api/emiten/${encodeURIComponent(symbol)}`, { method: "POST" });
      const json = (await res.json()) as { pesan?: string; error?: { pesan: string } };
      if (!res.ok) throw new Error(json.error?.pesan ?? `HTTP ${res.status}`);
      setPesan(json.pesan ?? "Permintaan dicatat.");
      setStatus("tercatat");
    } catch (err) {
      setPesan(err instanceof Error ? err.message : "Gagal mencatat permintaan.");
      setStatus("gagal");
    }
  }

  return (
    <div data-testid="minta-tarik">
      <button className="pu-btn primary" type="button" onClick={kirim} disabled={status !== "diam"}>
        {status === "mengirim" ? "Mencatat…" : status === "tercatat" ? "Permintaan tercatat" : `Minta ${symbol} ditarik`}
      </button>
      {pesan && (
        <p className={status === "tercatat" ? "pu-ok-text" : undefined} style={{ marginTop: 8 }} role="status">
          {pesan}
        </p>
      )}
    </div>
  );
}
