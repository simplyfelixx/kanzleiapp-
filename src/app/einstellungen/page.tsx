"use client";
import { useEffect, useState } from "react";
import { useStore } from "@/components/Store";

type Kanzlei = { name: string; zusatz: string; strasse: string; ort: string; telefon: string; email: string; web: string; bank: string; akzent: string; logo: string | null; signatur: string };

function KiEinstellungen() {
  const { zeige } = useStore();
  const [e, setE] = useState<{ aktiv: boolean; url: string; modell: string; ocr: boolean; ocrModell: string } | null>(null);
  const [status, setStatus] = useState<{ ok: boolean; modelle: string[]; fehler?: string } | null>(null);
  const pruefen = () => { setStatus(null); fetch("/api/ki/status").then((r) => r.json()).then(setStatus); };
  useEffect(() => { fetch("/api/ki/einstellungen").then((r) => r.json()).then(setE); pruefen(); }, []);
  if (!e) return null;
  const speichern = async (neu = e) => {
    const r = await fetch("/api/ki/einstellungen", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(neu) });
    const j = await r.json();
    if (!r.ok) return zeige(j.fehler ?? "Fehler");
    setE(j); zeige("KI-Einstellungen gespeichert"); pruefen();
  };
  return (
    <div style={{ marginTop: 28, maxWidth: 720 }}>
      <div className="th" style={{ marginBottom: 8 }}>KI (lokal)</div>
      <div className="lab" style={{ marginBottom: 10, lineHeight: 1.5 }}>
        Läuft über <b>Ollama</b> auf diesem Rechner oder im Kanzleinetz – keine Daten ins Internet. Namen, Telefon, E-Mail, IBAN,
        Kennzeichen und Adressen werden vor der Verarbeitung durch Platzhalter ersetzt. Jeder KI-Wert muss bestätigt werden.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr 200px auto", gap: 10, alignItems: "end" }}>
        <label style={{ display: "flex", gap: 6, alignItems: "center", paddingBottom: 6 }}>
          <input type="checkbox" checked={e.aktiv} onChange={(x) => speichern({ ...e, aktiv: x.target.checked })} /> aktiv
        </label>
        <label><div className="lab">Adresse</div><input className="feld" style={{ width: "100%" }} value={e.url} onChange={(x) => setE({ ...e, url: x.target.value })} /></label>
        <label><div className="lab">Modell</div>
          <input className="feld" style={{ width: "100%" }} list="ki-modelle" value={e.modell} onChange={(x) => setE({ ...e, modell: x.target.value })} />
          <datalist id="ki-modelle">{status?.modelle.map((m) => <option key={m} value={m} />)}</datalist>
        </label>
        <button className="btn pri" onClick={() => speichern()}>Speichern</button>
      </div>
      <div className="lab" style={{ marginTop: 8 }}>
        Status: {!status ? "prüfe …" : status.ok ? `✓ bereit (${e.modell})` : `✗ ${status.fehler}`} · <a href="#" onClick={(x) => { x.preventDefault(); pruefen(); }}>erneut prüfen</a>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr 200px", gap: 10, alignItems: "end", marginTop: 14 }}>
        <label style={{ display: "flex", gap: 6, alignItems: "center", paddingBottom: 6 }}>
          <input type="checkbox" checked={e.ocr} onChange={(x) => speichern({ ...e, ocr: x.target.checked })} /> Texterkennung für Scans
        </label>
        <div className="lab" style={{ paddingBottom: 6 }}>Gescannte PDFs und Fotos werden mit einem lokalen Bildmodell gelesen (bis 4 Seiten).</div>
        <label><div className="lab">Bildmodell</div>
          <input className="feld" style={{ width: "100%" }} list="ki-modelle" value={e.ocrModell} onChange={(x) => setE({ ...e, ocrModell: x.target.value })} onBlur={() => speichern()} />
        </label>
      </div>
      <div className="lab" style={{ marginTop: 4 }}>Einrichtung: Ollama installieren, dann <span className="mono">ollama pull {e.modell}</span>. Empfehlung: qwen2.5:7b (8 GB RAM) oder qwen2.5:14b (16 GB). Für Scans zusätzlich <span className="mono">ollama pull {e.ocrModell}</span>.</div>
    </div>
  );
}

function MailKonto() {
  const { zeige } = useStore();
  const [k, setK] = useState<{ aktiv: boolean; host: string; port: number; benutzer: string; ordner: string; tls: boolean; hatPasswort: boolean; smtpHost: string; smtpPort: number; absender: string; absenderName: string; signatur: string } | null>(null);
  const [pw, setPw] = useState("");
  const testen = async () => {
    const r = await fetch("/api/mail/senden", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ test: true }) });
    zeige(r.ok ? "Versand-Verbindung in Ordnung" : (await r.json()).fehler);
  };
  useEffect(() => { fetch("/api/mail/konto").then((r) => r.json()).then(setK); }, []);
  if (!k) return null;
  const speichern = async () => {
    const r = await fetch("/api/mail/konto", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...k, passwort: pw || undefined }) });
    if (r.ok) { setK(await r.json()); setPw(""); zeige("Mailkonto gespeichert"); }
  };
  const f = (key: "host" | "benutzer" | "ordner" | "smtpHost" | "absender" | "absenderName", l: string, w: string) => (
    <label><div className="lab">{l}</div><input className="feld" style={{ width: w }} value={k[key]} onChange={(x) => setK({ ...k, [key]: x.target.value })} /></label>
  );
  return (
    <div style={{ marginTop: 28, maxWidth: 720 }}>
      <div className="th" style={{ marginBottom: 8 }}>Mailkonto (IMAP)</div>
      <div className="lab" style={{ marginBottom: 10, lineHeight: 1.5 }}>Zum Abrufen per „Abrufen“ im Mailbereich. Es wird nur gelesen, nichts als gelesen markiert. Outlook/Microsoft 365 folgt über Microsoft Graph; bis dahin Mails aus Outlook in den Mailbereich ziehen.</div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
        {f("host", "Server", "220px")}
        <label><div className="lab">Port</div><input className="feld" style={{ width: 80 }} value={k.port} onChange={(x) => setK({ ...k, port: Number(x.target.value) || 993 })} /></label>
        {f("benutzer", "Benutzer", "220px")}
        <label><div className="lab">Passwort {k.hatPasswort && "(gespeichert)"}</div><input className="feld" type="password" autoComplete="new-password" style={{ width: 180 }} value={pw} placeholder={k.hatPasswort ? "••••••" : ""} onChange={(x) => setPw(x.target.value)} /></label>
        {f("ordner", "Ordner", "120px")}
        <button className="btn pri" onClick={speichern}>Speichern</button>
      </div>
      <div className="lab" style={{ marginTop: 6 }}>Passwort wird verschlüsselt gespeichert.</div>
      <div className="th" style={{ margin: "18px 0 8px" }}>Versand (SMTP)</div>
      <div className="lab" style={{ marginBottom: 10 }}>Gleicher Benutzer und gleiches Passwort wie oben. Port 587 (STARTTLS) oder 465 (SSL). Gesendet wird nur nach Klick auf „Senden“.</div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
        {f("smtpHost", "SMTP-Server", "220px")}
        <label><div className="lab">Port</div><input className="feld" style={{ width: 80 }} value={k.smtpPort} onChange={(x) => setK({ ...k, smtpPort: Number(x.target.value) || 587 })} /></label>
        {f("absender", "Absenderadresse", "240px")}
        {f("absenderName", "Absendername", "220px")}
      </div>
      <label style={{ display: "block", marginTop: 10 }}><div className="lab">Signatur</div>
        <textarea className="feld" style={{ width: "100%", minHeight: 90 }} value={k.signatur} onChange={(x) => setK({ ...k, signatur: x.target.value })} placeholder={"Kanzlei Muster\nRechtsanwalt …\nTel. …"} />
      </label>
      <div style={{ display: "flex", gap: 6, marginTop: 8 }}><button className="btn pri" onClick={speichern}>Speichern</button><button className="btn" onClick={testen}>Verbindung testen</button></div>
    </div>
  );
}

function Outlook() {
  const { zeige } = useStore();
  const [k, setK] = useState<{ clientId: string; tenant: string; aktiv: boolean; konto: string; verbunden: boolean } | null>(null);
  const [code, setCode] = useState<{ code: string; url: string } | null>(null);
  const laden = () => fetch("/api/mail/outlook").then((r) => r.json()).then(setK);
  useEffect(() => { laden(); }, []);
  const post = (aktion: string) => fetch("/api/mail/outlook", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ aktion }) }).then(async (r) => ({ ok: r.ok, j: await r.json() }));
  // Während ein Code angezeigt wird, regelmäßig nachfragen
  useEffect(() => {
    if (!code) return;
    let aus = false;
    const t = setInterval(async () => {
      const { j } = await post("pruefen");
      if (aus || j.status === "wartet") return;
      setCode(null);
      if (j.status === "fertig") zeige(`Verbunden mit ${j.konto}`); else zeige(j.fehler || "Code abgelaufen – bitte neu anmelden");
      laden();
    }, 5000);
    return () => { aus = true; clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);
  if (!k) return null;
  const speichern = async (neu = k) => {
    const r = await fetch("/api/mail/outlook", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(neu) });
    const j = await r.json(); if (!r.ok) return zeige(j.fehler);
    setK(j); zeige("Outlook-Einstellungen gespeichert");
  };
  const anmelden = async () => { const { ok, j } = await post("start"); if (!ok) return zeige(j.fehler); setCode(j); };
  const abmelden = async () => { if (!confirm("Von Microsoft abmelden?")) return; const { j } = await post("abmelden"); setK(j); };
  return (
    <div style={{ marginTop: 28, maxWidth: 720 }}>
      <div className="th" style={{ marginBottom: 8 }}>Outlook / Microsoft 365</div>
      <div className="lab" style={{ marginBottom: 10, lineHeight: 1.5 }}>Abrufen und Senden über das Outlook-Konto statt IMAP/SMTP. Einmalig im Microsoft Entra Admin Center eine App registrieren (Anleitung in der README) und hier die Anwendungs-ID eintragen. Kein Passwort wird in der App gespeichert.</div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
        <label><div className="lab">Anwendungs-ID (Client-ID)</div><input className="feld mono" style={{ width: 340 }} value={k.clientId} placeholder="00000000-0000-0000-0000-000000000000" onChange={(x) => setK({ ...k, clientId: x.target.value })} /></label>
        <label><div className="lab">Mandant (Tenant)</div><input className="feld mono" style={{ width: 200 }} value={k.tenant} onChange={(x) => setK({ ...k, tenant: x.target.value })} /></label>
        <button className="btn" onClick={() => speichern()}>Speichern</button>
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 12 }}>
        {k.verbunden ? <>
          <span style={{ color: "#1d7a43" }}>✓ Verbunden{k.konto && ` als ${k.konto}`}</span>
          <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 14.5 }}><input type="checkbox" checked={k.aktiv} onChange={(x) => speichern({ ...k, aktiv: x.target.checked })} /> Outlook statt IMAP/SMTP verwenden</label>
          <div style={{ flex: 1 }} /><button className="btn" onClick={abmelden}>Abmelden</button>
        </> : <>
          <button className="btn pri" disabled={!k.clientId || !!code} onClick={anmelden}>Bei Microsoft anmelden</button>
          {k.aktiv && <span style={{ color: "var(--rot)" }}>Outlook ist gewählt, aber die Anmeldung ist abgelaufen – Abrufen und Senden gehen erst nach erneuter Anmeldung.</span>}
        </>}
      </div>
      {code && (
        <div style={{ marginTop: 10, border: "1px solid var(--line)", borderRadius: 6, background: "#fff", padding: "12px 14px", lineHeight: 1.6 }}>
          1. <a href={code.url} target="_blank" rel="noopener noreferrer">{code.url}</a> öffnen<br />
          2. Code eingeben: <b className="mono" style={{ fontSize: 19, letterSpacing: 2 }}>{code.code}</b> <button className="btn" onClick={() => navigator.clipboard?.writeText(code.code)}>Kopieren</button><br />
          3. Mit dem Kanzlei-Konto anmelden und zustimmen. <span className="lab">Diese Seite wartet automatisch …</span>
        </div>
      )}
    </div>
  );
}

function Datensicherung() {
  const { zeige } = useStore();
  const [e, setE] = useState<{ aktiv: boolean; ordner: string; behalten: number; hatPasswort: boolean; letzte: string | null; letzterFehler: string; dateien: { name: string; groesse: number }[] } | null>(null);
  const [pw, setPw] = useState("");
  const [laeuft, setLaeuft] = useState("");
  const [wh, setWh] = useState<{ datei: File | null; pw: string; ok: string }>({ datei: null, pw: "", ok: "" });
  const laden = () => fetch("/api/sicherung").then((r) => r.json()).then(setE);
  useEffect(() => { laden(); }, []);
  if (!e) return null;
  const speichern = async (neu = e) => {
    const r = await fetch("/api/sicherung", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...neu, passwort: pw || undefined }) });
    const j = await r.json(); if (!r.ok) return zeige(j.fehler);
    setPw(""); zeige("Datensicherung gespeichert"); laden();
  };
  const jetzt = async () => {
    setLaeuft("Sichere …");
    const r = await fetch("/api/sicherung", { method: "POST" }); const j = await r.json(); setLaeuft("");
    zeige(r.ok ? `Gesichert: ${j.dokumente} Dokumente · ${(j.groesse / 1e6).toFixed(1).replace(".", ",")} MB` : j.fehler); laden();
  };
  const wiederherstellen = async () => {
    if (!wh.datei || wh.ok !== "WIEDERHERSTELLEN") return;
    setLaeuft("Stelle wieder her …");
    const fd = new FormData(); fd.append("datei", wh.datei); fd.append("passwort", wh.pw); fd.append("bestaetigung", wh.ok);
    const r = await fetch("/api/sicherung/wiederherstellen", { method: "POST", body: fd }); const j = await r.json(); setLaeuft("");
    if (!r.ok) return zeige(j.fehler);
    alert(`Wiederhergestellt: Stand ${new Date(j.erstellt).toLocaleString("de-DE")}, ${j.dokumente} Dokumente. Bitte neu anmelden.`);
    window.location.href = "/login";
  };
  const alt = e.letzte ? (Date.now() - new Date(e.letzte).getTime()) / 864e5 : Infinity;
  return (
    <div style={{ marginTop: 28, maxWidth: 820 }}>
      <div className="th" style={{ marginBottom: 8 }}>Datensicherung</div>
      <div style={{ fontSize: 14.5, marginBottom: 10, padding: "8px 12px", borderRadius: 4, background: !e.aktiv || alt > 2 ? "#fdf0ee" : "#eef8f1", color: !e.aktiv || alt > 2 ? "#c0392b" : "#1d7a43" }}>
        {!e.aktiv ? "Automatische Sicherung ist AUS – bitte einrichten." : e.letzte ? `Letzte Sicherung: ${new Date(e.letzte).toLocaleString("de-DE")}` : "Noch keine Sicherung erstellt."}
        {e.letzterFehler && <div>Fehler: {e.letzterFehler}</div>}
      </div>
      <div className="lab" style={{ marginBottom: 10, lineHeight: 1.5 }}>
        Täglich automatisch: Datenbank und alle Dokumente in eine verschlüsselte Datei (AES-256). Zielordner am besten auf einem anderen Laufwerk, NAS oder USB-Stick.
        <b> Das Passwort gut aufbewahren</b> – ohne es lässt sich keine Sicherung öffnen.
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
        <label style={{ display: "flex", gap: 6, alignItems: "center", paddingBottom: 8 }}><input type="checkbox" checked={e.aktiv} onChange={(x) => speichern({ ...e, aktiv: x.target.checked })} /> täglich automatisch</label>
        <label style={{ flex: 1, minWidth: 260 }}><div className="lab">Zielordner</div><input className="feld mono" style={{ width: "100%" }} value={e.ordner} onChange={(x) => setE({ ...e, ordner: x.target.value })} /></label>
        <label><div className="lab">Behalten</div><input className="feld" style={{ width: 70 }} type="number" min={1} value={e.behalten} onChange={(x) => setE({ ...e, behalten: Number(x.target.value) })} /></label>
        <label><div className="lab">Passwort {e.hatPasswort ? "(gesetzt)" : "(fehlt!)"}</div><input className="feld" type="password" autoComplete="new-password" style={{ width: 180 }} value={pw} placeholder={e.hatPasswort ? "••••••" : "mind. 10 Zeichen"} onChange={(x) => setPw(x.target.value)} /></label>
        <button className="btn pri" onClick={() => speichern()}>Speichern</button>
        <button className="btn" disabled={!e.hatPasswort || !!laeuft} onClick={jetzt}>Jetzt sichern</button>
      </div>
      {laeuft && <div className="lab" style={{ marginTop: 6 }}>{laeuft}</div>}
      {e.dateien.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div className="lab">Vorhandene Sicherungen ({e.dateien.length})</div>
          {e.dateien.slice(0, 5).map((d) => <div key={d.name} className="mono" style={{ fontSize: 13.5 }}>{d.name} · {(d.groesse / 1e6).toFixed(1).replace(".", ",")} MB</div>)}
        </div>
      )}
      <details style={{ marginTop: 14 }}>
        <summary style={{ cursor: "pointer", fontSize: 14.5, color: "#c0392b" }}>Wiederherstellen …</summary>
        <div style={{ border: "1px solid #e3a29a", background: "#fdf0ee", borderRadius: 6, padding: 12, marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 14.5 }}>Ersetzt <b>alle</b> aktuellen Daten (Akten, Benutzer, Dokumente) durch den Stand der Sicherung. Der aktuelle Stand wird vorher noch einmal gesichert.</div>
          <input type="file" accept=".kzb" onChange={(x) => setWh({ ...wh, datei: x.target.files?.[0] ?? null })} />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input className="feld" type="password" placeholder="Passwort der Sicherung" value={wh.pw} onChange={(x) => setWh({ ...wh, pw: x.target.value })} />
            <input className="feld" placeholder="WIEDERHERSTELLEN eintippen" value={wh.ok} onChange={(x) => setWh({ ...wh, ok: x.target.value })} />
            <button className="btn" style={{ color: "#c0392b", borderColor: "#e3a29a" }} disabled={!wh.datei || !wh.pw || wh.ok !== "WIEDERHERSTELLEN" || !!laeuft} onClick={wiederherstellen}>Wiederherstellen</button>
          </div>
        </div>
      </details>
    </div>
  );
}

export default function Einstellungen() {
  const { zeige } = useStore();
  const [k, setK] = useState<Kanzlei | null>(null);
  const [logoV, setLogoV] = useState(0);
  useEffect(() => { fetch("/api/kanzlei").then((r) => r.json()).then(setK); }, []);
  if (!k) return <div className="empty">Lade …</div>;

  const speichern = async () => {
    const r = await fetch("/api/kanzlei", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(k) });
    setK(await r.json()); zeige("Briefkopf gespeichert");
  };
  const logo = async (f: File) => {
    const fd = new FormData(); fd.append("logo", f);
    const r = await fetch("/api/kanzlei/logo", { method: "POST", body: fd });
    const j = await r.json();
    if (!r.ok) return zeige(j.fehler);
    setK(j); setLogoV(Date.now()); zeige("Logo gespeichert");
  };
  const feld = (key: keyof Kanzlei, label: string, breit = false) => (
    <label style={{ gridColumn: breit ? "span 2" : undefined }}>
      <div className="lab">{label}</div>
      <input className="feld" style={{ width: "100%" }} value={String(k[key] ?? "")} onChange={(e) => setK({ ...k, [key]: e.target.value })} />
    </label>
  );

  return (
    <>
      <div className="head">
        <div><h1>Einstellungen</h1><div className="lab" style={{ fontSize: 14.5, marginTop: 2 }}>Kanzlei &amp; Briefkopf – gilt für alle Schreiben, später auch Rechnungen und Mandantenportal</div></div>
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: "20px 28px", display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 28, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <div className="th">Logo</div>
            <div style={{ display: "flex", gap: 14, alignItems: "center", marginTop: 8 }}>
              <label style={{ width: 160, height: 80, border: "2px dashed #b9bec4", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", overflow: "hidden", background: "#fff" }}
                onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); e.dataTransfer.files[0] && logo(e.dataTransfer.files[0]); }}>
                {k.logo ? <img src={`/api/kanzlei/logo?v=${logoV}`} alt="Kanzleilogo" style={{ maxWidth: "100%", maxHeight: "100%" }} /> : <span className="lab" style={{ textAlign: "center" }}>Logo hierher ziehen<br />oder klicken</span>}
                <input type="file" accept=".png,.jpg,.jpeg" style={{ display: "none" }} onChange={(e) => e.target.files?.[0] && logo(e.target.files[0])} />
              </label>
              <div className="lab" style={{ lineHeight: 1.5 }}>PNG oder JPG, max. 2 MB.<br />Erscheint oben rechts im Brief.{k.logo && <><br /><a href="#" onClick={async (e) => { e.preventDefault(); const r = await fetch("/api/kanzlei/logo", { method: "DELETE" }); setK(await r.json()); }}>Logo entfernen</a></>}</div>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {feld("name", "Kanzleiname", true)}
            {feld("zusatz", "Zusatz (z. B. Rechtsanwälte · Verkehrsrecht)", true)}
            {feld("strasse", "Straße")}
            {feld("ort", "PLZ Ort")}
            {feld("telefon", "Telefon")}
            {feld("email", "E-Mail")}
            {feld("bank", "Bankverbindung (Fußzeile)", true)}
            <label><div className="lab">Akzentfarbe</div><input type="color" value={k.akzent} onChange={(e) => setK({ ...k, akzent: e.target.value })} style={{ width: 60, height: 30, border: "1px solid #d5d8dc", borderRadius: 4 }} /></label>
          </div>
          <label><div className="lab">Grußformel / Signatur</div><textarea className="feld" style={{ width: "100%", minHeight: 90 }} value={k.signatur} onChange={(e) => setK({ ...k, signatur: e.target.value })} /></label>
          <div><button className="btn pri" onClick={speichern}>Speichern</button></div>
        </div>
        {/* Live-Vorschau Briefkopf */}
        <div>
          <div className="th" style={{ marginBottom: 8 }}>Vorschau</div>
          <div style={{ background: "#fff", boxShadow: "0 1px 4px rgba(0,0,0,.15)", padding: "34px 40px", aspectRatio: "1 / 1.414", fontFamily: "Helvetica, Arial, sans-serif", fontSize: 13.5, position: "relative" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div><div style={{ color: k.akzent, fontWeight: 700, fontSize: 19 }}>{k.name}</div><div style={{ color: "#666", fontSize: 13.5 }}>{k.zusatz}</div></div>
              {k.logo && <img src={`/api/kanzlei/logo?v=${logoV}`} alt="" style={{ maxHeight: 48, maxWidth: 140 }} />}
            </div>
            <div style={{ borderTop: `1px solid ${k.akzent}`, margin: "10px 0 26px" }} />
            <div style={{ color: "#666", fontSize: 13.5 }}>{k.name} · {k.strasse} · {k.ort}</div>
            <div style={{ marginTop: 6, lineHeight: 1.4 }}>HUK-Coburg<br />Schadenabteilung<br />96444 Coburg</div>
            <div style={{ marginTop: 40, fontWeight: 700 }}>Schaden-Nr.: 77-4410-2</div>
            <div style={{ marginTop: 14, color: "#333", lineHeight: 1.6 }}>Sehr geehrte Damen und Herren,<br />…<br /><br /><span style={{ whiteSpace: "pre-wrap" }}>{k.signatur}</span></div>
            <div style={{ position: "absolute", left: 40, right: 40, bottom: 26, borderTop: "0.5px solid #888", paddingTop: 4, color: "#666", fontSize: 13.5 }}>
              {[k.name, k.strasse, k.ort, k.telefon, k.email].filter(Boolean).join(" · ")}<br />{k.bank}
            </div>
          </div>
        </div>
      </div>
          <div style={{ padding: "0 28px 28px" }}><Datensicherung /><KiEinstellungen /><MailKonto /><Outlook /></div>
    </>
  );
}
