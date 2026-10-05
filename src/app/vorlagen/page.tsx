"use client";
import { useEffect, useRef, useState } from "react";
import { useStore } from "@/components/Store";

type Vorlage = { id: number; name: string; typ: string; empfaenger: string; text: string; wv_tage: number; wv_titel: string };
const ROLLEN = ["Versicherung", "Mandant", "Gegner", "Rechtsschutz", "Polizei", "Bank", "Werkstatt", "Gutachter"];

export default function Vorlagen() {
  const { zeige } = useStore();
  const [liste, setListe] = useState<Vorlage[]>([]);
  const [platzhalter, setPlatzhalter] = useState<string[]>([]);
  const [v, setV] = useState<Vorlage | null>(null);
  const [akten, setAkten] = useState<{ id: string; titel: string }[]>([]);
  const [test, setTest] = useState("");
  const [vorschau, setVorschau] = useState<{ text: string; fehlend: string[] } | null>(null);
  const ta = useRef<HTMLTextAreaElement>(null);

  const laden = (waehle?: number) => fetch("/api/vorlagen").then((r) => r.json()).then((j) => {
    setListe(j.vorlagen); setPlatzhalter(j.platzhalter);
    setV((alt) => j.vorlagen.find((x: Vorlage) => x.id === (waehle ?? alt?.id)) ?? j.vorlagen[0] ?? null);
  });
  useEffect(() => { laden(); fetch("/api/akten").then((r) => r.json()).then((a) => { setAkten(a); if (a[0]) setTest(a.find((x: { id: string }) => x.id === "214/26")?.id ?? a[0].id); }); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setVorschau(null); }, [v?.id]);

  const speichern = async () => {
    if (!v) return;
    await fetch(`/api/vorlagen/${v.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(v) });
    zeige("Vorlage gespeichert"); laden(v.id);
  };
  const neu = async () => {
    const r = await fetch("/api/vorlagen", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    const j = await r.json(); laden(j.id);
  };
  const loeschen = async () => {
    if (!v || !confirm(`Vorlage „${v.name}“ löschen?`)) return;
    await fetch(`/api/vorlagen/${v.id}`, { method: "DELETE" }); zeige("Gelöscht"); setV(null); laden();
  };
  const einfuegen = (p: string) => {
    if (!v || !ta.current) return;
    const el = ta.current, a = el.selectionStart, b = el.selectionEnd, ins = `{{${p}}}`;
    setV({ ...v, text: v.text.slice(0, a) + ins + v.text.slice(b) });
    setTimeout(() => { el.focus(); el.setSelectionRange(a + ins.length, a + ins.length); });
  };
  const testen = async () => {
    if (!v) return;
    await fetch(`/api/vorlagen/${v.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(v) });
    const r = await fetch("/api/schreiben/vorschau", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ akteId: test, vorlageId: v.id }) });
    setVorschau(await r.json());
  };

  return (
    <>
      <div className="head">
        <div>
          <h1>Vorlagen &amp; Textbausteine</h1>
          <div className="lab" style={{ fontSize: 13, marginTop: 2 }}>Platzhalter wie <code>{"{{mandant.name}}"}</code> werden aus der Akte befüllt. Briefkopf und Logo kommen aus den Einstellungen.</div>
        </div>
        <div style={{ flex: 1 }} />
        <button className="btn pri" onClick={neu}>+ Neue Vorlage</button>
      </div>
      <div className="main">
        <div style={{ width: 320, borderRight: "1px solid var(--line)", overflow: "auto" }}>
          {liste.map((x) => (
            <div key={x.id} className={"row" + (x.id === v?.id ? " sel" : "")} style={{ gridTemplateColumns: "1fr auto", padding: "10px 16px" }} onClick={() => setV(x)}>
              <div><div style={{ fontWeight: 500 }}>{x.name}</div><div className="lab">an {x.empfaenger}{x.wv_tage ? ` · WV ${x.wv_tage} T.` : ""}</div></div>
              <span className="k">{x.typ}</span>
            </div>
          ))}
        </div>
        {v && (
          <div style={{ flex: 1, minWidth: 0, padding: "16px 24px", display: "flex", flexDirection: "column", gap: 10, overflow: "auto" }}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 90px 2fr", gap: 8 }}>
              <label><div className="lab">Name</div><input className="feld" style={{ width: "100%" }} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></label>
              <label><div className="lab">Dokumenttyp</div><input className="feld" style={{ width: "100%" }} value={v.typ} onChange={(e) => setV({ ...v, typ: e.target.value })} /></label>
              <label><div className="lab">Empfänger</div><select className="feld" style={{ width: "100%" }} value={v.empfaenger} onChange={(e) => setV({ ...v, empfaenger: e.target.value })}>{ROLLEN.map((r) => <option key={r}>{r}</option>)}</select></label>
              <label><div className="lab">WV in Tagen</div><input className="feld" type="number" min={0} style={{ width: "100%" }} value={v.wv_tage} onChange={(e) => setV({ ...v, wv_tage: Number(e.target.value) })} /></label>
              <label><div className="lab">WV-Text</div><input className="feld" style={{ width: "100%" }} value={v.wv_titel} onChange={(e) => setV({ ...v, wv_titel: e.target.value })} /></label>
            </div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              <span className="lab" style={{ marginRight: 4 }}>Platzhalter einfügen:</span>
              {platzhalter.map((p) => <span key={p} className="chip" style={{ padding: "1px 6px", fontSize: 11 }} onClick={() => einfuegen(p)}>{p}</span>)}
            </div>
            <textarea ref={ta} className="feld" style={{ width: "100%", minHeight: 360, fontSize: 13.5, lineHeight: 1.6, fontFamily: "Georgia, serif", padding: 14 }} value={v.text} onChange={(e) => setV({ ...v, text: e.target.value })} />
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button className="btn pri" onClick={speichern}>Speichern</button>
              <span className="lab">Testen mit</span>
              <select className="feld" value={test} onChange={(e) => setTest(e.target.value)}>{akten.map((a) => <option key={a.id} value={a.id}>{a.id} {a.titel}</option>)}</select>
              <button className="btn" onClick={testen}>Vorschau</button>
              <div style={{ flex: 1 }} />
              <button className="btn" style={{ color: "var(--rot)" }} onClick={loeschen}>Löschen</button>
            </div>
            {vorschau && (
              <div style={{ border: "1px solid var(--line)", borderRadius: 4, padding: 16, background: "var(--bg3)" }}>
                {vorschau.fehlend.length > 0 && <div style={{ color: "#8a2416", fontSize: 13, marginBottom: 8 }}>In dieser Akte fehlen: {vorschau.fehlend.join(", ")}</div>}
                <div style={{ whiteSpace: "pre-wrap", fontFamily: "Georgia, serif", fontSize: 13, lineHeight: 1.6 }}>
                  {vorschau.text.split(/(\[\[[\w.]+\]\])/).map((t, i) => /^\[\[/.test(t) ? <mark key={i} style={{ background: "#fde3d4", color: "#8a2416" }}>{t}</mark> : t)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
