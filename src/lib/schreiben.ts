// Vorlagen, Platzhalter und PDF-Erzeugung mit Briefkopf.
import fs from "fs";
import path from "path";
import { PDFDocument, StandardFonts, rgb, PDFFont } from "pdf-lib";
import { ABLAGE, db, plusTage } from "./db";

export interface Vorlage { id: number; name: string; typ: string; empfaenger: string; text: string; wv_tage: number; wv_titel: string }
export interface Kanzlei { name: string; zusatz: string; strasse: string; ort: string; telefon: string; email: string; web: string; bank: string; akzent: string; logo: string | null; signatur: string }

export function schreibenTabellen() {
  const d = db();
  d.exec(`
    CREATE TABLE IF NOT EXISTS vorlagen (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, typ TEXT NOT NULL DEFAULT 'Schreiben',
      empfaenger TEXT NOT NULL DEFAULT 'Versicherung', text TEXT NOT NULL, wv_tage INTEGER NOT NULL DEFAULT 0, wv_titel TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS kanzlei (id INTEGER PRIMARY KEY CHECK (id=1), daten TEXT NOT NULL);
  `);
  if (!d.prepare("SELECT 1 FROM vorlagen LIMIT 1").get()) {
    const ins = d.prepare("INSERT INTO vorlagen (name,typ,empfaenger,text,wv_tage,wv_titel) VALUES (?,?,?,?,?,?)");
    for (const v of STANDARD) ins.run(v.name, v.typ, v.empfaenger, v.text, v.wv_tage, v.wv_titel);
  }
  if (!d.prepare("SELECT 1 FROM kanzlei").get())
    d.prepare("INSERT INTO kanzlei (id,daten) VALUES (1,?)").run(JSON.stringify({
      name: "Kanzlei Nord", zusatz: "Rechtsanwälte · Verkehrsrecht", strasse: "Musterstraße 1", ort: "22926 Ahrensburg",
      telefon: "04102 000000", email: "info@kanzlei-nord.de", web: "", bank: "IBAN DE00 0000 0000 0000 0000 00", akzent: "#1E3A6E", logo: null,
      signatur: "Mit freundlichen Grüßen\n\n\nRechtsanwalt",
    } satisfies Kanzlei));
}

const STANDARD: Omit<Vorlage, "id">[] = [
  {
    name: "Anspruchsschreiben Haftpflicht", typ: "Anspruchsschreiben", empfaenger: "Versicherung", wv_tage: 28, wv_titel: "Prüffrist Versicherung abgelaufen? Zahlung prüfen",
    text: `Schaden-Nr.: {{versicherung.zeichen}}
Ihr Versicherungsnehmer: {{gegner.name}}, amtl. Kennzeichen {{gegner.zeichen}}
Unser Mandant: {{mandant.name}}
Unfall vom {{fall.unfalltag}} in {{fall.unfallort}}

Sehr geehrte Damen und Herren,

wir zeigen an, dass wir {{mandant.name}} anwaltlich vertreten. Eine auf uns lautende Vollmacht liegt vor.

Ihr Versicherungsnehmer hat den oben genannten Verkehrsunfall allein verschuldet. Zum Hergang: {{fall.schilderung}}

Wir machen folgende Schäden geltend:

{{konto.positionen}}

Gesamt: {{konto.gefordert}}

Wir fordern Sie auf, den Betrag bis zum {{frist.28}} auf unser Konto zu überweisen und Ihre Einstandspflicht dem Grunde nach zu bestätigen.`,
  },
  {
    name: "Erinnerung mit Klageandrohung", typ: "Erinnerung", empfaenger: "Versicherung", wv_tage: 14, wv_titel: "Zahlung nach Erinnerung prüfen – sonst Klage",
    text: `Schaden-Nr.: {{versicherung.zeichen}}
Unser Mandant: {{mandant.name}}

Sehr geehrte Damen und Herren,

in obiger Angelegenheit haben wir Sie zur Regulierung aufgefordert. Bislang ist ein Betrag von {{konto.offen}} offen.

{{konto.offene_positionen}}

Wir setzen Ihnen hiermit eine letzte Frist bis zum {{frist.14}}. Nach fruchtlosem Ablauf werden wir unserem Mandanten empfehlen, ohne weitere Ankündigung Klage zu erheben.`,
  },
  {
    name: "Nachforderung Kürzung", typ: "Nachforderung", empfaenger: "Versicherung", wv_tage: 14, wv_titel: "Antwort auf Nachforderung prüfen",
    text: `Schaden-Nr.: {{versicherung.zeichen}}
Unser Mandant: {{mandant.name}}

Sehr geehrte Damen und Herren,

vielen Dank für Ihre bisherige Zahlung. Die vorgenommenen Kürzungen sind nicht gerechtfertigt. Offen sind noch:

{{konto.offene_positionen}}

Gesamt offen: {{konto.offen}}

Die Positionen sind im Gutachten ausgewiesen und tatsächlich angefallen. Wir bitten um Ausgleich bis zum {{frist.14}}.`,
  },
  {
    name: "Deckungsanfrage Rechtsschutz", typ: "Deckungsanfrage", empfaenger: "Rechtsschutz", wv_tage: 14, wv_titel: "Deckungszusage eingegangen?",
    text: `Versicherungsnehmer: {{mandant.name}}
Schadenereignis: Verkehrsunfall vom {{fall.unfalltag}}

Sehr geehrte Damen und Herren,

wir zeigen an, dass wir Ihren Versicherungsnehmer {{mandant.name}} vertreten, und bitten um Deckungszusage für die außergerichtliche und gegebenenfalls gerichtliche Geltendmachung von Schadensersatzansprüchen aus dem Verkehrsunfall vom {{fall.unfalltag}}.

Sachverhalt: {{fall.schilderung}}

Gegner: {{gegner.name}}, versichert bei {{versicherung.name}}.`,
  },
  {
    name: "Akteneinsichtsgesuch Polizei", typ: "Akteneinsichtsgesuch", empfaenger: "Polizei", wv_tage: 21, wv_titel: "Ermittlungsakte eingegangen?",
    text: `Verkehrsunfall vom {{fall.unfalltag}} in {{fall.unfallort}}
Beteiligte: {{mandant.name}} / {{gegner.name}}
Ihr Zeichen: {{polizei.zeichen}}

Sehr geehrte Damen und Herren,

wir vertreten {{mandant.name}}. Zur Geltendmachung zivilrechtlicher Ansprüche beantragen wir Einsicht in die Ermittlungsakte bzw. Übersendung einer Kopie der Unfallanzeige.`,
  },
  {
    name: "Sachstandsmitteilung Mandant", typ: "Mandantenbrief", empfaenger: "Mandant", wv_tage: 0, wv_titel: "",
    text: `Ihr Verkehrsunfall vom {{fall.unfalltag}} – Sachstand

Sehr geehrte(r) {{mandant.name}},

wir möchten Sie über den aktuellen Stand informieren:

Vorliegend: {{akte.vorliegend}}
Ausstehend: {{akte.ausstehend}}
Nächster Schritt: {{akte.naechster}}

Bei Fragen erreichen Sie uns jederzeit.`,
  },
];

export function kanzleiLaden(): Kanzlei {
  schreibenTabellen();
  return JSON.parse((db().prepare("SELECT daten FROM kanzlei WHERE id=1").get() as { daten: string }).daten);
}
export function vorlagenLaden(): Vorlage[] {
  schreibenTabellen();
  return db().prepare("SELECT * FROM vorlagen ORDER BY id").all() as Vorlage[];
}

const eur = (n: number) => n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
const de = (iso: string) => iso.split("-").reverse().join(".");

/** Alle Platzhalter einer Akte. Fehlt ein Wert, bleibt er leer und wird gemeldet. */
export function platzhalterWerte(akteId: string): Record<string, string> {
  const d = db();
  const a = d.prepare("SELECT * FROM akten WHERE id=?").get(akteId) as { id: string; titel: string; falldaten: string; stand_vorliegend: string; stand_ausstehend: string; stand_naechster: string } | undefined;
  if (!a) throw new Error("Akte unbekannt");
  const bet = d.prepare("SELECT * FROM beteiligte WHERE akte_id=?").all(akteId) as { rolle: string; name: string; adresse: string; zeichen: string; ansprechpartner: string }[];
  const konto = d.prepare("SELECT * FROM konto WHERE akte_id=? ORDER BY id").all(akteId) as { position: string; gefordert: number; gezahlt: number }[];
  const fall = JSON.parse(a.falldaten || "{}") as Record<string, string>;
  const w: Record<string, string> = {
    "akte.az": a.id, "akte.titel": a.titel, "akte.vorliegend": a.stand_vorliegend, "akte.ausstehend": a.stand_ausstehend, "akte.naechster": a.stand_naechster,
    "datum.heute": de(new Date().toISOString().slice(0, 10)),
    "frist.14": de(plusTage(14)), "frist.28": de(plusTage(28)),
  };
  for (const rolle of ["Mandant", "Gegner", "Versicherung", "Rechtsschutz", "Polizei", "Bank", "Werkstatt", "Gutachter"]) {
    const b = bet.find((x) => x.rolle === rolle);
    const k = rolle.toLowerCase();
    w[`${k}.name`] = b?.name ?? ""; w[`${k}.adresse`] = b?.adresse ?? ""; w[`${k}.zeichen`] = b?.zeichen ?? ""; w[`${k}.ansprechpartner`] = b?.ansprechpartner ?? "";
  }
  if (!w["rechtsschutz.name"] && fall.rsv) w["rechtsschutz.name"] = fall.rsv.replace(/^ja\s*·\s*/, "");
  if (!w["polizei.zeichen"] && fall.polizei) w["polizei.zeichen"] = fall.polizei.replace(/^ja\s*·\s*/, "");
  for (const [k, v] of Object.entries(fall)) w[`fall.${k}`] = v ?? "";
  const gef = konto.reduce((s, p) => s + p.gefordert, 0), gez = konto.reduce((s, p) => s + p.gezahlt, 0);
  w["konto.positionen"] = konto.filter((p) => p.gefordert > 0).map((p) => `– ${p.position}: ${eur(p.gefordert)}`).join("\n");
  w["konto.offene_positionen"] = konto.filter((p) => p.gefordert > p.gezahlt).map((p) => `– ${p.position}: ${eur(p.gefordert - p.gezahlt)}`).join("\n");
  w["konto.gefordert"] = gef ? eur(gef) : "";
  w["konto.gezahlt"] = eur(gez);
  w["konto.offen"] = gef - gez > 0 ? eur(gef - gez) : "";
  return w;
}

export const PLATZHALTER_HILFE = [
  "mandant.name", "mandant.adresse", "gegner.name", "gegner.zeichen", "versicherung.name", "versicherung.adresse", "versicherung.zeichen",
  "fall.unfalltag", "fall.unfallort", "fall.schilderung", "konto.positionen", "konto.offene_positionen", "konto.gefordert", "konto.offen",
  "frist.14", "frist.28", "datum.heute", "akte.az", "akte.vorliegend", "akte.ausstehend", "akte.naechster", "polizei.zeichen", "rechtsschutz.name",
];

/** Text befüllen. Fehlende Werte werden als [[…]] markiert und zurückgegeben. */
export function befuellen(text: string, werte: Record<string, string>) {
  const fehlend = new Set<string>();
  const out = text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, k: string) => {
    const v = werte[k];
    if (v && v.trim()) return v;
    fehlend.add(k);
    return `[[${k}]]`;
  });
  return { text: out, fehlend: Array.from(fehlend) };
}

// ---- PDF ----
function umbrechen(text: string, font: PDFFont, size: number, breite: number): string[] {
  const zeilen: string[] = [];
  for (const absatz of text.split("\n")) {
    if (!absatz.trim()) { zeilen.push(""); continue; }
    let z = "";
    for (const wort of absatz.split(/\s+/)) {
      const probe = z ? `${z} ${wort}` : wort;
      if (font.widthOfTextAtSize(probe, size) > breite && z) { zeilen.push(z); z = wort; } else z = probe;
    }
    zeilen.push(z);
  }
  return zeilen;
}
// Helvetica (WinAnsi) kann keine Zeichen außerhalb von Latin-1 – ersetzen statt abstürzen
const sicher = (s: string) => s.replace(/[–—]/g, "-").replace(/[„“”]/g, '"').replace(/[‚‘’]/g, "'").replace(/…/g, "...").replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF€]/g, "?");

function hexRgb(hex: string) {
  const n = parseInt((hex || "#1E3A6E").replace("#", ""), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

export interface PdfTabelle { zeilen: { text: string; betrag: string; fett?: boolean; linie?: boolean }[]; nachtext?: string }

export async function briefPdf(opts: { empfaenger: string; text: string; az: string; betreff?: string; tabelle?: PdfTabelle; info?: [string, string][] }): Promise<Buffer> {
  const k = kanzleiLaden();
  const pdf = await PDFDocument.create();
  const reg = await pdf.embedFont(StandardFonts.Helvetica);
  const fett = await pdf.embedFont(StandardFonts.HelveticaBold);
  const akzent = hexRgb(k.akzent);
  const grau = rgb(0.35, 0.37, 0.4);
  const B = 595.28, H = 841.89, L = 70, R = 60, BR = B - L - R;
  let page = pdf.addPage([B, H]);

  // Logo
  let logoBreite = 0;
  if (k.logo) {
    const datei = path.join(ABLAGE, path.basename(k.logo));
    if (fs.existsSync(datei)) {
      const bytes = fs.readFileSync(datei);
      const img = /\.png$/i.test(datei) ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
      const h = 48, w = Math.min(160, (img.width / img.height) * h);
      page.drawImage(img, { x: B - R - w, y: H - 50 - h, width: w, height: (w / img.width) * img.height });
      logoBreite = w;
    }
  }
  // Briefkopf
  page.drawText(sicher(k.name), { x: L, y: H - 70, size: 16, font: fett, color: akzent });
  if (k.zusatz) page.drawText(sicher(k.zusatz), { x: L, y: H - 86, size: 9, font: reg, color: grau });
  page.drawLine({ start: { x: L, y: H - 100 }, end: { x: B - R, y: H - 100 }, thickness: 1, color: akzent });
  // Absenderzeile + Empfänger (DIN-5008-nah)
  page.drawText(sicher(`${k.name} · ${k.strasse} · ${k.ort}`), { x: L, y: H - 140, size: 7, font: reg, color: grau });
  let y = H - 158;
  for (const z of opts.empfaenger.split("\n").slice(0, 6)) { page.drawText(sicher(z), { x: L, y, size: 10.5, font: reg }); y -= 14; }
  // Infoblock rechts
  const info = [["Unser Zeichen", opts.az], ...(opts.info ?? []), ["Datum", new Date().toLocaleDateString("de-DE")], ["Telefon", k.telefon], ["E-Mail", k.email]].filter((x) => x[1]);
  let iy = H - 158;
  for (const [l, v] of info) {
    page.drawText(sicher(l), { x: B - R - 170, y: iy, size: 8, font: reg, color: grau });
    page.drawText(sicher(v), { x: B - R - 95, y: iy, size: 8.5, font: reg });
    iy -= 12;
  }
  void logoBreite;

  // Text
  y = H - 270;
  const size = 10.5, zh = 15;
  // Mit Tabelle: Text – Tabelle – Nachtext/Signatur; sonst Text + Signatur
  const zeilen = umbrechen(sicher(opts.tabelle ? opts.text : opts.text + "\n\n" + k.signatur), reg, size, BR);
  const fusszeile = (p: typeof page, nr: number) => {
    p.drawLine({ start: { x: L, y: 60 }, end: { x: B - R, y: 60 }, thickness: 0.5, color: grau });
    p.drawText(sicher([k.name, k.strasse, k.ort, k.telefon, k.email].filter(Boolean).join(" · ")), { x: L, y: 46, size: 7, font: reg, color: grau });
    if (k.bank) p.drawText(sicher(k.bank), { x: L, y: 36, size: 7, font: reg, color: grau });
    p.drawText(`Seite ${nr}`, { x: B - R - 30, y: 36, size: 7, font: reg, color: grau });
  };
  let nr = 1;
  for (const [i, z] of zeilen.entries()) {
    if (y < 80) { fusszeile(page, nr++); page = pdf.addPage([B, H]); y = H - 80; }
    // Erste Zeilen bis zur Anrede fett (Betreffblock)
    const imBetreff = i < zeilen.findIndex((x) => /^sehr geehrte|^hallo|^liebe/i.test(x));
    const unvollstaendig = z.includes("[[");
    page.drawText(z, { x: L, y, size, font: imBetreff ? fett : reg, color: unvollstaendig ? rgb(0.75, 0.2, 0.12) : rgb(0.08, 0.09, 0.11) });
    y -= zh;
  }
  if (opts.tabelle) {
    y -= 6;
    for (const z of opts.tabelle.zeilen) {
      if (y < 100) { fusszeile(page, nr++); page = pdf.addPage([B, H]); y = H - 80; }
      if (z.linie) { page.drawLine({ start: { x: L, y: y + zh - 3 }, end: { x: B - R, y: y + zh - 3 }, thickness: 0.6, color: grau }); }
      const f = z.fett ? fett : reg;
      page.drawText(sicher(z.text), { x: L, y, size, font: f });
      const t = sicher(z.betrag);
      page.drawText(t, { x: B - R - f.widthOfTextAtSize(t, size), y, size, font: f });
      y -= zh + 2;
    }
    y -= zh;
    for (const z of umbrechen(sicher((opts.tabelle.nachtext ? opts.tabelle.nachtext + "\n\n" : "") + k.signatur), reg, size, BR)) {
      if (y < 80) { fusszeile(page, nr++); page = pdf.addPage([B, H]); y = H - 80; }
      page.drawText(z, { x: L, y, size, font: reg }); y -= zh;
    }
  }
  fusszeile(page, nr);
  return Buffer.from(await pdf.save());
}
