"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

type Zeile = { id: number; zeit: string; kuerzel: string; kategorie: string; aktion: string; akte_id: string | null; details: string; ip: string };
type Antwort = { eintraege: Zeile[]; kette: { ok: boolean; anzahl: number; fehlerBei?: number } };
const BEREICHE: [string, string][] = [["", "Alle"], ["anmeldung", "Anmeldung"], ["akte", "Akte"], ["dokument", "Dokument"], ["eingang", "Eingang"], ["frist", "Frist"], ["ki", "KI"], ["benutzer", "Benutzer"], ["einstellungen", "Einstellungen"]];
const FARBE: Record<string, string> = { anmeldung: "#6b7178", benutzer: "#B5620A", einstellungen: "#B5620A", ki: "#1F4FD1" };

export default function Protokoll() {
  const [f, setF] = useState({ von: "", bis: "", kuerzel: "", kategorie: "", akte: "", suche: "" });
  const [d, setD] = useState<Antwort | null>(null);
  const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v)).toString();
  useEffect(() => {
    const t = setTimeout(() => fetch("/api/protokoll?" + qs).then((r) => r.json()).then(setD), 200);
    return () => clearTimeout(t);
  }, [qs]);

  const feld = (k: keyof typeof f, l: string, w: number, typ = "text") => (
    <label><div className="lab">{l}</div><input className="feld" type={typ} style={{ width: w }} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></label>
  );
  const td: React.CSSProperties = { padding: "6px 8px", borderBottom: "1px solid #eceef0", fontSize: 13, verticalAlign: "top" };

  return (
    <div className="main" style={{ padding: 20, flexDirection: "column", overflow: "auto" }}>
      <div className="head" style={{ display: "flex", alignItems: "flex-end", gap: 16 }}>
        <div>
          <h1>Protokoll</h1>
          <div className="lab" style={{ fontSize: 13, marginTop: 2 }}>Wer hat wann was getan · unveränderlich, jede Zeile mit der vorherigen verkettet</div>
        </div>
        <div style={{ flex: 1 }} />
        {d && (
          <span style={{ fontSize: 12, padding: "4px 10px", borderRadius: 4, border: `1px solid ${d.kette.ok ? "#9fd3b0" : "#e3a29a"}`, background: d.kette.ok ? "#eef8f1" : "#fdf0ee", color: d.kette.ok ? "#1d7a43" : "#c0392b" }}>
            {d.kette.ok ? `✓ Kette intakt · ${d.kette.anzahl} Einträge` : `✗ Kette verletzt bei Eintrag #${d.kette.fehlerBei}`}
          </span>
        )}
        <a className="btn" href={"/api/protokoll?format=csv&" + qs}>CSV-Export</a>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end", margin: "14px 0" }}>
        {feld("von", "Von", 140, "date")}
        {feld("bis", "Bis", 140, "date")}
        {feld("kuerzel", "Benutzer (Kürzel)", 110)}
        <label><div className="lab">Bereich</div>
          <select className="feld" value={f.kategorie} onChange={(e) => setF({ ...f, kategorie: e.target.value })}>
            {BEREICHE.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </label>
        {feld("akte", "Akte (Az.)", 100)}
        {feld("suche", "Suche", 200)}
        {Object.values(f).some(Boolean) && <button className="btn" onClick={() => setF({ von: "", bis: "", kuerzel: "", kategorie: "", akte: "", suche: "" })}>Zurücksetzen</button>}
      </div>

      {!d ? <div className="empty">Lade …</div> : d.eintraege.length === 0 ? <div className="empty">Keine Einträge</div> : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>{["Zeit", "Wer", "Bereich", "Aktion", "Akte", "Details", "IP"].map((h) => <th key={h} className="th" style={{ ...td, textAlign: "left", background: "#fafbfc" }}>{h}</th>)}</tr></thead>
          <tbody>
            {d.eintraege.map((r) => (
              <tr key={r.id}>
                <td style={{ ...td, whiteSpace: "nowrap" }} className="mono">{r.zeit}</td>
                <td style={td} className="mono">{r.kuerzel || "–"}</td>
                <td style={{ ...td, color: FARBE[r.kategorie] ?? "#3a3f47" }}>{BEREICHE.find(([k]) => k === r.kategorie)?.[1] ?? r.kategorie}</td>
                <td style={{ ...td, color: /fehlgeschlagen|gelöscht|deaktiviert/i.test(r.aktion + r.details) ? "#c0392b" : undefined }}>{r.aktion}</td>
                <td style={td} className="mono">{r.akte_id ? <Link href={`/akte/${encodeURIComponent(r.akte_id)}`}>{r.akte_id}</Link> : ""}</td>
                <td style={{ ...td, color: "#6b7178" }}>{r.details}</td>
                <td style={{ ...td, color: "#6b7178" }} className="mono">{r.ip}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {d && d.eintraege.length >= 500 && <div className="lab" style={{ marginTop: 8 }}>Es werden die neuesten 500 angezeigt – Filter verwenden oder CSV exportieren (bis 5.000).</div>}
    </div>
  );
}
