"use client";
import { useEffect, useState } from "react";
import { useStore } from "@/components/Store";

export type Entwurf = { an?: string; cc?: string; betreff?: string; text?: string; akteId?: string | null; antwortAuf?: number | null };
type AkteKurz = { id: string; titel: string };
type Akte = { beteiligte: { rolle: string; name: string; email: string }[]; dokumente: { id: number; name: string; datum: string }[] };

/** Mail verfassen. Gesendet wird nur per Klick auf „Senden“ (nach Rückfrage). */
export default function MailVerfassen({ start, akten, fertig, abbrechen }: { start: Entwurf; akten: AkteKurz[]; fertig: (id: number) => void; abbrechen: () => void }) {
  const { zeige } = useStore();
  const [e, setE] = useState({ an: "", cc: "", betreff: "", text: "", akteId: "", ...start, akteIdS: start.akteId ?? "" });
  const [akte, setAkte] = useState<Akte | null>(null);
  const [doks, setDoks] = useState<number[]>([]);
  const [laeuft, setLaeuft] = useState(false);
  const set = (k: string, v: string) => setE((x) => ({ ...x, [k]: v }));

  useEffect(() => {
    setAkte(null); setDoks([]);
    if (!e.akteIdS) return;
    fetch(`/api/akten/${encodeURIComponent(e.akteIdS)}`).then((r) => (r.ok ? r.json() : null)).then(setAkte);
  }, [e.akteIdS]);

  const senden = async () => {
    if (!confirm(`Mail jetzt an ${e.an} senden?${doks.length ? `\n${doks.length} Anhang/Anhänge` : ""}`)) return;
    setLaeuft(true);
    const r = await fetch("/api/mail/senden", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ an: e.an, cc: e.cc, betreff: e.betreff, text: e.text, akteId: e.akteIdS || null, dokumente: doks, antwortAuf: start.antwortAuf ?? null }) });
    const j = await r.json(); setLaeuft(false);
    if (!r.ok) return zeige(j.fehler);
    zeige("Mail gesendet" + (e.akteIdS ? ` · im Verlauf von ${e.akteIdS}` : "")); fertig(j.id);
  };
  const mitMail = (akte?.beteiligte ?? []).filter((b) => b.email);

  return (
    <div style={{ maxWidth: 900, display: "flex", flexDirection: "column", gap: 10 }}
      onKeyDown={(x) => { if (x.key === "Enter" && x.ctrlKey && !laeuft) senden(); if (x.key === "Escape") abbrechen(); }}>
      <h2 style={{ fontSize: 20, margin: 0, fontWeight: 600 }}>{start.antwortAuf ? "Antworten" : "Neue Mail"}</h2>
      <label style={{ display: "flex", gap: 8, alignItems: "center" }}><span className="lab" style={{ width: 60 }}>Akte</span>
        <select className="feld" value={e.akteIdS} onChange={(x) => set("akteIdS", x.target.value)} style={{ maxWidth: 360 }}>
          <option value="">– keine –</option>{akten.map((k) => <option key={k.id} value={k.id}>{k.id} {k.titel}</option>)}
        </select>
      </label>
      <label style={{ display: "flex", gap: 8, alignItems: "center" }}><span className="lab" style={{ width: 60 }}>An</span>
        <input className="feld" style={{ flex: 1 }} value={e.an} onChange={(x) => set("an", x.target.value)} placeholder="name@beispiel.de, mehrere mit Komma" autoFocus={!e.an} />
      </label>
      {mitMail.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginLeft: 68 }}>
          {mitMail.map((b) => <span key={b.email} className="chip" title={b.email} onClick={() => set("an", e.an.includes(b.email) ? e.an : [e.an, b.email].filter(Boolean).join(", "))}>+ {b.rolle}: {b.name}</span>)}
        </div>
      )}
      <label style={{ display: "flex", gap: 8, alignItems: "center" }}><span className="lab" style={{ width: 60 }}>Cc</span>
        <input className="feld" style={{ flex: 1 }} value={e.cc} onChange={(x) => set("cc", x.target.value)} />
      </label>
      <label style={{ display: "flex", gap: 8, alignItems: "center" }}><span className="lab" style={{ width: 60 }}>Betreff</span>
        <input className="feld" style={{ flex: 1 }} value={e.betreff} onChange={(x) => set("betreff", x.target.value)} />
      </label>
      <textarea className="feld" value={e.text} onChange={(x) => set("text", x.target.value)} autoFocus={!!e.an}
        style={{ width: "100%", minHeight: 280, fontSize: 14.5, lineHeight: 1.6 }} />
      {akte && akte.dokumente.length > 0 && (
        <div>
          <div className="th" style={{ marginBottom: 4 }}>Anhänge aus der Akte</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2, maxHeight: 180, overflow: "auto", border: "1px solid var(--line)", borderRadius: 6, padding: "6px 10px", background: "#fff" }}>
            {akte.dokumente.map((d) => (
              <label key={d.id} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14.5 }}>
                <input type="checkbox" checked={doks.includes(d.id)} onChange={(x) => setDoks(x.target.checked ? [...doks, d.id] : doks.filter((n) => n !== d.id))} />
                <span className="mono" style={{ fontSize: 13.5 }}>{d.name}</span>
              </label>
            ))}
          </div>
        </div>
      )}
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <span className="lab">Signatur wird angehängt · Strg+Enter senden</span>
        <div style={{ flex: 1 }} />
        <button className="btn" onClick={abbrechen}>Verwerfen</button>
        <button className="btn pri" disabled={laeuft || !e.an.trim() || !e.betreff.trim()} onClick={senden}>{laeuft ? "Sende …" : "Senden"}</button>
      </div>
    </div>
  );
}
