"use client";
import { useEffect, useState } from "react";

type Vorlage = { id: number; name: string; typ: string; empfaenger: string; wv_tage: number };

/** Seitenfenster in der Akte: Vorlage wählen, Text prüfen/ändern, als PDF mit Briefkopf erstellen. */
export default function SchreibenPanel({ akteId, onClose, onFertig, zeige }: { akteId: string; onClose: () => void; onFertig: () => void; zeige: (m: string) => void }) {
  const [vorlagen, setVorlagen] = useState<Vorlage[]>([]);
  const [vid, setVid] = useState<number | null>(null);
  const [text, setText] = useState("");
  const [empfaenger, setEmpfaenger] = useState("");
  const [fehlend, setFehlend] = useState<string[]>([]);
  const [rolle, setRolle] = useState("");
  const [laeuft, setLaeuft] = useState(false);

  useEffect(() => {
    fetch("/api/vorlagen").then((r) => r.json()).then((j) => { setVorlagen(j.vorlagen); if (j.vorlagen[0]) setVid(j.vorlagen[0].id); });
  }, []);
  useEffect(() => {
    if (!vid) return;
    fetch("/api/schreiben/vorschau", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ akteId, vorlageId: vid }) })
      .then((r) => r.json()).then((j) => { setText(j.text ?? ""); setEmpfaenger(j.empfaenger ?? ""); setFehlend(j.fehlend ?? []); setRolle(j.empfaengerRolle ?? ""); });
  }, [vid, akteId]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const offen = Array.from(new Set(Array.from(text.matchAll(/\[\[([\w.]+)\]\]/g)).map((m) => m[1])));
  const vorlage = vorlagen.find((v) => v.id === vid);

  const erstellen = async (trotzdem = false) => {
    setLaeuft(true);
    const r = await fetch("/api/schreiben", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ akteId, vorlageId: vid, text, empfaenger, trotzdem }) });
    const j = await r.json();
    setLaeuft(false);
    if (!r.ok) return zeige(j.fehler ?? "Fehler");
    zeige(`${j.name} erstellt${j.wv ? ` · Wiedervorlage ${j.wv.split("-").reverse().join(".")}` : ""}`);
    window.open(`/api/dokumente/${j.dokId}`, "_blank");
    onFertig();
  };

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(22,25,29,.25)", zIndex: 40 }} />
      <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 720, maxWidth: "100vw", background: "#fff", borderLeft: "1px solid #c9ccd1", boxShadow: "-8px 0 24px rgba(0,0,0,.1)", zIndex: 41, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 18, fontWeight: 600 }}>Schreiben erstellen</span>
          <span className="lab mono">Az. {akteId}</span>
          <div style={{ flex: 1 }} /><span className="k">Esc</span>
        </div>
        <div style={{ flex: 1, overflow: "auto", padding: "14px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {vorlagen.map((v) => <span key={v.id} className={"chip" + (v.id === vid ? " on" : "")} onClick={() => setVid(v.id)}>{v.name}</span>)}
          </div>
          <div>
            <div className="lab" style={{ marginBottom: 3 }}>Empfänger ({rolle || "–"}){!empfaenger && <span style={{ color: "#B5620A" }}> · kein {rolle} mit Adresse in der Akte – bitte eintragen</span>}</div>
            <textarea className="feld" style={{ width: "100%", minHeight: 70, background: empfaenger ? "#fff" : "var(--hl2)" }} value={empfaenger} onChange={(e) => setEmpfaenger(e.target.value)} placeholder={"Name\nStraße\nPLZ Ort"} />
          </div>
          {offen.length > 0 && (
            <div style={{ fontSize: 14.5, color: "#8a2416", background: "#fdeeea", border: "1px solid #f0c4b9", borderRadius: 4, padding: "8px 10px" }}>
              Es fehlen Angaben aus der Akte: {offen.map((f) => <code key={f} style={{ marginRight: 6 }}>{f}</code>)}<br />
              <span className="lab">Im Text ersetzen oder in der Akte (Beteiligte, Falldaten, Aktenkonto) ergänzen und Vorlage neu wählen.</span>
            </div>
          )}
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <div className="lab" style={{ marginBottom: 3 }}>Text (aus der Akte befüllt, frei änderbar)</div>
            <textarea className="feld" style={{ width: "100%", flex: 1, minHeight: 320, fontSize: 15, lineHeight: 1.6, fontFamily: "Georgia, serif", padding: 14 }} value={text} onChange={(e) => setText(e.target.value)} />
          </div>
          {vorlage && vorlage.wv_tage > 0 && <div className="lab">Danach wird automatisch eine Wiedervorlage in {vorlage.wv_tage} Tagen gesetzt. Briefkopf, Logo und Signatur kommen aus den Einstellungen.</div>}
          {fehlend.length === 0 && offen.length === 0 && <div className="lab" style={{ color: "var(--gruen)" }}>✓ Alle Angaben aus der Akte gefunden</div>}
        </div>
        <div style={{ padding: "12px 20px", borderTop: "1px solid var(--line)", display: "flex", gap: 6 }}>
          <button className="btn pri" style={{ padding: "8px 16px", fontSize: 14.5 }} disabled={laeuft || !text} onClick={() => erstellen(false)}>Als PDF erstellen &amp; ablegen</button>
          {offen.length > 0 && <button className="btn" onClick={() => erstellen(true)}>Trotzdem erstellen</button>}
          <button className="btn" onClick={onClose}>Abbrechen</button>
        </div>
      </div>
    </>
  );
}
