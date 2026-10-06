"use client";
import { useCallback, useEffect, useState } from "react";
import { useStore } from "@/components/Store";
import PortalView from "@/components/PortalView";
import type { PortalAnsicht } from "@/lib/portal";

type Zugang = { aktiv: boolean; abgelaufen: boolean; erstellt: string; ablauf: string; letzter_zugriff: string | null; freigaben: { fortschritt: boolean; geld: boolean; aufgaben: boolean } } | null;
type Zeile = { id: string; titel: string; mandant: string | null; phase: string; zugang: Zugang; offeneAufgaben: number };
type Detail = { zugang: Zugang; meldungen: { id: number; text: string; status: string; von: string; erstellt: string; freigegeben_am: string | null }[]; aufgaben: { id: number; titel: string; erledigt: number }[]; vorschau: PortalAnsicht };
const VORSCHLAEGE = ["Ärztliches Attest", "Fotos vom Schaden", "Rechnung", "Unterschriebene Vollmacht", "Fragebogen", "Führerschein (Kopie)"];
const FREIGABEN: [keyof NonNullable<Zugang>["freigaben"], string][] = [["fortschritt", "Fortschritt anzeigen"], ["geld", "Geldübersicht anzeigen"], ["aufgaben", "Aufgaben anzeigen"]];
const datum = (s: string | null) => (s ? s.slice(0, 16).replace(/(\d{4})-(\d\d)-(\d\d)/, "$3.$2.$1") : "–");

export default function PortalVerwaltung() {
  const { zeige } = useStore();
  const [liste, setListe] = useState<Zeile[]>([]);
  const [akte, setAkte] = useState<string | null>(null);
  const [d, setD] = useState<Detail | null>(null);
  const [link, setLink] = useState("");
  const [neueMeldung, setNeueMeldung] = useState("");
  const [eigene, setEigene] = useState("");

  const laden = useCallback(() => {
    fetch("/api/portal-verwaltung").then((r) => r.json()).then(setListe);
    if (akte) fetch("/api/portal-verwaltung?akte=" + encodeURIComponent(akte)).then((r) => r.json()).then(setD);
  }, [akte]);
  useEffect(() => { laden(); }, [laden]);
  useEffect(() => { setLink(""); setD(null); }, [akte]);

  const aktion = async (body: object, ok?: string) => {
    const r = await fetch("/api/portal-verwaltung", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ akte, ...body }) });
    const j = await r.json();
    if (!r.ok) { zeige(j.fehler ?? "Fehler"); return null; }
    if (ok) zeige(ok);
    laden();
    return j;
  };
  const td: React.CSSProperties = { padding: "8px", borderBottom: "1px solid #eceef0", fontSize: 14.5 };
  const auswahl = liste.find((a) => a.id === akte);

  return (
    <div className="main">
      <div style={{ flex: 1, minWidth: 0, padding: "18px 24px", overflow: "auto", borderRight: "1px solid var(--line)" }}>
        <div className="head" style={{ padding: "0 0 12px" }}><div><h1>Mandantenportal</h1><div className="lab" style={{ fontSize: 14.5, marginTop: 2 }}>Mandanten sehen nur, was hier freigegeben ist · nur lesen · Zugang per persönlichem Link</div></div></div>
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 12 }}>
          <thead><tr>{["Akte", "Mandant", "Zugang", "Zuletzt aktiv", "Offene Aufgaben"].map((h) => <th key={h} className="th" style={{ ...td, textAlign: "left", background: "#fafbfc" }}>{h}</th>)}</tr></thead>
          <tbody>
            {liste.map((a) => (
              <tr key={a.id} onClick={() => setAkte(a.id)} style={{ cursor: "pointer", background: akte === a.id ? "#eef2f9" : undefined }}>
                <td style={td} className="mono">{a.id}</td>
                <td style={td}>{a.mandant ?? "–"}</td>
                <td style={{ ...td, color: a.zugang?.aktiv ? "#1d7a43" : "#6b7178" }}>{!a.zugang ? "kein Link" : a.zugang.aktiv ? `aktiv bis ${datum(a.zugang.ablauf).slice(0, 10)}` : a.zugang.abgelaufen ? "abgelaufen" : "gesperrt"}</td>
                <td style={td}>{a.zugang?.letzter_zugriff ? datum(a.zugang.letzter_zugriff) : "–"}</td>
                <td style={td}>{a.offeneAufgaben || "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="side" style={{ width: 860, display: "flex", flexDirection: "row", gap: 20, alignItems: "flex-start", overflow: "auto" }}>
        {!akte || !d ? <div className="empty" style={{ flex: 1 }}>Akte links auswählen</div> : (
          <>
            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 18 }}>
              <div>
                <div className="th">Zugang · {akte} {auswahl?.mandant}</div>
                <div style={{ fontSize: 14.5, margin: "6px 0" }}>
                  {!d.zugang ? "Noch kein Link erstellt." : d.zugang.aktiv ? `Aktiv bis ${datum(d.zugang.ablauf)} · erstellt ${datum(d.zugang.erstellt)}` : "Kein gültiger Link (gesperrt oder abgelaufen)."}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button className="btn pri" onClick={async () => { if (d.zugang?.aktiv && !confirm("Der bisherige Link wird ungültig. Fortfahren?")) return; const j = await aktion({ aktion: "link", tage: 90 }); if (j) setLink(j.link); }}>{d.zugang ? "Neuen Link erstellen" : "Link erstellen"}</button>
                  {d.zugang?.aktiv && <button className="btn" onClick={() => aktion({ aktion: "sperren" }, "Zugang gesperrt")}>Sperren</button>}
                </div>
                {link && (
                  <div style={{ marginTop: 8, padding: 10, border: "1px solid #9fd3b0", background: "#eef8f1", borderRadius: 4, fontSize: 13.5 }}>
                    <div style={{ marginBottom: 4 }}>Link für den Mandanten – <b>wird nur jetzt angezeigt</b>:</div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <input className="feld mono" readOnly value={link} style={{ flex: 1, fontSize: 13.5 }} onFocus={(e) => e.target.select()} />
                      <button className="btn" onClick={() => { navigator.clipboard.writeText(link); zeige("Link kopiert"); }}>Kopieren</button>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <div className="th" style={{ marginBottom: 6 }}>Freigaben</div>
                {FREIGABEN.map(([k, l]) => (
                  <label key={k} style={{ display: "flex", gap: 8, alignItems: "center", padding: "4px 0", fontSize: 14.5, opacity: d.zugang ? 1 : 0.5 }}>
                    <input type="checkbox" disabled={!d.zugang} checked={d.zugang?.freigaben[k] ?? false} onChange={(e) => aktion({ aktion: "freigaben", freigaben: { [k]: e.target.checked } })} /> {l}
                  </label>
                ))}
                <div className="lab">Interne Notizen, Beteiligte, Dokumente und Verlauf sind nie sichtbar.</div>
              </div>

              <div>
                <div className="th" style={{ marginBottom: 6 }}>Statusmeldung</div>
                {d.meldungen.filter((m) => m.status === "entwurf").map((m) => (
                  <div key={m.id} style={{ border: "1px solid #e8c49a", background: "#fdf6ee", borderRadius: 4, padding: 10, marginBottom: 6, fontSize: 14.5 }}>
                    <div style={{ whiteSpace: "pre-wrap" }}>„{m.text}“</div>
                    <div style={{ display: "flex", gap: 6, marginTop: 6, alignItems: "center" }}>
                      <span className="lab">Entwurf · {m.von}</span><div style={{ flex: 1 }} />
                      <button className="btn" onClick={() => aktion({ aktion: "meldung_loeschen", id: m.id })}>Verwerfen</button>
                      <button className="btn pri" onClick={() => aktion({ aktion: "meldung_freigeben", id: m.id }, "Für den Mandanten sichtbar")}>Freigeben</button>
                    </div>
                  </div>
                ))}
                <textarea className="feld" placeholder="z. B. „Die Versicherung hat einen Teil gezahlt. Den Rest fordern wir nach.“" value={neueMeldung} onChange={(e) => setNeueMeldung(e.target.value)} style={{ width: "100%", minHeight: 70 }} />
                <button className="btn" style={{ marginTop: 4 }} disabled={!neueMeldung.trim()} onClick={async () => { if (await aktion({ aktion: "meldung", text: neueMeldung }, "Entwurf gespeichert – noch nicht sichtbar")) setNeueMeldung(""); }}>Als Entwurf speichern</button>
                {d.meldungen.filter((m) => m.status === "frei").slice(0, 3).map((m) => (
                  <div key={m.id} className="lab" style={{ marginTop: 6 }}>✓ {datum(m.freigegeben_am)} · {m.text.slice(0, 80)}{m.text.length > 80 ? " …" : ""}</div>
                ))}
              </div>

              <div>
                <div className="th" style={{ marginBottom: 6 }}>Aufgaben für den Mandanten</div>
                {d.aufgaben.map((a) => (
                  <label key={a.id} style={{ display: "flex", gap: 8, alignItems: "center", padding: "3px 0", fontSize: 14.5, color: a.erledigt ? "#9aa0a6" : undefined, textDecoration: a.erledigt ? "line-through" : undefined }}>
                    <input type="checkbox" checked={!!a.erledigt} onChange={(e) => aktion({ aktion: "aufgabe_erledigt", id: a.id, erledigt: e.target.checked })} /> {a.titel}
                  </label>
                ))}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                  {VORSCHLAEGE.filter((v) => !d.aufgaben.some((a) => a.titel === v && !a.erledigt)).map((v) => (
                    <span key={v} className="chip" onClick={() => aktion({ aktion: "aufgabe", titel: v })}>+ {v}</span>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                  <input className="feld" placeholder="eigene Aufgabe" value={eigene} onChange={(e) => setEigene(e.target.value)} style={{ flex: 1 }} />
                  <button className="btn" disabled={!eigene.trim()} onClick={async () => { if (await aktion({ aktion: "aufgabe", titel: eigene })) setEigene(""); }}>Hinzufügen</button>
                </div>
              </div>
            </div>

            <div style={{ width: 380, flex: "none" }}>
              <div className="th" style={{ marginBottom: 6 }}>Vorschau – so sieht es der Mandant</div>
              <div style={{ border: "1px solid var(--line)", borderRadius: 18, background: "#f5f6f8", padding: "8px 0", maxHeight: 640, overflow: "auto" }}>
                <PortalView a={d.vorschau} />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
