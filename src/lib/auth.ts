// Benutzerverwaltung (nur Server/Node).
import crypto from "crypto";
import { cookies, headers } from "next/headers";
import { db } from "./db";
import { COOKIE, DAUER_MS, pruefen, signieren, type Rolle, type Sitzung } from "./sitzung";

export interface BenutzerRow { id: number; name: string; kuerzel: string; login: string; rolle: Rolle; aktiv: number; letzter_login: string | null }

let bereit = false;
function tabellen() {
  if (bereit) return;
  db().exec(`CREATE TABLE IF NOT EXISTS benutzer (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, kuerzel TEXT NOT NULL,
    login TEXT NOT NULL UNIQUE COLLATE NOCASE, hash TEXT NOT NULL, rolle TEXT NOT NULL DEFAULT 'refa',
    aktiv INTEGER NOT NULL DEFAULT 1, fehlversuche INTEGER NOT NULL DEFAULT 0, gesperrt_bis INTEGER NOT NULL DEFAULT 0,
    letzter_login TEXT, angelegt TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  )`);
  bereit = true;
}

export function hashen(pw: string): string {
  const salz = crypto.randomBytes(16);
  const h = crypto.scryptSync(pw, salz, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salz.toString("hex")}$${h.toString("hex")}`;
}
function hashPruefen(pw: string, gespeichert: string): boolean {
  const [art, salz, h] = gespeichert.split("$");
  if (art !== "scrypt" || !salz || !h) return false;
  const neu = crypto.scryptSync(pw, Buffer.from(salz, "hex"), 64, { N: 16384, r: 8, p: 1 });
  const alt = Buffer.from(h, "hex");
  return alt.length === neu.length && crypto.timingSafeEqual(alt, neu);
}
const DUMMY = hashen("x".repeat(16)); // gleiche Laufzeit bei unbekanntem Login

export function passwortFehler(pw: unknown): string | null {
  if (typeof pw !== "string" || pw.length < 10) return "Passwort: mindestens 10 Zeichen";
  if (pw.length > 200) return "Passwort zu lang";
  return null;
}

export function anzahlBenutzer(): number {
  tabellen();
  return (db().prepare("SELECT COUNT(*) c FROM benutzer").get() as { c: number }).c;
}
export function alleBenutzer(): BenutzerRow[] {
  tabellen();
  return db().prepare("SELECT id,name,kuerzel,login,rolle,aktiv,letzter_login FROM benutzer ORDER BY name").all() as BenutzerRow[];
}
export function benutzerAnlegen(b: { name: string; kuerzel: string; login: string; passwort: string; rolle: Rolle }) {
  tabellen();
  const r = db().prepare("INSERT INTO benutzer (name,kuerzel,login,hash,rolle) VALUES (?,?,?,?,?)")
    .run(b.name, b.kuerzel.toUpperCase(), b.login, hashen(b.passwort), b.rolle);
  return Number(r.lastInsertRowid);
}
export function benutzerAendern(id: number, f: { rolle?: Rolle; aktiv?: boolean; passwort?: string }) {
  tabellen();
  const d = db();
  if (f.rolle) d.prepare("UPDATE benutzer SET rolle=? WHERE id=?").run(f.rolle, id);
  if (typeof f.aktiv === "boolean") d.prepare("UPDATE benutzer SET aktiv=? WHERE id=?").run(f.aktiv ? 1 : 0, id);
  if (f.passwort) d.prepare("UPDATE benutzer SET hash=?, fehlversuche=0, gesperrt_bis=0 WHERE id=?").run(hashen(f.passwort), id);
}
export function aktiveAdmins(): number {
  tabellen();
  return (db().prepare("SELECT COUNT(*) c FROM benutzer WHERE rolle='admin' AND aktiv=1").get() as { c: number }).c;
}

/** Prüft Login und Passwort. Nach 5 Fehlversuchen 5 Minuten gesperrt. */
export function anmelden(login: string, pw: string): { ok: true; s: Sitzung } | { ok: false; fehler: string } {
  tabellen();
  const d = db();
  const u = d.prepare("SELECT * FROM benutzer WHERE login=?").get(login) as (BenutzerRow & { hash: string; fehlversuche: number; gesperrt_bis: number }) | undefined;
  if (!u) { hashPruefen(pw, DUMMY); return { ok: false, fehler: "Login oder Passwort falsch" }; }
  if (u.gesperrt_bis > Date.now()) return { ok: false, fehler: "Zu viele Fehlversuche – bitte in einigen Minuten erneut versuchen" };
  if (!hashPruefen(pw, u.hash) || !u.aktiv) {
    const n = u.fehlversuche + 1;
    d.prepare("UPDATE benutzer SET fehlversuche=?, gesperrt_bis=? WHERE id=?").run(n >= 5 ? 0 : n, n >= 5 ? Date.now() + 5 * 60_000 : 0, u.id);
    return { ok: false, fehler: "Login oder Passwort falsch" };
  }
  d.prepare("UPDATE benutzer SET fehlversuche=0, gesperrt_bis=0, letzter_login=datetime('now','localtime') WHERE id=?").run(u.id);
  return { ok: true, s: { u: u.id, k: u.kuerzel, r: u.rolle, e: Date.now() + DAUER_MS } };
}

export async function sitzungsCookie(s: Sitzung) {
  return {
    name: COOKIE, value: await signieren(s),
    httpOnly: true, sameSite: "strict" as const, path: "/",
    secure: process.env.NODE_ENV === "production" && process.env.AUTH_HTTP !== "1",
    maxAge: Math.floor(DAUER_MS / 1000),
  };
}

/** Aktueller Benutzer aus dem Cookie; prüft zusätzlich, ob er noch aktiv ist. */
export async function aktuellerBenutzer(): Promise<BenutzerRow | null> {
  const s = await pruefen(cookies().get(COOKIE)?.value);
  if (!s) return null;
  tabellen();
  const u = db().prepare("SELECT id,name,kuerzel,login,rolle,aktiv,letzter_login FROM benutzer WHERE id=?").get(s.u) as BenutzerRow | undefined;
  return u && u.aktiv ? u : null;
}

/** Kürzel des angemeldeten Benutzers (von der Middleware gesetzt) – für Verlauf und Zuständigkeit. */
export function wer(): string {
  return headers().get("x-kuerzel") || "?";
}
