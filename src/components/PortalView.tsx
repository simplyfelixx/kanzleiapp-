// Ansicht des Mandanten (Handy-tauglich). Wird im Portal und als Vorschau in der Portal-Verwaltung benutzt.
import type { PortalAnsicht } from "@/lib/portal";

const euro = (n: number) => n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";

export default function PortalView({ a }: { a: PortalAnsicht }) {
  const karte: React.CSSProperties = { border: "1px solid #e1e4e8", borderRadius: 8, padding: 16, background: "#fff" };
  const th: React.CSSProperties = { fontSize: 12.5, textTransform: "uppercase", letterSpacing: ".06em", color: "#6b7178", fontWeight: 500, marginBottom: 8 };
  return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: 16, display: "flex", flexDirection: "column", gap: 12, fontSize: 16, lineHeight: 1.5 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: 6, background: "var(--akzent, #1E3A6E)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 14 }}>
          {a.kanzlei.name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
        </div>
        <div>
          <div style={{ fontWeight: 600 }}>{a.kanzlei.name}</div>
          <div style={{ fontSize: 13.5, color: "#6b7178" }}>{a.unfalltag ? `Ihr Unfall vom ${a.unfalltag}` : `Ihre Angelegenheit · Az. ${a.az}`}</div>
        </div>
      </div>

      <div style={karte}>
        <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 6 }}>Hallo {a.anrede || "und willkommen"}</div>
        {a.meldung
          ? <><div style={{ whiteSpace: "pre-wrap" }}>{a.meldung.text}</div><div style={{ fontSize: 13, color: "#6b7178", marginTop: 6 }}>Stand {a.meldung.datum}</div></>
          : <div style={{ color: "#6b7178" }}>Wir kümmern uns um Ihren Fall. Neuigkeiten erscheinen hier.</div>}
      </div>

      {a.aufgaben && a.aufgaben.length > 0 && (
        <div style={{ ...karte, borderColor: "#e8c49a", background: "#fdf6ee" }}>
          <div style={{ ...th, color: "#B5620A" }}>Bitte erledigen: {a.aufgaben.length} {a.aufgaben.length === 1 ? "Sache" : "Sachen"}</div>
          {a.aufgaben.map((t) => <div key={t} style={{ padding: "4px 0" }}>• {t}</div>)}
          <div style={{ fontSize: 13, color: "#6b7178", marginTop: 6 }}>Bitte per E-Mail an {a.kanzlei.email || "uns"} senden und das Aktenzeichen {a.az} angeben.</div>
        </div>
      )}

      {a.geld && (
        <div style={karte}>
          <div style={th}>Geld</div>
          {([["Gefordert", a.geld.gefordert], ["Bereits gezahlt", a.geld.gezahlt]] as const).map(([l, v]) => (
            <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}><span>{l}</span><span className="mono">{euro(v)}</span></div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0 0", marginTop: 4, borderTop: "1px solid #eef0f2", fontWeight: 600 }}><span>Noch offen</span><span className="mono">{euro(a.geld.offen)}</span></div>
        </div>
      )}

      {a.fortschritt && (
        <div style={karte}>
          <div style={th}>Stand Ihres Falls</div>
          {a.fortschritt.schritte.map((s, i) => {
            const fertig = i < a.fortschritt!.aktuell, jetzt = i === a.fortschritt!.aktuell;
            return (
              <div key={s} style={{ display: "flex", gap: 10, alignItems: "center", padding: "5px 0", color: fertig || jetzt ? "#16191d" : "#9aa0a6", fontWeight: jetzt ? 600 : 400 }}>
                <span style={{ width: 14, height: 14, borderRadius: "50%", flex: "none", background: fertig ? "#2e8b57" : jetzt ? "var(--akzent, #1E3A6E)" : "#fff", border: fertig || jetzt ? "none" : "1.5px solid #c9ccd1" }} />
                {s}{jetzt && <span style={{ fontSize: 13, color: "#6b7178", fontWeight: 400 }}> · aktuell</span>}
              </div>
            );
          })}
        </div>
      )}

      <div style={{ fontSize: 13, color: "#6b7178", textAlign: "center", marginTop: 4 }}>
        Fragen? {a.kanzlei.telefon && <>Tel. {a.kanzlei.telefon}</>}{a.kanzlei.telefon && a.kanzlei.email && " · "}{a.kanzlei.email}<br />Aktenzeichen {a.az}
      </div>
    </div>
  );
}
