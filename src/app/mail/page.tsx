"use client";
import Link from "next/link";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { useStore } from "@/components/Store";
import MailVerfassen, { type Entwurf } from "@/components/MailVerfassen";

type Kurz = { id: number; quelle?: string; an?: string; von: string; von_name: string; betreff: string; datum: string; akte_id: string | null; gelesen: number; anhaenge: number };
type Erkannt = {
  typ: string; absender: string; datum: string; zusammenfassung: string; kiText: string; betraege: { label: string; wert: number }[];
  frist: { datum: string; text: string } | null; zeichen: string; akteId: string | null; akteGrund: string; sicher: boolean; textQuelle: string; hinweis: string;
};
type Anhang = { id: number; name: string; groesse: number; erkannt: Erkannt | null; abgelegt_in: string | null };
type Mail = { id: number; von: string; von_name: string; an: string; betreff: string; datum: string; text: string; akte_id: string | null; akte_grund: string; anhaenge: Anhang[] };
type AkteKurz = { id: string; titel: string };

const euro = (n: number) => n.toLocaleString("de-DE", { minimumFractionDigits: 2 }) + " €";
const de = (s: string) => s.slice(0, 10).split("-").reverse().join(".");
const zeit = (s: string) => { const n = new Date(), heute = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`; return s.slice(0, 10) === heute ? s.slice(11, 16) : de(s).slice(0, 6); };
const kb = (n: number) => (n > 1e6 ? (n / 1e6).toFixed(1).replace(".", ",") + " MB" : Math.max(1, Math.round(n / 1e3)) + " KB");

function AnhangKarte({ a, akten, vorschlag, neu }: { a: Anhang; akten: AkteKurz[]; vorschlag: string | null; neu: () => void }) {
  const { zeige } = useStore();
  const e = a.erkannt;
  const [akte, setAkte] = useState(e?.akteId ?? vorschlag ?? "");
  const ablegen = async () => {
    const r = await fetch(`/api/mail/anhang/${a.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ akteId: akte }) });
    const j = await r.json();
    if (!r.ok) return zeige(j.fehler);
    zeige(`In Akte ${akte} abgelegt als ${j.name}`); neu();
  };
  const summe = e?.betraege.find((b) => /gesamt|summe|endbetrag|zahl/i.test(b.label)) ?? e?.betraege[e.betraege.length - 1];
  return (
    <div style={{ border: "1px solid var(--line)", borderRadius: 6, background: "#fff", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "var(--bg3)", borderBottom: "1px solid var(--line)" }}>
        <span style={{ fontSize: 13.5, fontWeight: 600, color: "#fff", background: /\.pdf$/i.test(a.name) ? "#b3261e" : "#6b7178", borderRadius: 3, padding: "1px 5px" }}>{(a.name.match(/\.(\w+)$/)?.[1] ?? "?").toUpperCase()}</span>
        <b style={{ fontWeight: 500, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={a.name}>{a.name}</b>
        <span className="lab">{kb(a.groesse)}</span>
        <a className="btn" style={{ textDecoration: "none" }} href={`/api/mail/anhang/${a.id}`} target="_blank" rel="noopener noreferrer">Öffnen</a>
      </div>
      {!e ? <div className="lab" style={{ padding: "10px 12px" }}>Kein lesbarer Inhalt (nur PDF, Bilder und Text werden ausgewertet).</div> : (
        <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 6, fontSize: 14.5 }}>
          <div><b style={{ fontWeight: 600 }}>{e.typ}</b>{e.absender && e.absender !== "unbekannt" && <> von {e.absender}</>} <span className="lab">· {de(e.datum)}</span>
            {e.textQuelle === "ocr" && <span className="k" style={{ marginLeft: 8, color: "#B5620A", borderColor: "#e8c49a" }} title="Gescannt – Text per lokaler Texterkennung gelesen. Werte bitte besonders prüfen.">SCAN · OCR</span>}
          </div>
          {e.kiText && <div style={{ lineHeight: 1.5 }}>{e.kiText}</div>}
          {(e.betraege.length > 0 || e.frist || e.zeichen) && (
            <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", columnGap: 14, rowGap: 2, fontSize: 14 }}>
              {e.betraege.map((b, i) => <Fragment key={i}><span className="lab" style={{ fontSize: 13.5 }}>{b.label}</span><span className="mono" style={{ fontWeight: b === summe ? 600 : 400 }}>{euro(b.wert)}</span></Fragment>)}
              {e.zeichen && <><span className="lab" style={{ fontSize: 13.5 }}>Zeichen</span><span className="mono">{e.zeichen}</span></>}
              {e.frist && <><span className="lab" style={{ fontSize: 13.5, color: "var(--rot)" }}>Frist</span><span style={{ color: "var(--rot)" }}>{de(e.frist.datum)} <span className="lab">– {e.frist.text.slice(0, 90)}</span></span></>}
            </div>
          )}
          {e.hinweis && <div className="lab" style={{ color: "#B5620A" }}>{e.hinweis}</div>}
          <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 4, paddingTop: 8, borderTop: "1px solid var(--line2)" }}>
            {a.abgelegt_in ? <span style={{ color: "#1d7a43", fontSize: 14 }}>✓ abgelegt in <Link href={`/akte/${encodeURIComponent(a.abgelegt_in)}`}>{a.abgelegt_in}</Link></span> : (
              <>
                <select className="feld" value={akte} onChange={(x) => setAkte(x.target.value)} style={{ maxWidth: 280 }}>
                  <option value="">– Akte wählen –</option>{akten.map((k) => <option key={k.id} value={k.id}>{k.id} {k.titel}</option>)}
                </select>
                {e.akteGrund && akte === e.akteId && <span className="lab">{e.sicher ? "erkannt" : "vermutet"}: {e.akteGrund}</span>}
                <div style={{ flex: 1 }} />
                <button className="btn pri" disabled={!akte} onClick={ablegen}>In Akte ablegen</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function MailSeite() {
  const { zeige } = useStore();
  const [liste, setListe] = useState<Kurz[] | null>(null);
  const [akten, setAkten] = useState<AkteKurz[]>([]);
  const [wahl, setWahl] = useState<number | null>(null);
  const [mail, setMail] = useState<Mail | null>(null);
  const [laeuft, setLaeuft] = useState("");
  const [ziehen, setZiehen] = useState(false);
  const [entwurf, setEntwurf] = useState<Entwurf | null>(null);
  const datei = useRef<HTMLInputElement>(null);

  const laden = useCallback(() => fetch("/api/mail").then((r) => r.json()).then(setListe), []);
  const mailLaden = useCallback((id: number) => fetch(`/api/mail/${id}`).then((r) => r.json()).then(setMail), []);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search), id = Number(q.get("id")), neu = q.get("neu");
    if (id) setWahl(id);
    if (neu !== null) setEntwurf({ akteId: neu || null, betreff: neu ? `Unser Zeichen ${neu}` : "" });
  }, []);
  const antworten = (m: Mail) => setEntwurf({
    an: m.von, akteId: m.akte_id, antwortAuf: m.id,
    betreff: /^(re|aw):/i.test(m.betreff) ? m.betreff : `AW: ${m.betreff}`,
    text: `\n\n\nAm ${de(m.datum)} um ${m.datum.slice(11, 16)} schrieb ${m.von_name || m.von}:\n` + m.text.split("\n").slice(0, 200).map((z) => "> " + z).join("\n"),
  });
  useEffect(() => { laden(); fetch("/api/akten").then((r) => r.json()).then(setAkten); }, [laden]);
  useEffect(() => { if (wahl) mailLaden(wahl); else setMail(null); }, [wahl, mailLaden]);

  const importieren = async (files: FileList | File[]) => {
    const fd = new FormData(); Array.from(files).forEach((f) => fd.append("datei", f));
    setLaeuft(`Lese ${fd.getAll("datei").length} Mail(s) und Anhänge … (Scans dauern länger)`);
    const r = await fetch("/api/mail/import", { method: "POST", body: fd });
    const j = await r.json(); setLaeuft("");
    if (!r.ok) return zeige(j.fehler);
    const neu = j.ergebnis.filter((x: { neu?: boolean }) => x.neu).length, fehler = j.ergebnis.filter((x: { fehler?: string }) => x.fehler);
    zeige(`${neu} neu importiert${fehler.length ? ` · ${fehler.length} Fehler: ${fehler[0].name} (${fehler[0].fehler})` : ""}`);
    await laden(); const erste = j.ergebnis.find((x: { id?: number }) => x.id); if (erste) setWahl(erste.id);
  };
  const abrufen = async () => {
    setLaeuft("Rufe Mails ab und lese Anhänge …");
    const r = await fetch("/api/mail/abrufen", { method: "POST" });
    const j = await r.json(); setLaeuft("");
    zeige(r.ok ? `${j.neu} neue Mail(s)` : j.fehler); laden();
  };
  const zuordnen = async (akteId: string) => {
    if (!mail) return;
    const r = await fetch(`/api/mail/${mail.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ akteId: akteId || null }) });
    if (r.ok) { setMail(await r.json()); laden(); }
  };

  return (
    <div className="main" onDragOver={(e) => { e.preventDefault(); setZiehen(true); }} onDragLeave={() => setZiehen(false)}
      onDrop={(e) => { e.preventDefault(); setZiehen(false); if (e.dataTransfer.files.length) importieren(e.dataTransfer.files); }}
      style={{ position: "relative" }}>
      {ziehen && <div style={{ position: "absolute", inset: 8, border: "2px dashed var(--akzent)", background: "rgba(30,58,110,.06)", borderRadius: 8, zIndex: 20, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: "var(--akzent)", pointerEvents: "none" }}>.eml- oder .msg-Dateien hier ablegen</div>}

      <div style={{ width: 420, flex: "none", borderRight: "1px solid var(--line)", display: "flex", flexDirection: "column", minHeight: 0 }}>
        <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--line)", display: "flex", gap: 6, alignItems: "center" }}>
          <h1 style={{ fontSize: 21, margin: 0, flex: 1 }}>Mail</h1>
          <button className="btn pri" onClick={() => setEntwurf({})}>Neue Mail</button>
          <button className="btn" onClick={() => datei.current?.click()} title="Mails aus Outlook herausziehen oder als .eml/.msg speichern">Importieren</button>
          <button className="btn" onClick={abrufen}>Abrufen</button>
          <input ref={datei} type="file" accept=".eml,.msg" multiple hidden onChange={(e) => e.target.files && importieren(e.target.files)} />
        </div>
        {laeuft && <div className="lab" style={{ padding: "8px 16px", background: "var(--akzent-bg)" }}>{laeuft}</div>}
        <div style={{ flex: 1, overflow: "auto" }}>
          {!liste ? <div className="empty">Lade …</div> : liste.length === 0 ? (
            <div className="empty" style={{ lineHeight: 1.6, padding: 24 }}>Noch keine Mails.<br />Mails aus Outlook einfach hierher ziehen<br />oder „Abrufen“ (Konto unter Einstellungen).</div>
          ) : liste.map((m) => (
            <div key={m.id} onClick={() => { setEntwurf(null); setWahl(m.id); }} style={{ padding: "10px 16px", borderBottom: "1px solid var(--line2)", cursor: "pointer", background: wahl === m.id ? "var(--sel)" : undefined, borderLeft: `3px solid ${m.gelesen ? "transparent" : "var(--akzent)"}` }}>
              <div style={{ display: "flex", gap: 8 }}>
                <span style={{ flex: 1, fontWeight: m.gelesen ? 400 : 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.quelle === "gesendet" ? <><span className="lab">an </span>{m.an}</> : m.von_name || m.von}</span>
                <span className="lab mono">{zeit(m.datum)}</span>
              </div>
              <div style={{ fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: m.gelesen ? 400 : 500 }}>{m.betreff}</div>
              <div className="lab" style={{ display: "flex", gap: 8, marginTop: 2 }}>
                {m.anhaenge > 0 && <span>📎 {m.anhaenge}</span>}{m.akte_id && <span className="mono">{m.akte_id}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, minWidth: 0, overflow: "auto", padding: "18px 28px" }}>
        {entwurf ? <MailVerfassen key={JSON.stringify(entwurf)} start={entwurf} akten={akten} abbrechen={() => setEntwurf(null)} fertig={(id) => { setEntwurf(null); laden(); setWahl(id); }} />
        : !mail ? <div className="empty">Mail links auswählen</div> : (
          <div style={{ maxWidth: 900, display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <h2 style={{ fontSize: 20, margin: "0 0 4px", fontWeight: 600 }}>{mail.betreff}</h2>
              <div style={{ fontSize: 14.5 }}><b style={{ fontWeight: 500 }}>{mail.von_name || mail.von}</b> <span className="lab">&lt;{mail.von}&gt; · {de(mail.datum)} {mail.datum.slice(11, 16)}</span></div>
              {mail.an && <div className="lab">an {mail.an}</div>}
              <div style={{ marginTop: 8 }}><button className="btn" onClick={() => antworten(mail)}>↩ Antworten</button></div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
                <span className="lab">Akte</span>
                <select className="feld" value={mail.akte_id ?? ""} onChange={(e) => zuordnen(e.target.value)} style={{ maxWidth: 320 }}>
                  <option value="">– keine –</option>{akten.map((k) => <option key={k.id} value={k.id}>{k.id} {k.titel}</option>)}
                </select>
                {mail.akte_id && mail.akte_grund && <span className="lab">{mail.akte_grund}</span>}
              </div>
            </div>
            {mail.anhaenge.length > 0 && (
              <div>
                <div className="th" style={{ marginBottom: 6 }}>Anhänge · {mail.anhaenge.length}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {mail.anhaenge.map((a) => <AnhangKarte key={a.id} a={a} akten={akten} vorschlag={mail.akte_id} neu={() => mailLaden(mail.id)} />)}
                </div>
              </div>
            )}
            <div>
              <div className="th" style={{ marginBottom: 6 }}>Nachricht</div>
              <div style={{ whiteSpace: "pre-wrap", fontSize: 14.5, lineHeight: 1.6, background: "#fff", border: "1px solid var(--line)", borderRadius: 6, padding: "12px 14px" }}>{mail.text || "(kein Text)"}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
