// Kostennoten nach RVG: Vorschlag aus dem Aktenkonto, Erstellen als PDF, Zahlung erfassen.
import { dateiSpeichern, db, verlaufEintrag } from "./db";
import { kostennote, tabelleFuer, TABELLE_NAME, type Kostennote, type Posten, type Tabelle } from "./rvg";
import { briefPdf } from "./schreiben";
import { briefanschrift } from "./kontakte";

export interface RechnungRow {
  id: number; nr: string; akte_id: string; datum: string; empfaenger: string; wert: number; posten: string;
  netto: number; ust: number; brutto: number; status: "offen" | "bezahlt" | "storniert"; bezahlt_am: string | null; dokument_id: number | null;
  tabelle: Tabelle; nach_von: string;
}
/** Geprüfte Eingabe für Berechnung/Erstellung */
export interface Eingabe { akte: string; wert: number; posten: Posten[]; empfaenger: string; tabelle: Tabelle; nach: number[] }

let bereit = false;
function tabellen() {
  if (bereit) return;
  db().exec(`CREATE TABLE IF NOT EXISTS rechnungen (
    id INTEGER PRIMARY KEY AUTOINCREMENT, nr TEXT NOT NULL UNIQUE, akte_id TEXT NOT NULL REFERENCES akten(id) ON DELETE CASCADE,
    datum TEXT NOT NULL, empfaenger TEXT NOT NULL DEFAULT '', wert REAL NOT NULL, posten TEXT NOT NULL DEFAULT '[]',
    netto REAL NOT NULL, ust REAL NOT NULL, brutto REAL NOT NULL, status TEXT NOT NULL DEFAULT 'offen',
    bezahlt_am TEXT, dokument_id INTEGER, konto_id INTEGER
  )`);
  const sp = (db().prepare("PRAGMA table_info(rechnungen)").all() as { name: string }[]).map((c) => c.name);
  if (!sp.includes("tabelle")) db().exec("ALTER TABLE rechnungen ADD COLUMN tabelle TEXT NOT NULL DEFAULT '2025'");
  if (!sp.includes("nach_von")) db().exec("ALTER TABLE rechnungen ADD COLUMN nach_von TEXT NOT NULL DEFAULT ''");
  bereit = true;
}
const euro = (n: number) => n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
const heute = () => { const d = new Date(), p = (n: number) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };
const IST_RA_POSTEN = /anwalt|ra-kosten|rechtsanwalt|kostennote|honorar/i;

/** Vorschlag für eine neue Kostennote: Gegenstandswert = Summe der Schadenpositionen, Empfänger = gegnerische Versicherung. */
export function vorschlag(akteId: string) {
  tabellen();
  const d = db();
  const konto = d.prepare("SELECT position, gefordert FROM konto WHERE akte_id=?").all(akteId) as { position: string; gefordert: number }[];
  const wert = Math.round(konto.filter((k) => !IST_RA_POSTEN.test(k.position)).reduce((s, k) => s + k.gefordert, 0) * 100) / 100;
  const v = d.prepare("SELECT name, ansprechpartner, adresse, zeichen, kontakt_id FROM beteiligte WHERE akte_id=? AND rolle='Versicherung' LIMIT 1").get(akteId) as { name: string; ansprechpartner: string; adresse: string; zeichen: string; kontakt_id: number | null } | undefined;
  const m = d.prepare("SELECT name FROM beteiligte WHERE akte_id=? AND rolle='Mandant' LIMIT 1").get(akteId) as { name: string } | undefined;
  const a = d.prepare("SELECT angelegt FROM akten WHERE id=?").get(akteId) as { angelegt: string } | undefined;
  const auftrag = (a?.angelegt ?? "").slice(0, 10);
  return {
    auftrag, tabelle: tabelleFuer(auftrag),
    wert, positionen: konto.filter((k) => !IST_RA_POSTEN.test(k.position)),
    empfaenger: v ? briefanschrift(v) : "",
    schadennummer: v?.zeichen ?? "", mandant: m?.name ?? "",
    bisher: rechnungen(akteId).filter((r) => r.status !== "storniert"),
  };
}

export function rechnungen(akteId?: string): RechnungRow[] {
  tabellen();
  return (akteId
    ? db().prepare("SELECT * FROM rechnungen WHERE akte_id=? ORDER BY id DESC").all(akteId)
    : db().prepare("SELECT * FROM rechnungen ORDER BY id DESC LIMIT 500").all()) as RechnungRow[];
}

function naechsteNr(): string {
  const j = new Date().getFullYear();
  const n = (db().prepare("SELECT COUNT(*) c FROM rechnungen WHERE nr LIKE ?").get(`${j}-%`) as { c: number }).c + 1;
  return `${j}-${String(n).padStart(3, "0")}`;
}

/** Kostennote berechnen; bei Nachliquidation werden die Nettobeträge der genannten Rechnungen abgezogen. */
export function berechnen(e: Eingabe): Kostennote & { nachNr: string[] } {
  tabellen();
  const alt = e.nach.length
    ? (db().prepare(`SELECT nr, netto FROM rechnungen WHERE akte_id=? AND status!='storniert' AND id IN (${e.nach.map(() => "?").join(",")})`).all(e.akte, ...e.nach) as { nr: string; netto: number }[])
    : [];
  const k = kostennote(e.wert, e.posten, { tabelle: e.tabelle, abzug: alt.map((r) => ({ text: `abzüglich bereits berechnet (Kostennote ${r.nr}, netto)`, betrag: r.netto })) });
  return { ...k, nachNr: alt.map((r) => r.nr) };
}

function pdfText(k: Kostennote & { nachNr: string[] }, mandant: string, schaden: string) {
  return [
    `Schadensache ${mandant}${schaden ? ` – Ihr Zeichen ${schaden}` : ""}`,
    k.nachNr.length ? "Kostennote (Nachliquidation)" : "Kostennote",
    "",
    "Sehr geehrte Damen und Herren,",
    "",
    k.nachNr.length
      ? `aufgrund des erhöhten Gegenstandswerts von ${euro(k.wert)} rechnen wir unter Anrechnung unserer Kostennote ${k.nachNr.join(", ")} wie folgt nach (Gebührentabelle § 13 RVG ${TABELLE_NAME[k.tabelle]}):`
      : `für unsere Tätigkeit berechnen wir aus einem Gegenstandswert von ${euro(k.wert)} wie folgt (Gebührentabelle § 13 RVG ${TABELLE_NAME[k.tabelle]}):`,
  ].join("\n");
}

export async function vorschauPdf(e: Eingabe) {
  const v = vorschlag(e.akte);
  const k = berechnen(e);
  return briefPdf({ empfaenger: e.empfaenger, az: e.akte, text: pdfText(k, v.mandant, v.schadennummer), tabelle: tabelle(k), info: [["Rechnung", "Entwurf"]] });
}
function tabelle(k: Kostennote) {
  return {
    zeilen: [
      ...k.zeilen.map((z) => ({ text: z.text, betrag: euro(z.betrag) })),
      { text: "Zwischensumme netto", betrag: euro(k.netto), linie: true },
      { text: `${k.ustSatz} % Umsatzsteuer Nr. 7008 VV RVG`, betrag: euro(k.ust) },
      { text: "Gesamtbetrag", betrag: euro(k.brutto), fett: true, linie: true },
    ],
    nachtext: "Wir bitten um Ausgleich auf das unten angegebene Konto unter Angabe unseres Zeichens.",
  };
}

/** Kostennote erstellen: PDF in der Akte, Position im Aktenkonto, Verlauf. */
export async function erstellen(e: Eingabe, wer: string) {
  tabellen();
  const d = db();
  const { akte: akteId, wert, posten, empfaenger } = e;
  const v = vorschlag(akteId);
  const k = berechnen(e);
  if (k.brutto <= 0) throw new Error("Betrag nach Abzug nicht positiv");
  const nr = naechsteNr(), datum = heute();
  const pdf = await briefPdf({ empfaenger, az: akteId, text: pdfText(k, v.mandant, v.schadennummer), tabelle: tabelle(k), info: [["Rechnung Nr.", nr]] });
  const name = `${datum}_Kostennote_${nr}.pdf`;
  let id = 0;
  d.transaction(() => {
    const dok = d.prepare("INSERT INTO dokumente (akte_id,richtung,name,typ,absender,datum,datei,groesse) VALUES (?,?,?,?,?,?,?,?)")
      .run(akteId, "aus", name, "Kostennote", "Kanzlei", datum, dateiSpeichern(pdf, ".pdf"), pdf.length);
    const kto = d.prepare("INSERT INTO konto (akte_id,position,gefordert,gezahlt,quelle) VALUES (?,?,?,?,?)")
      .run(akteId, `RA-Kosten (Kostennote ${nr})`, k.brutto, 0, `Kostennote ${nr}`);
    id = Number(d.prepare(`INSERT INTO rechnungen (nr,akte_id,datum,empfaenger,wert,posten,netto,ust,brutto,dokument_id,konto_id,tabelle,nach_von) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(nr, akteId, datum, empfaenger.split("\n")[0], wert, JSON.stringify(posten), k.netto, k.ust, k.brutto, Number(dok.lastInsertRowid), Number(kto.lastInsertRowid), k.tabelle, k.nachNr.join(",")).lastInsertRowid);
    verlaufEintrag(akteId, `${k.nachNr.length ? "Nachliquidation" : "Kostennote"} ${nr} erstellt: ${euro(k.brutto)} an ${empfaenger.split("\n")[0] || "?"}`, wer);
  })();
  return { id, nr, brutto: k.brutto };
}

export function zahlung(id: number, bezahlt: boolean, wer: string) {
  tabellen();
  const d = db();
  const r = d.prepare("SELECT * FROM rechnungen WHERE id=?").get(id) as (RechnungRow & { konto_id: number | null }) | undefined;
  if (!r || r.status === "storniert") return null;
  d.transaction(() => {
    d.prepare("UPDATE rechnungen SET status=?, bezahlt_am=? WHERE id=?").run(bezahlt ? "bezahlt" : "offen", bezahlt ? heute() : null, id);
    if (r.konto_id) d.prepare("UPDATE konto SET gezahlt=? WHERE id=?").run(bezahlt ? r.brutto : 0, r.konto_id);
    verlaufEintrag(r.akte_id, `Kostennote ${r.nr} ${bezahlt ? "bezahlt" : "wieder offen"}`, wer);
  })();
  return r;
}

export function stornieren(id: number, wer: string) {
  tabellen();
  const d = db();
  const r = d.prepare("SELECT * FROM rechnungen WHERE id=?").get(id) as (RechnungRow & { konto_id: number | null }) | undefined;
  if (!r || r.status !== "offen") return null;
  d.transaction(() => {
    d.prepare("UPDATE rechnungen SET status='storniert' WHERE id=?").run(id);
    if (r.konto_id) d.prepare("DELETE FROM konto WHERE id=?").run(r.konto_id);
    verlaufEintrag(r.akte_id, `Kostennote ${r.nr} storniert`, wer);
  })();
  return r;
}

/** Eingaben für Berechnung/Erstellung prüfen */
export function pruefen(b: Record<string, unknown>): Eingabe | { fehler: string } {
  const akte = String(b.akte ?? "");
  const wert = Number(b.wert);
  const posten = (Array.isArray(b.posten) ? b.posten : []).map((p: Posten) => ({ vv: String(p.vv), faktor: Number(p.faktor) })).filter((p) => isFinite(p.faktor)).slice(0, 6);
  if (!db().prepare("SELECT 1 FROM akten WHERE id=?").get(akte)) return { fehler: "Akte unbekannt" };
  if (!(wert > 0 && wert < 1e8)) return { fehler: "Gegenstandswert fehlt" };
  if (!posten.length) return { fehler: "Keine Gebühr gewählt" };
  const tabelle: Tabelle = b.tabelle === "2021" ? "2021" : "2025";
  const nach = (Array.isArray(b.nach) ? b.nach : []).map(Number).filter((n) => Number.isInteger(n)).slice(0, 10);
  return { akte, wert, posten, empfaenger: String(b.empfaenger ?? "").slice(0, 400), tabelle, nach };
}

