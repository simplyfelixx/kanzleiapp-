// Aufgaben für die KI: Fallaufnahme und Dokumente. Immer mit Pseudonymisierung und Beleg („woher?“).
import { anonymisieren, tiefZurueck } from "./anonym";
import { LEER, type Erkannt } from "./erkennung";
import { DOKTYPEN } from "./dokerkennung";
import { kiJson } from "./ki";

const FELDBESCHREIBUNG: Record<keyof Erkannt, string> = {
  mandant: "Name des Mandanten (Anrufer / Geschädigter)",
  telefon: "Telefonnummer des Mandanten", email: "E-Mail des Mandanten", adresse: "Anschrift des Mandanten",
  gegner: "Name des Unfallgegners", kennzeichen: "Kennzeichen des Gegners", versicherung: "Haftpflichtversicherung des Gegners",
  rsv: "Rechtsschutzversicherung des Mandanten, Format „ja · Name“ oder „nein“",
  unfalltag: "Datum und Uhrzeit des Unfalls, Format TT.MM.JJJJ, HH:MM; relative Angaben wie „gestern“ anhand des heutigen Datums umrechnen",
  unfallort: "Unfallort", schilderung: "Unfallhergang in einem sachlichen Satz",
  polizei: "Polizei vor Ort? Format „ja · Dienststelle“ oder „nein“",
  verletzt: "Verletzungen? Format „ja · Art“ oder „nein“", fahrbereit: "Fahrzeug fahrbereit? „ja“ oder „nein“, ggf. mit Schäden",
  finanzierung: "Finanzierung/Leasing, Format „Leasing · Bank“ oder „Finanzierung · Bank“",
  ausfall: "„Mietwagen“ oder „Nutzungsausfall“", gutachter: "„erwähnt“, „noch nicht beauftragt“ oder Name",
};
const KEYS = Object.keys(LEER) as (keyof Erkannt)[];

export interface KiFall { werte: Partial<Erkannt>; belege: Partial<Record<keyof Erkannt, string>>; ersetzt: number }

export async function kiFallaufnahme(text: string, heute = new Date()): Promise<KiFall> {
  const p = anonymisieren(text.slice(0, 12000));
  const schema = {
    type: "object",
    properties: Object.fromEntries(KEYS.map((k) => [k, {
      type: "object", properties: { wert: { type: "string" }, beleg: { type: "string" } }, required: ["wert", "beleg"],
    }])),
    required: KEYS,
  };
  const system = [
    "Du bist Assistenz in einer deutschen Anwaltskanzlei für Verkehrsrecht und erfasst Angaben aus einer Telefonnotiz.",
    "Gib für jedes Feld den Wert und als Beleg die wörtliche Stelle aus der Notiz zurück (höchstens 15 Wörter).",
    "Erfinde nichts. Steht etwas nicht in der Notiz, sind wert und beleg leere Strings.",
    "Platzhalter wie [PERSON_1] oder [TEL_1] unverändert übernehmen.",
    `Heute ist ${heute.toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" })}.`,
    "Felder:", ...KEYS.map((k) => `- ${k}: ${FELDBESCHREIBUNG[k]}`),
  ].join("\n");
  const roh = await kiJson<Record<string, { wert?: string; beleg?: string }>>(system, p.text, schema);
  const ergebnis = tiefZurueck(roh, p.zurueck);
  const werte: Partial<Erkannt> = {}, belege: KiFall["belege"] = {};
  for (const k of KEYS) {
    const w = String(ergebnis[k]?.wert ?? "").trim().slice(0, 500);
    if (w && !/^(unbekannt|nicht angegeben|-|–|n\/a)$/i.test(w)) { werte[k] = w; belege[k] = String(ergebnis[k]?.beleg ?? "").slice(0, 200); }
  }
  return { werte, belege, ersetzt: p.anzahl };
}

export interface KiDok { typ: string; absender: string; zusammenfassung: string; ersetzt: number }

export async function kiDokument(text: string, bekannteNamen: string[]): Promise<KiDok | null> {
  if (text.trim().length < 40) return null;
  const p = anonymisieren(text.slice(0, 12000), bekannteNamen);
  const schema = {
    type: "object",
    properties: { typ: { type: "string", enum: [...DOKTYPEN] }, absender: { type: "string" }, zusammenfassung: { type: "string" } },
    required: ["typ", "absender", "zusammenfassung"],
  };
  const system = [
    "Du bist Assistenz in einer deutschen Anwaltskanzlei für Verkehrsrecht und sichtest eingegangene Post.",
    "Bestimme den Dokumenttyp, den Absender (Firma, Versicherung, Gericht oder Behörde, kurz) und fasse das Dokument in höchstens zwei sachlichen Sätzen zusammen:",
    "was wird mitgeteilt oder gefordert, welche Beträge und Fristen. Erfinde nichts. Platzhalter wie [PERSON_1] unverändert übernehmen.",
  ].join("\n");
  const r = tiefZurueck(await kiJson<{ typ: string; absender: string; zusammenfassung: string }>(system, p.text, schema), p.zurueck);
  const typ = (DOKTYPEN as readonly string[]).includes(r.typ) ? r.typ : "Sonstiges";
  return { typ, absender: String(r.absender ?? "").slice(0, 80).trim(), zusammenfassung: String(r.zusammenfassung ?? "").slice(0, 400).trim(), ersetzt: p.anzahl };
}
