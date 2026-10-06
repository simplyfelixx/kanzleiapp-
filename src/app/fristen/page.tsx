"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@/components/Store";

type F = { id: number; akte_id: string; akte_titel: string; gebiet: string; art: "wv" | "frist"; datum: string; titel: string; wer: string; bestaetigt: number; quelle: string };
type AkteKurz = { id: string; titel: string };

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const de = (s: string) => s.split("-").reverse().join(".");
const WT = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const WT_MO = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const MONAT = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
const montag = (d: Date) => { const x = new Date(d); x.setHours(12, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };

/** Datum als Text, Klick öffnet den Kalender des Browsers */
function DatumFeld({ wert, onChange }: { wert: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const d = new Date(wert + "T12:00");
  return (
    <span style={{ position: "relative", display: "inline-flex" }}>
      <button className="btn mono" style={{ padding: "3px 8px", fontSize: 14, border: "1px solid transparent", background: "transparent", whiteSpace: "nowrap" }}
        title="Datum ändern" onClick={() => { try { ref.current?.showPicker(); } catch { ref.current?.focus(); } }}>
        {WT[d.getDay()]} {de(wert).slice(0, 6)}<span style={{ color: "var(--muted)" }}>{wert.slice(2, 4)}</span>
      </button>
      <input ref={ref} type="date" value={wert} onChange={(e) => e.target.value && onChange(e.target.value)}
        style={{ position: "absolute", inset: 0, opacity: 0, pointerEvents: "none" }} tabIndex={-1} />
    </span>
  );
}

export default function Fristen() {
  const { gebiete, imGebiet, zeige } = useStore();
  const [liste, setListe] = useState<F[] | null>(null);
  const [akten, setAkten] = useState<AkteKurz[]>([]);
  const [nurMeine, setNurMeine] = useState(false);
  const [neu, setNeu] = useState(false);
  const [form, setForm] = useState({ akteId: "", art: "wv", datum: iso(new Date(Date.now() + 7 * 864e5)), titel: "", wer: "" });
  const [ich, setIch] = useState("");
  const [monat, setMonat] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1, 12); });
  useEffect(() => { fetch("/api/auth/ich").then((r) => r.json()).then((u) => { setIch(u.kuerzel ?? ""); setForm((f) => ({ ...f, wer: f.wer || u.kuerzel || "" })); }).catch(() => {}); }, []);

  const laden = useCallback(() => fetch("/api/fristen").then((r) => r.json()).then(setListe), []);
  useEffect(() => { laden(); fetch("/api/akten").then((r) => r.json()).then(setAkten); }, [laden]);

  const heute = iso(new Date());
  const wocheEnde = iso(new Date(Date.now() + 7 * 864e5));
  const sicht = useMemo(() => (liste ?? []).filter((f) => imGebiet(f.gebiet) && (!nurMeine || f.wer.split(/\s+/).includes(ich))), [liste, gebiete, nurMeine, ich]);
  const gruppen: [string, string, F[]][] = [
    ["Von KI erkannt – bitte bestätigen", "#8a6d00", sicht.filter((f) => !f.bestaetigt)],
    ["Überfällig", "var(--rot)", sicht.filter((f) => f.bestaetigt && f.datum < heute)],
    ["Heute", "var(--rot)", sicht.filter((f) => f.bestaetigt && f.datum === heute)],
    ["Nächste 7 Tage", "#B5620A", sicht.filter((f) => f.bestaetigt && f.datum > heute && f.datum <= wocheEnde)],
    ["Später", "var(--muted)", sicht.filter((f) => f.bestaetigt && f.datum > wocheEnde)],
  ];

  // Zwei Wochen ab Montag, wie ein Kalender
  // Ganzer Monat, Wochen von Montag bis Sonntag
  const start = montag(monat);
  const wochen = Math.ceil(((monat.getDay() + 6) % 7 + new Date(monat.getFullYear(), monat.getMonth() + 1, 0).getDate()) / 7);
  const tage = Array.from({ length: wochen * 7 }, (_, i) => { const d = new Date(start); d.setDate(d.getDate() + i); return d; });
  const ueberfaellig = sicht.filter((f) => f.bestaetigt && f.datum < heute).length;
  const zeitraum = `${MONAT[monat.getMonth()]} ${monat.getFullYear()}`;
  const verschiebe = (m: number) => setMonat((x) => new Date(x.getFullYear(), x.getMonth() + m, 1, 12));
  const [tagWahl, setTagWahl] = useState<string | null>(null);

  const aktion = async (f: F, aktion: string, extra: object = {}) => {
    const r = await fetch(`/api/fristen/${f.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ aktion, ...extra }) });
    zeige(r.ok ? ({ erledigt: "Erledigt", bestaetigen: "Frist bestätigt", verschieben: "Verschoben", datum: "Datum geändert" } as Record<string, string>)[aktion] : "Fehler");
    laden();
  };
  const anlegen = async () => {
    const r = await fetch("/api/fristen", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const j = await r.json();
    if (!r.ok) return zeige(j.fehler);
    zeige(form.art === "frist" ? "Frist notiert" : "Wiedervorlage gesetzt");
    setForm({ ...form, titel: "" }); setNeu(false); laden();
  };

  if (!liste) return <div className="empty">Lade …</div>;
  return (
    <>
      <div className="head">
        <div>
          <h1>Fristen &amp; Wiedervorlagen</h1>
          <div className="lab" style={{ fontSize: 14.5, marginTop: 2 }}>{sicht.filter((f) => f.art === "frist").length} Fristen · {sicht.filter((f) => f.art === "wv").length} Wiedervorlagen · Fristen von der KI gelten erst nach Bestätigung</div>
        </div>
        <span className={"chip" + (nurMeine ? " on" : "")} onClick={() => setNurMeine(!nurMeine)}>Nur meine</span>
        <div style={{ flex: 1 }} />
        <button className="btn pri" onClick={() => setNeu(!neu)}>+ Wiedervorlage / Frist</button>
      </div>
      {neu && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "12px 24px", borderBottom: "1px solid var(--line)", background: "var(--akzent-bg)", flexWrap: "wrap" }}>
          <select className="feld" value={form.art} onChange={(e) => setForm({ ...form, art: e.target.value })}><option value="wv">Wiedervorlage</option><option value="frist">Frist</option></select>
          <select className="feld" value={form.akteId} onChange={(e) => setForm({ ...form, akteId: e.target.value })}><option value="">– Akte –</option>{akten.map((a) => <option key={a.id} value={a.id}>{a.id} {a.titel}</option>)}</select>
          <input className="feld" type="date" value={form.datum} onChange={(e) => setForm({ ...form, datum: e.target.value })} />
          {[1, 7, 14, 28].map((t) => <span key={t} className="chip" onClick={() => setForm({ ...form, datum: iso(new Date(Date.now() + t * 864e5)) })}>+{t}</span>)}
          <input className="feld" placeholder="Worum geht es?" style={{ flex: 1, minWidth: 220 }} value={form.titel} onChange={(e) => setForm({ ...form, titel: e.target.value })} onKeyDown={(e) => e.key === "Enter" && anlegen()} />
          <input className="feld" style={{ width: 70 }} value={form.wer} onChange={(e) => setForm({ ...form, wer: e.target.value })} title="Kürzel" />
          <button className="btn pri" onClick={anlegen}>Speichern</button>
        </div>
      )}
      <div style={{ flex: 1, minHeight: 0, display: "flex", gap: 20, padding: "12px 24px 20px" }}>
      {/* Links: Monatskalender */}
      <div style={{ flex: "1.25 1 0", minWidth: 0, display: "flex", flexDirection: "column", minHeight: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <b style={{ fontSize: 19, fontWeight: 600, minWidth: 170 }}>{zeitraum}</b>
          <button className="btn" onClick={() => verschiebe(-1)} title="Monat zurück">‹</button>
          <button className="btn" onClick={() => { const d = new Date(); setMonat(new Date(d.getFullYear(), d.getMonth(), 1, 12)); }}>Heute</button>
          <button className="btn" onClick={() => verschiebe(1)} title="Monat vor">›</button>
          <div style={{ flex: 1 }} />
          <span className="lab"><span style={{ display: "inline-block", width: 11, height: 11, background: "#f8d9d4", borderRadius: 2, marginRight: 4 }} />Frist
            <span style={{ display: "inline-block", width: 11, height: 11, background: "#e3e8f2", borderRadius: 2, margin: "0 4px 0 12px" }} />WV</span>
        </div>
        <div style={{ flex: 1, minHeight: 0, border: "1px solid var(--line)", borderRadius: 6, overflow: "hidden", background: "#fff", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5,minmax(0,1fr)) repeat(2,minmax(0,.55fr))", background: "var(--bg3)", borderBottom: "1px solid var(--line)" }}>
            {WT_MO.map((w, i) => <div key={w} className="th" style={{ padding: "6px 10px", borderLeft: i ? "1px solid #eceef0" : undefined }}>{w}</div>)}
          </div>
          {Array.from({ length: wochen }, (_, woche) => (
            <div key={woche} style={{ flex: 1, minHeight: 86, display: "grid", gridTemplateColumns: "repeat(5,minmax(0,1fr)) repeat(2,minmax(0,.55fr))", borderTop: woche ? "1px solid var(--line)" : undefined }}>
              {tage.slice(woche * 7, woche * 7 + 7).map((d, i) => {
                const tag = iso(d), items = sicht.filter((f) => f.bestaetigt && f.datum === tag);
                const istHeute = tag === heute, anderer = d.getMonth() !== monat.getMonth(), we = i >= 5, gewaehlt = tagWahl === tag;
                return (
                  <div key={tag} onClick={() => setTagWahl(gewaehlt ? null : tag)}
                    style={{ borderLeft: i ? "1px solid #eceef0" : undefined, padding: "5px 6px", minWidth: 0, overflow: "hidden", cursor: "pointer",
                      background: gewaehlt ? "var(--akzent-bg)" : istHeute ? "var(--sel)" : we || anderer ? "#fafbfc" : undefined, outline: gewaehlt ? "2px solid var(--akzent)" : undefined, outlineOffset: -2 }}>
                    <div style={{ marginBottom: 3 }}>
                      <span style={{ fontSize: 14.5, fontWeight: istHeute ? 700 : 500, color: istHeute ? "#fff" : anderer ? "#b0b4b9" : we ? "var(--muted)" : undefined, background: istHeute ? "var(--akzent)" : undefined, borderRadius: 10, padding: istHeute ? "0 7px" : 0 }}>{d.getDate()}</span>
                    </div>
                    {items.slice(0, 3).map((f) => (
                      <div key={f.id} title={`${f.akte_id} ${f.akte_titel} – ${f.titel}`}
                        style={{ marginTop: 2, padding: "1px 5px", borderRadius: 3, fontSize: 13.5, lineHeight: 1.35, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                          background: f.art === "frist" ? "#f8d9d4" : "#e3e8f2", color: f.art === "frist" ? "#8a2416" : "#16191d", borderLeft: `3px solid ${f.art === "frist" ? "var(--rot)" : "#8a99b8"}` }}>
                        {f.akte_titel.split(" ")[0]} · {f.titel}
                      </div>
                    ))}
                    {items.length > 3 && <div className="lab" style={{ marginTop: 2 }}>+{items.length - 3}</div>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Rechts: offene Fristen und Wiedervorlagen */}
      <div style={{ flex: "1 1 0", minWidth: 460, overflow: "auto", borderLeft: "1px solid var(--line)", paddingLeft: 20 }}>
        {tagWahl && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: "var(--akzent-bg)", borderRadius: 4, marginBottom: 4 }}>
            <span style={{ fontSize: 14.5 }}>Nur {WT[new Date(tagWahl + "T12:00").getDay()]} {de(tagWahl)}</span><div style={{ flex: 1 }} />
            <button className="btn" onClick={() => setTagWahl(null)}>Alle zeigen</button>
          </div>
        )}
        {gruppen.map(([name, farbe, alle]) => { const rows = tagWahl ? alle.filter((f) => f.datum === tagWahl) : alle; return rows.length > 0 && (
          <div key={name}>
            <div className="th" style={{ padding: "12px 0 4px", color: farbe }}>{name} · {rows.length}</div>
            {rows.map((f) => (
              <div key={f.id} style={{ display: "grid", gridTemplateColumns: "4px 1fr auto", columnGap: 10, padding: "9px 0", borderBottom: "1px solid #e6e8eb", background: !f.bestaetigt ? "#fffbea" : undefined }}>
                <span style={{ gridRow: "span 2", background: farbe, borderRadius: 2 }} />
                <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  <DatumFeld wert={f.datum} onChange={(v) => aktion(f, "datum", { datum: v })} />
                  <span className="k" style={{ color: f.art === "frist" ? "var(--rot)" : undefined }}>{f.art === "frist" ? "FRIST" : "WV"}</span>
                  <Link href={`/akte/${encodeURIComponent(f.akte_id)}`} className="mono" style={{ fontSize: 14 }}>{f.akte_id}</Link>
                  <span className="lab">{f.wer || ""}</span>
                </div>
                <span style={{ display: "flex", gap: 5, justifyContent: "flex-end" }}>
                  {f.bestaetigt
                    ? <button className="btn" onClick={() => aktion(f, "erledigt")}>Erledigt</button>
                    : <button className="btn pri" onClick={() => aktion(f, "bestaetigen")}>Bestätigen</button>}
                  <button className="btn" onClick={() => aktion(f, "verschieben", { tage: 1 })}>+1</button>
                  <button className="btn" onClick={() => aktion(f, "verschieben", { tage: 7 })}>+7</button>
                </span>
                <div style={{ gridColumn: "2 / span 2", fontSize: 15, paddingLeft: 8, marginTop: 2 }}>
                  <b style={{ fontWeight: 500 }}>{f.akte_titel}</b> – {f.titel}{!f.bestaetigt && f.quelle && <span className="lab"> · Quelle: {f.quelle}</span>}
                </div>
              </div>
            ))}
          </div>
        ); })}
        {sicht.length === 0 && <div className="empty">Keine offenen Fristen oder Wiedervorlagen.</div>}
        {tagWahl && !sicht.some((f) => f.datum === tagWahl) && <div className="empty">An diesem Tag nichts.</div>}
      </div>
      </div>
    </>
  );
}
