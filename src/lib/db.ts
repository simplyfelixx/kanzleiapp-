// Lokale Datenbank (SQLite-Datei unter ./daten/kanzlei.db).
// Später austauschbar gegen PostgreSQL auf einem Server.
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { akten as beispielAkten } from "./data";

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
  `);
  const n = (db.prepare("SELECT COUNT(*) c FROM akten").get() as { c: number }).c;
  if (n === 0) seed(db);
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
  };
}
export function naechstesAz(): string {
  const jahr = String(new Date().getFullYear()).slice(2);
  const rows = db().prepare("SELECT id FROM akten WHERE id LIKE ?").all(`%/${jahr}`) as { id: string }[];
  const max = rows.reduce((m, r) => Math.max(m, parseInt(r.id) || 0), 0);
  return `${max + 1}/${jahr}`;
}
