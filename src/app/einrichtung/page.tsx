"use client";
import { useEffect, useState } from "react";

const SCHRITTE = ["Kanzlei", "Mitarbeiter", "KI", "Mail", "Datensicherung", "Fertig"];
type K = { name: string; zusatz: string; strasse: string; ort: string; telefon: string; email: string; web: string; bank: string; akzent: string; signatur: string };

async function senden(url: string, method: string, body: object) {
  const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.fehler ?? "Fehler");
  return j;
}

export default function Einrichtung() {
  const [schritt, setSchritt] = useState(0);
  const [fehler, setFehler] = useState("");
  const [k, setK] = useState<K | null>(null);
  const [mit, setMit] = useState<{ name: string; kuerzel: string; login: string; passwort: string; rolle: string }[]>([]);
  const [neu, setNeu] = useState({ name: "", kuerzel: "", login: "", passwort: "", rolle: "refa" });
  const [ki, setKi] = useState({ aktiv: true, modell: "qwen2.5:7b", ocr: false });
  const [kiStatus, setKiStatus] = useState("");
  const [mail, setMail] = useState({ host: "", port: 993, benutzer: "", passwort: "" });
  const [sich, setSich] = useState({ ordner: "", passwort: "", passwort2: "" });
  const [beispiel, setBeispiel] = useState(true);
  const [akten, setAkten] = useState(0);

  useEffect(() => {
    fetch("/api/kanzlei").then((r) => r.json()).then(setK);
    fetch("/api/sicherung").then((r) => r.json()).then((s) => setSich((x) => ({ ...x, ordner: s.ordner ?? "" })));
    fetch("/api/einrichtung").then((r) => r.json()).then((s) => setAkten(s.akten));
  }, []);

  const fertig = async (wie: "abgeschlossen" | "übersprungen", loeschen = false) => {
    await senden("/api/einrichtung", "POST", { wie, beispieldatenLoeschen: loeschen });
    window.location.href = "/";
  };
  const weiter = async () => {
    setFehler("");
    try {
      if (schritt === 0 && k) await senden("/api/kanzlei", "PUT", k);
      if (schritt === 2) {
        await senden("/api/ki/einstellungen", "PUT", { aktiv: ki.aktiv, modell: ki.modell, ocr: ki.ocr });
      }
      if (schritt === 3 && mail.host) await senden("/api/mail/konto", "PUT", { ...mail, aktiv: true });
      if (schritt === 4 && sich.passwort) {
        if (sich.passwort !== sich.passwort2) throw new Error("Passwörter stimmen nicht überein");
        await senden("/api/sicherung", "PUT", { aktiv: true, ordner: sich.ordner, passwort: sich.passwort });
      }
      setSchritt((s) => s + 1);
    } catch (x) { setFehler((x as Error).message); }
  };
  const mitarbeiterAnlegen = async () => {
    setFehler("");
    try { await senden("/api/benutzer", "POST", neu); setMit([...mit, neu]); setNeu({ name: "", kuerzel: "", login: "", passwort: "", rolle: "refa" }); }
    catch (x) { setFehler((x as Error).message); }
  };
  const kiPruefen = async () => {
    await senden("/api/ki/einstellungen", "PUT", { aktiv: ki.aktiv, modell: ki.modell, ocr: ki.ocr }).catch(() => {});
    const s = await fetch("/api/ki/status").then((r) => r.json());
    setKiStatus(s.ok ? `✓ bereit (${ki.modell})` : `✗ ${s.fehler}`);
  };

  const feld = (wert: string, set: (v: string) => void, label: string, typ = "text", breit = false) => (
    <label style={{ gridColumn: breit ? "span 2" : undefined }}><div className="lab">{label}</div>
      <input className="feld" type={typ} autoComplete="off" style={{ width: "100%" }} value={wert} onChange={(e) => set(e.target.value)} /></label>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#f5f6f8", display: "flex", justifyContent: "center", alignItems: "flex-start", padding: "6vh 16px", overflow: "auto" }}>
      <div style={{ width: 760, maxWidth: "100%", display: "grid", gridTemplateColumns: "200px 1fr", background: "#fff", border: "1px solid var(--line)", borderRadius: 10, overflow: "hidden" }}>
        <div style={{ background: "var(--bg3)", borderRight: "1px solid var(--line)", padding: "20px 16px" }}>
          <div style={{ fontWeight: 600, fontSize: 17, marginBottom: 14 }}>Einrichtung</div>
          {SCHRITTE.map((s, i) => (
            <div key={s} onClick={() => i < schritt && setSchritt(i)} style={{ display: "flex", gap: 8, alignItems: "center", padding: "6px 0", fontSize: 15, color: i === schritt ? "#16191d" : i < schritt ? "#1d7a43" : "var(--muted)", fontWeight: i === schritt ? 600 : 400, cursor: i < schritt ? "pointer" : "default" }}>
              <span style={{ width: 20 }}>{i < schritt ? "✓" : i === schritt ? "●" : i + 1}</span>{s}
            </div>
          ))}
          <div style={{ marginTop: 24 }}>
            <button className="btn" style={{ width: "100%" }} onClick={() => fertig("übersprungen")} title="Später unter Einstellungen nachholen">Einrichtung überspringen</button>
            <div className="lab" style={{ marginTop: 6 }}>Alles lässt sich später unter Einstellungen ändern.</div>
          </div>
        </div>

        <div style={{ padding: "22px 26px", display: "flex", flexDirection: "column", gap: 14, minHeight: 440 }}>
          {schritt === 0 && k && (<>
            <div><h2 style={{ margin: 0, fontSize: 21 }}>Kanzlei</h2><div className="lab">Für Briefkopf, Kostennoten und Mandantenportal</div></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {feld(k.name, (v) => setK({ ...k, name: v }), "Name der Kanzlei", "text", true)}
              {feld(k.zusatz, (v) => setK({ ...k, zusatz: v }), "Zusatz (z. B. Rechtsanwälte · Verkehrsrecht)", "text", true)}
              {feld(k.strasse, (v) => setK({ ...k, strasse: v }), "Straße")}
              {feld(k.ort, (v) => setK({ ...k, ort: v }), "PLZ Ort")}
              {feld(k.telefon, (v) => setK({ ...k, telefon: v }), "Telefon")}
              {feld(k.email, (v) => setK({ ...k, email: v }), "E-Mail")}
              {feld(k.bank, (v) => setK({ ...k, bank: v }), "Bankverbindung (IBAN)", "text", true)}
            </div>
            <div className="lab">Logo und Signatur: später unter Einstellungen.</div>
          </>)}

          {schritt === 1 && (<>
            <div><h2 style={{ margin: 0, fontSize: 21 }}>Mitarbeiter</h2><div className="lab">Jede Person bekommt ein eigenes Konto – das Protokoll zeigt, wer was getan hat.</div></div>
            {mit.map((m) => <div key={m.login} style={{ fontSize: 15 }}>✓ {m.name} ({m.kuerzel.toUpperCase()}) · {m.rolle}</div>)}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {feld(neu.name, (v) => setNeu({ ...neu, name: v }), "Name")}
              {feld(neu.kuerzel, (v) => setNeu({ ...neu, kuerzel: v }), "Kürzel")}
              {feld(neu.login, (v) => setNeu({ ...neu, login: v }), "Benutzername")}
              {feld(neu.passwort, (v) => setNeu({ ...neu, passwort: v }), "Erstes Passwort (mind. 10 Zeichen)", "password")}
              <label><div className="lab">Rolle</div>
                <select className="feld" style={{ width: "100%" }} value={neu.rolle} onChange={(e) => setNeu({ ...neu, rolle: e.target.value })}>
                  <option value="refa">ReFa</option><option value="anwalt">Anwalt</option><option value="admin">Admin</option>
                </select></label>
              <div style={{ alignSelf: "end" }}><button className="btn" disabled={!neu.name || !neu.login || !neu.passwort} onClick={mitarbeiterAnlegen}>+ Hinzufügen</button></div>
            </div>
          </>)}

          {schritt === 2 && (<>
            <div><h2 style={{ margin: 0, fontSize: 21 }}>KI (lokal)</h2><div className="lab">Läuft über Ollama auf diesem PC – keine Daten ins Internet. Namen und Kontaktdaten werden vorher ersetzt.</div></div>
            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 15 }}><input type="checkbox" checked={ki.aktiv} onChange={(e) => setKi({ ...ki, aktiv: e.target.checked })} /> KI verwenden</label>
            <label><div className="lab">Modell</div>
              <select className="feld" value={ki.modell} onChange={(e) => setKi({ ...ki, modell: e.target.value })}>
                <option value="qwen2.5:7b">qwen2.5:7b – ab 8 GB RAM</option><option value="qwen2.5:14b">qwen2.5:14b – ab 16 GB RAM, genauer</option>
              </select></label>
            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 15 }}><input type="checkbox" checked={ki.ocr} onChange={(e) => setKi({ ...ki, ocr: e.target.checked })} /> Gescannte PDFs lesen (Texterkennung, qwen2.5vl:7b)</label>
            <div style={{ fontSize: 14, background: "var(--bg3)", borderRadius: 6, padding: "10px 12px", lineHeight: 1.6 }}>
              Einmalig in PowerShell: <span className="mono">ollama pull {ki.modell}</span>{ki.ocr && <> und <span className="mono">ollama pull qwen2.5vl:7b</span></>}
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}><button className="btn" onClick={kiPruefen}>Verbindung prüfen</button><span style={{ fontSize: 14.5 }}>{kiStatus}</span></div>
          </>)}

          {schritt === 3 && (<>
            <div><h2 style={{ margin: 0, fontSize: 21 }}>Mail</h2><div className="lab">Optional. Ohne Konto lassen sich Mails aus Outlook einfach in den Mailbereich ziehen.</div></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {feld(mail.host, (v) => setMail({ ...mail, host: v }), "IMAP-Server (z. B. imap.ionos.de)")}
              {feld(String(mail.port), (v) => setMail({ ...mail, port: Number(v) || 993 }), "Port")}
              {feld(mail.benutzer, (v) => setMail({ ...mail, benutzer: v }), "Benutzer / E-Mail")}
              {feld(mail.passwort, (v) => setMail({ ...mail, passwort: v }), "Passwort", "password")}
            </div>
            <div className="lab">Microsoft 365 / Outlook-Anbindung folgt.</div>
          </>)}

          {schritt === 4 && (<>
            <div><h2 style={{ margin: 0, fontSize: 21 }}>Datensicherung</h2><div className="lab">Täglich automatisch, verschlüsselt. Am besten auf ein anderes Laufwerk, NAS oder USB-Stick.</div></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {feld(sich.ordner, (v) => setSich({ ...sich, ordner: v }), "Zielordner", "text", true)}
              {feld(sich.passwort, (v) => setSich({ ...sich, passwort: v }), "Sicherungs-Passwort (mind. 10 Zeichen)", "password")}
              {feld(sich.passwort2, (v) => setSich({ ...sich, passwort2: v }), "Wiederholen", "password")}
            </div>
            <div style={{ fontSize: 14, color: "#B5620A" }}>Passwort sicher aufbewahren (z. B. ausgedruckt im Tresor) – ohne es lässt sich keine Sicherung öffnen.</div>
          </>)}

          {schritt === 5 && (<>
            <div><h2 style={{ margin: 0, fontSize: 21 }}>Fertig</h2><div className="lab">Die Kanzlei ist eingerichtet.</div></div>
            {akten > 0 && (
              <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 15, lineHeight: 1.5 }}>
                <input type="checkbox" checked={beispiel} onChange={(e) => setBeispiel(e.target.checked)} style={{ marginTop: 4 }} />
                <span>Beispielakten entfernen ({akten} Akten mit Testdaten) und mit leerer Kanzlei starten</span>
              </label>
            )}
            <div style={{ fontSize: 14.5, lineHeight: 1.7 }}>
              Tipps: <span className="k">F3</span> Fallaufnahme · <span className="k">F4</span> Eingang · <span className="k">F5</span> Mein Tag · <span className="k">F6</span> Fristen · <span className="k">F2</span> Suche
            </div>
          </>)}

          <div style={{ flex: 1 }} />
          {fehler && <div style={{ color: "#c0392b", fontSize: 14.5 }}>{fehler}</div>}
          <div style={{ display: "flex", gap: 8 }}>
            {schritt > 0 && <button className="btn" onClick={() => setSchritt(schritt - 1)}>Zurück</button>}
            <div style={{ flex: 1 }} />
            {schritt < 5 && schritt > 0 && <button className="btn" onClick={() => { setFehler(""); setSchritt(schritt + 1); }}>Schritt überspringen</button>}
            {schritt < 5 ? <button className="btn pri" onClick={weiter}>Weiter</button>
              : <button className="btn pri" onClick={() => fertig("abgeschlossen", akten > 0 && beispiel)}>Los geht&apos;s</button>}
          </div>
        </div>
      </div>
    </div>
  );
}
