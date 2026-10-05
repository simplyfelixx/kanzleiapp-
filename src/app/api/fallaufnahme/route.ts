import { wer } from "@/lib/auth";
import { NextResponse } from "next/server";
import { db, naechstesAz, plusTage, verlaufEintrag } from "@/lib/db";
import type { Erkannt } from "@/lib/erkennung";

export const dynamic = "force-dynamic";

// Legt aus einer bestätigten Fallaufnahme eine neue Akte an.
export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as { werte?: Partial<Erkannt>; notiz?: string; gebiet?: string; worum?: string };
  const w = Object.fromEntries(Object.entries(b.werte ?? {}).map(([k, v]) => [k, String(v ?? "").slice(0, 500).trim()])) as Partial<Erkannt>;
  if (!w.mandant) return NextResponse.json({ fehler: "Name des Mandanten fehlt" }, { status: 400 });

  const id = naechstesAz();
  const titel = `${w.mandant} ./. ${w.versicherung || w.gegner || "?"}`;
  const falldaten = {
    unfalltag: w.unfalltag, unfallort: w.unfallort, schilderung: w.schilderung, ausfall: w.ausfall,
    verletzt: w.verletzt, polizei: w.polizei, rsv: w.rsv, fahrbereit: w.fahrbereit, finanzierung: w.finanzierung,
  };
  const ausstehend = [
    !w.adresse && "Adresse Mandant", "Vollmacht", !w.versicherung && "gegnerische Versicherung",
    w.gutachter !== "erwähnt" && "Gutachten", w.polizei?.startsWith("ja") && "Akteneinsicht",
  ].filter(Boolean).join(" · ");
  const naechster = [
    "Vollmacht + Fragebogen an Mandant", w.rsv?.startsWith("ja") && "Deckungsanfrage RSV",
    w.versicherung && `Schadensmeldung an ${w.versicherung}`, w.polizei?.startsWith("ja") && "Akteneinsichtsgesuch",
    w.finanzierung && "Leasing-/Finanzierungsbank informieren",
  ].filter(Boolean).join(" · ");

  const d = db();
  d.transaction(() => {
    d.prepare(`INSERT INTO akten (id,titel,gebiet,prioritaet,phase,worum,stand_vorliegend,stand_ausstehend,stand_naechster,falldaten)
      VALUES (?,?,?,?,?,?,?,?,?,?)`).run(
      id, titel, b.gebiet || "VR", "pruefen", "Mandat", String(b.worum ?? "").slice(0, 2000),
      "Fallaufnahme vom " + new Date().toLocaleDateString("de-DE"), ausstehend, naechster, JSON.stringify(falldaten));
    const ins = d.prepare("INSERT INTO beteiligte (akte_id,rolle,name,telefon,email,adresse,zeichen,notiz) VALUES (?,?,?,?,?,?,?,?)");
    ins.run(id, "Mandant", w.mandant, w.telefon ?? "", w.email ?? "", w.adresse ?? "", "", b.notiz ? `Fallaufnahme: ${String(b.notiz).slice(0, 2000)}` : "");
    if (w.gegner || w.kennzeichen) ins.run(id, "Gegner", w.gegner ?? "", "", "", "", w.kennzeichen ?? "", "");
    if (w.versicherung) ins.run(id, "Versicherung", w.versicherung, "", "", "", "", "");
    verlaufEintrag(id, "Akte aus Fallaufnahme angelegt", wer());
    // Erster Vorgang für „Mein Tag“: Vollmacht und erste Schreiben vorbereiten
    d.prepare(`INSERT INTO vorgaenge (akte_id,prioritaet,titel,zusammenfassung,felder,aktion,wirkung) VALUES (?,?,?,?,?,?,?)`).run(
      id, "pruefen", "Neue Akte – Vollmacht und erste Schreiben vorbereitet",
      `Neue Akte ${titel}. Vorbereitet: ${naechster || "Vollmacht + Fragebogen an Mandant"}.`,
      JSON.stringify([{ label: "Mandant", wert: w.mandant, quelle: "Fallaufnahme" }, { label: "Versicherung", wert: w.versicherung || "–", quelle: "Fallaufnahme" }]),
      "Bestätigen & senden",
      JSON.stringify({ wv: { tage: 7, titel: "Vollmacht und Fragebogen zurück?" }, verlauf: "Vollmacht + Fragebogen an Mandant versandt", prioritaet: "wartet" }));
    d.prepare("INSERT INTO fristen (akte_id,art,datum,titel,wer) VALUES (?,?,?,?,?)").run(id, "wv", plusTage(1), "Neue Akte prüfen", wer());
  })();
  return NextResponse.json({ id });
}
