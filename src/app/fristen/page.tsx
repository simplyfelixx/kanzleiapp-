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
  const [start, setStart] = useState(() => montag(new Date()));
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
  const tage = Array.from({ length: 14 }, (_, i) => { const d = new Date(start); d.setDate(d.getDate() + i); return d; });
  const ueberfaellig = sicht.filter((f) => f.bestaetigt && f.datum < heute).length;
  const zeitraum = (() => { const a = tage[0], b = tage[13]; return a.getMonth() === b.getMonth() ? `${MONAT[a.getMonth()]} ${a.getFullYear()}` : `${MONAT[a.getMonth()]} – ${MONAT[b.getMonth()]} ${b.getFullYear()}`; })();
  const verschiebe = (w: number) => setStart((s) => { const x = new Date(s); x.setDate(x.getDate() + 7 * w); return x; });

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
      <div style={{ padding: "12px 24px 4px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <b style={{ fontSize: 16.5, fontWeight: 600, minWidth: 220 }}>{zeitraum}</b>
          <button className="btn" onClick={() => verschiebe(-1)} title="Woche zurück">‹</button>
          <button className="btn" onClick={() => setStart(montag(new Date()))}>Heute</button>
          <button className="btn" onClick={() => verschiebe(1)} title="Woche vor">›</button>
          {ueberfaellig > 0 && <span style={{ fontSize: 13.5, color: "var(--rot)", marginLeft: 8 }}>{ueberfaellig} überfällig – siehe Liste unten</span>}
          <div style={{ flex: 1 }} />
          <span className="lab"><span style={{ display: "inline-block", width: 10, height: 10, background: "#f8d9d4", borderRadius: 2, marginRight: 4 }} />Frist
            <span style={{ display: "inline-block", width: 10, height: 10, background: "#e3e8f2", borderRadius: 2, margin: "0 4px 0 12px" }} />Wiedervorlage</span>
        </div>
        <div style={{ border: "1px solid var(--line)", borderRadius: 6, overflow: "hidden", background: "#fff" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5,minmax(0,1fr)) repeat(2,minmax(0,.6fr))", background: "var(--bg3)", borderBottom: "1px solid var(--line)" }}>
            {WT_MO.map((w, i) => <div key={w} className="th" style={{ padding: "6px 10px", borderLeft: i ? "1px solid #eceef0" : undefined }}>{w}</div>)}
          </div>
          {[0, 1].map((woche) => (
            <div key={woche} style={{ display: "grid", gridTemplateColumns: "repeat(5,minmax(0,1fr)) repeat(2,minmax(0,.6fr))", borderTop: woche ? "1px solid var(--line)" : undefined }}>
              {tage.slice(woche * 7, woche * 7 + 7).map((d, i) => {
                const tag = iso(d), items = sicht.filter((f) => f.bestaetigt && f.datum === tag);
                const istHeute = tag === heute, vorbei = tag < heute, we = i >= 5;
                return (
                  <div key={tag} style={{ borderLeft: i ? "1px solid #eceef0" : undefined, padding: "6px 8px", minHeight: 92, background: istHeute ? "var(--sel)" : we ? "#fafbfc" : undefined, opacity: vorbei && !istHeute ? 0.55 : 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: istHeute ? 700 : 500, color: istHeute ? "#fff" : we ? "var(--muted)" : undefined, background: istHeute ? "var(--akzent)" : undefined, borderRadius: 10, padding: istHeute ? "0 7px" : 0 }}>{d.getDate()}</span>
                      {d.getDate() === 1 && <span className="lab">{MONAT[d.getMonth()].slice(0, 3)}</span>}
                    </div>
                    {items.slice(0, 4).map((f) => (
                      <Link key={f.id} href={`/akte/${encodeURIComponent(f.akte_id)}`} title={`${f.akte_titel} – ${f.titel}`}
                        style={{ display: "block", marginTop: 3, padding: "2px 6px", borderRadius: 3, fontSize: 13, lineHeight: 1.35, textDecoration: "none", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                          background: f.art === "frist" ? "#f8d9d4" : "#e3e8f2", color: f.art === "frist" ? "#8a2416" : "#16191d", borderLeft: `3px solid ${f.art === "frist" ? "var(--rot)" : "#8a99b8"}` }}>
                        <span className="mono" style={{ fontSize: 12 }}>{f.akte_id}</span> {f.titel}
                      </Link>
                    ))}
                    {items.length > 4 && <div className="lab" style={{ marginTop: 3 }}>+{items.length - 4} weitere</div>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: "0 24px 24px" }}>
        {gruppen.map(([name, farbe, rows]) => rows.length > 0 && (
          <div key={name}>
            <div className="th" style={{ padding: "14px 0 4px", color: farbe }}>{name} · {rows.length}</div>
            {rows.map((f) => (
              <div key={f.id} className="row" style={{ gridTemplateColumns: "4px 130px 64px 90px 1fr 70px 300px", padding: "9px 0", cursor: "default", background: !f.bestaetigt ? "#fffbea" : undefined }}>
                <span style={{ alignSelf: "stretch", background: farbe }} />
                <DatumFeld wert={f.datum} onChange={(v) => aktion(f, "datum", { datum: v })} />
                <span className="k" style={{ justifySelf: "start", color: f.art === "frist" ? "var(--rot)" : undefined }}>{f.art === "frist" ? "FRIST" : "WV"}</span>
                <Link href={`/akte/${encodeURIComponent(f.akte_id)}`} className="mono" style={{ fontSize: 13.5 }}>{f.akte_id}</Link>
                <span><b style={{ fontWeight: 500 }}>{f.akte_titel}</b> – {f.titel}{!f.bestaetigt && f.quelle && <span className="lab"> · Quelle: {f.quelle}</span>}</span>
                <span className="lab">{f.wer || "–"}</span>
                <span style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                  {f.bestaetigt
                    ? <button className="btn" onClick={() => aktion(f, "erledigt")}>Erledigt</button>
                    : <button className="btn pri" onClick={() => aktion(f, "bestaetigen")}>Bestätigen</button>}
                  <button className="btn" onClick={() => aktion(f, "verschieben", { tage: 1 })}>+1</button>
                  <button className="btn" onClick={() => aktion(f, "verschieben", { tage: 7 })}>+7</button>
                  <button className="btn" onClick={() => aktion(f, "verschieben", { tage: 14 })}>+14</button>
                </span>
              </div>
            ))}
          </div>
        ))}
        {sicht.length === 0 && <div className="empty">Keine offenen Fristen oder Wiedervorlagen.</div>}
      </div>
    </>
  );
}
