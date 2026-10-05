"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useStore } from "@/components/Store";

type R = { id: number; nr: string; akte_id: string; akte_titel: string; datum: string; empfaenger: string; wert: number; brutto: number; status: string; bezahlt_am: string | null; dokument_id: number | null };
type Vorschlag = { wert: number; positionen: { position: string; gefordert: number }[]; empfaenger: string; schadennummer: string; mandant: string; bisher: R[] };
type Note = { voll: number; zeilen: { text: string; betrag: number }[]; netto: number; ust: number; ustSatz: number; brutto: number };
type AkteKurz = { id: string; titel: string };

const euro = (n: number) => n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
const de = (s: string) => s.split("-").reverse().join(".");
const zahl = (s: string) => Number(String(s).replace(/\./g, "").replace(",", ".")) || 0;

export default function Abrechnung() {
  const { zeige } = useStore();
  const [liste, setListe] = useState<R[] | null>(null);
  const [akten, setAkten] = useState<AkteKurz[]>([]);
  const [filter, setFilter] = useState<"offen" | "bezahlt" | "alle">("offen");
  const [akte, setAkte] = useState("");
  const [v, setV] = useState<Vorschlag | null>(null);
  const [wert, setWert] = useState("");
  const [faktor, setFaktor] = useState("1,3");
  const [einigung, setEinigung] = useState(false);
  const [empf, setEmpf] = useState("");
  const [note, setNote] = useState<Note | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  const laden = useCallback(() => fetch("/api/abrechnung").then((r) => r.json()).then(setListe), []);
  useEffect(() => { laden(); fetch("/api/akten").then((r) => r.json()).then(setAkten); }, [laden]);
  useEffect(() => {
    setV(null); setNote(null);
    if (!akte) return;
    fetch("/api/abrechnung?akte=" + encodeURIComponent(akte)).then((r) => r.json()).then((x: Vorschlag) => {
      setV(x); setWert(x.wert ? x.wert.toLocaleString("de-DE", { minimumFractionDigits: 2 }) : ""); setEmpf(x.empfaenger); setFaktor("1,3"); setEinigung(false);
    });
  }, [akte]);

  const posten = [{ vv: "2300", faktor: zahl(faktor) }, ...(einigung ? [{ vv: "1000", faktor: 1.5 }] : [])];
  const eingabe = { akte, wert: zahl(wert), posten, empfaenger: empf };
  useEffect(() => {
    if (!akte || !(zahl(wert) > 0)) return setNote(null);
    const t = setTimeout(() => fetch("/api/abrechnung", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...eingabe, nurBerechnen: true }) })
      .then((r) => (r.ok ? r.json() : null)).then(setNote), 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [akte, wert, faktor, einigung]);

  const vorschau = async () => {
    const r = await fetch("/api/abrechnung/vorschau", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(eingabe) });
    if (!r.ok) return zeige((await r.json()).fehler);
    window.open(URL.createObjectURL(await r.blob()), "_blank");
  };
  const erstellen = async () => {
    setLaeuft(true);
    const r = await fetch("/api/abrechnung", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(eingabe) });
    const j = await r.json(); setLaeuft(false);
    if (!r.ok) return zeige(j.fehler);
    zeige(`Kostennote ${j.nr} erstellt · ${euro(j.brutto)} · in Akte und Aktenkonto`); setAkte(""); laden();
  };
  const aktion = async (r: R, a: string) => {
    if (a === "storno" && !confirm(`Kostennote ${r.nr} stornieren?`)) return;
    const x = await fetch(`/api/abrechnung/${r.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ aktion: a }) });
    zeige(x.ok ? ({ bezahlt: "Zahlung erfasst", offen: "Wieder offen", storno: "Storniert" } as Record<string, string>)[a] : "Nicht möglich"); laden();
  };

  const sicht = (liste ?? []).filter((r) => filter === "alle" ? true : r.status === filter);
  const offenSumme = (liste ?? []).filter((r) => r.status === "offen").reduce((s, r) => s + r.brutto, 0);
  const bezahltMonat = (liste ?? []).filter((r) => r.status === "bezahlt" && r.bezahlt_am?.slice(0, 7) === new Date().toISOString().slice(0, 7)).reduce((s, r) => s + r.brutto, 0);
  const td: React.CSSProperties = { padding: "8px", borderBottom: "1px solid #eceef0", fontSize: 14.5 };

  return (
    <div className="main">
      <div style={{ flex: 1, minWidth: 0, padding: "18px 24px", overflow: "auto", borderRight: "1px solid var(--line)" }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 24, marginBottom: 14 }}>
          <div><h1 style={{ fontSize: 23, margin: 0 }}>Abrechnung</h1><div className="lab" style={{ fontSize: 14.5, marginTop: 2 }}>Kostennoten nach RVG (Tabelle ab 01.06.2025)</div></div>
          <div style={{ flex: 1 }} />
          <div style={{ textAlign: "right" }}><div className="lab">Offene Honorare</div><div className="mono" style={{ fontSize: 19, fontWeight: 600 }}>{euro(offenSumme)}</div></div>
          <div style={{ textAlign: "right" }}><div className="lab">Eingang diesen Monat</div><div className="mono" style={{ fontSize: 19, fontWeight: 600, color: "#1d7a43" }}>{euro(bezahltMonat)}</div></div>
        </div>
        <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
          {(["offen", "bezahlt", "alle"] as const).map((f) => <span key={f} className={"chip" + (filter === f ? " on" : "")} onClick={() => setFilter(f)}>{f === "offen" ? "Offen" : f === "bezahlt" ? "Bezahlt" : "Alle"}</span>)}
        </div>
        {!liste ? <div className="empty">Lade …</div> : sicht.length === 0 ? <div className="empty">Keine Kostennoten{filter !== "alle" ? ` (${filter})` : ""}. Rechts eine Akte wählen und berechnen.</div> : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>{["Nr.", "Datum", "Akte", "Empfänger", "Wert", "Betrag", "Status", ""].map((h) => <th key={h} className="th" style={{ ...td, textAlign: h === "Wert" || h === "Betrag" ? "right" : "left", background: "#fafbfc" }}>{h}</th>)}</tr></thead>
            <tbody>
              {sicht.map((r) => (
                <tr key={r.id} style={{ opacity: r.status === "storniert" ? 0.45 : 1 }}>
                  <td style={td} className="mono">{r.nr}</td>
                  <td style={td} className="mono">{de(r.datum).slice(0, 6)}</td>
                  <td style={td}><Link href={`/akte/${encodeURIComponent(r.akte_id)}`} className="mono">{r.akte_id}</Link> <span className="lab">{r.akte_titel}</span></td>
                  <td style={td}>{r.empfaenger}</td>
                  <td style={{ ...td, textAlign: "right" }} className="mono">{euro(r.wert)}</td>
                  <td style={{ ...td, textAlign: "right", fontWeight: 600 }} className="mono">{euro(r.brutto)}</td>
                  <td style={{ ...td, color: r.status === "bezahlt" ? "#1d7a43" : r.status === "offen" ? "#B5620A" : "#6b7178" }}>{r.status === "bezahlt" ? `bezahlt ${de(r.bezahlt_am ?? "").slice(0, 6)}` : r.status}</td>
                  <td style={{ ...td, whiteSpace: "nowrap", textAlign: "right" }}>
                    {r.dokument_id && <a className="btn" style={{ textDecoration: "none" }} href={`/api/dokumente/${r.dokument_id}`} target="_blank" rel="noopener noreferrer">PDF</a>}{" "}
                    {r.status === "offen" && <><button className="btn pri" onClick={() => aktion(r, "bezahlt")}>Bezahlt</button> <button className="btn" onClick={() => aktion(r, "storno")}>Storno</button></>}
                    {r.status === "bezahlt" && <button className="btn" onClick={() => aktion(r, "offen")}>Zurück</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="side" style={{ width: 520 }}>
        <div className="th" style={{ color: "var(--akzent)" }}>Neue Kostennote</div>
        <select className="feld" value={akte} onChange={(e) => setAkte(e.target.value)}>
          <option value="">– Akte wählen –</option>{akten.map((a) => <option key={a.id} value={a.id}>{a.id} {a.titel}</option>)}
        </select>
        {v && (
          <>
            {v.bisher.length > 0 && <div className="lab" style={{ color: "#B5620A" }}>Schon abgerechnet: {v.bisher.map((r) => `${r.nr} (${euro(r.brutto)})`).join(", ")} – ggf. Nachliquidation nur über die Differenz.</div>}
            <label><div className="lab">Gegenstandswert <span title={v.positionen.map((p) => `${p.position}: ${euro(p.gefordert)}`).join("\n") || "keine Positionen im Aktenkonto"} className="q">?</span></div>
              <input className="feld mono" value={wert} onChange={(e) => setWert(e.target.value)} style={{ width: 180 }} /> <span className="lab">Summe Schadenpositionen aus dem Aktenkonto</span>
            </label>
            <div style={{ display: "flex", gap: 16, alignItems: "flex-end" }}>
              <label><div className="lab">Geschäftsgebühr 2300 (0,5–2,5)</div>
                <input className="feld mono" value={faktor} onChange={(e) => setFaktor(e.target.value)} style={{ width: 80 }} />
              </label>
              {[1.3, 1.5, 1.8].map((f) => <span key={f} className={"chip" + (zahl(faktor) === f ? " on" : "")} onClick={() => setFaktor(String(f).replace(".", ","))}>{String(f).replace(".", ",")}</span>)}
              <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 14.5, paddingBottom: 6 }}><input type="checkbox" checked={einigung} onChange={(e) => setEinigung(e.target.checked)} /> Einigungsgebühr 1,5</label>
            </div>
            {zahl(faktor) > 1.3 && <div className="lab" style={{ color: "#B5620A" }}>Über 1,3 nur bei umfangreicher oder schwieriger Tätigkeit (Anm. zu Nr. 2300 VV) – Begründung bereithalten.</div>}
            {note && (
              <div style={{ border: "1px solid var(--line)", borderRadius: 6, background: "#fff", padding: "10px 12px", fontSize: 14.5 }}>
                <div className="lab" style={{ marginBottom: 6 }}>1,0-Gebühr bei {euro(zahl(wert))}: {euro(note.voll)}</div>
                {note.zeilen.map((z) => <div key={z.text} style={{ display: "flex", padding: "2px 0" }}><span style={{ flex: 1 }}>{z.text}</span><span className="mono">{euro(z.betrag)}</span></div>)}
                <div style={{ display: "flex", padding: "4px 0 2px", borderTop: "1px solid var(--line2)", marginTop: 4 }}><span style={{ flex: 1 }}>Netto</span><span className="mono">{euro(note.netto)}</span></div>
                <div style={{ display: "flex", padding: "2px 0" }}><span style={{ flex: 1 }}>{note.ustSatz} % USt Nr. 7008 VV</span><span className="mono">{euro(note.ust)}</span></div>
                <div style={{ display: "flex", padding: "6px 0 0", borderTop: "1px solid var(--line)", marginTop: 4, fontWeight: 600 }}><span style={{ flex: 1 }}>Gesamt</span><span className="mono">{euro(note.brutto)}</span></div>
              </div>
            )}
            <label><div className="lab">Empfänger</div>
              <textarea className="feld" value={empf} onChange={(e) => setEmpf(e.target.value)} style={{ width: "100%", minHeight: 70 }} placeholder="Versicherung, Anschrift" />
            </label>
            <div style={{ display: "flex", gap: 6 }}>
              <button className="btn" disabled={!note} onClick={vorschau}>PDF-Vorschau</button>
              <div style={{ flex: 1 }} />
              <button className="btn pri" disabled={!note || !empf.trim() || laeuft} onClick={erstellen}>Kostennote erstellen</button>
            </div>
            <div className="lab">Erstellen legt das PDF in der Akte ab und trägt die RA-Kosten ins Aktenkonto ein.</div>
          </>
        )}
      </div>
    </div>
  );
}
