// Regelbasierte Dokumenterkennung (ohne KI): Typ, Absender, Beträge, Zeichen, Fristen, passende Akte.
// Später durch ein KI-Modell ersetzbar – die Rückgabe bleibt gleich.

export const DOKTYPEN = [
  "Abrechnungsschreiben", "Gutachten", "Reparaturrechnung", "Mietwagenrechnung", "Abschleppkostenrechnung",
  "Gutachterrechnung", "Rechnung", "Ärztliches Attest", "Vollmacht", "Fragebogen", "Ermittlungsakte",
  "Ladung", "Beschluss", "Urteil", "Kostenfestsetzungsbeschluss", "Deckungszusage", "Schreiben Versicherung",
  "Schreiben Gericht", "Schreiben Gegenseite", "Fotos", "Sonstiges",
] as const;

const REGELN: [string, RegExp][] = [
  ["Kostenfestsetzungsbeschluss", /kostenfestsetzungsbeschluss/i],
  ["Urteil", /\bim namen des volkes\b|\burteil\b/i],
  ["Beschluss", /\bbeschluss\b/i],
  ["Ladung", /\bladung\b|termin zur mündlichen verhandlung/i],
  ["Ermittlungsakte", /ermittlungsakte|verkehrsunfallanzeige|tagebuch-?nr|tgb\.?-?nr/i],
  ["Abrechnungsschreiben", /regulier|wir zahlen|überwiesen|angewiesen|gekürzt|abrechnung zu|unsere abrechnung/i],
  ["Gutachterrechnung", /(sachverständig|gutacht)\w*\s.{0,40}rechnung|rechnung\s(?:für|über)\s.{0,20}gutacht/i],
  ["Mietwagenrechnung", /mietwagen|autovermietung|mietfahrzeug|anmietung/i],
  ["Abschleppkostenrechnung", /abschlepp/i],
  ["Reparaturrechnung", /(reparatur|instandsetzung|werkstatt|autohaus).{0,120}(rechnung|gesamtbetrag)|rechnung.{0,120}(reparatur|instandsetzung)/i],
  ["Gutachten", /sachverständigengutachten|schadengutachten|wiederbeschaffungswert|restwert|gutachten-?nr|^gutachten/i],
  ["Deckungszusage", /deckungszusage|deckungsschutz|kostenschutz/i],
  ["Ärztliches Attest", /attest|arbeitsunfähig|diagnose|praxis dr\./i],
  ["Vollmacht", /\bvollmacht\b/i],
  ["Fragebogen", /fragebogen/i],
  ["Rechnung", /\brechnung\b|rechnungsnummer|rechnung nr/i],
];

const VERSICHERER = ["HUK-Coburg", "HUK", "Allianz", "DEVK", "R+V", "VHV", "HDI", "AXA", "Generali", "Zurich", "Ergo", "LVM", "Provinzial", "Debeka", "Signal Iduna", "Württembergische", "Gothaer", "Itzehoer", "ARAG", "Roland", "Advocard", "ÖRAG"];

export interface AkteIndex { id: string; titel: string; zeichen: string[]; namen: string[] }
export interface DokErkannt {
  typ: string;
  absender: string;
  datum: string; // yyyy-mm-dd
  betraege: { label: string; wert: number }[];
  zeichen: string;
  frist: { datum: string; text: string } | null;
  akteId: string | null;
  akteGrund: string;
  sicher: boolean;
  kandidaten: string[];
  zusammenfassung: string;
  dateiname: string;
}

const zahl = (s: string) => Number(s.replace(/\./g, "").replace(",", "."));
const euro = (n: number) => n.toLocaleString("de-DE", { minimumFractionDigits: 2 }) + " €";
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const kurz = (s: string) => s.replace(/[^\wäöüÄÖÜß]+/g, "").slice(0, 24);

export function erkenneDokument(textRoh: string, dateiname: string, akten: AkteIndex[], heute = new Date()): DokErkannt {
  const t = textRoh.replace(/\s+/g, " ").trim();
  const low = t.toLowerCase();

  const typ = t ? REGELN.find(([, re]) => re.test(t))?.[0] ?? "Sonstiges" : /\.(jpe?g|png|heic)$/i.test(dateiname) ? "Fotos" : "Sonstiges";

  // Absender: bekannter Versicherer, sonst Firmenname mit Rechtsform, sonst erste Wörter
  const vers = VERSICHERER.find((v) => low.includes(v.toLowerCase()));
  const firma = t.match(/([A-ZÄÖÜ][\wäöüß&.-]*(?:\s[A-ZÄÖÜ][\wäöüß&.-]*){0,3}\s(?:GmbH|AG|KG|e\.K\.|UG|GbR|OHG|mbH))/)?.[1];
  const gericht = t.match(/((?:Amtsgericht|Landgericht|Oberlandesgericht)\s[A-ZÄÖÜ][\wäöüß-]+)/)?.[1];
  const polizei = t.match(/(Polizei\w*\s[A-ZÄÖÜ][\wäöüß-]+|PK\s?\d+\s?[A-ZÄÖÜ]?[\wäöüß-]*)/)?.[1];
  const absender = (gericht ?? polizei ?? (vers === "HUK" ? "HUK-Coburg" : vers) ?? firma ?? t.split(" ").slice(0, 3).join(" ")).trim() || "unbekannt";

  // Datum: „Datum: …“ oder erstes Datum, sonst heute
  const dm = t.match(/(?:datum|rechnungsdatum)[:\s]+(\d{1,2})\.(\d{1,2})\.(\d{4})/i); // sonst Eingangsdatum
  const datum = dm ? `${dm[3]}-${dm[2].padStart(2, "0")}-${dm[1].padStart(2, "0")}` : iso(heute);

  // Beträge
  const betraege: { label: string; wert: number }[] = [];
  const re = /([A-Za-zÄÖÜäöüß-]{4,}(?:\s[A-Za-zÄÖÜäöüß-]{3,}){0,2})\s*:?\s*(\d{1,3}(?:\.\d{3})*,\d{2})\s*(?:€|EUR|Euro)/g;
  for (const m of Array.from(t.matchAll(re))) {
    const w = m[1].trim().split(" ");
    const label = (/gesamt|summe|betrag/i.test(w[w.length - 1]) ? w[w.length - 1] : w.slice(-2).join(" ")).replace(/^(um|von|über|laut)\s+/i, "");
    if (/^(um|von|über|in höhe)$/i.test(w[w.length - 1])) continue;
    if (betraege.length < 6 && !betraege.some((b) => b.label === label)) betraege.push({ label, wert: zahl(m[2]) });
  }
  const kuerz = t.match(/(?:um|in höhe von)\s(\d{1,3}(?:\.\d{3})*,\d{2})\s*(?:€|EUR|Euro)\s*gekürzt/i);
  if (kuerz) betraege.push({ label: "Kürzung", wert: zahl(kuerz[1]) });

  // Zeichen (Schadennummer, Az., Rechnungsnummer)
  const zeichen = t.match(/(?:schaden-?(?:nr|nummer)|aktenzeichen|az|ihr zeichen|unser zeichen)\.?[:\s]+([A-Z0-9][\w\/.-]{3,})/i)?.[1] ?? "";

  // Frist im Dokument
  let frist: DokErkannt["frist"] = null;
  const bis = t.match(/(?:bis zum|bis spätestens|binnen|innerhalb von)\s+(\d{1,2}\.\d{1,2}\.\d{4}|\d+\s+(?:tagen|wochen|woche|monat(?:en)?))/i);
  if (bis) {
    let d: Date;
    if (/\./.test(bis[1])) { const [tt, mm, jj] = bis[1].split("."); d = new Date(+jj, +mm - 1, +tt); }
    else { const n = parseInt(bis[1]); d = new Date(heute); if (/woche/i.test(bis[1])) d.setDate(d.getDate() + 7 * n); else if (/monat/i.test(bis[1])) d.setMonth(d.getMonth() + n); else d.setDate(d.getDate() + n); }
    const satz = t.split(/(?<=[.!?])\s+/).find((s) => s.includes(bis[0])) ?? bis[0];
    frist = { datum: iso(d), text: satz.slice(0, 160) };
  }

  // Passende Akte: Zeichen > Kennzeichen > Namen
  const scores = akten.map((a) => {
    let s = 0, grund = "";
    for (const z of a.zeichen) if (z && z.length >= 4 && t.replace(/\s/g, "").includes(z.replace(/\s/g, ""))) { s += 10; grund = `Zeichen ${z}`; }
    if (t.includes(a.id)) { s += 10; grund = `Az. ${a.id}`; }
    for (const n of a.namen) if (n && n.length > 3) {
      const nach = n.split(" ").pop()!;
      if (low.includes(n.toLowerCase())) { s += 4; grund ||= `Name ${n}`; } else if (nach.length > 3 && new RegExp(`\\b${nach}\\b`, "i").test(t)) { s += 2; grund ||= `Name ${nach}`; }
    }
    return { id: a.id, s, grund };
  }).filter((x) => x.s > 0).sort((a, b) => b.s - a.s);
  const best = scores[0];
  const sicher = !!best && best.s >= 4 && (!scores[1] || best.s - scores[1].s >= 3);

  const summe = betraege.find((b) => /gesamt|summe|endbetrag|zahl/i.test(b.label)) ?? betraege[0];
  const zusammenfassung = [
    `${typ}${absender !== "unbekannt" ? ` von ${absender}` : ""}`,
    summe ? `Betrag ${euro(summe.wert)}` : "",
    betraege.find((b) => b.label === "Kürzung") ? `Kürzung ${euro(betraege.find((b) => b.label === "Kürzung")!.wert)}` : "",
    frist ? `Frist bis ${frist.datum.split("-").reverse().join(".")}` : "",
    !t ? "Kein Text lesbar (Scan/Bild) – bitte prüfen" : "",
  ].filter(Boolean).join(" · ");

  const endung = (dateiname.match(/\.\w+$/)?.[0] ?? ".pdf").toLowerCase();
  return {
    typ, absender, datum, betraege, zeichen, frist,
    akteId: best?.id ?? null, akteGrund: best?.grund ?? "", sicher, kandidaten: scores.slice(0, 3).map((x) => x.id),
    zusammenfassung, dateiname: `${datum}_${kurz(typ)}_${kurz(absender)}${endung}`,
  };
}

/** Dateiname nach Kanzlei-Schema: JJJJ-MM-TT_Typ_Absender */
export function schemaName(datum: string, typ: string, absender: string, endung = ".pdf") {
  return `${datum}_${kurz(typ)}_${kurz(absender)}${endung}`;
}
