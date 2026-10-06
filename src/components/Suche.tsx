"use client";
// Suchfenster (F2 oder Klick auf „Suchen“): tippen, Pfeiltasten, Enter.
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type T = { art: string; titel: string; info: string; link: string };

export default function Suche({ offen, schliessen }: { offen: boolean; schliessen: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [treffer, setTreffer] = useState<T[]>([]);
  const [aktiv, setAktiv] = useState(0);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (offen) { setQ(""); setTreffer([]); setTimeout(() => ref.current?.focus(), 0); } }, [offen]);
  useEffect(() => {
    if (q.trim().length < 2) return setTreffer([]);
    const t = setTimeout(() => fetch("/api/suche?q=" + encodeURIComponent(q)).then((r) => r.json()).then((x) => { setTreffer(x); setAktiv(0); }), 150);
    return () => clearTimeout(t);
  }, [q]);
  if (!offen) return null;
  const gehe = (x: T) => { schliessen(); router.push(x.link); };
  return (
    <div onMouseDown={schliessen} style={{ position: "fixed", inset: 0, background: "rgba(22,25,29,.35)", zIndex: 100, display: "flex", justifyContent: "center", paddingTop: "12vh" }}>
      <div onMouseDown={(e) => e.stopPropagation()} style={{ width: 640, maxWidth: "92vw", background: "#fff", borderRadius: 8, boxShadow: "0 16px 48px rgba(0,0,0,.25)", overflow: "hidden", alignSelf: "flex-start" }}>
        <input ref={ref} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Akte, Name, Schaden-Nr., Kennzeichen, Dokument, Mail …"
          onKeyDown={(e) => {
            if (e.key === "Escape") schliessen();
            else if (e.key === "ArrowDown") { e.preventDefault(); setAktiv((a) => Math.min(a + 1, treffer.length - 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setAktiv((a) => Math.max(a - 1, 0)); }
            else if (e.key === "Enter" && treffer[aktiv]) gehe(treffer[aktiv]);
          }}
          style={{ width: "100%", border: 0, borderBottom: "1px solid var(--line)", padding: "16px 18px", fontSize: 18, outline: "none", fontFamily: "inherit" }} />
        <div style={{ maxHeight: "55vh", overflowY: "auto" }}>
          {q.trim().length >= 2 && treffer.length === 0 && <div className="lab" style={{ padding: "14px 18px" }}>Nichts gefunden</div>}
          {treffer.map((x, i) => (
            <div key={i} onMouseEnter={() => setAktiv(i)} onMouseDown={() => gehe(x)}
              style={{ display: "flex", gap: 12, alignItems: "baseline", padding: "9px 18px", cursor: "pointer", background: i === aktiv ? "var(--sel)" : undefined }}>
              <span className="k" style={{ flex: "none", minWidth: 84, textAlign: "center" }}>{x.art}</span>
              <span style={{ fontSize: 15.5, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{x.titel}</span>
              <span className="lab" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{x.info}</span>
            </div>
          ))}
        </div>
        <div className="lab" style={{ padding: "8px 18px", borderTop: "1px solid var(--line2)", background: "var(--bg3)" }}>↑ ↓ wählen · Enter öffnen · Esc schließen</div>
      </div>
    </div>
  );
}
