"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useStore } from "@/components/Store";

type F = { id: number; akte_id: string; akte_titel: string; gebiet: string; art: "wv" | "frist"; datum: string; titel: string; wer: string; bestaetigt: number; quelle: string };
type AkteKurz = { id: string; titel: string };

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const de = (s: string) => s.split("-").reverse().join(".");
const WT = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

export default function Fristen() {
  const { gebiet, zeige } = useStore();
  const [liste, setListe] = useState<F[] | null>(null);
  const [akten, setAkten] = useState<AkteKurz[]>([]);
  const [nurMeine, setNurMeine] = useState(false);
  const [neu, setNeu] = useState(false);
  const [form, setForm] = useState({ akteId: "", art: "wv", datum: iso(new Date(Date.now() + 7 * 864e5)), titel: "", wer: "FK" });

  const laden = useCallback(() => fetch("/api/fristen").then((r) => r.json()).then(setListe), []);
  useEffect(() => { laden(); fetch("/api/akten").then((r) => r.json()).then(setAkten); }, [laden]);

  const heute = iso(new Date());
  const wocheEnde = iso(new Date(Date.now() + 7 * 864e5));
  const sicht = useMemo(() => (liste ?? []).filter((f) => (gebiet === "Alle" || f.gebiet === gebiet) && (!nurMeine || f.wer === "FK")), [liste, gebiet, nurMeine]);
  const gruppen: [string, string, F[]][] = [
    ["Von KI erkannt – bitte bestätigen", "#8a6d00", sicht.filter((f) => !f.bestaetigt)],
    ["Überfällig", "var(--rot)", sicht.filter((f) => f.bestaetigt && f.datum < heute)],
    ["Heute", "var(--rot)", sicht.filter((f) => f.bestaetigt && f.datum === heute)],
    ["Nächste 7 Tage", "#B5620A", sicht.filter((f) => f.bestaetigt && f.datum > heute && f.datum <= wocheEnde)],
    ["Später", "var(--muted)", sicht.filter((f) => f.bestaetigt && f.datum > wocheEnde)],
  ];

  const tage = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() + i); return d; });

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
          <div className="lab" style={{ fontSize: 13, marginTop: 2 }}>{sicht.filter((f) => f.art === "frist").length} Fristen · {sicht.filter((f) => f.art === "wv").length} Wiedervorlagen · Fristen von der KI gelten erst nach Bestätigung</div>
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
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,minmax(0,1fr))", borderBottom: "1px solid var(--line)", background: "var(--bg3)" }}>
        {tage.map((d, i) => {
          const tag = iso(d), items = sicht.filter((f) => f.bestaetigt && (i === 0 ? f.datum <= tag : f.datum === tag));
          const we = d.getDay() === 0 || d.getDay() === 6;
          return (
            <div key={tag} style={{ borderRight: "1px solid #e6e8eb", padding: 6, fontSize: 11, minHeight: 64, background: i === 0 ? "var(--sel)" : undefined, color: we ? "var(--grau)" : undefined }}>
              <b>{WT[d.getDay()]} {de(tag).slice(0, 6)}</b>
              {items.slice(0, 3).map((f) => (
                <div key={f.id} title={f.titel} style={{ marginTop: 3, padding: "1px 4px", borderRadius: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", background: f.art === "frist" ? "#f8d9d4" : "#e6e8eb", color: f.art === "frist" ? "#8a2416" : undefined }}>
                  {f.akte_titel.split(" ")[0]} · {f.titel}
                </div>
              ))}
              {items.length > 3 && <div className="lab">+{items.length - 3} weitere</div>}
            </div>
          );
        })}
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: "0 24px 24px" }}>
        {gruppen.map(([name, farbe, rows]) => rows.length > 0 && (
          <div key={name}>
            <div className="th" style={{ padding: "14px 0 4px", color: farbe }}>{name} · {rows.length}</div>
            {rows.map((f) => (
              <div key={f.id} className="row" style={{ gridTemplateColumns: "4px 90px 60px 90px 1fr 70px 300px", padding: "9px 0", cursor: "default", background: !f.bestaetigt ? "#fffbea" : undefined }}>
                <span style={{ alignSelf: "stretch", background: farbe }} />
                <input className="feld mono" type="date" value={f.datum} onChange={(e) => aktion(f, "datum", { datum: e.target.value })} style={{ padding: "2px 4px", fontSize: 12, border: "1px solid transparent" }} />
                <span className="k" style={{ justifySelf: "start", color: f.art === "frist" ? "var(--rot)" : undefined }}>{f.art === "frist" ? "FRIST" : "WV"}</span>
                <Link href={`/akte/${encodeURIComponent(f.akte_id)}`} className="mono" style={{ fontSize: 12 }}>{f.akte_id}</Link>
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
