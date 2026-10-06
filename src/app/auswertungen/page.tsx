"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

type Wert = { monat: string; wert: number };
type Daten = {
  kennzahlen: { aktenGesamt: number; aktenOffen: number; offeneHonorare: number; offeneHonorareAnzahl: number; offeneSchaden: number; eingangJahr: number; fristenUeberfaellig: number; fristenHeute: number };
  abgerechnet: Wert[]; eingegangen: Wert[]; neueAkten: Wert[];
  phasen: { phase: string; n: number }[]; gebiete: { gebiet: string; n: number }[];
  offenVers: { vers: string; offen: number; akten: number }[]; zahldauer: { empfaenger: string; tage: number; n: number }[];
};

const euro = (n: number, nk = 0) => n.toLocaleString("de-DE", { minimumFractionDigits: nk, maximumFractionDigits: nk }) + " €";
const MON = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
const monatKurz = (m: string) => MON[Number(m.slice(5)) - 1];
const SPALTEN: [string, RegExp][] = [
  ["Mandat", /^mandat|neu|aufnahme/i], ["Unterlagen", /unterlagen|gutachten|akteneinsicht/i], ["Anspruch", /anspruch|anschreiben|bezifferung/i],
  ["Regulierung", /regulier|kürzung|nachfrist|prüffrist|zahlung/i], ["Klage", /klage|gericht|berufung|verfahren/i], ["Abschluss", /abschluss|erledigt|abgerechnet/i],
];
const FARBE = "var(--akzent)";

function Kachel({ titel, wert, info, warn }: { titel: string; wert: string; info?: string; warn?: boolean }) {
  return (
    <div style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 8, padding: "14px 16px" }}>
      <div className="lab">{titel}</div>
      <div className="mono" style={{ fontSize: 26, fontWeight: 600, marginTop: 4, color: warn ? "var(--rot)" : "#16191d" }}>{wert}</div>
      {info && <div className="lab" style={{ marginTop: 2 }}>{info}</div>}
    </div>
  );
}

function Karte({ titel, info, children }: { titel: string; info?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 8, padding: "14px 16px", minWidth: 0 }}>
      <div style={{ fontWeight: 600, fontSize: 16 }}>{titel}</div>
      {info && <div className="lab" style={{ marginBottom: 8 }}>{info}</div>}
      {children}
    </div>
  );
}

/** Säulen pro Monat mit Hover-Wert */
function Saeulen({ daten, format }: { daten: Wert[]; format: (n: number) => string }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...daten.map((d) => d.wert));
  const H = 150;
  return (
    <div style={{ position: "relative" }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: H, borderBottom: "1px solid #c9ccd1", paddingTop: 22 }}>
        {daten.map((d, i) => (
          <div key={d.monat} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
            style={{ flex: 1, height: "100%", display: "flex", alignItems: "flex-end", cursor: "default", position: "relative" }}>
            <div style={{ width: "100%", height: d.wert ? Math.max(3, (d.wert / max) * (H - 22)) : 0, background: FARBE, opacity: hover === null || hover === i ? 1 : 0.45, borderRadius: "4px 4px 0 0" }} />
            {hover === i && (
              <div style={{ position: "absolute", bottom: "100%", left: "50%", transform: "translateX(-50%)", background: "#16191d", color: "#fff", fontSize: 13.5, padding: "3px 8px", borderRadius: 4, whiteSpace: "nowrap", zIndex: 2 }}>
                {monatKurz(d.monat)} {d.monat.slice(2, 4)}: <b>{format(d.wert)}</b>
              </div>
            )}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
        {daten.map((d) => <div key={d.monat} className="lab" style={{ flex: 1, textAlign: "center", fontSize: 13 }}>{monatKurz(d.monat)}</div>)}
      </div>
    </div>
  );
}

/** Waagerechte Balken mit Beschriftung am Ende */
function Balken({ zeilen }: { zeilen: { label: React.ReactNode; wert: number; text: string; key: string }[] }) {
  const max = Math.max(1, ...zeilen.map((z) => z.wert));
  if (!zeilen.length) return <div className="lab" style={{ padding: "12px 0" }}>Noch keine Daten</div>;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(110px,auto) 1fr auto", columnGap: 10, rowGap: 7, alignItems: "center" }}>
      {zeilen.map((z) => (
        <div key={z.key} style={{ display: "contents" }}>
          <div style={{ fontSize: 14.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{z.label}</div>
          <div style={{ background: "var(--bg3)", borderRadius: 4, height: 14 }} title={z.text}>
            <div style={{ width: `${Math.max(2, (z.wert / max) * 100)}%`, height: "100%", background: FARBE, borderRadius: 4 }} />
          </div>
          <div className="mono" style={{ fontSize: 14, textAlign: "right" }}>{z.text}</div>
        </div>
      ))}
    </div>
  );
}

export default function Auswertung() {
  const [d, setD] = useState<Daten | null>(null);
  useEffect(() => { fetch("/api/auswertung").then((r) => r.json()).then(setD); }, []);
  if (!d) return <div className="empty">Lade …</div>;
  const k = d.kennzahlen;
  const phasen = SPALTEN.map(([name]) => ({ name, n: d.phasen.filter((p) => (SPALTEN.find(([, r]) => r.test(p.phase))?.[0] ?? "Mandat") === name).reduce((s, p) => s + p.n, 0) }));

  return (
    <div style={{ flex: 1, overflow: "auto", padding: "18px 24px 28px" }}>
      <h1 style={{ fontSize: 23, margin: "0 0 2px" }}>Auswertung</h1>
      <div className="lab" style={{ fontSize: 14.5, marginBottom: 14 }}>Letzte 12 Monate · alle Rechtsgebiete</div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12, marginBottom: 14 }}>
        <Kachel titel="Offene Akten" wert={String(k.aktenOffen)} info={`von ${k.aktenGesamt} gesamt`} />
        <Kachel titel="Offene Honorare" wert={euro(k.offeneHonorare)} info={`${k.offeneHonorareAnzahl} Kostennote(n)`} />
        <Kachel titel={`Honorareingang ${new Date().getFullYear()}`} wert={euro(k.eingangJahr)} />
        <Kachel titel="Offene Schadenpositionen" wert={euro(k.offeneSchaden)} info="bei den Versicherungen" />
        <Kachel titel="Fristen überfällig" wert={String(k.fristenUeberfaellig)} info={`${k.fristenHeute} heute fällig`} warn={k.fristenUeberfaellig > 0} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(420px,1fr))", gap: 12 }}>
        <Karte titel="Abgerechnet pro Monat" info="Kostennoten brutto, ohne Stornos"><Saeulen daten={d.abgerechnet} format={(n) => euro(n)} /></Karte>
        <Karte titel="Honorareingang pro Monat" info="als bezahlt markierte Kostennoten"><Saeulen daten={d.eingegangen} format={(n) => euro(n)} /></Karte>
        <Karte titel="Neue Akten pro Monat"><Saeulen daten={d.neueAkten} format={(n) => `${n} Akte${n === 1 ? "" : "n"}`} /></Karte>
        <Karte titel="Akten je Phase" info={<Link href="/phasen">zum Kanban →</Link>}>
          <Balken zeilen={phasen.map((p) => ({ key: p.name, label: p.name, wert: p.n, text: String(p.n) }))} />
        </Karte>
        <Karte titel="Offene Schadenpositionen je Versicherung" info="gefordert minus gezahlt, ohne RA-Kosten">
          <Balken zeilen={d.offenVers.map((v) => ({ key: v.vers, label: v.vers, wert: v.offen, text: `${euro(v.offen)} · ${v.akten} Akte${v.akten === 1 ? "" : "n"}` }))} />
        </Karte>
        <Karte titel="Zahldauer der Versicherungen" info="Tage von Kostennote bis Zahlung (Durchschnitt)">
          <Balken zeilen={d.zahldauer.map((z) => ({ key: z.empfaenger, label: z.empfaenger || "–", wert: z.tage, text: `${z.tage} Tage · ${z.n}×` }))} />
        </Karte>
      </div>
    </div>
  );
}
