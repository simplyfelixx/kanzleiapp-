"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { akten, vorgaenge, prioFarbe, prioLabel, Vorgang } from "@/lib/data";
import { useStore } from "@/components/Store";
import { useListKeys } from "@/components/useListKeys";

const reihenfolge = ["heute", "woche", "pruefen", "wartet", "laeuft"];

export default function MeinTag() {
  const { erledigt, erledigen, gebiet, zeige } = useStore();
  const liste = useMemo(
    () =>
      vorgaenge
        .filter((v) => !erledigt.has(v.id))
        .filter((v) => gebiet === "Alle" || akten.find((a) => a.id === v.akteId)?.gebiet === gebiet)
        .sort((a, b) => reihenfolge.indexOf(a.prioritaet) - reihenfolge.indexOf(b.prioritaet)),
    [erledigt, gebiet]
  );
  const [idx, setIdx] = useState(0);
  useEffect(() => { if (idx > liste.length - 1) setIdx(Math.max(0, liste.length - 1)); }, [liste.length, idx]);
  const v: Vorgang | undefined = liste[idx];
  const akte = v && akten.find((a) => a.id === v.akteId);
  const [entwurf, setEntwurf] = useState("");
  useEffect(() => setEntwurf(v?.entwurf ?? ""), [v?.id, v?.entwurf]);

  const bestaetigen = useCallback(() => {
    if (!v) return;
    erledigen([v.id]);
    zeige(`Bestätigt: ${akte?.titel} – ${v.aktion}`);
  }, [v, akte, erledigen, zeige]);
  useListKeys(liste.length, idx, setIdx, bestaetigen);

  const zaehle = (p: string) => liste.filter((x) => x.prioritaet === p).length;

  return (
    <>
      <div className="head">
        <div>
          <h1>Mein Tag</h1>
          <div className="lab" style={{ fontSize: 13, marginTop: 2 }}>{liste.length} Vorgänge offen · ↑ ↓ wählen · Enter bestätigen</div>
        </div>
        <div style={{ display: "flex", gap: 24, fontSize: 13 }}>
          <div><span className="mono" style={{ fontSize: 20, color: "var(--rot)" }}>{zaehle("heute")}</span> heute</div>
          <div><span className="mono" style={{ fontSize: 20, color: "#B5620A" }}>{zaehle("woche")}</span> diese Woche</div>
          <div><span className="mono" style={{ fontSize: 20 }}>{zaehle("pruefen")}</span> zu prüfen</div>
          <div><span className="mono" style={{ fontSize: 20, color: "var(--gruen)" }}>{erledigt.size}</span> erledigt</div>
        </div>
      </div>
      <div className="main">
        <div style={{ flex: 1, minWidth: 0, paddingLeft: 24, overflow: "auto" }}>
          {liste.length === 0 && <div className="empty">Alles erledigt. Neue Vorgänge erscheinen hier automatisch.</div>}
          {liste.map((x, i) => {
            const a = akten.find((k) => k.id === x.akteId)!;
            return (
              <div
                key={x.id}
                className={"row" + (i === idx ? " sel" : "")}
                style={{ gridTemplateColumns: "4px 80px 210px 1fr", padding: "11px 20px 11px 0" }}
                onClick={() => setIdx(i)}
              >
                <span style={{ alignSelf: "stretch", background: prioFarbe[x.prioritaet] }} />
                <span style={{ fontSize: 11, fontWeight: 600, color: prioFarbe[x.prioritaet] }}>{prioLabel[x.prioritaet]}</span>
                <span><span className="mono lab">{a.id}</span> <b style={{ fontWeight: 500 }}>{a.titel}</b></span>
                <span>{x.titel}</span>
              </div>
            );
          })}
        </div>
        {v && akte && (
          <div className="side" style={{ width: 500 }}>
            <div style={{ display: "flex", alignItems: "center" }}>
              <span className="th">Vorschau · {akte.titel}</span>
              <div style={{ flex: 1 }} />
              <Link href={`/akte/${encodeURIComponent(akte.id)}`} className="btn" style={{ textDecoration: "none" }}>Akte öffnen →</Link>
            </div>
            <div style={{ fontSize: 14, lineHeight: 1.5 }}>{v.zusammenfassung}</div>
            <div>
              {v.felder.map((f) => (
                <div className="fr" key={f.label}>
                  <span className="lab">{f.label}</span>
                  <span style={{ justifySelf: "start", background: f.unsicher ? "var(--hl2)" : "var(--hl)", padding: "0 3px" }}>
                    {f.wert}{f.unsicher && " · unsicher"}
                  </span>
                  <span className="q" title={`Quelle: ${f.quelle}`} onClick={() => zeige(`Quelle: ${f.quelle}`)}>?</span>
                </div>
              ))}
            </div>
            {v.entwurf !== undefined && (
              <textarea className="draft" value={entwurf} onChange={(e) => setEntwurf(e.target.value)} />
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn pri" style={{ padding: "8px 16px", fontSize: 13 }} onClick={bestaetigen}>{v.aktion} ↵</button>
              <button className="btn" style={{ padding: "8px 14px", fontSize: 13 }} onClick={() => { erledigen([v.id]); zeige("Verworfen"); }}>Verwerfen</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
