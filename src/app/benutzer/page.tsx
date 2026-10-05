"use client";
import { useEffect, useState } from "react";
import { useStore } from "@/components/Store";

type B = { id: number; name: string; kuerzel: string; login: string; rolle: string; aktiv: number; letzter_login: string | null };
const ROLLEN = [{ key: "admin", label: "Admin" }, { key: "anwalt", label: "Anwalt" }, { key: "refa", label: "ReFa" }];
const LEER = { name: "", kuerzel: "", login: "", passwort: "", rolle: "refa" };

export default function Benutzer() {
  const { zeige } = useStore();
  const [liste, setListe] = useState<B[]>([]);
  const [neu, setNeu] = useState(LEER);
  useEffect(() => { fetch("/api/benutzer").then((r) => r.json()).then(setListe); }, []);

  const antwort = async (r: Response, ok: string) => {
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { zeige(j.fehler || "Fehler"); return false; }
    setListe(j); zeige(ok); return true;
  };
  const anlegen = async () => {
    const r = await fetch("/api/benutzer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(neu) });
    if (await antwort(r, "Benutzer angelegt")) setNeu(LEER);
  };
  const aendern = async (id: number, d: Record<string, unknown>, ok: string) =>
    antwort(await fetch(`/api/benutzer/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) }), ok);
  const pwNeu = (u: B) => {
    const pw = window.prompt(`Neues Passwort für ${u.name} (mind. 10 Zeichen)`);
    if (pw) aendern(u.id, { passwort: pw }, "Passwort geändert");
  };

  const td: React.CSSProperties = { padding: "6px 8px", borderBottom: "1px solid #eceef0", fontSize: 14.5 };
  return (
    <div className="main" style={{ padding: 20 }}>
      <div className="head"><div><h1>Benutzer</h1><div className="lab" style={{ fontSize: 14.5, marginTop: 2 }}>Konten und Rollen · nur für Admins</div></div></div>
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 12 }}>
        <thead><tr>{["Name", "Kürzel", "Benutzername", "Rolle", "Letzter Login", "Status", ""].map((h) => <th key={h} className="th" style={{ ...td, textAlign: "left" }}>{h}</th>)}</tr></thead>
        <tbody>
          {liste.map((u) => (
            <tr key={u.id} style={{ opacity: u.aktiv ? 1 : 0.5 }}>
              <td style={td}>{u.name}</td>
              <td style={td} className="mono">{u.kuerzel}</td>
              <td style={td}>{u.login}</td>
              <td style={td}>
                <select className="feld" value={u.rolle} onChange={(e) => aendern(u.id, { rolle: e.target.value }, "Rolle geändert")}>
                  {ROLLEN.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
                </select>
              </td>
              <td style={td} className="mono">{u.letzter_login ?? "–"}</td>
              <td style={td}>{u.aktiv ? "aktiv" : "deaktiviert"}</td>
              <td style={{ ...td, whiteSpace: "nowrap" }}>
                <button className="btn" onClick={() => pwNeu(u)}>Passwort</button>{" "}
                <button className="btn" onClick={() => aendern(u.id, { aktiv: !u.aktiv }, u.aktiv ? "Deaktiviert" : "Aktiviert")}>{u.aktiv ? "Deaktivieren" : "Aktivieren"}</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="th" style={{ margin: "24px 0 8px" }}>Neuer Benutzer</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
        {([["name", "Name", 180], ["kuerzel", "Kürzel", 70], ["login", "Benutzername", 140], ["passwort", "Passwort", 160]] as const).map(([k, l, w]) => (
          <label key={k}><div className="lab">{l}</div>
            <input className="feld" style={{ width: w }} type={k === "passwort" ? "password" : "text"} autoComplete="off" value={neu[k]} onChange={(e) => setNeu({ ...neu, [k]: e.target.value })} />
          </label>
        ))}
        <label><div className="lab">Rolle</div>
          <select className="feld" value={neu.rolle} onChange={(e) => setNeu({ ...neu, rolle: e.target.value })}>
            {ROLLEN.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
          </select>
        </label>
        <button className="btn pri" onClick={anlegen}>Anlegen</button>
      </div>
    </div>
  );
}
