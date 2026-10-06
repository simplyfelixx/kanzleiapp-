// Lokale Datenbank (SQLite-Datei unter ./daten/kanzlei.db).
// Später austauschbar gegen PostgreSQL auf einem Server.
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { akten as beispielAkten, vorgaenge as beispielVorgaenge, eingang as beispielEingang } from "./data";

export interface AkteRow {
  id: string;
  titel: string;
  gebiet: string;
  prioritaet: string;
  phase: string;
  worum: string;
  stand_vorliegend: string;
  stand_ausstehend: string;
  stand_naechster: string;
  falldaten: string; // JSON
  angelegt: string;
}
export interface BeteiligterRow {
  id: number;
  akte_id: string;
  rolle: string; // Mandant | Gegner | Versicherung | Werkstatt | Gutachter | Bank | Polizei | Zeuge
  name: string;
  adresse: string;
  telefon: string;
  email: string;
  iban: string;
  ansprechpartner: string;
  zeichen: string; // Schadennummer, Kennzeichen, Tgb.-Nr.
  vorsteuer: number; // 0/1
  notiz: string;
}
export interface KontoRow {
  id: number;
  akte_id: string;
  position: string;
  gefordert: number;
  gezahlt: number;
  quelle: string;
}

export interface FristRow { id: number; akte_id: string; art: "wv" | "frist"; datum: string; titel: string; wer: string; status: string; bestaetigt: number; quelle: string }
export interface DokumentRow { id: number; akte_id: string; richtung: "ein" | "aus"; name: string; typ: string; absender: string; datum: string; datei: string | null; groesse: number }
export interface VerlaufRow { id: number; akte_id: string; zeit: string; text: string; wer: string }

export const FALLFELDER: { key: string; label: string }[] = [
  { key: "unfalltag", label: "Unfalltag" },
  { key: "unfallort", label: "Unfallort" },
  { key: "schilderung", label: "Unfallschilderung" },
  { key: "ausfall", label: "Mietwagen / Nutzungsausfall" },
  { key: "verletzt", label: "Verletzungen" },
  { key: "polizei", label: "Polizei (Dienststelle, Az.)" },
  { key: "akteneinsicht", label: "Akteneinsicht" },
  { key: "haftung", label: "Haftung" },
  { key: "vollkasko", label: "Vollkasko / SB" },
  { key: "fahrer", label: "Fahrer (wenn nicht Mandant)" },
  { key: "rsv", label: "Rechtsschutz" },
  { key: "fahrbereit", label: "Fahrbereit / Reparatur" },
  { key: "finanzierung", label: "Finanzierung / Leasing" },
  { key: "mw_kuerzung", label: "MW-Kürzung" },
];

const g = globalThis as unknown as { __db?: Database.Database };

function open(): Database.Database {
  const dir = path.join(process.cwd(), "daten");
  fs.mkdirSync(dir, { recursive: true });
  const db = new Database(path.join(dir, "kanzlei.db"));
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS akten (
      id TEXT PRIMARY KEY, titel TEXT NOT NULL, gebiet TEXT NOT NULL DEFAULT 'VR',
      prioritaet TEXT NOT NULL DEFAULT 'laeuft', phase TEXT NOT NULL DEFAULT 'Mandat',
      worum TEXT NOT NULL DEFAULT '', stand_vorliegend TEXT NOT NULL DEFAULT '',
      stand_ausstehend TEXT NOT NULL DEFAULT '', stand_naechster TEXT NOT NULL DEFAULT '',
      falldaten TEXT NOT NULL DEFAULT '{}', angelegt TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS beteiligte (
      id INTEGER PRIMARY KEY AUTOINCREMENT, akte_id TEXT NOT NULL REFERENCES akten(id) ON DELETE CASCADE,
      rolle TEXT NOT NULL, name TEXT NOT NULL DEFAULT '', adresse TEXT NOT NULL DEFAULT '',
      telefon TEXT NOT NULL DEFAULT '', email TEXT NOT NULL DEFAULT '', iban TEXT NOT NULL DEFAULT '',
      ansprechpartner TEXT NOT NULL DEFAULT '', zeichen TEXT NOT NULL DEFAULT '',
      vorsteuer INTEGER NOT NULL DEFAULT 0, notiz TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS konto (
      id INTEGER PRIMARY KEY AUTOINCREMENT, akte_id TEXT NOT NULL REFERENCES akten(id) ON DELETE CASCADE,
      position TEXT NOT NULL, gefordert REAL NOT NULL DEFAULT 0, gezahlt REAL NOT NULL DEFAULT 0,
      quelle TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS vorgaenge (
      id INTEGER PRIMARY KEY AUTOINCREMENT, akte_id TEXT NOT NULL REFERENCES akten(id) ON DELETE CASCADE,
      prioritaet TEXT NOT NULL DEFAULT 'pruefen', titel TEXT NOT NULL, zusammenfassung TEXT NOT NULL DEFAULT '',
      felder TEXT NOT NULL DEFAULT '[]', entwurf TEXT, aktion TEXT NOT NULL DEFAULT 'Bestätigen',
      wirkung TEXT NOT NULL DEFAULT '{}', status TEXT NOT NULL DEFAULT 'offen',
      erstellt TEXT NOT NULL DEFAULT (datetime('now')), erledigt_am TEXT
    );
    CREATE TABLE IF NOT EXISTS eingang (
      id INTEGER PRIMARY KEY AUTOINCREMENT, quelle TEXT NOT NULL, zeit TEXT NOT NULL DEFAULT '', typ TEXT NOT NULL,
      absender TEXT NOT NULL DEFAULT '', akte_id TEXT, sicher INTEGER NOT NULL DEFAULT 0, erkannt TEXT NOT NULL DEFAULT '',
      dateiname TEXT NOT NULL DEFAULT '', felder TEXT NOT NULL DEFAULT '[]', folgeaktionen TEXT NOT NULL DEFAULT '[]',
      vorschau TEXT NOT NULL DEFAULT '', wirkung TEXT NOT NULL DEFAULT '{}', status TEXT NOT NULL DEFAULT 'offen',
      erledigt_am TEXT
    );
    CREATE TABLE IF NOT EXISTS fristen (
      id INTEGER PRIMARY KEY AUTOINCREMENT, akte_id TEXT NOT NULL REFERENCES akten(id) ON DELETE CASCADE,
      art TEXT NOT NULL DEFAULT 'wv', datum TEXT NOT NULL, titel TEXT NOT NULL, wer TEXT NOT NULL DEFAULT 'FK',
      status TEXT NOT NULL DEFAULT 'offen', bestaetigt INTEGER NOT NULL DEFAULT 1, quelle TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS dokumente (
      id INTEGER PRIMARY KEY AUTOINCREMENT, akte_id TEXT NOT NULL REFERENCES akten(id) ON DELETE CASCADE,
      richtung TEXT NOT NULL DEFAULT 'ein', name TEXT NOT NULL, typ TEXT NOT NULL DEFAULT 'Sonstiges',
      absender TEXT NOT NULL DEFAULT '', datum TEXT NOT NULL, datei TEXT, groesse INTEGER NOT NULL DEFAULT 0,
      angelegt TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS verlauf (
      id INTEGER PRIMARY KEY AUTOINCREMENT, akte_id TEXT NOT NULL REFERENCES akten(id) ON DELETE CASCADE,
      zeit TEXT NOT NULL DEFAULT (datetime('now','localtime')), text TEXT NOT NULL, wer TEXT NOT NULL DEFAULT ''
    );
  `);
  // Spalten, die in späteren Versionen dazugekommen sind
  const spalten = (db.prepare("PRAGMA table_info(eingang)").all() as { name: string }[]).map((c) => c.name);
  if (!spalten.includes("datei")) db.exec("ALTER TABLE eingang ADD COLUMN datei TEXT; ALTER TABLE eingang ADD COLUMN datum TEXT;");
  // Verknüpfung Beteiligter → Adressbuch (immer beim Öffnen sicherstellen, nicht erst beim ersten Adressbuch-Aufruf)
  const bsp = (db.prepare("PRAGMA table_info(beteiligte)").all() as { name: string }[]).map((c) => c.name);
  if (!bsp.includes("kontakt_id")) db.exec("ALTER TABLE beteiligte ADD COLUMN kontakt_id INTEGER");
  const n = (db.prepare("SELECT COUNT(*) c FROM akten").get() as { c: number }).c;
  if (n === 0) seed(db);
  const v = (db.prepare("SELECT COUNT(*) c FROM eingang").get() as { c: number }).c;
  if (v === 0 && !(db.prepare("SELECT 1 FROM verlauf LIMIT 1").get())) seedWorkflow(db);
  if (!db.prepare("SELECT 1 FROM dokumente LIMIT 1").get() && db.prepare("SELECT 1 FROM akten WHERE id='214/26'").get()) {
    const ins = db.prepare("INSERT INTO dokumente (akte_id,richtung,name,typ,absender,datum) VALUES ('214/26',?,?,?,?,?)");
    ins.run("ein", "2026-08-15_Vollmacht_Mandant.pdf", "Vollmacht", "Thomas Müller", "2026-08-15");
    ins.run("ein", "2026-08-20_Gutachten_SVBrandt.pdf", "Gutachten", "SV Brandt", "2026-08-20");
    ins.run("aus", "2026-08-20_Akteneinsichtsgesuch_Kanzlei.pdf", "Akteneinsichtsgesuch", "Kanzlei", "2026-08-20");
    ins.run("ein", "2026-08-22_Reparaturrechnung_AutohausNord.pdf", "Reparaturrechnung", "Autohaus Nord", "2026-08-22");
    ins.run("aus", "2026-08-25_Anspruchsschreiben_Kanzlei.pdf", "Anspruchsschreiben", "Kanzlei", "2026-08-25");
    ins.run("aus", "2026-09-18_Nachfrist_Kanzlei.pdf", "Erinnerung", "Kanzlei", "2026-09-18");
  }
  return db;
}

function seed(db: Database.Database) {
  const insA = db.prepare(`INSERT INTO akten (id,titel,gebiet,prioritaet,phase,worum,stand_vorliegend,stand_ausstehend,stand_naechster,falldaten)
    VALUES (@id,@titel,@gebiet,@prioritaet,@phase,@worum,@v,@a,@n,@f)`);
  const insB = db.prepare(`INSERT INTO beteiligte (akte_id,rolle,name,telefon,ansprechpartner,zeichen,adresse,iban,email,vorsteuer)
    VALUES (?,?,?,?,?,?,?,?,?,?)`);
  const insK = db.prepare("INSERT INTO konto (akte_id,position,gefordert,gezahlt,quelle) VALUES (?,?,?,?,?)");
  db.transaction(() => {
    for (const a of beispielAkten) {
      const mueller = a.id === "214/26";
      insA.run({
        id: a.id, titel: a.titel, gebiet: a.gebiet, prioritaet: a.prioritaet, phase: a.phase,
        worum: mueller ? "Parkschaden, Gegner fuhr auf das geparkte Fahrzeug, Haftung 100 % unstreitig. Mandant leicht verletzt (HWS), Fahrzeug geleast." : "",
        v: mueller ? "4.205 € gezahlt · Gutachten, Rechnungen, Polizeibericht · Haftung 100 %" : a.stand,
        a: mueller ? "1.432 € offen (Reparatur gekürzt, Nutzungsausfall) · Attest vom Mandanten · Akteneinsicht PK 26" : "",
        n: mueller ? "Erinnerung mit Klageandrohung an HUK · Leasingbank informieren" : "",
        f: JSON.stringify(mueller ? {
          unfalltag: "14.08.2026, 17:20", unfallort: "Weserstraße 12, 26452 Sande",
          schilderung: "Gegner fuhr gegen das ordnungsgemäß geparkte Fahrzeug des Mandanten.",
          ausfall: "Nutzungsausfall · Gruppe F, 89 €/Tag × 8", verletzt: "ja · HWS, Attest fehlt",
          polizei: "PK 26 Bahrenfeld · Tgb.-Nr. 0814/26", akteneinsicht: "beantragt 20.08., offen",
          haftung: "100 % · Dok 24", vollkasko: "ja · SB 500 €", rsv: "ja · ARAG",
          fahrbereit: "ja · Reparatur erfolgt", finanzierung: "Leasing · VW Leasing", mw_kuerzung: "",
        } : {}),
      });
      insB.run(a.id, "Mandant", a.mandant, a.mandantTel, "", "", "", "", "", 0);
      if (a.versicherung !== "–") insB.run(a.id, "Versicherung", a.versicherung, a.durchwahl, a.sachbearbeiter, a.schadennummer, "", "", "", 0);
      for (const k of a.konto) insK.run(a.id, k.position, k.gefordert, k.gezahlt, "Beispieldaten");
    }
  })();
}

/** Verbindung schließen (z. B. vor dem Wiederherstellen einer Sicherung); nächster Zugriff öffnet neu. */
export function dbSchliessen() {
  if (g.__db) { try { g.__db.close(); } catch { /* egal */ } g.__db = undefined; }
}

export function db(): Database.Database {
  if (!g.__db) g.__db = open();
  return g.__db;
}

// ---- Abfragen ----
export function alleAkten() {
  return db().prepare(`
    SELECT a.*,
      (SELECT name FROM beteiligte b WHERE b.akte_id=a.id AND b.rolle='Mandant' LIMIT 1) AS mandant,
      (SELECT name FROM beteiligte b WHERE b.akte_id=a.id AND b.rolle='Versicherung' LIMIT 1) AS versicherung,
      COALESCE((SELECT SUM(gefordert-gezahlt) FROM konto k WHERE k.akte_id=a.id),0) AS offen
    FROM akten a ORDER BY a.angelegt DESC, a.id DESC`).all() as (AkteRow & { mandant: string | null; versicherung: string | null; offen: number })[];
}
export function akteLaden(id: string) {
  const d = db();
  const akte = d.prepare("SELECT * FROM akten WHERE id=?").get(id) as AkteRow | undefined;
  if (!akte) return null;
  return {
    akte,
    beteiligte: d.prepare("SELECT * FROM beteiligte WHERE akte_id=? ORDER BY id").all(id) as BeteiligterRow[],
    konto: d.prepare("SELECT * FROM konto WHERE akte_id=? ORDER BY id").all(id) as KontoRow[],
    fristen: d.prepare("SELECT * FROM fristen WHERE akte_id=? AND status='offen' ORDER BY datum").all(id) as FristRow[],
    dokumente: d.prepare("SELECT * FROM dokumente WHERE akte_id=? ORDER BY datum DESC, id DESC").all(id) as DokumentRow[],
    verlauf: d.prepare("SELECT * FROM verlauf WHERE akte_id=? ORDER BY zeit DESC, id DESC LIMIT 50").all(id) as VerlaufRow[],
  };
}
export function naechstesAz(): string {
  const jahr = String(new Date().getFullYear()).slice(2);
  const rows = db().prepare("SELECT id FROM akten WHERE id LIKE ?").all(`%/${jahr}`) as { id: string }[];
  const max = rows.reduce((m, r) => Math.max(m, parseInt(r.id) || 0), 0);
  return `${max + 1}/${jahr}`;
}

// ---- Datumshilfen (ISO yyyy-mm-dd, lokale Zeit) ----
export function isoTag(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function plusTage(tage: number, ab = new Date()) {
  const d = new Date(ab); d.setDate(d.getDate() + tage);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1); // nie aufs Wochenende
  return isoTag(d);
}

/** Wirkungen, die beim Bestätigen eines Vorgangs/Dokuments ausgeführt werden. */
export interface Wirkung {
  konto?: { position: string; gefordert?: number; gezahlt?: number }[];
  wv?: { tage: number; titel: string };
  frist?: { tage: number; titel: string };
  phase?: string;
  prioritaet?: string;
  verlauf?: string;
}

function seedWorkflow(db: Database.Database) {
  const insV = db.prepare(`INSERT INTO vorgaenge (akte_id,prioritaet,titel,zusammenfassung,felder,entwurf,aktion,wirkung) VALUES (?,?,?,?,?,?,?,?)`);
  const wirkV: Record<string, Wirkung> = {
    "214/26": { wv: { tage: 14, titel: "Zahlungseingang HUK prüfen (Frist aus Erinnerung)" }, verlauf: "Erinnerung mit Klageandrohung an HUK versandt", prioritaet: "wartet" },
    "198/26": { frist: { tage: 30, titel: "Verjährung Restansprüche – Klage oder Verzicht" }, verlauf: "An Anwalt übergeben: Verjährung prüfen" },
    "221/26": { wv: { tage: 14, titel: "Antwort Allianz auf Nachforderung Wertminderung" }, verlauf: "Nachforderung Wertminderung 800 € an Allianz versandt", prioritaet: "wartet" },
    "230/26": { konto: [{ position: "Reparatur netto", gefordert: 5410 }, { position: "Wertminderung", gefordert: 450 }, { position: "Nutzungsausfall", gefordert: 325 }, { position: "Gutachterkosten", gefordert: 690 }], verlauf: "Gutachten-Werte ins Aktenkonto übernommen", phase: "Anspruch" },
  };
  for (const v of beispielVorgaenge)
    insV.run(v.akteId, v.prioritaet, v.titel, v.zusammenfassung, JSON.stringify(v.felder), v.entwurf ?? null, v.aktion, JSON.stringify(wirkV[v.akteId] ?? {}));

  const insE = db.prepare(`INSERT INTO eingang (quelle,zeit,typ,absender,akte_id,sicher,erkannt,dateiname,felder,folgeaktionen,vorschau,wirkung) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
  const wirkE: Record<string, Wirkung> = {
    e1: { verlauf: "Abrechnungsschreiben HUK eingegangen: Kürzung 720 €, Nutzungsausfall abgelehnt", wv: { tage: 7, titel: "Nachforderung Verbringung/UPE vorbereiten" }, prioritaet: "woche" },
    e2: { konto: [{ position: "Reparatur", gefordert: 6300 }], verlauf: "Reparaturrechnung Autohaus Nord eingegangen (6.300 €)" },
    e3: { verlauf: "Mandantin hat Fotos und Führerschein im Portal hochgeladen" },
    e4: { verlauf: "Ermittlungsakte PK 26 eingegangen" },
    e5: { verlauf: "Schreiben (Scan) zugeordnet" },
  };
  for (const e of beispielEingang) {
    const akte = e.akteId && db.prepare("SELECT 1 FROM akten WHERE id=?").get(e.akteId) ? e.akteId : null;
    insE.run(e.quelle, e.zeit, e.typ, e.absender, akte, e.sicher && akte ? 1 : 0, e.erkannt, e.dateiname, JSON.stringify(e.felder), JSON.stringify(e.folgeaktionen), e.vorschau, JSON.stringify(wirkE[e.id] ?? {}));
  }

  const insF = db.prepare("INSERT INTO fristen (akte_id,art,datum,titel,wer,bestaetigt,quelle) VALUES (?,?,?,?,?,?,?)");
  insF.run("214/26", "wv", plusTage(0), "Nachfrist HUK abgelaufen – Erinnerung bereit", "FK", 1, "");
  insF.run("198/26", "frist", plusTage(0), "Verjährung Restansprüche zum 31.12. – Anwalt prüfen", "RA KN", 1, "");
  insF.run("233/26", "frist", plusTage(2), "Berufungsbegründung", "RA KN", 1, "");
  insF.run("230/26", "wv", plusTage(3), "Antwort DEVK zur Haftungsfrage", "FK", 1, "");
  insF.run("221/26", "wv", plusTage(1), "Zahlung Reparaturrechnung prüfen", "AS", 1, "");
  insF.run("230/26", "frist", plusTage(21), "Stellungnahmefrist aus Schreiben AG Harburg (2 Wochen ab Zustellung)", "", 0, "KI: Schreiben AG Harburg, S. 1");
  const insL = db.prepare("INSERT INTO verlauf (akte_id,zeit,text,wer) VALUES (?,?,?,?)");
  insL.run("214/26", "2026-08-15 10:12", "Akte aus Erstanruf angelegt", "FK");
  insL.run("214/26", "2026-08-20 09:40", "Gutachten ausgelesen, 4 Positionen übernommen", "KI · bestätigt FK");
  insL.run("214/26", "2026-08-25 14:05", "Anspruchsschreiben an HUK per beA", "FK");
  insL.run("214/26", "2026-09-28 08:30", "Zahlung 3.400 € im Kontoauszug abgeglichen", "AS");
}

/** Führt die Wirkung aus (Aktenkonto, Wiedervorlage, Frist, Phase, Verlauf). */
export function wirkungAusfuehren(akteId: string, w: Wirkung, wer = "FK") {
  const d = db();
  for (const k of w.konto ?? []) {
    const row = d.prepare("SELECT id FROM konto WHERE akte_id=? AND position=?").get(akteId, k.position) as { id: number } | undefined;
    if (row) {
      if (k.gefordert != null) d.prepare("UPDATE konto SET gefordert=? WHERE id=?").run(k.gefordert, row.id);
      if (k.gezahlt != null) d.prepare("UPDATE konto SET gezahlt=? WHERE id=?").run(k.gezahlt, row.id);
    } else d.prepare("INSERT INTO konto (akte_id,position,gefordert,gezahlt,quelle) VALUES (?,?,?,?,?)").run(akteId, k.position, k.gefordert ?? 0, k.gezahlt ?? 0, "aus Vorgang");
  }
  if (w.wv) d.prepare("INSERT INTO fristen (akte_id,art,datum,titel,wer) VALUES (?,?,?,?,?)").run(akteId, "wv", plusTage(w.wv.tage), w.wv.titel, wer);
  if (w.frist) d.prepare("INSERT INTO fristen (akte_id,art,datum,titel,wer,bestaetigt,quelle) VALUES (?,?,?,?,?,?,?)").run(akteId, "frist", plusTage(w.frist.tage), w.frist.titel, "", 0, "aus Vorgang");
  if (w.phase) d.prepare("UPDATE akten SET phase=? WHERE id=?").run(w.phase, akteId);
  if (w.prioritaet) d.prepare("UPDATE akten SET prioritaet=? WHERE id=?").run(w.prioritaet, akteId);
  if (w.verlauf) verlaufEintrag(akteId, w.verlauf, wer);
}
export function verlaufEintrag(akteId: string, text: string, wer = "") {
  db().prepare("INSERT INTO verlauf (akte_id,text,wer) VALUES (?,?,?)").run(akteId, text, wer);
}

// ---- Dateiablage (daten/dokumente) ----
export const ABLAGE = path.join(process.cwd(), "daten", "dokumente");
export function dateiSpeichern(inhalt: Buffer, endung: string): string {
  fs.mkdirSync(ABLAGE, { recursive: true });
  const name = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}${endung.replace(/[^.\w]/g, "").slice(0, 6)}`;
  fs.writeFileSync(path.join(ABLAGE, name), inhalt);
  return name;
}

/** Index aller Akten für die Zuordnung von Dokumenten (Zeichen, Namen). */
export function aktenIndex() {
  const d = db();
  const akten = d.prepare("SELECT id, titel FROM akten").all() as { id: string; titel: string }[];
  return akten.map((a) => {
    const b = d.prepare("SELECT name, zeichen FROM beteiligte WHERE akte_id=?").all(a.id) as { name: string; zeichen: string }[];
    return { id: a.id, titel: a.titel, zeichen: b.map((x) => x.zeichen).filter(Boolean), namen: b.filter((x) => x.name).map((x) => x.name) };
  });
}
