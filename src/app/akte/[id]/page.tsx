"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { akten, euro, prioFarbe } from "@/lib/data";

export default function AktePage() {
  const { id } = useParams<{ id: string }>();
  const a = akten.find((x) => x.id === decodeURIComponent(id));
  if (!a) return <div className="empty">Akte nicht gefunden. <Link href="/">Zurück</Link></div>;
  const summe = (k: "gefordert" | "gezahlt") => a.konto.reduce((s, p) => s + p[k], 0);

  return (
    <div style={{ padding: "16px 24px", display: "flex", flexDirection: "column", gap: 16, overflow: "auto" }}>
      <Link href="/" className="lab" style={{ textDecoration: "none" }}>← Mein Tag</Link>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span className="dot" style={{ background: prioFarbe[a.prioritaet] }} />
        <span style={{ fontSize: 19, fontWeight: 600 }}>{a.titel}</span>
        <span className="k">{a.gebiet}</span>
        <span className="lab mono">Az. {a.id}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr 1fr 1fr", border: "1px solid var(--line)", borderRadius: 4 }}>
        <div style={{ padding: "10px 14px", borderRight: "1px solid var(--line)" }}><div className="lab">Mandant</div><div style={{ fontWeight: 500 }}>{a.mandant}</div><div className="mono" style={{ fontSize: 12 }}>{a.mandantTel}</div></div>
        <div style={{ padding: "10px 14px", borderRight: "1px solid var(--line)", background: "var(--akzent-bg)" }}><div className="lab">{a.versicherung} · {a.sachbearbeiter}</div><div className="mono" style={{ fontWeight: 600 }}>{a.durchwahl}</div><div className="mono" style={{ fontSize: 12 }}>Schaden-Nr. {a.schadennummer}</div></div>
        <div style={{ padding: "10px 14px", borderRight: "1px solid var(--line)" }}><div className="lab">Phase</div><div style={{ color: "var(--akzent)", fontWeight: 500 }}>{a.phase}</div></div>
        <div style={{ padding: "10px 14px" }}><div className="lab">Offen</div><div className="mono" style={{ fontSize: 18, fontWeight: 600, color: "var(--rot)" }}>{euro(summe("gefordert") - summe("gezahlt"))}</div></div>
      </div>
      <div style={{ border: "1px solid var(--line)", borderRadius: 4, padding: "10px 14px", background: "var(--bg3)" }}>
        <div className="th" style={{ color: "var(--akzent)" }}>Stand · KI-Zusammenfassung</div>
        <div style={{ marginTop: 4, lineHeight: 1.5 }}>{a.stand}</div>
      </div>
      {a.konto.length > 0 && (
        <div style={{ maxWidth: 560 }}>
          <div className="th">Aktenkonto</div>
          <table className="t">
            <tbody>
              <tr className="lab"><td>Position</td><td className="num">Gefordert</td><td className="num">Gezahlt</td><td className="num">Offen</td></tr>
              {a.konto.map((p) => (
                <tr key={p.position}><td>{p.position}</td><td className="num">{euro(p.gefordert)}</td><td className="num">{euro(p.gezahlt)}</td><td className="num" style={{ color: p.gefordert > p.gezahlt ? "var(--rot)" : undefined }}>{euro(p.gefordert - p.gezahlt)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="lab">Prototyp – vollständige Aktenansicht folgt.</div>
    </div>
  );
}
