"use client";
import { useEffect, useState } from "react";

export default function Login() {
  const [einrichtung, setEinrichtung] = useState<boolean | null>(null);
  const [f, setF] = useState({ name: "", kuerzel: "", login: "", passwort: "", passwort2: "" });
  const [fehler, setFehler] = useState("");
  const [laeuft, setLaeuft] = useState(false);
  useEffect(() => { fetch("/api/auth/login").then((r) => r.json()).then((d) => setEinrichtung(!!d.einrichtung)); }, []);

  const weiter = () => {
    const w = new URLSearchParams(window.location.search).get("weiter") || "/";
    window.location.href = w.startsWith("/") && !w.startsWith("//") ? w : "/";
  };
  const senden = async (e: React.FormEvent) => {
    e.preventDefault(); setFehler("");
    if (einrichtung && f.passwort !== f.passwort2) return setFehler("Passwörter stimmen nicht überein");
    setLaeuft(true);
    const r = await fetch(einrichtung ? "/api/auth/einrichten" : "/api/auth/login", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f),
    });
    const j = await r.json().catch(() => ({}));
    setLaeuft(false);
    if (!r.ok) return setFehler(j.fehler || "Anmeldung fehlgeschlagen");
    if (einrichtung) { window.location.href = "/einrichtung"; return; } // nach dem ersten Admin: Einrichtungsassistent
    weiter();
  };
  const feld = (k: keyof typeof f, label: string, typ = "text", auto = "off") => (
    <label style={{ display: "block", marginBottom: 10 }}>
      <div className="lab">{label}</div>
      <input className="feld" style={{ width: "100%" }} type={typ} autoComplete={auto} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
    </label>
  );
  if (einrichtung === null) return <div className="empty">Lade …</div>;

  return (
    <div style={{ display: "flex", justifyContent: "center", paddingTop: "12vh" }}>
      <form onSubmit={senden} style={{ width: 340, background: "#fff", border: "1px solid #d5d8dc", borderRadius: 6, padding: 24 }}>
        <h1 style={{ fontSize: 19, margin: "0 0 4px" }}>{einrichtung ? "Ersten Admin anlegen" : "Anmelden"}</h1>
        <div className="lab" style={{ marginBottom: 16 }}>{einrichtung ? "Noch kein Benutzer vorhanden. Dieses Konto verwaltet später alle weiteren." : "Kanzlei Nord"}</div>
        {einrichtung && feld("name", "Name")}
        {einrichtung && feld("kuerzel", "Kürzel (z. B. FK)")}
        {feld("login", "Benutzername", "text", "username")}
        {feld("passwort", einrichtung ? "Passwort (mind. 10 Zeichen)" : "Passwort", "password", einrichtung ? "new-password" : "current-password")}
        {einrichtung && feld("passwort2", "Passwort wiederholen", "password", "new-password")}
        {fehler && <div style={{ color: "#c0392b", fontSize: 14.5, marginBottom: 10 }}>{fehler}</div>}
        <button className="btn pri" style={{ width: "100%" }} disabled={laeuft}>{laeuft ? "…" : einrichtung ? "Anlegen und anmelden" : "Anmelden"}</button>
      </form>
    </div>
  );
}
