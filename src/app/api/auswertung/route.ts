// Kennzahlen für die Auswertung
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rechnungen } from "@/lib/abrechnung";

export const dynamic = "force-dynamic";

export function GET() {
  rechnungen(); // Tabelle sicherstellen
  const d = db();
  const jetzt = new Date();
  const monate = Array.from({ length: 12 }, (_, i) => { const x = new Date(jetzt.getFullYear(), jetzt.getMonth() - 11 + i, 1); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`; });
  const proMonat = (sql: string) => { const m = new Map((d.prepare(sql).all() as { m: string; v: number }[]).map((r) => [r.m, r.v])); return monate.map((x) => ({ monat: x, wert: m.get(x) ?? 0 })); };

  const abgerechnet = proMonat("SELECT substr(datum,1,7) m, SUM(brutto) v FROM rechnungen WHERE status!='storniert' GROUP BY m");
  const eingegangen = proMonat("SELECT substr(bezahlt_am,1,7) m, SUM(brutto) v FROM rechnungen WHERE status='bezahlt' GROUP BY m");
  const neueAkten = proMonat("SELECT substr(angelegt,1,7) m, COUNT(*) v FROM akten GROUP BY m");
  const phasen = d.prepare("SELECT phase, COUNT(*) n FROM akten GROUP BY phase").all() as { phase: string; n: number }[];
  const gebiete = d.prepare("SELECT gebiet, COUNT(*) n FROM akten GROUP BY gebiet ORDER BY n DESC").all() as { gebiet: string; n: number }[];
  // Offene Schadenpositionen je gegnerischer Versicherung
  const offenVers = d.prepare(`SELECT COALESCE((SELECT name FROM beteiligte b WHERE b.akte_id=k.akte_id AND b.rolle='Versicherung' LIMIT 1),'ohne Versicherung') vers,
      SUM(k.gefordert-k.gezahlt) offen, COUNT(DISTINCT k.akte_id) akten
    FROM konto k WHERE k.gefordert > k.gezahlt AND k.position NOT LIKE 'RA-Kosten%' GROUP BY vers ORDER BY offen DESC LIMIT 8`).all() as { vers: string; offen: number; akten: number }[];
  // Zahldauer der Kostennoten (Tage von Rechnung bis Zahlung) je Empfänger
  const zahldauer = d.prepare(`SELECT empfaenger, ROUND(AVG(julianday(bezahlt_am)-julianday(datum))) tage, COUNT(*) n
    FROM rechnungen WHERE status='bezahlt' AND bezahlt_am IS NOT NULL GROUP BY empfaenger ORDER BY tage DESC LIMIT 8`).all() as { empfaenger: string; tage: number; n: number }[];
  const offeneHonorare = (d.prepare("SELECT COALESCE(SUM(brutto),0) s, COUNT(*) n FROM rechnungen WHERE status='offen'").get() as { s: number; n: number });
  const heute = jetzt.toISOString().slice(0, 10);
  const fristen = d.prepare("SELECT SUM(datum < ?) ueber, SUM(datum = ?) heute, COUNT(*) alle FROM fristen WHERE status='offen' AND bestaetigt=1").get(heute, heute) as { ueber: number; heute: number; alle: number };

  return NextResponse.json({
    kennzahlen: {
      aktenGesamt: (d.prepare("SELECT COUNT(*) n FROM akten").get() as { n: number }).n,
      aktenOffen: (d.prepare("SELECT COUNT(*) n FROM akten WHERE phase NOT LIKE 'Abschluss%'").get() as { n: number }).n,
      offeneHonorare: offeneHonorare.s, offeneHonorareAnzahl: offeneHonorare.n,
      offeneSchaden: offenVers.reduce((s, v) => s + v.offen, 0),
      eingangJahr: (d.prepare("SELECT COALESCE(SUM(brutto),0) s FROM rechnungen WHERE status='bezahlt' AND substr(bezahlt_am,1,4)=?").get(String(jetzt.getFullYear())) as { s: number }).s,
      fristenUeberfaellig: fristen.ueber ?? 0, fristenHeute: fristen.heute ?? 0,
    },
    abgerechnet, eingegangen, neueAkten, phasen, gebiete, offenVers, zahldauer,
  });
}
