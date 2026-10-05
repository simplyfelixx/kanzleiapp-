"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useStore } from "@/components/Store";
import { useListKeys } from "@/components/useListKeys";

type Dok = { id: number; datei: string | null; quelle: string; zeit: string; typ: string; absender: string; akte_id: string | null; akte_titel: string | null; akte_phase: string | null; sicher: number; erkannt: string; dateiname: string; felder: string; folgeaktionen: string; vorschau: string };
type AkteKurz = { id: string; titel: string };
const filterListe = ["Alle", "UPLOAD", "MAIL", "beA", "SCAN", "PORTAL", "Unklar"] as const;
const label: Record<string, string> = { UPLOAD: "Hochgeladen", Alle: "Alle", MAIL: "Mail", beA: "beA", SCAN: "Scan", PORTAL: "Portal", Unklar: "Unklar" };

export default function Eingang() {
  const { zeige } = useStore();
  const [doks, setDoks] = useState<Dok[] | null>(null);
  const [akten, setAkten] = useState<AkteKurz[]>([]);
  const [filter, setFilter] = useState<(typeof filterListe)[number]>("Alle");
  const [auswahl, setAuswahl] = useState<Set<number>>(new Set());
  const [zuordnung, setZuordnung] = useState<Record<number, string>>({});
  const [ziehen, setZiehen] = useState(false);
  const [laedt, setLaedt] = useState(false);
  const hochladen = async (files: FileList | File[]) => {
    const liste = Array.from(files);
    if (!liste.length) return;
    setLaedt(true);
    const fd = new FormData();
    liste.forEach((f) => fd.append("datei", f));
    const r = await fetch("/api/upload", { method: "POST", body: fd });
    const j = await r.json();
    setLaedt(false);
    if (!r.ok) return zeige(j.fehler ?? "Upload fehlgeschlagen");
    zeige(`${j.dateien.length} Dokument(e) erkannt: ${j.dateien.map((x: { name: string; ziel: string }) => `${x.name} → ${x.ziel}`).join(", ")}`);
    setFilter("Alle");
    await laden();
  };

  const laden = useCallback(() => fetch("/api/eingang").then((r) => r.json()).then(setDoks), []);
  useEffect(() => { laden(); fetch("/api/akten").then((r) => r.json()).then(setAkten); }, [laden]);

  const liste = useMemo(() => (doks ?? []).filter((e) => (filter === "Alle" ? true : filter === "Unklar" ? !e.sicher : e.quelle === filter)), [doks, filter]);
  const [idx, setIdx] = useState(0);
  useEffect(() => { if (idx > liste.length - 1) setIdx(Math.max(0, liste.length - 1)); }, [liste.length, idx]);
  const d = liste[idx];
  const akteId = d ? zuordnung[d.id] ?? d.akte_id : null;

  const aktion = async (dok: Dok, art: "bestaetigen" | "verwerfen", akte?: string | null) => {
    const r = await fetch(`/api/eingang/${dok.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ aktion: art, akteId: akte }) });
    const j = await r.json();
    return r.ok ? null : j.fehler ?? "Fehler";
  };
  const bestaetigen = useCallback(async () => {
    if (!d) return;
    const f = await aktion(d, "bestaetigen", akteId);
    if (f) return zeige(f);
    zeige(`${d.typ} → ${akteId} abgelegt · Akte aktualisiert`);
    laden();
  }, [d, akteId]); // eslint-disable-line react-hooks/exhaustive-deps
  useListKeys(liste.length, idx, setIdx, bestaetigen);

  const toggle = (id: number) => setAuswahl((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const sammel = async () => {
    let ok = 0, offen = 0;
    for (const id of Array.from(auswahl)) {
      const dok = (doks ?? []).find((x) => x.id === id);
      if (!dok) continue;
      const a = zuordnung[id] ?? dok.akte_id;
      if (!a) { offen++; continue; }
      if (!(await aktion(dok, "bestaetigen", a))) ok++;
    }
    setAuswahl(new Set());
    zeige(`${ok} bestätigt${offen ? ` · ${offen} ohne Akte übersprungen` : ""}`);
    laden();
  };

  if (!doks) return <div className="empty">Lade …</div>;
  const felder: { label: string; wert: string; quelle: string }[] = d ? JSON.parse(d.felder || "[]") : [];
  const folge: string[] = d ? JSON.parse(d.folgeaktionen || "[]") : [];

  return (
    <>
      <div className="head">
        <div>
          <h1>Eingang</h1>
          <div className="lab" style={{ fontSize: 13, marginTop: 2 }}>{doks.length} neu · {doks.filter((e) => e.sicher).length} sicher zugeordnet · {doks.filter((e) => !e.sicher).length} brauchen dich</div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {filterListe.map((q) => <span key={q} className={"chip" + (filter === q ? " on" : "")} onClick={() => { setFilter(q); setIdx(0); }}>{label[q]}</span>)}
        </div>
      </div>
      <div className="main" onDragOver={(ev) => { ev.preventDefault(); setZiehen(true); }} onDragLeave={() => setZiehen(false)} onDrop={(ev) => { ev.preventDefault(); setZiehen(false); hochladen(ev.dataTransfer.files); }} style={{ position: "relative" }}>
        {ziehen && <div style={{ position: "absolute", inset: 8, border: "2px dashed var(--akzent)", background: "rgba(31,79,209,.06)", zIndex: 30, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: "var(--akzent)", pointerEvents: "none" }}>Dateien hier ablegen – sie werden erkannt und zugeordnet</div>}
        <div style={{ width: 500, borderRight: "1px solid var(--line)", display: "flex", flexDirection: "column", overflow: "auto" }}>
          {auswahl.size > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", borderBottom: "1px solid var(--line)", background: "var(--akzent-bg)", fontSize: 12 }}>
              <b>{auswahl.size} ausgewählt</b><div style={{ flex: 1 }} />
              <button className="btn" onClick={() => setAuswahl(new Set())}>Auswahl aufheben</button>
              <button className="btn pri" onClick={sammel}>Alle bestätigen</button>
            </div>
          )}
          <label style={{ display: "block", margin: "10px 16px", padding: "12px", border: "1px dashed #b9bec4", borderRadius: 4, textAlign: "center", fontSize: 13, cursor: "pointer", color: "var(--muted)" }}>
            {laedt ? "Wird gelesen und erkannt …" : <>PDF oder Scan hierher ziehen oder <span style={{ color: "var(--akzent)" }}>Datei wählen</span></>}
            <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.txt" style={{ display: "none" }} onChange={(ev) => ev.target.files && hochladen(ev.target.files)} />
          </label>
          {liste.length === 0 && <div className="empty">Eingang leer.</div>}
          {liste.map((e, i) => (
            <div key={e.id} className={"row" + (i === idx ? " sel" : "")} style={{ gridTemplateColumns: "16px 56px 1fr 70px", padding: "11px 16px", alignItems: "start" }} onClick={() => setIdx(i)}>
              <span className={"cb" + (auswahl.has(e.id) ? " on" : "")} onClick={(ev) => { ev.stopPropagation(); toggle(e.id); }}>{auswahl.has(e.id) ? "✓" : ""}</span>
              <span className="mono" style={{ fontSize: 10, textAlign: "center", border: "1px solid #d5d8dc", borderRadius: 3, color: e.quelle === "beA" ? "var(--akzent)" : "#3a3f47" }}>{e.quelle}</span>
              <div>
                <div style={{ fontWeight: 500 }}>{e.typ}</div>
                <div className="lab" style={{ fontSize: 12 }}>{e.absender} → {(zuordnung[e.id] ?? e.akte_id) ? <span className="mono">{zuordnung[e.id] ?? e.akte_id}</span> : <span style={{ color: "#B5620A" }}>Akte unklar</span>}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div className="lab mono">{e.zeit}</div>
                <div style={{ fontSize: 11, color: e.sicher ? "var(--gruen)" : "#B5620A" }}>{e.sicher ? "sicher" : "unklar"}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ flex: 1, background: "#eceef1", padding: 20, display: "flex", justifyContent: "center", overflow: "auto" }}>
          {d && d.datei && <iframe src={`/api/dokumente/e${d.id}`} title={d.dateiname} style={{ width: "100%", height: "100%", border: 0, background: "#fff" }} />}
          {d && !d.datei && (
            <div style={{ width: 480, background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,.12)", padding: "36px 40px", fontSize: 12, lineHeight: 1.7, fontFamily: "Georgia, serif", whiteSpace: "pre-wrap", alignSelf: "flex-start" }}>
              <div style={{ fontFamily: "IBM Plex Sans", fontWeight: 600, fontSize: 13, marginBottom: 16 }}>{d.absender}</div>
              {d.vorschau}
            </div>
          )}
        </div>
        {d && (
          <div className="side" style={{ width: 400 }}>
            <div>
              <div className="th" style={{ color: "var(--akzent)" }}>KI hat erkannt</div>
              <div style={{ fontSize: 14, lineHeight: 1.5, marginTop: 4 }}>{d.erkannt}</div>
            </div>
            <div>
              <div className="fr">
                <span className="lab">Akte</span>
                <select className="feld" value={akteId ?? ""} onChange={(ev) => setZuordnung({ ...zuordnung, [d.id]: ev.target.value })} style={{ background: akteId ? "#fff" : "var(--hl2)" }}>
                  <option value="">– Akte wählen –</option>
                  {akten.map((a) => <option key={a.id} value={a.id}>{a.id} {a.titel}</option>)}
                </select>
                <span />
              </div>
              <div className="fr"><span className="lab">Dokumenttyp</span><span>{d.typ}</span><span /></div>
              <div className="fr"><span className="lab">Dateiname</span><span className="mono" style={{ fontSize: 12 }}>{d.dateiname}</span><span /></div>
              {felder.map((f) => (
                <div className="fr" key={f.label}>
                  <span className="lab">{f.label}</span>
                  <span className="hl" style={{ justifySelf: "start" }}>{f.wert}</span>
                  <span className="q" title={`Quelle: ${f.quelle}`} onClick={() => zeige(`Quelle: ${f.quelle}`)}>?</span>
                </div>
              ))}
            </div>
            <div>
              <div className="th">Wird danach erledigt</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6, fontSize: 13 }}>
                {folge.map((f) => <div key={f} style={{ display: "flex", gap: 8 }}><span className="cb on">✓</span>{f}</div>)}
                <div style={{ display: "flex", gap: 8 }}><span className="cb on">✓</span>Im Verlauf der Akte ablegen</div>
              </div>
            </div>
            {akteId && <Link href={`/akte/${encodeURIComponent(akteId)}`} className="lab">Akte {akteId} öffnen →</Link>}
            <div style={{ flex: 1 }} />
            <div style={{ display: "flex", gap: 6 }}>
              <button className="btn pri" style={{ padding: "8px 16px", fontSize: 13 }} onClick={bestaetigen}>Bestätigen ↵</button>
              <button className="btn" style={{ padding: "8px 12px", fontSize: 13 }} onClick={async () => { await aktion(d, "verwerfen"); zeige("Verworfen"); laden(); }}>Verwerfen</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
