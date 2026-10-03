// Gambar berbagi (Open Graph / Twitter) dirender saat build dari token yang
// sama dengan layar, tanpa aset foto: aksen navy pada latar terang, satu baris
// judul display, satu baris ringkasan, dan satu angka dari snapshot uji.
//
// Angka yang dipakai WAJIB dari docs/skor-nyata.json (R-17: tidak ada angka
// karangan). Bila snapshot tidak ada, kalimatnya diturunkan, bukan diganti
// angka baru.
import { ImageResponse } from "next/og";

import { SKOR_NYATA } from "@/lib/metodologi/skor";

export const alt = "Alarm Saham · Pantau sinyal risiko resmi pada saham yang dipegang.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function GambarBerbagi() {
  const skor = SKOR_NYATA;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#f3f5f9",
          padding: "72px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div
            style={{
              width: "52px",
              height: "52px",
              borderRadius: "12px",
              background: "#2c3f9e",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#ffffff",
              fontSize: "34px",
              fontWeight: 800,
            }}
          >
            !
          </div>
          <div style={{ fontSize: "30px", fontWeight: 700, color: "#151c2b" }}>Alarm Saham</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div style={{ fontSize: "58px", fontWeight: 800, lineHeight: 1.1, color: "#151c2b", maxWidth: "900px" }}>
            Pantau sinyal risiko resmi pada saham yang dipegang.
          </div>
          <div style={{ fontSize: "28px", color: "#3f4a5f", maxWidth: "860px" }}>
            Suspensi, laporan yang berhenti, utang lebih besar dari harta. Bertanggal, dengan sumbernya.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "baseline", gap: "14px" }}>
          <div style={{ display: "flex", fontSize: "34px", fontWeight: 800, color: "#2c3f9e" }}>
            {skor.hits}/{skor.total}
          </div>
          <div style={{ fontSize: "22px", color: "#5c6880" }}>
            saham bermasalah yang tandanya terbit lebih dulu
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}