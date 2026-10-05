// Mandantenportal: strikt getrennt von der Kanzlei-Ansicht.
// Zugang nur per Link (zufälliger Schlüssel, in der DB nur als Hash), nur lesen, nur ausdrücklich freigegebene Daten.
import crypto from "crypto";
import { db } from "./db";
import { kanzleiLaden } from "./schreiben";

export interface Freigaben { fortschritt: boolean; geld: boolean; aufgaben: boolean }
export const STANDARD_FREIGABEN: Freigaben = { fortschritt: true, geld: false, aufgaben: true };
export interface ZugangRow { id: number; akte_id: string; erstellt: string; ablauf: string; aktiv: number; letzter_zugriff: string | null; freigaben: string }

let bereit = false;
function tabellen() {
  if (bereit) return;
  db().exec(`
    CREATE TABLE IF NOT EXISTS portal_zugang (
      id INTEGER PRIMARY KEY AUTOINCREMENT, akte_id TEXT NOT NULL REFERENCES akten(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE, erstellt TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      ablauf TEXT NOT NULL, aktiv INTEGER NOT NULL DEFAULT 1, letzter_zugriff TEXT,
      freigaben TEXT NOT NULL DEFAULT '{}'
    );
    CREATE TABLE IF NOT EXISTS portal_meldung (
      id INTEGER PRIMARY KEY AUTOINCREMENT, akte_id TEXT NOT NULL REFERENCES akten(id) ON DELETE CASCADE,
      text TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'entwurf', von TEXT NOT NULL DEFAULT '',
      erstellt TEXT NOT NULL DEFAULT (datetime('now','localtime')), freigegeben_am TEXT
    );
    CREATE TABLE IF NOT EXISTS portal_aufgabe (
      id INTEGER PRIMARY KEY AUTOINCREMENT, akte_id TEXT NOT NULL REFERENCES akten(id) ON DELETE CASCADE,
      titel TEXT NOT NULL, erledigt INTEGER NOT NULL DEFAULT 0, erstellt TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
  `);
  bereit = true;
}
const hash = (t: string) => crypto.createHash("sha256").update(t).digest("hex");
const jetzt = () => new Date().toISOString().slice(0, 19).replace("T", " ");

/** Neuen Link erzeugen. Ein bestehender Link der Akte wird dabei gesperrt. Der Schlüssel wird nur hier einmal zurückgegeben. */
export function zugangErstellen(akteId: string, tage = 90): string {
  tabellen();
  const token = crypto.randomBytes(32).toString("base64url");
  const d = db();
  const alt = d.prepare("SELECT freigaben FROM portal_zugang WHERE akte_id=? ORDER BY id DESC LIMIT 1").get(akteId) as { freigaben: string } | undefined;
  const ablauf = new Date(Date.now() + tage * 864e5).toISOString().slice(0, 19).replace("T", " ");
  d.transaction(() => {
    d.prepare("UPDATE portal_zugang SET aktiv=0 WHERE akte_id=?").run(akteId);
    d.prepare("INSERT INTO portal_zugang (akte_id,token_hash,ablauf,freigaben) VALUES (?,?,?,?)")
      .run(akteId, hash(token), ablauf, alt?.freigaben ?? JSON.stringify(STANDARD_FREIGABEN));
  })();
  return token;
}
export function zugangSperren(akteId: string) { tabellen(); db().prepare("UPDATE portal_zugang SET aktiv=0 WHERE akte_id=?").run(akteId); }
export function zugangLaden(akteId: string): (ZugangRow & { f: Freigaben }) | null {
  tabellen();
  const z = db().prepare("SELECT * FROM portal_zugang WHERE akte_id=? ORDER BY id DESC LIMIT 1").get(akteId) as ZugangRow | undefined;
  return z ? { ...z, f: { ...STANDARD_FREIGABEN, ...JSON.parse(z.freigaben || "{}") } } : null;
}
export function freigabenSetzen(akteId: string, f: Partial<Freigaben>) {
  const z = zugangLaden(akteId);
  const neu: Freigaben = { ...(z?.f ?? STANDARD_FREIGABEN) };
  for (const k of Object.keys(STANDARD_FREIGABEN) as (keyof Freigaben)[]) if (typeof f[k] === "boolean") neu[k] = f[k]!;
  if (z) db().prepare("UPDATE portal_zugang SET freigaben=? WHERE id=?").run(JSON.stringify(neu), z.id);
  return neu;
}

/** Prüft den Schlüssel aus Link/Cookie. Nur aktive, nicht abgelaufene Zugänge. */
export function tokenPruefen(token: string | undefined | null): ZugangRow | null {
  if (!token || token.length < 40 || token.length > 60) return null;
  tabellen();
  const z = db().prepare("SELECT * FROM portal_zugang WHERE token_hash=?").get(hash(token)) as ZugangRow | undefined;
  if (!z || !z.aktiv || z.ablauf < jetzt()) return null;
  db().prepare("UPDATE portal_zugang SET letzter_zugriff=datetime('now','localtime') WHERE id=?").run(z.id);
  return z;
}

// Meldungen und Aufgaben (Kanzlei-Seite)
export function meldungen(akteId: string) { tabellen(); return db().prepare("SELECT * FROM portal_meldung WHERE akte_id=? ORDER BY id DESC LIMIT 20").all(akteId) as { id: number; text: string; status: string; von: string; erstellt: string; freigegeben_am: string | null }[]; }
export function meldungAnlegen(akteId: string, text: string, von: string) { tabellen(); return Number(db().prepare("INSERT INTO portal_meldung (akte_id,text,von) VALUES (?,?,?)").run(akteId, text, von).lastInsertRowid); }
export function meldungFreigeben(akteId: string, id: number, text?: string) {
  tabellen();
  if (text) db().prepare("UPDATE portal_meldung SET text=? WHERE id=? AND akte_id=? AND status='entwurf'").run(text, id, akteId);
  return db().prepare("UPDATE portal_meldung SET status='frei', freigegeben_am=datetime('now','localtime') WHERE id=? AND akte_id=?").run(id, akteId).changes > 0;
}
export function meldungLoeschen(akteId: string, id: number) { tabellen(); db().prepare("DELETE FROM portal_meldung WHERE id=? AND akte_id=? AND status='entwurf'").run(id, akteId); }
export function aufgaben(akteId: string) { tabellen(); return db().prepare("SELECT * FROM portal_aufgabe WHERE akte_id=? ORDER BY erledigt, id").all(akteId) as { id: number; titel: string; erledigt: number }[]; }
export function aufgabeAnlegen(akteId: string, titel: string) { tabellen(); db().prepare("INSERT INTO portal_aufgabe (akte_id,titel) VALUES (?,?)").run(akteId, titel); }
export function aufgabeErledigt(akteId: string, id: number, erledigt: boolean) { tabellen(); db().prepare("UPDATE portal_aufgabe SET erledigt=? WHERE id=? AND akte_id=?").run(erledigt ? 1 : 0, id, akteId); }

// Fortschritt in einfachen Schritten, abgeleitet aus der Phase der Akte
const SCHRITTE = ["Auftrag erhalten", "Unterlagen sammeln", "Versicherung angeschrieben", "Regulierung läuft", "Abschluss"];
function schrittAusPhase(phase: string): number {
  const p = phase.toLowerCase();
  if (/abschluss|erledigt|abgerechnet/.test(p)) return 4;
  if (/kürzung|nachfrist|prüffrist|regulier|zahlung|klage|berufung|gericht/.test(p)) return 3;
  if (/anspruch|anschreiben|versicherung/.test(p)) return 2;
  if (/unterlagen/.test(p)) return 1;
  return 0;
}

/** Genau das, was der Mandant sieht – nichts darüber hinaus. */
export interface PortalAnsicht {
  kanzlei: { name: string; telefon: string; email: string };
  az: string; anrede: string; unfalltag: string;
  meldung: { text: string; datum: string } | null;
  aufgaben: string[] | null;
  geld: { gefordert: number; gezahlt: number; offen: number } | null;
  fortschritt: { schritte: string[]; aktuell: number } | null;
}
export function portalAnsicht(akteId: string, f: Freigaben): PortalAnsicht | null {
  tabellen();
  const d = db();
  const a = d.prepare("SELECT id, phase, falldaten FROM akten WHERE id=?").get(akteId) as { id: string; phase: string; falldaten: string } | undefined;
  if (!a) return null;
  const mandant = (d.prepare("SELECT name FROM beteiligte WHERE akte_id=? AND rolle='Mandant' LIMIT 1").get(akteId) as { name: string } | undefined)?.name ?? "";
  const k = kanzleiLaden();
  const fd = JSON.parse(a.falldaten || "{}");
  const m = d.prepare("SELECT text, freigegeben_am FROM portal_meldung WHERE akte_id=? AND status='frei' ORDER BY freigegeben_am DESC, id DESC LIMIT 1").get(akteId) as { text: string; freigegeben_am: string } | undefined;
  const summe = d.prepare("SELECT COALESCE(SUM(gefordert),0) g, COALESCE(SUM(gezahlt),0) z FROM konto WHERE akte_id=?").get(akteId) as { g: number; z: number };
  return {
    kanzlei: { name: k.name, telefon: k.telefon, email: k.email },
    az: a.id,
    anrede: mandant,
    unfalltag: String(fd.unfalltag ?? "").split(",")[0],
    meldung: m ? { text: m.text, datum: m.freigegeben_am.slice(0, 10).split("-").reverse().join(".") } : null,
    aufgaben: f.aufgaben ? aufgaben(akteId).filter((x) => !x.erledigt).map((x) => x.titel) : null,
    geld: f.geld ? { gefordert: summe.g, gezahlt: summe.z, offen: Math.max(0, summe.g - summe.z) } : null,
    fortschritt: f.fortschritt ? { schritte: SCHRITTE, aktuell: schrittAusPhase(a.phase) } : null,
  };
}
