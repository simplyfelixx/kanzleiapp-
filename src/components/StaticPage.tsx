/**
 * Zeigt einen übernommenen Design-Screen an (noch ohne echte Logik).
 * kind: "desk" = normale Seite unter der Kopfleiste, "phone" = Handy-Ansicht, "bare" = Vollbild.
 */
export default function StaticPage({ css, html, kind }: { css: string; html: string; kind: "desk" | "phone" | "bare" }) {
  if (kind === "phone") {
    return (
      <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center", background: "#eceef1", padding: 24, overflow: "auto" }}>
        <style>{css}</style>
        <div style={{ borderRadius: 24, overflow: "hidden", boxShadow: "0 10px 40px rgba(0,0,0,.18)", border: "8px solid #16191d" }} dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    );
  }
  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "auto" }}>
      <style>{css}</style>
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }} dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
