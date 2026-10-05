// Pseudonymisierung vor der KI: personenbezogene Angaben werden durch Platzhalter ersetzt
// ([PERSON_1], [TEL_1] …) und nach der Antwort wieder eingesetzt. Die Zuordnung bleibt nur im Speicher.

export interface Pseudonym {
  text: string;
  anzahl: number;
  /** Platzhalter in einem Text der KI-Antwort zurückübersetzen */
  zurueck: (s: string) => string;
}

const MUSTER: [string, RegExp][] = [
  ["EMAIL", /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g],
  ["IBAN", /\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){3,7}(?:\s?[A-Z0-9]{1,4})?\b/g],
  ["TEL", /(?:\+49|\b0)\s?\(?\d{2,5}\)?[\s\/-]?\d[\d\s\/-]{4,12}\d/g],
  ["KZ", /\b[A-ZÄÖÜ]{1,3}[- ][A-Z]{1,2}\s?\d{1,4}[EH]?\b/g],
  ["ADRESSE", /\b[A-ZÄÖÜ][a-zäöüß-]+(?:straße|strasse|str\.|weg|allee|platz|ring|damm|gasse|chaussee)\s\d+\s?[a-z]?\b/g],
  ["PLZ", /\b\d{5}\s[A-ZÄÖÜ][a-zäöüß-]+\b/g],
  ["GEBDAT", /\b(?:geb\.?|geboren(?: am)?)\s*\d{1,2}\.\d{1,2}\.\d{2,4}/gi],
];
const NAME = "[A-ZÄÖÜ][a-zäöüß]+(?:-[A-ZÄÖÜ][a-zäöüß]+)?";
const PERSON = new RegExp(
  `(?:\\b(?:Herr|Herrn|Frau|Hr\\.|Fr\\.|Mandant(?:in)?|Gegner(?:in)?|heißt|namens|Dr\\.)\\s+)((?:${NAME}\\s)?${NAME})`, "g");
const KEIN_NAME = /^(Der|Die|Das|Ein|Eine|Ist|War|Hat|Und|Mit|Bei|Von|Aus|Auf|Gestern|Heute|Polizei|Leasing)$/;
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function anonymisieren(eingabe: string, bekannteNamen: string[] = []): Pseudonym {
  const zuordnung = new Map<string, string>(); // Original -> Platzhalter
  const zaehler: Record<string, number> = {};
  const platz = (art: string, original: string) => {
    const o = original.trim();
    if (!zuordnung.has(o)) zuordnung.set(o, `[${art}_${(zaehler[art] = (zaehler[art] ?? 0) + 1)}]`);
    return zuordnung.get(o)!;
  };
  let t = eingabe;

  for (const [art, re] of MUSTER) t = t.replace(re, (m) => platz(art, m));

  // Personen: bekannte Namen aus den Akten + Namen nach Anrede oder „heißt“
  const namen = new Set(bekannteNamen.filter((n) => n && n.trim().length > 2).map((n) => n.trim()));
  for (const m of Array.from(t.matchAll(PERSON))) {
    const n = m[1].split(" ").filter((w) => !KEIN_NAME.test(w)).join(" ");
    if (n.length > 2) namen.add(n);
  }
  // Längste zuerst, Nachname einzeln auf denselben Platzhalter
  for (const n of Array.from(namen).sort((a, b) => b.length - a.length)) {
    const p = platz("PERSON", n);
    t = t.replace(new RegExp(`\\b${esc(n)}\\b`, "g"), p);
    const nach = n.split(" ");
    if (nach.length > 1 && nach[nach.length - 1].length > 3) {
      const nn = nach[nach.length - 1];
      if (!zuordnung.has(nn)) zuordnung.set(nn, p);
      t = t.replace(new RegExp(`\\b${esc(nn)}\\b`, "g"), p);
    }
  }

  // Rückübersetzung: Platzhalter -> erstes (vollständigstes) Original
  const rueck = new Map<string, string>();
  for (const [o, p] of Array.from(zuordnung.entries())) if (!rueck.has(p) || o.length > rueck.get(p)!.length) rueck.set(p, o);
  const zurueck = (s: string) => s.replace(/\[[A-Z]+_\d+\]/g, (p) => rueck.get(p) ?? p);
  return { text: t, anzahl: rueck.size, zurueck };
}

/** Alle String-Werte eines Objekts zurückübersetzen */
export function tiefZurueck<T>(wert: T, zurueck: (s: string) => string): T {
  if (typeof wert === "string") return zurueck(wert) as T;
  if (Array.isArray(wert)) return wert.map((x) => tiefZurueck(x, zurueck)) as T;
  if (wert && typeof wert === "object") return Object.fromEntries(Object.entries(wert).map(([k, v]) => [k, tiefZurueck(v, zurueck)])) as T;
  return wert;
}
