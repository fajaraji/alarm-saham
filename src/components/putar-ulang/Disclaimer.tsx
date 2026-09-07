// Footer disclaimer (PLAN.md §2): di setiap layar.
export function Disclaimer() {
  return (
    <footer className="pu-footer" data-testid="disclaimer">
      <p style={{ margin: 0 }}>
        <strong>Alarm Saham adalah alat informasi, bukan saran investasi.</strong> Semua kejadian di halaman ini
        adalah fakta resmi dari feed Sectors (data BEI) dengan nama endpoint dan tautan dokumen bila tersedia; tidak
        ada penilaian tentang emiten mana pun. Data laporan dan keuangan tersedia sejak kuartal 1 2020, filing orang
        dalam sejak 2024. Cara kami menghitung: <code>docs/mesin-uji.md</code> dan{" "}
        <code>docs/data-proof.md</code> di repositori.
      </p>
    </footer>
  );
}
