"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { akten, eingang, Quelle } from "@/lib/data";
import { useStore } from "@/components/Store";
import { useListKeys } from "@/components/useListKeys";

const quellen: (Quelle | "Alle" | "Unklar")[] = ["Alle", "MAIL", "beA", "SCAN", "PORTAL", "Unklar"];

export default function Eingang() {
  const { erledigt, erledigen, zeige } = useStore();
  const [filter, setFilter] = useState<(typeof quellen)[number]>("Alle");
  const [auswahl, setAuswahl] = useState<Set<string>>(new Set());
  const [zuordnung, setZuordnung] = useState<Record<string, string>>({});

  const offen = eingang.filter((e) => !erledigt.has(e.id));
  const liste = useMemo(
    () =>
      offen.filter((e) =>
        filter === "Alle" ? true : filter === "Unklar" ? !e.sicher : e.quelle === filter
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [erledigt, filter]
  );
  const [idx, setIdx] = useState(0);
  useEffect(() => { if (idx > liste.length - 1) setIdx(Math.max(0, liste.length - 1)); }, [liste.length, idx]);
  const d = liste[idx];
  const akteId = d ? zuordnung[d.id] ?? d.akteId : null;
  const akte = akten.find((a) => a.id === akteId);

  const bestaetigen = useCallback(() => {
    if (!d) return;
    if (!akteId) { zeige("Bitte zuerst eine Akte wählen"); return; }
    erledigen([d.id]);
    zeige(`${d.typ} → ${akteId} abgelegt · ${d.folgeaktionen.length} Folgeaktionen vorbereitet`);
  }, [d, akteId, erledigen, zeige]);
  useListKeys(liste.length, idx, setIdx, bestaetigen);

  const toggle = (id: string) =>
    setAuswahl((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const sammelBestaetigen = () => {
    const ids = Array.from(auswahl).filter((id) => {
      const e = eingang.find((x) => x.id === id)!;
      return e.sicher || zuordnung[id];
    });
    erledigen(ids);
    setAuswahl(new Set());
    zeige(`${ids.length} Dokumente bestätigt`);
  };

  return (
    <>
      <div className="head">
        <div>
          <h1>Eingang</h1>
          <div className="lab" style={{ fontSize: 13, marginTop: 2 }}>
            {offen.length} neu · {offen.filter((e) => e.sicher).length} sicher zugeordnet · {offen.filter((e) => !e.sicher).length} brauchen dich
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {quellen.map((q) => (
            <span key={q} className={"chip" + (filter === q ? " on" : "")} onClick={() => { setFilter(q); setIdx(0); }}>
              {q === "Alle" ? "Alle" : q === "Unklar" ? "Unklar" : q === "MAIL" ? "Mail" : q === "SCAN" ? "Scan" : q === "PORTAL" ? "Portal" : q}
            </span>
          ))}
        </div>
      </div>
      <div className="main">
        <div style={{ width: 500, borderRight: "1px solid var(--line)", display: "flex", flexDirection: "column", overflow: "auto" }}>
          {auswahl.size > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", borderBottom: "1px solid var(--line)", background: "var(--akzent-bg)", fontSize: 12 }}>
              <b>{auswahl.size} ausgewählt</b>
              <div style={{ flex: 1 }} />
              <button className="btn" onClick={() => zeige("Umbenannt nach Schema")}>Umbenennen</button>
              <button className="btn pri" onClick={sammelBestaetigen}>Alle bestätigen</button>
            </div>
          )}
          {liste.length === 0 && <div className="empty">Eingang leer.</div>}
          {liste.map((e, i) => (
            <div
              key={e.id}
              className={"row" + (i === idx ? " sel" : "")}
              style={{ gridTemplateColumns: "16px 56px 1fr 70px", padding: "11px 16px", alignItems: "start" }}
              onClick={() => setIdx(i)}
            >
              <span className={"cb" + (auswahl.has(e.id) ? " on" : "")} onClick={(ev) => { ev.stopPropagation(); toggle(e.id); }}>{auswahl.has(e.id) ? "✓" : ""}</span>
              <span className="mono" style={{ fontSize: 10, textAlign: "center", border: "1px solid #d5d8dc", borderRadius: 3, color: e.quelle === "beA" ? "var(--akzent)" : "#3a3f47" }}>{e.quelle}</span>
              <div>
                <div style={{ fontWeight: 500 }}>{e.typ}</div>
                <div className="lab" style={{ fontSize: 12 }}>
                  {e.absender} → {e.akteId ? <span className="mono">{e.akteId}</span> : <span style={{ color: "#B5620A" }}>Akte unklar</span>}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div className="lab mono">{e.zeit}</div>
                <div style={{ fontSize: 11, color: e.sicher ? "var(--gruen)" : "#B5620A" }}>{e.sicher ? "sicher" : "unklar"}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ flex: 1, background: "#eceef1", padding: 20, display: "flex", justifyContent: "center", overflow: "auto" }}>
          {d && (
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
                <select
                  value={akteId ?? ""}
                  onChange={(e) => setZuordnung({ ...zuordnung, [d.id]: e.target.value })}
                  style={{ font: "inherit", fontSize: 13, padding: "3px 6px", border: "1px solid #d5d8dc", borderRadius: 4, background: akteId ? "#fff" : "var(--hl2)" }}
                >
                  <option value="">– Akte wählen –</option>
                  {akten.map((a) => <option key={a.id} value={a.id}>{a.id} {a.titel}</option>)}
                  {d.akteId && !akten.find((a) => a.id === d.akteId) && <option value={d.akteId}>{d.akteId}</option>}
                </select>
                <span />
              </div>
              <div className="fr"><span className="lab">Dokumenttyp</span><span>{d.typ}</span><span /></div>
              <div className="fr"><span className="lab">Dateiname</span><span className="mono" style={{ fontSize: 12 }}>{d.dateiname}</span><span /></div>
              {d.felder.map((f) => (
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
                {d.folgeaktionen.map((f) => <div key={f} style={{ display: "flex", gap: 8 }}><span className="cb on">✓</span>{f}</div>)}
              </div>
            </div>
            {akte && <div className="lab">Akte: {akte.titel} · {akte.phase}</div>}
            <div style={{ flex: 1 }} />
            <div style={{ display: "flex", gap: 6 }}>
              <button className="btn pri" style={{ padding: "8px 16px", fontSize: 13 }} onClick={bestaetigen}>Bestätigen ↵</button>
              <button className="btn" style={{ padding: "8px 12px", fontSize: 13 }} onClick={() => { erledigen([d.id]); zeige("Verworfen"); }}>Verwerfen</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
