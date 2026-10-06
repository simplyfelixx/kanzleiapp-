"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { euro, prioFarbe, Prioritaet } from "@/lib/data";
import { useStore } from "@/components/Store";
import type { AkteRow, BeteiligterRow, KontoRow, FristRow, VerlaufRow, DokumentRow } from "@/lib/db";
import { DOKTYPEN } from "@/lib/dokerkennung";
import SchreibenPanel from "@/components/SchreibenPanel";

// Felder und Rollen hier statt aus db.ts, damit kein Server-Code im Browser landet
const FALLFELDER = [
  ["unfalltag", "Unfalltag"], ["unfallort", "Unfallort"], ["schilderung", "Unfallschilderung"],
  ["ausfall", "Mietwagen / Nutzungsausfall"], ["verletzt", "Verletzungen"], ["polizei", "Polizei (Dienststelle, Az.)"],
  ["akteneinsicht", "Akteneinsicht"], ["haftung", "Haftung"], ["vollkasko", "Vollkasko / SB"], ["rsv", "Rechtsschutz"],
  ["fahrbereit", "Fahrbereit / Reparatur"], ["finanzierung", "Finanzierung / Leasing"], ["mw_kuerzung", "MW-Kürzung"],
] as const;
const ROLLEN = ["Mandant", "Gegner", "Versicherung", "Werkstatt", "Gutachter", "Bank", "Polizei", "Zeuge"];
const PHASEN = ["Mandat", "Unterlagen", "Anspruch", "Prüffrist", "Kürzung", "Klage", "Abschluss"];
const PRIOS: [Prioritaet, string][] = [["heute", "Heute"], ["woche", "Diese Woche"], ["pruefen", "Prüfen"], ["wartet", "Wartet"], ["laeuft", "Läuft"]];

type Daten = { akte: AkteRow; beteiligte: BeteiligterRow[]; konto: KontoRow[]; fristen: FristRow[]; verlauf: VerlaufRow[]; dokumente: DokumentRow[] };
const de = (s: string) => s.slice(0, 10).split("-").reverse().join(".");
const leer = (rolle: string): Partial<BeteiligterRow> => ({ rolle, name: "", adresse: "", telefon: "", email: "", iban: "", ansprechpartner: "", zeichen: "", vorsteuer: 0, notiz: "" });

export default function AktePage() {
  const { id } = useParams<{ id: string }>();
  const az = decodeURIComponent(id);
  const { zeige } = useStore();
  const [d, setD] = useState<Daten | null>(null);
  const [fehlt, setFehlt] = useState(false);
  const [panel, setPanel] = useState<Partial<BeteiligterRow> | null>(null);
  const [fallEdit, setFallEdit] = useState<Record<string, string> | null>(null);
  const [wv, setWv] = useState({ art: "wv", tage: 7, titel: "" });
  const [schreiben, setSchreiben] = useState(false);

  useEffect(() => {
    fetch(`/api/akten/${encodeURIComponent(az)}`).then(async (r) => (r.ok ? setD(await r.json()) : setFehlt(true)));
  }, [az]);

  const speichern = useCallback(async (body: object, msg = "Gespeichert") => {
    const r = await fetch(`/api/akten/${encodeURIComponent(az)}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (r.ok) { setD(await r.json()); zeige(msg); } else zeige("Fehler beim Speichern");
  }, [az, zeige]);

  // Esc schließt das Seitenfenster
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") { setPanel(null); setFallEdit(null); } };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const neuladen = () => fetch(`/api/akten/${encodeURIComponent(az)}`).then((r) => r.json()).then(setD);
  const wvAnlegen = async () => {
    if (!wv.titel.trim()) return zeige("Worum geht es?");
    const datum = new Date(Date.now() + wv.tage * 864e5);
    const r = await fetch("/api/fristen", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ akteId: az, art: wv.art, titel: wv.titel, wer: "FK", datum: `${datum.getFullYear()}-${String(datum.getMonth() + 1).padStart(2, "0")}-${String(datum.getDate()).padStart(2, "0")}` }) });
    if (r.ok) { zeige(wv.art === "frist" ? "Frist notiert" : "Wiedervorlage gesetzt"); setWv({ ...wv, titel: "" }); neuladen(); }
  };
  const fristAktion = async (id: number, aktion: string, tage?: number) => {
    await fetch(`/api/fristen/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ aktion, tage }) });
    zeige(aktion === "erledigt" ? "Erledigt" : aktion === "bestaetigen" ? "Bestätigt" : "Verschoben"); neuladen();
  };

  if (fehlt) return <div className="empty">Akte {az} nicht gefunden. <Link href="/akten">Zur Aktenliste</Link></div>;
  if (!d) return <div className="empty">Lade Akte …</div>;
  const { akte, beteiligte, konto } = d;
  const fall: Record<string, string> = JSON.parse(akte.falldaten || "{}");
  const sum = (k: "gefordert" | "gezahlt") => konto.reduce((s, p) => s + p[k], 0);
  const offen = sum("gefordert") - sum("gezahlt");

  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
      <div style={{ flex: 1, minWidth: 0, overflow: "auto", padding: "14px 24px 40px", display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Kopf */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <Link href="/akten" className="lab" style={{ textDecoration: "none" }}>← Akten</Link>
          <span className="dot" style={{ background: prioFarbe[akte.prioritaet as Prioritaet] ?? "var(--grau)" }} />
          <Inline value={akte.titel} onSave={(v) => speichern({ art: "akte", titel: v })} style={{ fontSize: 20, fontWeight: 600 }} />
          <span className="k">{akte.gebiet}</span>
          <span className="lab mono">Az. {akte.id}</span>
          <div style={{ flex: 1 }} />
          <button className="btn pri" onClick={() => setSchreiben(true)}>✉ Schreiben erstellen</button>
          <select className="feld" value={akte.prioritaet} onChange={(e) => speichern({ art: "akte", prioritaet: e.target.value })}>
            {PRIOS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <select className="feld" value={akte.phase} onChange={(e) => speichern({ art: "akte", phase: e.target.value })}>
            {[...new Set([...PHASEN, akte.phase])].map((p) => <option key={p}>{p}</option>)}
          </select>
        </div>

        {/* Beteiligte */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 0, border: "1px solid var(--line)", borderRadius: 4 }}>
          {beteiligte.map((b) => (
            <div key={b.id} style={{ padding: "10px 14px", borderRight: "1px solid var(--line)", borderBottom: "1px solid var(--line)", background: b.rolle === "Versicherung" ? "var(--akzent-bg)" : undefined }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span className="lab">{b.rolle}{b.ansprechpartner && ` · ${b.ansprechpartner}`}</span>
                <button className="btn" style={{ padding: "1px 7px", fontSize: 12.5 }} onClick={() => setPanel(b)}>Bearbeiten</button>
              </div>
              <div style={{ fontWeight: 500 }}>{b.name || "–"}</div>
              {b.telefon && <div className="mono" style={{ fontSize: 14.5, fontWeight: b.rolle === "Versicherung" ? 600 : 400 }}>{b.telefon} <a href={`tel:${b.telefon.replace(/[^\d+]/g, "")}`} style={{ fontSize: 12.5 }}>anrufen</a></div>}
              {b.zeichen && <div className="mono" style={{ fontSize: 13.5 }}>{b.rolle === "Versicherung" ? "Schaden-Nr. " : ""}{b.zeichen} <a href="#" style={{ fontSize: 12.5 }} onClick={(e) => { e.preventDefault(); navigator.clipboard?.writeText(b.zeichen); zeige("Kopiert"); }}>kopieren</a></div>}
            </div>
          ))}
          <div style={{ padding: "10px 14px", display: "flex", alignItems: "center" }}>
            <button className="btn" onClick={() => setPanel(leer("Gegner"))}>+ Beteiligter</button>
          </div>
        </div>

        {/* Zusammenfassung */}
        <div style={{ border: "1px solid var(--line)", borderRadius: 4, background: "var(--bg3)", padding: "10px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
          <div>
            <div className="th">Worum geht es</div>
            <Inline multiline value={akte.worum} platzhalter="Kurz beschreiben, worum es in der Akte geht …" onSave={(v) => speichern({ art: "akte", worum: v })} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 14 }}>
            {([["stand_vorliegend", "Vorliegend", "var(--gruen)"], ["stand_ausstehend", "Ausstehend", "#B5620A"], ["stand_naechster", "Nächster Schritt", "var(--akzent)"]] as const).map(([k, l, c]) => (
              <div key={k}>
                <div className="lab" style={{ fontWeight: 600, color: c }}>{l}</div>
                <Inline multiline value={akte[k]} platzhalter="–" onSave={(v) => speichern({ art: "akte", [k]: v })} />
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.2fr) minmax(0,1fr)", gap: 24, alignItems: "start" }}>
          {/* Aktenkonto */}
          <div>
            <div className="th">Aktenkonto</div>
            <table className="t">
              <tbody>
                <tr className="lab"><td>Position</td><td className="num">Gefordert</td><td className="num">Gezahlt</td><td className="num">Offen</td><td /></tr>
                {konto.map((p) => (
                  <tr key={p.id}>
                    <td><Inline value={p.position} onSave={(v) => speichern({ art: "konto", ...p, position: v })} /></td>
                    <td className="num"><Inline value={p.gefordert.toLocaleString("de-DE", { minimumFractionDigits: 2 })} onSave={(v) => speichern({ art: "konto", ...p, gefordert: v })} /></td>
                    <td className="num"><Inline value={p.gezahlt.toLocaleString("de-DE", { minimumFractionDigits: 2 })} onSave={(v) => speichern({ art: "konto", ...p, gezahlt: v })} /></td>
                    <td className="num" style={{ color: p.gefordert > p.gezahlt ? "var(--rot)" : undefined }}>{euro(p.gefordert - p.gezahlt)}</td>
                    <td style={{ textAlign: "right" }}><a href="#" className="lab" onClick={(e) => { e.preventDefault(); if (confirm(`„${p.position}“ löschen?`)) speichern({ art: "konto_loeschen", id: p.id }, "Gelöscht"); }}>✕</a></td>
                  </tr>
                ))}
                <tr><td style={{ fontWeight: 600 }}>Summe</td><td className="num" style={{ fontWeight: 600 }}>{euro(sum("gefordert"))}</td><td className="num" style={{ fontWeight: 600 }}>{euro(sum("gezahlt"))}</td><td className="num" style={{ fontWeight: 600, color: offen > 0 ? "var(--rot)" : undefined }}>{euro(offen)}</td><td /></tr>
              </tbody>
            </table>
            <button className="btn" style={{ marginTop: 8 }} onClick={() => speichern({ art: "konto", position: "Neue Position", gefordert: 0, gezahlt: 0 }, "Position hinzugefügt")}>+ Position</button>
            <div className="lab" style={{ marginTop: 6 }}>Werte anklicken zum Ändern · Enter speichert</div>
          </div>

          {/* Falldaten */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="th">Fall</span>
              <button className="btn" style={{ padding: "1px 7px", fontSize: 12.5 }} onClick={() => setFallEdit({ ...fall })}>Bearbeiten</button>
            </div>
            {FALLFELDER.map(([k, l]) => (
              <div className="fr" key={k} style={{ gridTemplateColumns: "150px 1fr" }}>
                <span className="lab">{l}</span>
                <span style={{ color: fall[k] ? undefined : "var(--muted)" }}>{fall[k] || "–"}</span>
              </div>
            ))}
          </div>
        </div>
        <Dokumente az={az} doks={d.dokumente} neuladen={neuladen} zeige={zeige} />

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 24, alignItems: "start" }}>
          {/* Fristen & Wiedervorlagen */}
          <div>
            <div className="th">Fristen &amp; Wiedervorlagen</div>
            {d.fristen.length === 0 && <div className="lab" style={{ padding: "8px 0" }}>Keine offenen Fristen oder Wiedervorlagen.</div>}
            {d.fristen.map((f) => (
              <div key={f.id} className="fr" style={{ gridTemplateColumns: "80px 50px 1fr auto", background: f.bestaetigt ? undefined : "#fffbea" }}>
                <span className="mono" style={{ fontSize: 13.5 }}>{de(f.datum)}</span>
                <span className="k" style={{ color: f.art === "frist" ? "var(--rot)" : undefined, justifySelf: "start" }}>{f.art === "frist" ? "Frist" : "WV"}</span>
                <span>{f.titel}{!f.bestaetigt && <span className="lab"> · von KI erkannt</span>}</span>
                <span style={{ display: "flex", gap: 4 }}>
                  {f.bestaetigt ? <button className="btn" style={{ padding: "2px 8px" }} onClick={() => fristAktion(f.id, "erledigt")}>Erledigt</button>
                    : <button className="btn pri" style={{ padding: "2px 8px" }} onClick={() => fristAktion(f.id, "bestaetigen")}>Bestätigen</button>}
                  <button className="btn" style={{ padding: "2px 8px" }} onClick={() => fristAktion(f.id, "verschieben", 7)}>+7</button>
                </span>
              </div>
            ))}
            <div style={{ display: "flex", gap: 6, marginTop: 8, alignItems: "center" }}>
              <select className="feld" value={wv.art} onChange={(e) => setWv({ ...wv, art: e.target.value })}><option value="wv">WV</option><option value="frist">Frist</option></select>
              <select className="feld" value={wv.tage} onChange={(e) => setWv({ ...wv, tage: Number(e.target.value) })}>{[1, 3, 7, 14, 28].map((t) => <option key={t} value={t}>in {t} T.</option>)}</select>
              <input className="feld" style={{ flex: 1 }} placeholder="Worum geht es? (Enter)" value={wv.titel} onChange={(e) => setWv({ ...wv, titel: e.target.value })} onKeyDown={(e) => e.key === "Enter" && wvAnlegen()} />
            </div>
          </div>
          {/* Verlauf */}
          <div>
            <div className="th">Verlauf</div>
            {d.verlauf.length === 0 && <div className="lab" style={{ padding: "8px 0" }}>Noch keine Einträge.</div>}
            {d.verlauf.map((v) => (
              <div key={v.id} style={{ display: "grid", gridTemplateColumns: "80px 1fr", gap: 8, padding: "5px 0", fontSize: 14.5, borderBottom: "1px solid var(--line2)" }}>
                <span className="mono lab" style={{ fontSize: 13.5 }}>{de(v.zeit)}</span>
                <span>{v.text}{v.wer && <span className="lab"> · {v.wer}</span>}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {schreiben && <SchreibenPanel akteId={az} zeige={zeige} onClose={() => setSchreiben(false)} onFertig={() => { setSchreiben(false); neuladen(); }} />}

      {/* Seitenfenster: Beteiligter */}
      {panel && (
        <Seitenfenster titel={panel.id ? `${panel.rolle}: ${panel.name}` : "Neuer Beteiligter"} onClose={() => setPanel(null)}>
          <Feld label="Rolle"><select className="feld" value={panel.rolle} onChange={(e) => setPanel({ ...panel, rolle: e.target.value })}>{ROLLEN.map((r) => <option key={r}>{r}</option>)}</select></Feld>
          {!["Mandant", "Gegner", "Zeuge"].includes(panel.rolle ?? "") && <AusAdressbuch rolle={panel.rolle ?? ""} verknuepft={(panel as { kontakt_id?: number | null }).kontakt_id ?? null} onWahl={(k) => setPanel({ ...panel, ...k, ansprechpartner: panel.ansprechpartner, zeichen: panel.zeichen, notiz: panel.notiz })} />}
          {([["name", "Name / Firma"], ["ansprechpartner", "Ansprechpartner"], ["adresse", "Adresse"], ["telefon", "Telefon"], ["email", "E-Mail"], ["zeichen", "Zeichen (Schaden-Nr., Kennzeichen, Az.)"], ["iban", "IBAN"]] as const).map(([k, l]) => (
            <Feld key={k} label={l}><input className="feld" style={{ width: "100%" }} value={String(panel[k] ?? "")} onChange={(e) => setPanel({ ...panel, [k]: e.target.value })} /></Feld>
          ))}
          {panel.rolle === "Mandant" && (
            <Feld label="Vorsteuerabzug"><label style={{ fontSize: 14.5 }}><input type="checkbox" checked={!!panel.vorsteuer} onChange={(e) => setPanel({ ...panel, vorsteuer: e.target.checked ? 1 : 0 })} /> berechtigt (netto abrechnen)</label></Feld>
          )}
          <Feld label="Notiz"><textarea className="feld" style={{ width: "100%", minHeight: 60 }} value={panel.notiz ?? ""} onChange={(e) => setPanel({ ...panel, notiz: e.target.value })} /></Feld>
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <button className="btn pri" onClick={async () => { await speichern({ art: "beteiligter", ...panel }); setPanel(null); }}>Speichern</button>
            <button className="btn" onClick={() => setPanel(null)}>Abbrechen</button>
            <div style={{ flex: 1 }} />
            {panel.id && <button className="btn" style={{ color: "var(--rot)" }} onClick={async () => { if (confirm("Beteiligten entfernen?")) { await speichern({ art: "beteiligter_loeschen", id: panel.id }, "Entfernt"); setPanel(null); } }}>Entfernen</button>}
          </div>
        </Seitenfenster>
      )}

      {/* Seitenfenster: Falldaten */}
      {fallEdit && (
        <Seitenfenster titel="Falldaten bearbeiten" onClose={() => setFallEdit(null)}>
          {FALLFELDER.map(([k, l]) => (
            <Feld key={k} label={l}>
              {k === "schilderung"
                ? <textarea className="feld" style={{ width: "100%", minHeight: 60 }} value={fallEdit[k] ?? ""} onChange={(e) => setFallEdit({ ...fallEdit, [k]: e.target.value })} />
                : <input className="feld" style={{ width: "100%" }} value={fallEdit[k] ?? ""} onChange={(e) => setFallEdit({ ...fallEdit, [k]: e.target.value })} />}
            </Feld>
          ))}
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <button className="btn pri" onClick={async () => { await speichern({ art: "falldaten", werte: fallEdit }); setFallEdit(null); }}>Speichern</button>
            <button className="btn" onClick={() => setFallEdit(null)}>Abbrechen</button>
          </div>
        </Seitenfenster>
      )}
    </div>
  );
}

function Seitenfenster({ titel, onClose, children }: { titel: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(22,25,29,.25)", zIndex: 40 }} />
      <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 480, background: "#fff", borderLeft: "1px solid #c9ccd1", boxShadow: "-8px 0 24px rgba(0,0,0,.1)", zIndex: 41, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center" }}>
          <span style={{ fontSize: 18, fontWeight: 600 }}>{titel}</span><div style={{ flex: 1 }} /><span className="k">Esc</span>
        </div>
        <div style={{ flex: 1, overflow: "auto", padding: "12px 20px" }}>{children}</div>
      </div>
    </>
  );
}

function Feld({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ padding: "6px 0" }}><div className="lab" style={{ marginBottom: 3 }}>{label}</div>{children}</div>;
}

/** Text, der beim Anklicken zum Eingabefeld wird. Enter (bzw. Klick daneben) speichert, Esc bricht ab. */
function Inline({ value, onSave, multiline, platzhalter, style }: { value: string; onSave: (v: string) => void; multiline?: boolean; platzhalter?: string; style?: React.CSSProperties }) {
  const [edit, setEdit] = useState(false);
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  const fertig = () => { setEdit(false); if (v !== value) onSave(v); };
  if (!edit)
    return <span onClick={() => setEdit(true)} title="Klicken zum Bearbeiten" style={{ cursor: "text", display: multiline ? "block" : "inline", minHeight: 18, lineHeight: 1.45, fontSize: 14.5, color: value ? undefined : "var(--muted)", ...style }}>{value || platzhalter || "–"}</span>;
  const props = {
    autoFocus: true, value: v, className: "feld", onBlur: fertig,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV(e.target.value),
    onKeyDown: (e: React.KeyboardEvent) => { if (e.key === "Enter" && !(multiline && e.shiftKey)) { e.preventDefault(); fertig(); } if (e.key === "Escape") { e.stopPropagation(); setV(value); setEdit(false); } },
  };
  return multiline ? <textarea {...props} style={{ width: "100%", minHeight: 56 }} /> : <input {...props} style={{ width: "100%", ...style }} />;
}

type Sortierung = "datum" | "beteiligter" | "typ";
function Dokumente({ az, doks, neuladen, zeige }: { az: string; doks: DokumentRow[]; neuladen: () => void; zeige: (m: string) => void }) {
  const [sort, setSort] = useState<Sortierung>("datum");
  const [auswahl, setAuswahl] = useState<Set<number>>(new Set());
  const [schemaTyp, setSchemaTyp] = useState("");
  const [umbenennen, setUmbenennen] = useState<{ id: number; name: string } | null>(null);
  const [ziehen, setZiehen] = useState(false);

  const sortiert = [...doks].sort((a, b) =>
    sort === "datum" ? b.datum.localeCompare(a.datum) || b.id - a.id
    : sort === "typ" ? a.typ.localeCompare(b.typ) || b.datum.localeCompare(a.datum)
    : a.absender.localeCompare(b.absender) || b.datum.localeCompare(a.datum));
  const gruppe = (x: DokumentRow) => (sort === "typ" ? x.typ : sort === "beteiligter" ? x.absender || "–" : "");

  const hochladen = async (files: FileList) => {
    const fd = new FormData();
    Array.from(files).forEach((f) => fd.append("datei", f));
    fd.append("akteId", az);
    const r = await fetch("/api/upload", { method: "POST", body: fd });
    const j = await r.json();
    if (!r.ok) return zeige(j.fehler ?? "Upload fehlgeschlagen");
    zeige(`Abgelegt: ${j.dateien.map((x: { name: string }) => x.name).join(", ")}`);
    neuladen();
  };
  const sammel = async () => {
    await fetch(`/api/akten/${encodeURIComponent(az)}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ art: "dokumente_schema", ids: Array.from(auswahl), typ: schemaTyp || undefined }) });
    zeige(`${auswahl.size} Dokument(e) umbenannt`); setAuswahl(new Set()); neuladen();
  };
  const speichern = async (id: number, body: object) => {
    await fetch(`/api/dokumente/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    neuladen();
  };
  const toggle = (id: number) => setAuswahl((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <div onDragOver={(e) => { e.preventDefault(); setZiehen(true); }} onDragLeave={() => setZiehen(false)} onDrop={(e) => { e.preventDefault(); setZiehen(false); hochladen(e.dataTransfer.files); }}
      style={{ outline: ziehen ? "2px dashed var(--akzent)" : undefined, outlineOffset: 4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span className="th">Dokumente · ein- und ausgegangen</span>
        <div style={{ flex: 1 }} />
        <div className="seg">{(["datum", "beteiligter", "typ"] as Sortierung[]).map((x) => <span key={x} className={sort === x ? "on" : ""} onClick={() => setSort(x)}>{x === "datum" ? "Nach Datum" : x === "beteiligter" ? "Nach Beteiligtem" : "Nach Typ"}</span>)}</div>
        <label className="btn" style={{ cursor: "pointer" }}>+ Datei<input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.txt" style={{ display: "none" }} onChange={(e) => e.target.files && hochladen(e.target.files)} /></label>
      </div>
      {auswahl.size > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", marginTop: 6, background: "var(--akzent-bg)", borderRadius: 4, fontSize: 13.5 }}>
          <b>{auswahl.size} ausgewählt</b>
          <select className="feld" value={schemaTyp} onChange={(e) => setSchemaTyp(e.target.value)}><option value="">Typ beibehalten</option>{DOKTYPEN.map((t) => <option key={t}>{t}</option>)}</select>
          <button className="btn pri" onClick={sammel}>Nach Schema umbenennen</button>
          <button className="btn" onClick={() => setAuswahl(new Set())}>Abbrechen</button>
          <span className="lab">Schema: JJJJ-MM-TT_Typ_Absender</span>
        </div>
      )}
      <div style={{ marginTop: 4 }}>
        {sortiert.length === 0 && <div className="lab" style={{ padding: "8px 0" }}>Noch keine Dokumente. Dateien hierher ziehen oder „+ Datei“.</div>}
        {sortiert.map((x, i) => (
          <div key={x.id}>
            {gruppe(x) && gruppe(x) !== gruppe(sortiert[i - 1] ?? ({} as DokumentRow)) && <div className="lab" style={{ padding: "8px 0 2px", fontWeight: 600 }}>{gruppe(x)}</div>}
            <div style={{ display: "grid", gridTemplateColumns: "16px 18px 80px 1fr 170px 130px", gap: 8, alignItems: "center", padding: "5px 0", borderBottom: "1px solid var(--line2)", fontSize: 14.5 }}>
              <span className={"cb" + (auswahl.has(x.id) ? " on" : "")} onClick={() => toggle(x.id)}>{auswahl.has(x.id) ? "✓" : ""}</span>
              <span title={x.richtung === "ein" ? "eingegangen" : "ausgegangen"} style={{ fontWeight: 600, color: x.richtung === "ein" ? "var(--gruen)" : "var(--akzent)" }}>{x.richtung === "ein" ? "↓" : "↑"}</span>
              <span className="mono lab" style={{ fontSize: 13.5 }}>{x.datum.split("-").reverse().join(".")}</span>
              {umbenennen?.id === x.id
                ? <input autoFocus className="feld" value={umbenennen.name} onChange={(e) => setUmbenennen({ id: x.id, name: e.target.value })}
                    onKeyDown={(e) => { if (e.key === "Enter") { speichern(x.id, { name: umbenennen.name }); setUmbenennen(null); } if (e.key === "Escape") setUmbenennen(null); }}
                    onBlur={() => { speichern(x.id, { name: umbenennen.name }); setUmbenennen(null); }} />
                : <span style={{ display: "flex", gap: 6, alignItems: "center", minWidth: 0 }}>
                    {x.datei ? <a href={`/api/dokumente/${x.id}`} target="_blank" rel="noreferrer" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.name}</a> : <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.name}</span>}
                    <a href="#" className="lab" onClick={(e) => { e.preventDefault(); setUmbenennen({ id: x.id, name: x.name }); }}>✎</a>
                  </span>}
              <select className="feld" style={{ padding: "2px 4px", fontSize: 13.5 }} value={x.typ} onChange={(e) => speichern(x.id, { typ: e.target.value })}>
                {[...new Set([x.typ, ...DOKTYPEN])].map((t) => <option key={t}>{t}</option>)}
              </select>
              <span className="lab" style={{ fontSize: 13.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.absender}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Firma aus dem Adressbuch übernehmen (Name, Anschrift, Kontakt) – Schaden-Nr. und Ansprechpartner bleiben pro Akte. */
function AusAdressbuch({ rolle, verknuepft, onWahl }: { rolle: string; verknuepft: number | null; onWahl: (k: Record<string, unknown>) => void }) {
  const [suche, setSuche] = useState("");
  const [treffer, setTreffer] = useState<{ id: number; name: string; art: string; plz_ort: string }[]>([]);
  useEffect(() => {
    if (suche.trim().length < 2) return setTreffer([]);
    const art = rolle === "Versicherung" ? "" : rolle;
    const t = setTimeout(() => fetch(`/api/kontakte?suche=${encodeURIComponent(suche)}${art ? "&art=" + encodeURIComponent(art) : ""}`).then((r) => r.json()).then((x) => setTreffer(x.slice(0, 6))), 150);
    return () => clearTimeout(t);
  }, [suche, rolle]);
  const waehlen = async (id: number) => { const k = await fetch(`/api/kontakte/${id}?als=beteiligter`).then((r) => r.json()); const { rolle: _r, ...rest } = k; void _r; onWahl(rest); setSuche(""); setTreffer([]); };
  return (
    <div style={{ marginBottom: 10, position: "relative" }}>
      <div className="lab" style={{ marginBottom: 3 }}>Aus Adressbuch {verknuepft ? <span style={{ color: "#1d7a43" }}>· verknüpft ✓</span> : ""}</div>
      <input className="feld" style={{ width: "100%" }} placeholder="Name eintippen, z. B. HUK …" value={suche} onChange={(e) => setSuche(e.target.value)} />
      {treffer.length > 0 && (
        <div style={{ position: "absolute", left: 0, right: 0, top: "100%", background: "#fff", border: "1px solid var(--line)", borderRadius: 4, boxShadow: "0 6px 18px rgba(0,0,0,.12)", zIndex: 30 }}>
          {treffer.map((t) => (
            <div key={t.id} onClick={() => waehlen(t.id)} style={{ padding: "7px 10px", cursor: "pointer", fontSize: 14.5, borderBottom: "1px solid var(--line2)" }}>
              <b style={{ fontWeight: 500 }}>{t.name}</b> <span className="lab">{t.art}{t.plz_ort && ` · ${t.plz_ort}`}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
