"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { prioFarbe, prioLabel, Prioritaet } from "@/lib/data";
import { useStore } from "@/components/Store";
import { useListKeys } from "@/components/useListKeys";

type Feld = { label: string; wert: string; quelle: string; unsicher?: boolean };
type V = { id: number; akte_id: string; akte_titel: string; gebiet: string; prioritaet: Prioritaet; titel: string; zusammenfassung: string; felder: string; entwurf: string | null; aktion: string };
type F = { id: number; akte_id: string; akte_titel: string; gebiet: string; art: "wv" | "frist"; datum: string; titel: string; wer: string; bestaetigt: number; quelle: string };
type Eintrag = { typ: "v"; key: string; prio: Prioritaet; v: V } | { typ: "f"; key: string; prio: Prioritaet; f: F };

const reihenfolge: Prioritaet[] = ["heute", "woche", "pruefen", "wartet", "laeuft"];
const datumDE = (iso: string) => iso.split("-").reverse().join(".");

export default function MeinTag() {
  const { gebiete, imGebiet, zeige } = useStore();
  const [daten, setDaten] = useState<{ heute: string; vorgaenge: V[]; faellig: F[]; erledigt: number } | null>(null);
  const laden = useCallback(() => fetch("/api/meintag").then((r) => r.json()).then(setDaten), []);
  useEffect(() => { laden(); }, [laden]);

  const liste: Eintrag[] = useMemo(() => {
    if (!daten) return [];
    const fPrio = (f: F): Prioritaet => (!f.bestaetigt ? "pruefen" : f.datum <= daten.heute ? "heute" : "woche");
    const alle: Eintrag[] = [
      ...daten.vorgaenge.map((v) => ({ typ: "v" as const, key: "v" + v.id, prio: v.prioritaet, v })),
      ...daten.faellig.map((f) => ({ typ: "f" as const, key: "f" + f.id, prio: fPrio(f), f })),
    ];
    return alle
      .filter((e) => imGebiet(e.typ === "v" ? e.v.gebiet : e.f.gebiet))
      .sort((a, b) => reihenfolge.indexOf(a.prio) - reihenfolge.indexOf(b.prio));
  }, [daten, gebiete]);

  const [idx, setIdx] = useState(0);
  useEffect(() => { if (idx > liste.length - 1) setIdx(Math.max(0, liste.length - 1)); }, [liste.length, idx]);
  const e = liste[idx];
  const [entwurf, setEntwurf] = useState("");
  useEffect(() => setEntwurf(e?.typ === "v" ? e.v.entwurf ?? "" : ""), [e?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  const vorgang = async (aktion: "bestaetigen" | "verwerfen") => {
    if (e?.typ !== "v") return;
    const r = await fetch(`/api/vorgaenge/${e.v.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ aktion, entwurf }) });
    zeige(r.ok ? (aktion === "bestaetigen" ? `Erledigt: ${e.v.akte_titel} – ${e.v.aktion}` : "Verworfen") : "Fehler");
    laden();
  };
  const frist = async (aktion: string, tage?: number) => {
    if (e?.typ !== "f") return;
    const r = await fetch(`/api/fristen/${e.f.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ aktion, tage }) });
    zeige(r.ok ? (aktion === "erledigt" ? "Erledigt" : aktion === "bestaetigen" ? "Frist bestätigt" : `Verschoben um ${tage} Tage`) : "Fehler");
    laden();
  };
  const enter = useCallback(() => {
    if (!e) return;
    if (e.typ === "v") vorgang("bestaetigen");
    else frist(e.f.bestaetigt ? "erledigt" : "bestaetigen");
  }, [e, entwurf]); // eslint-disable-line react-hooks/exhaustive-deps
  useListKeys(liste.length, idx, setIdx, enter);

  const zaehle = (p: Prioritaet) => liste.filter((x) => x.prio === p).length;
  if (!daten) return <div className="empty">Lade …</div>;

  return (
    <>
      <div className="head">
        <div>
          <h1>Mein Tag</h1>
          <div className="lab" style={{ fontSize: 13, marginTop: 2 }}>{liste.length} offen · ↑ ↓ wählen · Enter bestätigen bzw. erledigen</div>
        </div>
        <div style={{ display: "flex", gap: 24, fontSize: 13 }}>
          <div><span className="mono" style={{ fontSize: 20, color: "var(--rot)" }}>{zaehle("heute")}</span> heute</div>
          <div><span className="mono" style={{ fontSize: 20, color: "#B5620A" }}>{zaehle("woche")}</span> diese Woche</div>
          <div><span className="mono" style={{ fontSize: 20 }}>{zaehle("pruefen")}</span> zu prüfen</div>
          <div><span className="mono" style={{ fontSize: 20, color: "var(--gruen)" }}>{daten.erledigt}</span> heute erledigt</div>
        </div>
      </div>
      <div className="main">
        <div style={{ flex: 1, minWidth: 0, paddingLeft: 24, overflow: "auto" }}>
          {liste.length === 0 && <div className="empty">Alles erledigt. Neue Vorgänge und fällige Wiedervorlagen erscheinen hier automatisch.</div>}
          {liste.map((x, i) => (
            <div key={x.key} className={"row" + (i === idx ? " sel" : "")} style={{ gridTemplateColumns: "4px 80px 70px 230px 1fr", padding: "11px 20px 11px 0" }} onClick={() => setIdx(i)}>
              <span style={{ alignSelf: "stretch", background: prioFarbe[x.prio] }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: prioFarbe[x.prio] }}>{prioLabel[x.prio]}</span>
              <span className="k" style={{ justifySelf: "start" }}>{x.typ === "v" ? "Vorgang" : x.f.art === "frist" ? "Frist" : "WV"}</span>
              <span><span className="mono lab">{x.typ === "v" ? x.v.akte_id : x.f.akte_id}</span> <b style={{ fontWeight: 500 }}>{x.typ === "v" ? x.v.akte_titel : x.f.akte_titel}</b></span>
              <span>{x.typ === "v" ? x.v.titel : `${x.f.titel} · ${datumDE(x.f.datum)}`}</span>
            </div>
          ))}
        </div>
        {e && (
          <div className="side" style={{ width: 500 }}>
            <div style={{ display: "flex", alignItems: "center" }}>
              <span className="th">{e.typ === "v" ? "Vorgang" : e.f.art === "frist" ? "Frist" : "Wiedervorlage"} · {e.typ === "v" ? e.v.akte_titel : e.f.akte_titel}</span>
              <div style={{ flex: 1 }} />
              <Link href={`/akte/${encodeURIComponent(e.typ === "v" ? e.v.akte_id : e.f.akte_id)}`} className="btn" style={{ textDecoration: "none" }}>Akte öffnen →</Link>
            </div>
            {e.typ === "v" ? (
              <>
                <div style={{ fontSize: 14, lineHeight: 1.5 }}>{e.v.zusammenfassung}</div>
                <div>
                  {(JSON.parse(e.v.felder || "[]") as Feld[]).map((f) => (
                    <div className="fr" key={f.label}>
                      <span className="lab">{f.label}</span>
                      <span style={{ justifySelf: "start", background: f.unsicher ? "var(--hl2)" : "var(--hl)", padding: "0 3px" }}>{f.wert}{f.unsicher && " · unsicher"}</span>
                      <span className="q" title={`Quelle: ${f.quelle}`} onClick={() => zeige(`Quelle: ${f.quelle}`)}>?</span>
                    </div>
                  ))}
                </div>
                {e.v.entwurf !== null && <textarea className="draft" value={entwurf} onChange={(ev) => setEntwurf(ev.target.value)} />}
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn pri" style={{ padding: "8px 16px", fontSize: 13 }} onClick={() => vorgang("bestaetigen")}>{e.v.aktion} ↵</button>
                  <button className="btn" style={{ padding: "8px 14px", fontSize: 13 }} onClick={() => vorgang("verwerfen")}>Verwerfen</button>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 15, fontWeight: 500 }}>{e.f.titel}</div>
                <div className="fr"><span className="lab">Fällig</span><span className="mono" style={{ color: e.f.datum <= daten.heute ? "var(--rot)" : undefined }}>{datumDE(e.f.datum)}{e.f.datum < daten.heute && " · überfällig"}</span><span /></div>
                <div className="fr"><span className="lab">Zuständig</span><span>{e.f.wer || "–"}</span><span /></div>
                {!e.f.bestaetigt && <div style={{ fontSize: 13, color: "#8a6d00", background: "#fffbea", padding: "8px 10px", borderRadius: 4 }}>Von der KI erkannt ({e.f.quelle}). Gilt erst nach Bestätigung.</div>}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {e.f.bestaetigt
                    ? <button className="btn pri" style={{ padding: "8px 16px", fontSize: 13 }} onClick={() => frist("erledigt")}>Erledigt ↵</button>
                    : <button className="btn pri" style={{ padding: "8px 16px", fontSize: 13 }} onClick={() => frist("bestaetigen")}>Frist bestätigen ↵</button>}
                  <button className="btn" onClick={() => frist("verschieben", 1)}>+1 Tag</button>
                  <button className="btn" onClick={() => frist("verschieben", 7)}>+7 Tage</button>
                  <button className="btn" onClick={() => frist("verschieben", 14)}>+14 Tage</button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}
