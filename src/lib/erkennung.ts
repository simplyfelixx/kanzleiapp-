// Einfache, regelbasierte Erkennung für die Fallaufnahme (ohne KI).
// Später durch ein KI-Modell ersetzbar – die Rückgabe bleibt gleich.

export interface Erkannt {
  mandant: string;
  telefon: string;
  email: string;
  adresse: string;
  gegner: string;
  kennzeichen: string;
  versicherung: string;
  rsv: string;
  unfalltag: string;
  unfallort: string;
  schilderung: string;
  polizei: string;
  verletzt: string;
  fahrbereit: string;
  finanzierung: string;
  ausfall: string;
  gutachter: string;
}

export const LEER: Erkannt = {
  mandant: "", telefon: "", email: "", adresse: "", gegner: "", kennzeichen: "", versicherung: "", rsv: "",
  unfalltag: "", unfallort: "", schilderung: "", polizei: "", verletzt: "", fahrbereit: "", finanzierung: "", ausfall: "", gutachter: "",
};

const VERSICHERUNGEN = ["HUK-Coburg", "HUK24", "HUK", "Allianz", "DEVK", "R+V", "VHV", "HDI", "AXA", "Generali", "Zurich", "Ergo", "LVM", "Provinzial", "Debeka", "Signal Iduna", "Württembergische", "WGV", "Gothaer", "Itzehoer", "Barmenia", "Kravag", "Admiral Direkt", "CosmosDirekt", "DA Direkt", "Verti", "Alte Leipziger", "Continentale", "SV Sparkassen", "Mecklenburgische", "VGH", "Concordia"];
const RSV = ["ARAG", "Roland", "D.A.S.", "DAS", "Advocard", "Auxilia", "ÖRAG", "Örag", "Allianz", "HUK", "DEVK", "R+V", "ERGO", "Ergo"];
const NAME = "[A-ZÄÖÜ][a-zäöüß]+(?:[- ][A-ZÄÖÜ][a-zäöüß]+)?";

const erstes = (t: string, re: RegExp, gruppe = 1) => { const m = t.match(re); return m ? (m[gruppe] ?? m[0]).trim() : ""; };
const satzMit = (t: string, re: RegExp) => t.split(/(?<=[.!?])\s+/).find((s) => re.test(s))?.trim() ?? "";
const datum = (d: Date) => d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });

export function erkenne(text: string, heute = new Date()): Erkannt {
  const t = text.replace(/\s+/g, " ").trim();
  const e: Erkannt = { ...LEER };
  if (!t) return e;

  // Mandant: erste Nennung mit Anrede
  e.mandant = erstes(t, new RegExp(`\\b(?:Herr|Frau)\\s+(${NAME}(?:\\s+${NAME})?)`));
  if (!e.mandant) e.mandant = erstes(t, new RegExp(`(?:Mandant(?:in)?|Name)[: ]+(${NAME}(?:\\s+${NAME})?)`));

  e.telefon = erstes(t, /((?:\+49|0)[1-9][\d \/-]{6,16}\d)/);
  e.email = erstes(t, /([\w.+-]+@[\w-]+\.[\w.]+)/);
  e.adresse = erstes(t, /(?:wohnt|Adresse|wohnhaft)[: ]+(?:in |im |am |an der )?([A-ZÄÖÜ][^,.;]*?\d+[a-z]?(?:,\s*\d{5}\s+[A-ZÄÖÜ][a-zäöüß-]+)?)/);

  // Gegner
  e.gegner = erstes(t, new RegExp(`(?:Gegner|Unfallgegner|Unfallverursacher|Verursacher|Fahrer)(?:in)?\\s*(?:heißt|hei(?:ss)t|ist|war|:)?\\s+(?:Herr |Frau )?(${NAME}(?:\\s+${NAME})?)`));
  e.kennzeichen = erstes(t, /\b([A-ZÄÖÜ]{1,3}[- ][A-Z]{1,2} ?\d{1,4}[EH]?)\b/);

  // Versicherung (bevorzugt nach „versichert“)
  const nachVersichert = t.match(/versichert\s+(?:bei|über)\s+(?:der\s+|dem\s+)?([^,.;]+)/i)?.[1] ?? "";
  e.versicherung = VERSICHERUNGEN.find((v) => nachVersichert.toLowerCase().includes(v.toLowerCase()))
    ?? VERSICHERUNGEN.find((v) => new RegExp(`\\b${v.replace(/[+.]/g, "\\$&")}\\b`, "i").test(t.replace(/Rechtsschutz[^.]*\./gi, ""))) ?? "";

  const rsvSatz = satzMit(t, /rechtsschutz/i);
  if (rsvSatz) {
    if (/kein(?:e|en)? rechtsschutz|nicht rechtsschutz/i.test(rsvSatz)) e.rsv = "nein";
    else e.rsv = "ja" + ((x) => (x ? ` · ${x}` : ""))(RSV.find((r) => rsvSatz.includes(r)) ?? "");
  }

  // Unfalltag und Uhrzeit
  const d = t.match(/\b(\d{1,2})\.(\d{1,2})\.(\d{2,4})?/);
  if (d) {
    const jahr = d[3] ? (d[3].length === 2 ? "20" + d[3] : d[3]) : String(heute.getFullYear());
    e.unfalltag = `${d[1].padStart(2, "0")}.${d[2].padStart(2, "0")}.${jahr}`;
  } else if (/\bvorgestern\b/i.test(t)) e.unfalltag = datum(new Date(heute.getTime() - 2 * 864e5));
  else if (/\bgestern\b/i.test(t)) e.unfalltag = datum(new Date(heute.getTime() - 864e5));
  else if (/\bheute\b/i.test(t)) e.unfalltag = datum(heute);
  const uhr = erstes(t, /\b(?:gegen|um|ca\.?)?\s*(\d{1,2}(?::\d{2})?)\s*Uhr/);
  if (uhr && e.unfalltag) e.unfalltag += `, ~${uhr.includes(":") ? uhr : uhr + ":00"}`;

  // Ort
  e.unfallort = erstes(e.adresse ? t.replace(e.adresse, "") : t, /\b(?:auf der|in der|an der|auf dem|im|in)\s+((?:A|B)\s?\d+[^,.;]*|[A-ZÄÖÜ][\wäöüß-]*(?:straße|str\.|weg|allee|platz|ring|damm|chaussee|kreuzung)[^,.;]*|[A-ZÄÖÜ][\wäöüß-]+ (?:Straße|Weg|Allee|Platz|Ring|Damm|Chaussee|Kreuzung)[^,.;]*)/);

  e.unfallort = e.unfallort.split(/\s+(?:ist|hat|war|wurde|fuhr|kam|als|wo|beim|bei|während|gegen|um)\b/)[0].trim();

  // Hergang
  e.schilderung = satzMit(t, /(drauf|aufgefahren|aufgefahren|gefahren|zusammengestoßen|übersehen|gerammt|Vorfahrt|abgebogen|ausgeparkt|geparkt|Unfall)/i);

  // Polizei
  if (/keine polizei|polizei (?:war )?nicht|ohne polizei/i.test(t)) e.polizei = "nein";
  else if (/polizei|beamte/i.test(t)) {
    const ps = satzMit(t, /polizei|beamte|(?<![-\w])PK \d/i);
    e.polizei = "ja" + ((x) => (x ? ` · ${x}` : ""))(erstes(ps, /(Autobahnpolizei|Polizei(?:kommissariat|revier|station|inspektion)\s+[A-ZÄÖÜ][\wäöüß-]+|(?<![-\w])PK \d+[\wäöüß ]*)/));
  }

  // Verletzungen
  if (/nicht verletzt|unverletzt|keine verletzung/i.test(t)) e.verletzt = "nein";
  else {
    const s = satzMit(t, /(schmerz|verletz|HWS|Schleudertrauma|Arzt|Krankenhaus|Prellung)/i);
    if (s) e.verletzt = "ja · " + s.replace(/^(?:er|sie)\s+/i, "");
  }

  // Fahrzeug
  if (/nicht (?:mehr )?fahrbereit|totalschaden|abgeschleppt/i.test(t)) e.fahrbereit = "nein" + (/totalschaden/i.test(t) ? " · Totalschaden" : "");
  else if (/fahrbereit/i.test(t)) e.fahrbereit = "ja";

  const fin = satzMit(t, /(leasing|geleast|finanziert|finanzierung)/i);
  if (fin) {
    const art = /leas/i.test(fin) ? "Leasing" : "Finanzierung";
    const bank = erstes(fin, /(?:über|bei|von)\s+(?:der\s+|die\s+)?([A-ZÄÖÜ][\wäöüß&-]*(?:\s[A-ZÄÖÜ][\wäöüß&-]*){0,2})/);
    e.finanzierung = art + (bank ? ` · ${bank}` : "");
  }

  if (/mietwagen|leihwagen|ersatzwagen/i.test(t)) e.ausfall = "Mietwagen";
  else if (/nutzungsausfall/i.test(t)) e.ausfall = "Nutzungsausfall";

  if (/gutachter|sachverständig/i.test(t)) e.gutachter = /kein(?:en)? gutachter|noch kein/i.test(t) ? "noch nicht beauftragt" : "erwähnt";
  return e;
}

/** Was für eine vollständige Akte noch fehlt – als Fragen fürs Telefonat. */
export function fehlt(e: Erkannt): { feld: keyof Erkannt; frage: string; grund: string }[] {
  const f: { feld: keyof Erkannt; frage: string; grund: string }[] = [];
  if (!e.mandant) f.push({ feld: "mandant", frage: "Name des Mandanten?", grund: "Pflicht" });
  if (!e.telefon && !e.email) f.push({ feld: "telefon", frage: "Telefon oder E-Mail?", grund: "für Rückfragen" });
  if (!e.adresse) f.push({ feld: "adresse", frage: "Adresse des Mandanten?", grund: "für Vollmacht" });
  if (!e.email) f.push({ feld: "email", frage: "E-Mail für Portal-Link?", grund: "Mandantenportal" });
  if (!e.versicherung) f.push({ feld: "versicherung", frage: "Bei wem ist der Gegner versichert?", grund: "Schadensmeldung" });
  if (!e.kennzeichen) f.push({ feld: "kennzeichen", frage: "Kennzeichen des Gegners?", grund: "Zentralruf" });
  if (!e.unfalltag) f.push({ feld: "unfalltag", frage: "Wann war der Unfall?", grund: "Fristen" });
  if (!e.polizei) f.push({ feld: "polizei", frage: "War die Polizei vor Ort?", grund: "Akteneinsicht" });
  if (!e.rsv) f.push({ feld: "rsv", frage: "Rechtsschutzversicherung vorhanden?", grund: "Deckungsanfrage" });
  if (!e.gutachter) f.push({ feld: "gutachter", frage: "Gutachter schon beauftragt?", grund: "sonst vermitteln" });
  if (!e.ausfall) f.push({ feld: "ausfall", frage: "Mietwagen oder Nutzungsausfall?", grund: "Aktenkonto" });
  return f;
}
