"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useStore } from "@/components/Store";

const ARTEN = ["Versicherung", "Rechtsschutz", "Werkstatt", "Gutachter", "Polizei", "Bank", "Gericht", "Sonstige"];
type K = { id?: number; art: string; name: string; zusatz: string; strasse: string; plz_ort: string; telefon: string; email: string; iban: string; notiz: string; akten?: number };
type Detail = K & { id: number; personen: { id: number; name: string; telefon: string; email: string }[]; akten: { id: string; titel: string; phase: string; zeichen: string }[] };
const LEER: K = { art: "Versicherung", name: "", zusatz: "", strasse: "", plz_ort: "", telefon: "", email: "", iban: "", notiz: "" };

export default function Adressbuch() {
  const { zeige } = useStore();
  const [art, setArt] = useState("");
  const [suche, setSuche] = useState("");
  const [liste, setListe] = useState<(K & { id: number; akten: number })[] | null>(null);
  const [wahl, setWahl] = useState<number | null>(null);
  const [d, setD] = useState<Detail | null>(null);
  const [edit, setEdit] = useState<K | null>(null);
  const [person, setPerson] = useState({ name: "", telefon: "", email: "" });

  const laden = useCallback(() => {
    const q = new URLSearchParams(); if (art) q.set("art", art); if (suche) q.set("suche", suche);
    fetch("/api/kontakte?" + q).then((r) => r.json()).then(setListe);
  }, [art, suche]);
  useEffect(() => { const id = Number(new URLSearchParams(window.location.search).get("id")); if (id) setWahl(id); }, []);
  useEffect(() => { const t = setTimeout(laden, 150); return () => clearTimeout(t); }, [laden]);
  const detail = useCallback((id: number) => fetch(`/api/kontakte/${id}`).then((r) => r.json()).then(setD), []);
  useEffect(() => { if (wahl) detail(wahl); else setD(null); }, [wahl, detail]);

  const speichern = async () => {
    if (!edit) return;
    const r = await fetch(edit.id ? `/api/kontakte/${edit.id}` : "/api/kontakte", { method: edit.id ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(edit) });
    const j = await r.json();
    if (!r.ok) return zeige(j.fehler);
    zeige(edit.id ? "Gespeichert – verknüpfte Akten aktualisiert" : "Kontakt angelegt");
    setEdit(null); laden(); setWahl(j.id ?? edit.id ?? null); if (edit.id) setD(j);
  };
  const personAktion = async (body: object) => {
    if (!d) return;
    const r = await fetch(`/api/kontakte/${d.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json(); if (!r.ok) return zeige(j.fehler); setD(j);
  };
  const loeschen = async () => {
    if (!d || !confirm(`${d.name} aus dem Adressbuch löschen? In ${d.akten.length} Akte(n) bleiben die Angaben erhalten.`)) return;
    await fetch(`/api/kontakte/${d.id}`, { method: "DELETE" }); setWahl(null); laden(); zeige("Gelöscht");
  };

  const td: React.CSSProperties = { padding: "8px", borderBottom: "1px solid #eceef0", fontSize: 14.5 };
  const feld = (k: keyof K, l: string, breit = false) => edit && (
    <label style={{ gridColumn: breit ? "span 2" : undefined }}><div className="lab">{l}</div>
      <input className="feld" style={{ width: "100%" }} value={String(edit[k] ?? "")} onChange={(e) => setEdit({ ...edit, [k]: e.target.value })} /></label>
  );

  return (
    <div className="main">
      <div style={{ flex: 1, minWidth: 0, padding: "18px 24px", overflow: "auto", borderRight: "1px solid var(--line)" }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 16, marginBottom: 12 }}>
          <div><h1 style={{ fontSize: 23, margin: 0 }}>Adressbuch</h1><div className="lab" style={{ fontSize: 14.5, marginTop: 2 }}>Einmal anlegen, in allen Akten, Schreiben und Kostennoten verwenden</div></div>
          <div style={{ flex: 1 }} />
          <input className="feld" placeholder="Suchen …" value={suche} onChange={(e) => setSuche(e.target.value)} style={{ width: 220 }} />
          <button className="btn pri" onClick={() => { setEdit({ ...LEER, art: art || "Versicherung" }); setWahl(null); }}>+ Kontakt</button>
        </div>
        <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
          {["", ...ARTEN].map((a) => <span key={a} className={"chip" + (art === a ? " on" : "")} onClick={() => setArt(a)}>{a || "Alle"}</span>)}
        </div>
        {!liste ? <div className="empty">Lade …</div> : liste.length === 0 ? <div className="empty">Keine Kontakte{art ? ` (${art})` : ""}.</div> : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>{["Art", "Name", "Ort", "Telefon", "Akten"].map((h) => <th key={h} className="th" style={{ ...td, textAlign: "left", background: "#fafbfc" }}>{h}</th>)}</tr></thead>
            <tbody>
              {liste.map((k) => (
                <tr key={k.id} onClick={() => { setWahl(k.id); setEdit(null); }} style={{ cursor: "pointer", background: wahl === k.id ? "#eef2f9" : undefined }}>
                  <td style={{ ...td, color: "var(--muted)" }}>{k.art}</td>
                  <td style={td}><b style={{ fontWeight: 500 }}>{k.name}</b>{k.zusatz && <span className="lab"> · {k.zusatz}</span>}</td>
                  <td style={td}>{k.plz_ort || <span style={{ color: "#B5620A" }}>Anschrift fehlt</span>}</td>
                  <td style={td} className="mono">{k.telefon}</td>
                  <td style={td}>{k.akten || "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="side" style={{ width: 480 }}>
        {edit ? (
          <>
            <div className="th" style={{ color: "var(--akzent)" }}>{edit.id ? "Kontakt bearbeiten" : "Neuer Kontakt"}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <label><div className="lab">Art</div><select className="feld" style={{ width: "100%" }} value={edit.art} onChange={(e) => setEdit({ ...edit, art: e.target.value })}>{ARTEN.map((a) => <option key={a}>{a}</option>)}</select></label>
              <div />
              {feld("name", "Name / Firma", true)}
              {feld("zusatz", "Zusatz (z. B. Schadenabteilung)", true)}
              {feld("strasse", "Straße / Postfach", true)}
              {feld("plz_ort", "PLZ Ort", true)}
              {feld("telefon", "Telefon")}
              {feld("email", "E-Mail")}
              {feld("iban", "IBAN", true)}
              <label style={{ gridColumn: "span 2" }}><div className="lab">Notiz (Kanzleiwissen, z. B. „kürzt oft UPE“)</div>
                <textarea className="feld" style={{ width: "100%", minHeight: 70 }} value={edit.notiz} onChange={(e) => setEdit({ ...edit, notiz: e.target.value })} /></label>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button className="btn pri" onClick={speichern}>Speichern</button>
              <button className="btn" onClick={() => setEdit(null)}>Abbrechen</button>
            </div>
            {edit.id && <div className="lab">Änderungen an Name und Anschrift werden in alle verknüpften Akten übernommen.</div>}
          </>
        ) : !d ? <div className="empty">Kontakt links auswählen</div> : (
          <>
            <div>
              <div className="lab">{d.art}</div>
              <div style={{ fontSize: 19, fontWeight: 600 }}>{d.name}</div>
              <div style={{ fontSize: 14.5, lineHeight: 1.6, marginTop: 4 }}>
                {[d.zusatz, d.strasse, d.plz_ort].filter(Boolean).join(" · ") || <span style={{ color: "#B5620A" }}>Anschrift fehlt – für Schreiben und Kostennoten nötig</span>}<br />
                {[d.telefon, d.email].filter(Boolean).join(" · ")}{d.iban && <><br /><span className="mono" style={{ fontSize: 13.5 }}>{d.iban}</span></>}
              </div>
            </div>
            {d.notiz && <div style={{ fontSize: 14.5, background: "var(--hl)", padding: "8px 10px", borderRadius: 4, whiteSpace: "pre-wrap" }}>{d.notiz}</div>}
            <div>
              <div className="th" style={{ marginBottom: 6 }}>Ansprechpartner</div>
              {d.personen.map((p) => (
                <div key={p.id} style={{ display: "flex", gap: 8, fontSize: 14.5, padding: "3px 0", alignItems: "center" }}>
                  <span style={{ flex: 1 }}>{p.name}</span><span className="mono lab">{p.telefon}</span>
                  <a href="#" className="lab" onClick={(e) => { e.preventDefault(); personAktion({ personLoeschen: p.id }); }}>×</a>
                </div>
              ))}
              <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                <input className="feld" placeholder="Name" value={person.name} onChange={(e) => setPerson({ ...person, name: e.target.value })} style={{ flex: 1 }} />
                <input className="feld" placeholder="Durchwahl" value={person.telefon} onChange={(e) => setPerson({ ...person, telefon: e.target.value })} style={{ width: 130 }} />
                <button className="btn" disabled={!person.name.trim()} onClick={async () => { await personAktion({ person }); setPerson({ name: "", telefon: "", email: "" }); }}>+</button>
              </div>
            </div>
            <div>
              <div className="th" style={{ marginBottom: 6 }}>Akten · {d.akten.length}</div>
              {d.akten.length === 0 ? <div className="lab">Noch in keiner Akte verwendet.</div> : d.akten.map((a) => (
                <div key={a.id} style={{ display: "flex", gap: 8, fontSize: 14.5, padding: "3px 0" }}>
                  <Link href={`/akte/${encodeURIComponent(a.id)}`} className="mono">{a.id}</Link><span style={{ flex: 1 }}>{a.titel}</span>{a.zeichen && <span className="lab mono">{a.zeichen}</span>}
                </div>
              ))}
            </div>
            <div style={{ flex: 1 }} />
            <div style={{ display: "flex", gap: 6 }}>
              <button className="btn pri" onClick={() => setEdit({ ...d })}>Bearbeiten</button>
              <div style={{ flex: 1 }} />
              <button className="btn" style={{ color: "var(--rot)" }} onClick={loeschen}>Löschen</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
