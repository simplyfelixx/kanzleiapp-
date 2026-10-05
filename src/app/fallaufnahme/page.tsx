"use client";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { erkenne, fehlt, Erkannt, LEER } from "@/lib/erkennung";
import { useStore } from "@/components/Store";

const FELDER: { k: keyof Erkannt; l: string }[] = [
  { k: "mandant", l: "Mandant" }, { k: "telefon", l: "Telefon" }, { k: "email", l: "E-Mail" }, { k: "adresse", l: "Adresse" },
  { k: "gegner", l: "Gegner" }, { k: "kennzeichen", l: "Kennzeichen" }, { k: "versicherung", l: "Versicherung" },
  { k: "unfalltag", l: "Unfall" }, { k: "unfallort", l: "Ort" }, { k: "polizei", l: "Polizei" }, { k: "verletzt", l: "Verletzt" },
  { k: "fahrbereit", l: "Fahrbereit" }, { k: "finanzierung", l: "Finanzierung" }, { k: "ausfall", l: "Ausfall" },
  { k: "rsv", l: "Rechtsschutz" }, { k: "gutachter", l: "Gutachter" },
];
const BEISPIEL = "Herr Jonas Lange ruft an, 0176 5520 1934. Gestern gegen 17 Uhr auf der A7 Richtung Hannover kurz vor Ausfahrt Marmstorf ist ihm einer hinten drauf gefahren, im Stau. Gegner heißt Peter Kowalski, Kennzeichen HH-PK 4471, versichert bei der Allianz. Polizei war da, Autobahnpolizei. Auto ist noch fahrbereit, Heckklappe und Stoßstange kaputt. Er hat Nackenschmerzen, war beim Arzt. Auto ist geleast über VW Leasing. Er möchte lieber einen Mietwagen. Rechtsschutz hat er bei der ARAG.";

export default function Fallaufnahme() {
  const router = useRouter();
  const { zeige } = useStore();
  const [text, setText] = useState("");
  const [manuell, setManuell] = useState<Partial<Erkannt>>({}); // von Hand korrigierte Felder haben Vorrang
  const [gebiet, setGebiet] = useState("VR");
  const [laeuft, setLaeuft] = useState(false);
  // KI-Ergebnis gilt nur für den Text, aus dem es stammt
  const [ki, setKi] = useState<{ text: string; werte: Partial<Erkannt>; belege: Partial<Record<keyof Erkannt, string>>; ersetzt: number } | null>(null);
  const [kiLaeuft, setKiLaeuft] = useState(false);
  const [kiFortschritt, setKiFortschritt] = useState<{ text: string; anteil: number | null; sek: number } | null>(null);
  const abbruch = useRef<AbortController | null>(null);
  const kiAbbrechen = () => abbruch.current?.abort();
  const [kiStatus, setKiStatus] = useState<{ aktiv: boolean; ok: boolean; fehler?: string } | null>(null);
  useEffect(() => { fetch("/api/ki/status").then((r) => r.json()).then(setKiStatus).catch(() => {}); }, []);
  const kiAktuell = ki && ki.text === text ? ki : null;

  const kiAuswerten = async () => {
    if (!text.trim() || kiLaeuft) return;
    const ctrl = new AbortController();
    abbruch.current = ctrl;
    setKiLaeuft(true);
    setKiFortschritt({ text: "Starte …", anteil: null, sek: 0 });
    const t0 = Date.now();
    const uhr = setInterval(() => setKiFortschritt((f) => f && { ...f, sek: Math.round((Date.now() - t0) / 1000) }), 1000);
    const fertig = (meldung?: string) => { clearInterval(uhr); setKiLaeuft(false); setKiFortschritt(null); abbruch.current = null; if (meldung) zeige(meldung); };
    try {
      const r = await fetch("/api/ki/fallaufnahme", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }), signal: ctrl.signal });
      if (!r.ok || !r.body) { const j = await r.json().catch(() => ({})); return fertig(j.fehler ?? "KI-Fehler"); }
      const leser = r.body.getReader(), dec = new TextDecoder();
      let puffer = "";
      for (;;) {
        const { done, value } = await leser.read();
        if (done) break;
        puffer += dec.decode(value, { stream: true });
        let nl: number;
        while ((nl = puffer.indexOf("\n")) >= 0) {
          const ev = JSON.parse(puffer.slice(0, nl)); puffer = puffer.slice(nl + 1);
          if (ev.typ === "status") {
            const t = ev.schritt === "pseudonym" ? `Pseudonymisiere … ${ev.ersetzt} Angaben ersetzt`
              : ev.schritt === "laden" ? "Modell lädt (beim ersten Mal bis zu 1 Minute) …"
              : `KI schreibt … ${ev.felder} von ${ev.gesamt} Feldern`;
            setKiFortschritt((f) => ({ text: t, anteil: ev.schritt === "schreiben" ? ev.felder / ev.gesamt : null, sek: f?.sek ?? 0 }));
          } else if (ev.typ === "ergebnis") {
            setKi({ text, werte: ev.werte, belege: ev.belege, ersetzt: ev.ersetzt });
            return fertig(`KI-Auswertung fertig · ${ev.ersetzt} Angaben vorher pseudonymisiert`);
          } else if (ev.typ === "fehler") {
            return fertig(ev.fehler === "abgebrochen" ? "KI-Auswertung abgebrochen" : ev.fehler);
          }
        }
      }
      fertig("KI-Verbindung unterbrochen");
    } catch {
      fertig(ctrl.signal.aborted ? "KI-Auswertung abgebrochen" : "KI nicht erreichbar");
    }
  };

  const erkannt = useMemo(() => erkenne(text), [text]);
  const werte: Erkannt = { ...LEER, ...erkannt, ...(kiAktuell?.werte ?? {}), ...Object.fromEntries(Object.entries(manuell).filter(([, v]) => v !== undefined)) };
  const offen = fehlt(werte);
  const worum = [
    werte.schilderung, werte.verletzt.startsWith("ja") && "Mandant verletzt.", werte.finanzierung && `Fahrzeug: ${werte.finanzierung}.`,
    werte.ausfall && `${werte.ausfall} gewünscht.`,
  ].filter(Boolean).join(" ");

  const anlegen = async () => {
    if (!werte.mandant) return zeige("Name des Mandanten fehlt");
    setLaeuft(true);
    const r = await fetch("/api/fallaufnahme", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ werte, notiz: text, gebiet, worum }) });
    const j = await r.json();
    setLaeuft(false);
    if (!r.ok) return zeige(j.fehler ?? "Fehler");
    zeige(`Akte ${j.id} angelegt`);
    router.push(`/akte/${encodeURIComponent(j.id)}`);
  };

  // Strg+Enter = Akte anlegen
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); anlegen(); }
      if (e.key.toLowerCase() === "k" && e.altKey) { e.preventDefault(); kiAuswerten(); }
      if (e.key === "Escape" && abbruch.current) { e.preventDefault(); kiAbbrechen(); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });

  return (
    <div className="main">
      <div style={{ flex: 1, minWidth: 0, padding: "18px 28px", display: "flex", flexDirection: "column", gap: 14, borderRight: "1px solid var(--line)", overflow: "auto" }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 22, margin: 0 }}>Fallaufnahme</h1>
            <div className="lab" style={{ fontSize: 13, marginTop: 2 }}>Einfach schreiben oder einfügen – erkannte Angaben erscheinen rechts.</div>
          </div>
          <div style={{ flex: 1 }} />
          <select className="feld" value={gebiet} onChange={(e) => setGebiet(e.target.value)}>
            <option value="VR">Verkehr</option><option value="StR">Straf</option><option value="ArbR">Arbeit</option>
          </select>
          {!text && <button className="btn" onClick={() => setText(BEISPIEL)}>Beispiel einfügen</button>}
        </div>
        <textarea
          autoFocus
          className="feld"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="z. B. „Herr Müller ruft an, 0172 …, gestern Unfall auf der Weserstraße, Gegner versichert bei der HUK …“"
          style={{ flex: 1, minHeight: 260, fontSize: 15, lineHeight: 1.7, padding: "14px 16px", resize: "none" }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {kiLaeuft ? (
            <button className="btn" onClick={kiAbbrechen}>Abbrechen <span className="k">Esc</span></button>
          ) : (
          <button className="btn" disabled={!text.trim() || !kiStatus?.aktiv} onClick={kiAuswerten}
            title={!kiStatus?.aktiv ? "KI in den Einstellungen einschalten" : kiStatus.ok ? "Lokal, Namen und Kontaktdaten werden vorher ersetzt" : kiStatus.fehler}>
            Mit KI auswerten <span className="k">Alt+K</span>
          </button>
          )}
          <span className="lab">
            {!kiStatus ? "" : !kiStatus.aktiv ? "KI aus – regelbasierte Erkennung" : kiStatus.ok ? "KI lokal bereit" : `KI: ${kiStatus.fehler}`}
            {ki && !kiAktuell ? " · Text geändert – KI erneut auswerten" : ""}
          </span>
          <div style={{ flex: 1 }} />
          <span className="lab">Strg+Enter = Akte anlegen</span>
        </div>
        {kiFortschritt && (
          <div>
            <div style={{ display: "flex", fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>
              <span>{kiFortschritt.text}</span><div style={{ flex: 1 }} /><span className="mono">{kiFortschritt.sek} s</span>
            </div>
            <div style={{ height: 3, background: "var(--line2)", borderRadius: 2, overflow: "hidden" }}>
              <div style={{
                height: "100%", background: "var(--akzent)", borderRadius: 2, transition: "width .3s",
                width: kiFortschritt.anteil === null ? "30%" : `${Math.max(4, kiFortschritt.anteil * 100)}%`,
                animation: kiFortschritt.anteil === null ? "kiWarten 1.4s ease-in-out infinite" : undefined,
              }} />
            </div>
            <style>{"@keyframes kiWarten{0%{margin-left:-30%}100%{margin-left:100%}}"}</style>
          </div>
        )}
        {offen.length > 0 && (
          <div>
            <div className="th" style={{ color: "#B5620A" }}>Fehlt noch – am besten jetzt am Telefon fragen</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
              {offen.slice(0, 6).map((f) => (
                <div key={f.feld} style={{ display: "flex", gap: 10, alignItems: "center", padding: "7px 10px", border: "1px solid #e8c49a", background: "#fdf6ee", borderRadius: 4, fontSize: 13 }}>
                  <span style={{ color: "#B5620A", fontWeight: 600 }}>?</span><span style={{ flex: 1 }}>{f.frage}</span><span className="lab">{f.grund}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="side" style={{ width: 560 }}>
        <div style={{ display: "flex", alignItems: "center" }}>
          <span className="th" style={{ color: "var(--akzent)" }}>Neue Akte · Vorschau</span>
          <div style={{ flex: 1 }} /><span className="k">{gebiet}</span>
        </div>
        <div style={{ fontSize: 14, lineHeight: 1.5, borderLeft: "2px solid var(--akzent)", paddingLeft: 10, color: worum ? undefined : "var(--muted)" }}>
          {worum || "Hier erscheint eine kurze Zusammenfassung des Falls."}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 16 }}>
          {FELDER.map(({ k, l }) => {
            const vonHand = manuell[k] !== undefined;
            const v = werte[k];
            const vonKi = !vonHand && !!kiAktuell?.werte[k] && v === kiAktuell.werte[k];
            const beleg = vonKi ? kiAktuell!.belege[k] : "";
            return (
              <label key={k} style={{ display: "grid", gridTemplateColumns: "90px 1fr", gap: 8, alignItems: "center", padding: "4px 0", borderBottom: "1px solid var(--line2)" }}>
                <span className="lab">{l}</span>
                <input
                  className="feld"
                  value={v}
                  placeholder="–"
                  onChange={(e) => setManuell({ ...manuell, [k]: e.target.value })}
                  style={{ border: "1px solid transparent", borderLeft: vonKi ? "2px solid var(--akzent)" : "1px solid transparent", background: v && !vonHand ? "var(--hl)" : "transparent", padding: "3px 6px" }}
                  title={vonHand ? "von Hand geändert" : vonKi ? `KI · woher: „${beleg || "kein Beleg"}“` : v ? "regelbasiert erkannt" : ""}
                />
              </label>
            );
          })}
        </div>
        <div className="lab">Gelb = automatisch erkannt · Strich links = KI (Maus drauf: woher?) · Feld anklicken zum Korrigieren</div>
        {werte.mandant && (
          <div>
            <div className="th">Wird nach dem Anlegen vorgeschlagen</div>
            <div style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 4, marginTop: 6 }}>
              <div>✓ Vollmacht + Fragebogen an Mandant</div>
              {werte.rsv.startsWith("ja") && <div>✓ Deckungsanfrage {werte.rsv.replace("ja · ", "")}</div>}
              {werte.versicherung && <div>✓ Schadensmeldung an {werte.versicherung}</div>}
              {werte.polizei.startsWith("ja") && <div>✓ Akteneinsichtsgesuch Polizei</div>}
              {werte.finanzierung && <div>✓ Info an {werte.finanzierung.split(" · ")[1] ?? "Bank"}</div>}
            </div>
          </div>
        )}
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", gap: 6 }}>
          <button className="btn pri" style={{ padding: "9px 18px", fontSize: 13 }} disabled={laeuft} onClick={anlegen}>Akte anlegen ↵</button>
          <button className="btn" style={{ padding: "9px 14px", fontSize: 13 }} onClick={() => { setText(""); setManuell({}); }}>Verwerfen</button>
        </div>
      </div>
    </div>
  );
}
