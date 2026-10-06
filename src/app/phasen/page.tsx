"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useStore } from "@/components/Store";
import { euro, prioFarbe, type Prioritaet } from "@/lib/data";

type A = { id: string; titel: string; gebiet: string; prioritaet: Prioritaet; phase: string; mandant: string | null; versicherung: string | null; offen: number; stand_naechster: string };

// Spalten des Kanbans; Freitext-Phasen aus älteren Akten werden der passenden Spalte zugeordnet
const SPALTEN: { name: string; hilfe: string; passt: RegExp }[] = [
  { name: "Mandat", hilfe: "Vollmacht, Fragebogen", passt: /^mandat|neu|aufnahme/i },
  { name: "Unterlagen", hilfe: "Gutachten, Rechnungen, Akteneinsicht", passt: /unterlagen|gutachten|akteneinsicht/i },
  { name: "Anspruch", hilfe: "Anspruchsschreiben raus", passt: /anspruch|anschreiben|bezifferung/i },
  { name: "Regulierung", hilfe: "Prüffrist, Kürzungen, Nachforderung", passt: /regulier|kürzung|nachfrist|prüffrist|zahlung|teilzahlung/i },
  { name: "Klage", hilfe: "Gericht, Berufung", passt: /klage|gericht|berufung|verfahren/i },
  { name: "Abschluss", hilfe: "Abrechnen, Auszahlen, Ablage", passt: /abschluss|erledigt|abgerechnet|abgelegt/i },
];
const spalteVon = (phase: string) => SPALTEN.find((s) => s.passt.test(phase))?.name ?? "Mandat";

export default function Phasen() {
  const { imGebiet, gebiete, zeige } = useStore();
  const [akten, setAkten] = useState<A[] | null>(null);
  const [ziehe, setZiehe] = useState<string | null>(null);
  const [ueber, setUeber] = useState<string | null>(null);
  const [suche, setSuche] = useState("");

  const laden = useCallback(() => fetch("/api/akten").then((r) => r.json()).then(setAkten), []);
  useEffect(() => { laden(); }, [laden]);

  const verschieben = async (id: string, spalte: string) => {
    const a = akten?.find((x) => x.id === id);
    if (!a || spalteVon(a.phase) === spalte) return;
    setAkten((l) => l && l.map((x) => (x.id === id ? { ...x, phase: spalte } : x))); // sofort anzeigen
    const r = await fetch(`/api/akten/${encodeURIComponent(id)}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ art: "akte", phase: spalte }) });
    zeige(r.ok ? `${id} → ${spalte}` : "Konnte nicht verschoben werden");
    if (!r.ok) laden();
  };

  const q = suche.trim().toLowerCase();
  const sicht = (akten ?? []).filter((a) => imGebiet(a.gebiet) && (!q || `${a.id} ${a.titel} ${a.mandant ?? ""}`.toLowerCase().includes(q)));
  void gebiete;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div className="head">
        <div><h1>Phasen</h1><div className="lab" style={{ fontSize: 14.5, marginTop: 2 }}>Akten per Ziehen verschieben · {sicht.length} Akten · der Fortschritt im Mandantenportal folgt automatisch</div></div>
        <div style={{ flex: 1 }} />
        <input className="feld" placeholder="Akte oder Mandant …" value={suche} onChange={(e) => setSuche(e.target.value)} style={{ width: 240 }} />
      </div>
      {!akten ? <div className="empty">Lade …</div> : (
        <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: `repeat(${SPALTEN.length}, minmax(220px, 1fr))`, gap: 12, padding: "14px 24px 20px", overflowX: "auto" }}>
          {SPALTEN.map((s) => {
            const karten = sicht.filter((a) => spalteVon(a.phase) === s.name);
            const offen = karten.reduce((x, a) => x + Math.max(0, a.offen), 0);
            return (
              <div key={s.name}
                onDragOver={(e) => { e.preventDefault(); setUeber(s.name); }} onDragLeave={() => setUeber((u) => (u === s.name ? null : u))}
                onDrop={(e) => { e.preventDefault(); setUeber(null); setZiehe(null); const id = e.dataTransfer.getData("text/plain"); if (id) verschieben(id, s.name); }}
                style={{ display: "flex", flexDirection: "column", minHeight: 0, background: ueber === s.name ? "var(--akzent-bg)" : "var(--bg3)", border: `1px ${ueber === s.name ? "dashed var(--akzent)" : "solid var(--line)"}`, borderRadius: 8 }}>
                <div style={{ padding: "10px 12px 8px", borderBottom: "1px solid var(--line)" }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                    <b style={{ fontWeight: 600 }}>{s.name}</b><span className="lab">{karten.length}</span>
                    <div style={{ flex: 1 }} />{offen > 0 && <span className="lab mono">{euro(offen)}</span>}
                  </div>
                  <div className="lab">{s.hilfe}</div>
                </div>
                <div style={{ flex: 1, overflowY: "auto", padding: 8, display: "flex", flexDirection: "column", gap: 8 }}>
                  {karten.map((a) => (
                    <div key={a.id} draggable onDragStart={(e) => { e.dataTransfer.setData("text/plain", a.id); setZiehe(a.id); }} onDragEnd={() => setZiehe(null)}
                      style={{ background: "#fff", border: "1px solid var(--line)", borderLeft: `3px solid ${prioFarbe[a.prioritaet] ?? "var(--grau)"}`, borderRadius: 5, padding: "8px 10px", cursor: "grab", opacity: ziehe === a.id ? 0.4 : 1, boxShadow: "0 1px 2px rgba(0,0,0,.04)" }}>
                      <div style={{ display: "flex", gap: 6, alignItems: "baseline" }}>
                        <Link href={`/akte/${encodeURIComponent(a.id)}`} className="mono" style={{ fontSize: 13.5 }} draggable={false}>{a.id}</Link>
                        <div style={{ flex: 1 }} /><span className="k">{a.gebiet}</span>
                      </div>
                      <div style={{ fontSize: 14.5, fontWeight: 500, margin: "2px 0" }}>{a.mandant ?? a.titel}</div>
                      <div className="lab">{a.versicherung ?? a.titel.split("./.")[1]?.trim() ?? ""}{a.phase !== s.name && <> · {a.phase}</>}</div>
                      {a.stand_naechster && <div style={{ fontSize: 13.5, marginTop: 4, color: "#3a3f47" }}>→ {a.stand_naechster.split(" · ")[0]}</div>}
                      {a.offen > 0 && <div className="mono" style={{ fontSize: 13.5, marginTop: 3, color: "#B5620A" }}>offen {euro(a.offen)}</div>}
                    </div>
                  ))}
                  {karten.length === 0 && <div className="lab" style={{ textAlign: "center", padding: "18px 0" }}>hierher ziehen</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
