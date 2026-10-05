// Beispieldaten – keine echten Mandantendaten.

export type Prioritaet = "heute" | "woche" | "pruefen" | "wartet" | "laeuft";
export type Gebiet = "VR" | "StR" | "ArbR";

export interface Akte {
  id: string; // Aktenzeichen
  titel: string;
  gebiet: Gebiet;
  prioritaet: Prioritaet;
  mandant: string;
  mandantTel: string;
  versicherung: string;
  sachbearbeiter: string;
  durchwahl: string;
  schadennummer: string;
  phase: string;
  konto: { position: string; gefordert: number; gezahlt: number }[];
  stand: string;
}

export interface Vorgang {
  id: string;
  akteId: string;
  prioritaet: Prioritaet;
  titel: string;
  zusammenfassung: string;
  felder: { label: string; wert: string; quelle: string; unsicher?: boolean }[];
  entwurf?: string;
  aktion: string;
}

export type Quelle = "MAIL" | "beA" | "SCAN" | "PORTAL";

export interface Eingangsdokument {
  id: string;
  quelle: Quelle;
  zeit: string;
  typ: string;
  absender: string;
  akteId: string | null;
  sicher: boolean;
  erkannt: string;
  dateiname: string;
  felder: { label: string; wert: string; quelle: string }[];
  folgeaktionen: string[];
  vorschau: string;
}

export const akten: Akte[] = [
  {
    id: "214/26", titel: "Müller ./. HUK-Coburg", gebiet: "VR", prioritaet: "heute",
    mandant: "Thomas Müller", mandantTel: "0172 4481 903",
    versicherung: "HUK-Coburg", sachbearbeiter: "Frau Jansen", durchwahl: "09561 96-24417",
    schadennummer: "77-4410-2", phase: "Prüffrist – Nachfrist abgelaufen",
    konto: [
      { position: "Reparatur", gefordert: 4120, gezahlt: 3400 },
      { position: "Gutachter", gefordert: 780, gezahlt: 780 },
      { position: "Nutzungsausfall", gefordert: 712, gezahlt: 0 },
      { position: "Pauschale", gefordert: 25, gezahlt: 25 },
    ],
    stand: "HUK hat 4.205 € gezahlt, 1.432 € offen. Wir warten auf Zahlung (Nachfrist abgelaufen), Attest vom Mandanten und Akteneinsicht. Nächstes: Erinnerung mit Klageandrohung.",
  },
  {
    id: "198/26", titel: "Bauer ./. HDI", gebiet: "VR", prioritaet: "heute",
    mandant: "Lisa Bauer", mandantTel: "0160 1182 442", versicherung: "HDI", sachbearbeiter: "Herr Kraft",
    durchwahl: "0511 645-3310", schadennummer: "HD-55-2019", phase: "Abschluss",
    konto: [{ position: "Reparatur", gefordert: 2890, gezahlt: 2890 }],
    stand: "Regulierung abgeschlossen. Verjährung von Restansprüchen zum 31.12. prüfen.",
  },
  {
    id: "221/26", titel: "Schmidt ./. Allianz", gebiet: "VR", prioritaet: "woche",
    mandant: "Peter Schmidt", mandantTel: "0151 7745 210", versicherung: "Allianz", sachbearbeiter: "Herr Becker",
    durchwahl: "089 3800-12210", schadennummer: "AS-2210-88", phase: "Kürzung",
    konto: [
      { position: "Reparatur", gefordert: 6300, gezahlt: 6300 },
      { position: "Wertminderung", gefordert: 800, gezahlt: 0 },
    ],
    stand: "Allianz hat die Wertminderung (800 €) gekürzt. Nachforderung ist entworfen.",
  },
  {
    id: "230/26", titel: "Weber ./. DEVK", gebiet: "VR", prioritaet: "pruefen",
    mandant: "Eva Weber", mandantTel: "0176 3321 908", versicherung: "DEVK", sachbearbeiter: "Frau Ilić",
    durchwahl: "0221 757-4410", schadennummer: "DK-77812", phase: "Unterlagen",
    konto: [{ position: "Reparatur", gefordert: 0, gezahlt: 0 }],
    stand: "Gutachten ist eingegangen und ausgelesen. Anspruchsschreiben kann vorbereitet werden.",
  },
  {
    id: "233/26", titel: "Koch ./. Brandt GmbH", gebiet: "ArbR", prioritaet: "wartet",
    mandant: "Sven Koch", mandantTel: "0170 2290 113", versicherung: "–", sachbearbeiter: "–",
    durchwahl: "–", schadennummer: "–", phase: "Berufung",
    konto: [], stand: "Berufungsbegründung liegt beim Anwalt.",
  },
];

export const vorgaenge: Vorgang[] = [
  {
    id: "v1", akteId: "214/26", prioritaet: "heute", aktion: "Bestätigen & senden",
    titel: "Nachfrist abgelaufen – Erinnerung mit Klageandrohung bereit",
    zusammenfassung: "Nachfrist bis 02.10. abgelaufen, 1.432 € offen. KI hat eine Erinnerung mit Klageandrohung erstellt, Frist 14 Tage.",
    felder: [
      { label: "Empfänger", wert: "HUK-Coburg, Schaden", quelle: "Akte" },
      { label: "Schaden-Nr.", wert: "77-4410-2", quelle: "Mail 21.09." },
      { label: "Offener Betrag", wert: "1.432,00 €", quelle: "Aktenkonto" },
      { label: "Neue Frist", wert: "19.10.2026", quelle: "Regel: +14 Tage", unsicher: true },
    ],
    entwurf: "Sehr geehrte Damen und Herren,\n\nin obiger Angelegenheit haben wir Sie mit Schreiben vom 25.08.2026 zur Regulierung aufgefordert. Ein Betrag von 1.432,00 € ist weiterhin offen. Wir setzen Ihnen eine letzte Frist bis zum 19.10.2026. Nach fruchtlosem Ablauf werden wir unserem Mandanten empfehlen, Klage zu erheben.\n\nMit freundlichen Grüßen",
  },
  {
    id: "v2", akteId: "198/26", prioritaet: "heute", aktion: "An Anwalt",
    titel: "Verjährung 31.12. – Anwalt prüfen",
    zusammenfassung: "Restansprüche verjähren zum Jahresende. Bitte entscheiden: Verzicht einholen oder Klage.",
    felder: [{ label: "Verjährung", wert: "31.12.2026", quelle: "Unfalldatum 2023 + 3 Jahre" }],
  },
  {
    id: "v3", akteId: "221/26", prioritaet: "woche", aktion: "Bestätigen & senden",
    titel: "Kürzung 800 € Wertminderung – Nachforderung entworfen",
    zusammenfassung: "Allianz kürzt die merkantile Wertminderung vollständig. Gutachten weist 800 € aus. Nachforderung mit Verweis auf Gutachten vorbereitet.",
    felder: [
      { label: "Gekürzt", wert: "800,00 €", quelle: "Abrechnung Allianz 01.10." },
      { label: "Laut Gutachten", wert: "800,00 €", quelle: "Gutachten S. 5" },
    ],
    entwurf: "Sehr geehrter Herr Becker,\n\ndie Kürzung der merkantilen Wertminderung ist nicht nachvollziehbar. Der Sachverständige hat diese auf Seite 5 seines Gutachtens mit 800,00 € beziffert. Wir bitten um Ausgleich bis zum 19.10.2026.\n\nMit freundlichen Grüßen",
  },
  {
    id: "v4", akteId: "230/26", prioritaet: "pruefen", aktion: "Bestätigen",
    titel: "Gutachten erkannt, 4 Beträge übernommen",
    zusammenfassung: "Gutachten SV Brandt ausgelesen. Reparaturkosten, Wertminderung, Nutzungsausfall und Gutachterkosten ins Aktenkonto übernommen.",
    felder: [
      { label: "Reparatur netto", wert: "5.410,00 €", quelle: "Gutachten S. 3" },
      { label: "Wertminderung", wert: "450,00 €", quelle: "Gutachten S. 5" },
      { label: "Nutzungsausfall", wert: "65 €/Tag × 5", quelle: "Gutachten S. 4", unsicher: true },
      { label: "Gutachterkosten", wert: "690,00 €", quelle: "Rechnung SV" },
    ],
  },
];

export const eingang: Eingangsdokument[] = [
  {
    id: "e1", quelle: "MAIL", zeit: "09:41", typ: "Abrechnungsschreiben", absender: "HUK-Coburg",
    akteId: "214/26", sicher: true, dateiname: "2026-09-21_Abrechnungsschreiben_HUK",
    erkannt: "Abrechnungsschreiben der HUK. Teilzahlung 4.205 €, Kürzung 720 € (Verbringung, UPE), Nutzungsausfall abgelehnt.",
    felder: [
      { label: "Gezahlt", wert: "4.205,00 €", quelle: "S. 1, Zeile 8–10" },
      { label: "Gekürzt", wert: "720,00 € Reparatur", quelle: "S. 1, Absatz 3" },
      { label: "Abgelehnt", wert: "Nutzungsausfall", quelle: "S. 1, Absatz 3" },
    ],
    folgeaktionen: ["Aktenkonto aktualisieren", "Nachforderung Verbringung/UPE entwerfen", "Wiedervorlage in 7 Tagen"],
    vorschau: "Schaden-Nr. 77-4410-2 · Ihr Mandant Thomas Müller\n\nWir regulieren wie folgt: Reparaturkosten 3.400,00 €, Sachverständigenkosten 780,00 €, Kostenpauschale 25,00 €.\n\nDie Reparaturkosten wurden um 720,00 € gekürzt, da Verbringungskosten und UPE-Aufschläge nicht erstattungsfähig sind. Nutzungsausfall wird derzeit nicht erstattet.",
  },
  {
    id: "e2", quelle: "MAIL", zeit: "09:12", typ: "Reparaturrechnung", absender: "Autohaus Nord",
    akteId: "221/26", sicher: true, dateiname: "2026-10-05_Reparaturrechnung_AutohausNord",
    erkannt: "Reparaturrechnung Nr. 88124 über 6.300 € brutto.",
    felder: [{ label: "Betrag", wert: "6.300,00 €", quelle: "S. 2, Summe" }],
    folgeaktionen: ["Aktenkonto aktualisieren", "An Versicherung weiterleiten"],
    vorschau: "Rechnung Nr. 88124 · Fahrzeug HH-PS 801\n\nInstandsetzung Heck lt. Gutachten … Gesamtbetrag 6.300,00 € inkl. MwSt.",
  },
  {
    id: "e3", quelle: "PORTAL", zeit: "08:55", typ: "Fotos (6) · Führerschein", absender: "Mandant Wolf",
    akteId: "205/26", sicher: true, dateiname: "2026-10-05_Fotos_Mandant",
    erkannt: "Mandantin hat 6 Fotos und den Führerschein hochgeladen. Offene Aufgabe „Fotos“ ist damit erledigt.",
    felder: [{ label: "Dateien", wert: "7", quelle: "Portal-Upload" }],
    folgeaktionen: ["Aufgabe im Portal abhaken", "Wiedervorlage entfernen"],
    vorschau: "6 Bilder · 1 PDF (Führerschein)",
  },
  {
    id: "e4", quelle: "beA", zeit: "08:30", typ: "Akteneinsicht Ermittlungsakte", absender: "PK 26 Bahrenfeld",
    akteId: "214/26", sicher: true, dateiname: "2026-10-05_Ermittlungsakte_PK26",
    erkannt: "Ermittlungsakte zum Unfall 14.08. Gegner hat Unfallverursachung eingeräumt.",
    felder: [{ label: "Tgb.-Nr.", wert: "0814/26", quelle: "Deckblatt" }],
    folgeaktionen: ["Akteneinsicht als erledigt markieren", "Kopie an Versicherung"],
    vorschau: "Polizeikommissariat 26 · Tgb.-Nr. 0814/26\n\nVerkehrsunfallanzeige … Beteiligter 1 räumt ein, das geparkte Fahrzeug beim Rangieren übersehen zu haben.",
  },
  {
    id: "e5", quelle: "SCAN", zeit: "gestern", typ: "Schreiben (unleserlich)", absender: "unbekannt",
    akteId: null, sicher: false, dateiname: "2026-10-04_Schreiben_unbekannt",
    erkannt: "Absender nicht eindeutig. Mögliche Akten: 230/26 Weber oder 221/26 Schmidt.",
    felder: [], folgeaktionen: ["Akte wählen"],
    vorschau: "[Scan, 2 Seiten, teilweise unleserlich] … Schadensache Weber/Schmidt? … bitten um Rückruf …",
  },
];

export const prioFarbe: Record<Prioritaet, string> = {
  heute: "var(--rot)", woche: "var(--orange)", pruefen: "var(--gelb)", wartet: "var(--grau)", laeuft: "var(--gruen)",
};
export const prioLabel: Record<Prioritaet, string> = {
  heute: "HEUTE", woche: "WOCHE", pruefen: "PRÜFEN", wartet: "WARTET", laeuft: "LÄUFT",
};
export const euro = (n: number) => n.toLocaleString("de-DE", { minimumFractionDigits: 2 }) + " €";
