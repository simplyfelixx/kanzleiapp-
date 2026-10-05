"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { euro, prioFarbe, Prioritaet } from "@/lib/data";
import { useStore } from "@/components/Store";

type Zeile = { id: string; titel: string; gebiet: string; prioritaet: Prioritaet; phase: string; mandant: string | null; versicherung: string | null; offen: number };
const reihenfolge = ["heute", "woche", "pruefen", "wartet", "laeuft"];

export default function Akten() {
  const router = useRouter();
  const { gebiete, imGebiet, zeige } = useStore();
  const [akten, setAkten] = useState<Zeile[]>([]);
  const [suche, setSuche] = useState("");
  const [neu, setNeu] = useState(false);
  const [form, setForm] = useState({ mandant: "", gegner: "", gebiet: "VR" });

  useEffect(() => { fetch("/api/akten").then((r) => r.json()).then(setAkten); }, []);

  const liste = useMemo(() => {
    const q = suche.toLowerCase();
    return akten
      .filter((a) => imGebiet(a.gebiet))
      .filter((a) => !q || [a.id, a.titel, a.mandant, a.versicherung].some((x) => (x ?? "").toLowerCase().includes(q)))
      .sort((a, b) => reihenfolge.indexOf(a.prioritaet) - reihenfolge.indexOf(b.prioritaet));
  }, [akten, suche, gebiete]);

  const anlegen = async () => {
    const titel = form.gegner ? `${form.mandant} ./. ${form.gegner}` : "";
    const r = await fetch("/api/akten", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ titel, mandant: form.mandant, gebiet: form.gebiet }) });
    const j = await r.json();
    if (!r.ok) return zeige(j.fehler);
    zeige(`Akte ${j.id} angelegt`);
    router.push(`/akte/${encodeURIComponent(j.id)}`);
  };

  return (
    <>
      <div className="head">
        <div>
          <h1>Akten</h1>
          <div className="lab" style={{ fontSize: 13, marginTop: 2 }}>{liste.length} Akten · sortiert nach Priorität</div>
        </div>
        <input autoFocus placeholder="Suchen: Name, Az., Versicherung …" value={suche} onChange={(e) => setSuche(e.target.value)} className="feld" style={{ width: 320 }} />
        <div style={{ flex: 1 }} />
        <button className="btn pri" onClick={() => setNeu(!neu)}>+ Neue Akte</button>
      </div>
      {neu && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "12px 24px", borderBottom: "1px solid var(--line)", background: "var(--akzent-bg)" }}>
          <input className="feld" placeholder="Mandant" value={form.mandant} onChange={(e) => setForm({ ...form, mandant: e.target.value })} />
          <span className="lab">./.</span>
          <input className="feld" placeholder="Gegner / Versicherung" value={form.gegner} onChange={(e) => setForm({ ...form, gegner: e.target.value })} />
          <select className="feld" value={form.gebiet} onChange={(e) => setForm({ ...form, gebiet: e.target.value })}>
            <option value="VR">Verkehr</option><option value="StR">Straf</option><option value="ArbR">Arbeit</option>
          </select>
          <button className="btn pri" onClick={anlegen}>Anlegen</button>
          <span className="lab">oder ausführlich per <Link href="/fallaufnahme">Fallaufnahme (F3)</Link></span>
        </div>
      )}
      <div style={{ flex: 1, overflow: "auto", padding: "0 24px" }}>
        <div className="row lab" style={{ gridTemplateColumns: "4px 80px 1fr 180px 160px 180px 110px", padding: "10px 0", cursor: "default", textTransform: "uppercase", letterSpacing: ".06em" }}>
          <span /><span>Az.</span><span>Akte</span><span>Mandant</span><span>Versicherung</span><span>Phase</span><span style={{ textAlign: "right" }}>Offen</span>
        </div>
        {liste.map((a) => (
          <div key={a.id} className="row" style={{ gridTemplateColumns: "4px 80px 1fr 180px 160px 180px 110px", padding: "11px 0" }} onClick={() => router.push(`/akte/${encodeURIComponent(a.id)}`)}>
            <span style={{ alignSelf: "stretch", background: prioFarbe[a.prioritaet] ?? "var(--grau)" }} />
            <span className="mono">{a.id}</span>
            <span style={{ fontWeight: 500 }}>{a.titel} <span className="k">{a.gebiet}</span></span>
            <span>{a.mandant ?? "–"}</span>
            <span>{a.versicherung ?? "–"}</span>
            <span className="lab" style={{ fontSize: 13 }}>{a.phase}</span>
            <span className="num" style={{ color: a.offen > 0 ? "var(--rot)" : undefined }}>{euro(a.offen)}</span>
          </div>
        ))}
        {liste.length === 0 && <div className="empty">Keine Akten gefunden.</div>}
      </div>
    </>
  );
}
