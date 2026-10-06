// Datensicherung: Datenbank + Dokumente in eine verschlüsselte Datei (AES-256-GCM, Schlüssel aus Passwort per scrypt).
// Format: "KZB1" | salt(16) | iv(12) | tag(16) | gzip( [4 Byte Länge][Index-JSON] + Dateien hintereinander )
import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import zlib from "zlib";
import { ABLAGE, db, dbSchliessen } from "./db";

const DATEN = path.join(process.cwd(), "daten");
const MAGIC = Buffer.from("KZB1");

export interface SicherungEinst { aktiv: boolean; ordner: string; behalten: number; hatPasswort: boolean; letzte: string | null; letzterFehler: string }
type Roh = Omit<SicherungEinst, "hatPasswort"> & { passwort?: string };

function tabelle() { db().exec("CREATE TABLE IF NOT EXISTS sicherung (id INTEGER PRIMARY KEY CHECK (id=1), daten TEXT NOT NULL)"); }
const appSchl = () => crypto.createHash("sha256").update("sicherung:" + (process.env.AUTH_SECRET ?? "")).digest();
function appVer(t: string) { const iv = crypto.randomBytes(12), c = crypto.createCipheriv("aes-256-gcm", appSchl(), iv); const e = Buffer.concat([c.update(t, "utf8"), c.final()]); return [iv, c.getAuthTag(), e].map((b) => b.toString("base64")).join("."); }
function appEnt(s: string) { const [iv, tag, e] = s.split(".").map((x) => Buffer.from(x, "base64")); const d = crypto.createDecipheriv("aes-256-gcm", appSchl(), iv); d.setAuthTag(tag); return Buffer.concat([d.update(e), d.final()]).toString("utf8"); }

function roh(): Roh {
  tabelle();
  const r = db().prepare("SELECT daten FROM sicherung WHERE id=1").get() as { daten: string } | undefined;
  return { aktiv: false, ordner: path.join(os.homedir(), "Kanzlei-Sicherung"), behalten: 14, letzte: null, letzterFehler: "", ...(r ? JSON.parse(r.daten) : {}) };
}
function rohSpeichern(r: Roh) { tabelle(); db().prepare("INSERT INTO sicherung (id,daten) VALUES (1,?) ON CONFLICT(id) DO UPDATE SET daten=excluded.daten").run(JSON.stringify(r)); }
export function einstLaden(): SicherungEinst { const { passwort, ...r } = roh(); return { ...r, hatPasswort: !!passwort }; }
export function einstSpeichern(e: Partial<SicherungEinst> & { passwort?: string }) {
  const r = roh();
  if (typeof e.aktiv === "boolean") r.aktiv = e.aktiv;
  if (typeof e.ordner === "string" && e.ordner.trim()) r.ordner = e.ordner.trim().slice(0, 300);
  if (Number(e.behalten) >= 1) r.behalten = Math.min(365, Math.floor(Number(e.behalten)));
  if (e.passwort) { if (e.passwort.length < 10) throw new Error("Passwort: mindestens 10 Zeichen"); r.passwort = appVer(e.passwort); }
  rohSpeichern(r);
  return einstLaden();
}

function schluessel(pw: string, salz: Buffer) { return crypto.scryptSync(pw, salz, 32, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }); }

/** Erstellt eine Sicherung und legt sie im Zielordner ab. Gibt den Dateipfad zurück. */
export async function sichern(grund = "manuell"): Promise<{ datei: string; groesse: number; dokumente: number }> {
  const r = roh();
  if (!r.passwort) throw new Error("Erst ein Sicherungs-Passwort festlegen");
  fs.mkdirSync(r.ordner, { recursive: true });
  // Konsistente Kopie der laufenden Datenbank
  const tmp = path.join(os.tmpdir(), `kanzlei-${Date.now()}.db`);
  await db().backup(tmp);
  const teile: Buffer[] = [];
  const index: { name: string; laenge: number }[] = [];
  const add = (name: string, b: Buffer) => { index.push({ name, laenge: b.length }); teile.push(b); };
  add("kanzlei.db", fs.readFileSync(tmp)); fs.rmSync(tmp, { force: true });
  let n = 0;
  if (fs.existsSync(ABLAGE)) for (const f of fs.readdirSync(ABLAGE)) {
    const p = path.join(ABLAGE, f);
    if (fs.statSync(p).isFile()) { add("dokumente/" + f, fs.readFileSync(p)); n++; }
  }
  const kopf = Buffer.from(JSON.stringify({ version: 1, erstellt: new Date().toISOString(), grund, index }));
  const len = Buffer.alloc(4); len.writeUInt32BE(kopf.length);
  const klar = zlib.gzipSync(Buffer.concat([len, kopf, ...teile]), { level: 6 });
  const salz = crypto.randomBytes(16), iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", schluessel(appEnt(r.passwort), salz), iv);
  const enc = Buffer.concat([c.update(klar), c.final()]);
  const aus = Buffer.concat([MAGIC, salz, iv, c.getAuthTag(), enc]);
  const z = new Date(), p2 = (x: number) => String(x).padStart(2, "0");
  const datei = path.join(r.ordner, `Kanzlei-Sicherung_${z.getFullYear()}-${p2(z.getMonth() + 1)}-${p2(z.getDate())}_${p2(z.getHours())}${p2(z.getMinutes())}${p2(z.getSeconds())}.kzb`);
  fs.writeFileSync(datei + ".tmp", aus); fs.renameSync(datei + ".tmp", datei);
  // Alte Sicherungen aufräumen
  const alle = fs.readdirSync(r.ordner).filter((f) => /^Kanzlei-Sicherung_.*\.kzb$/.test(f)).sort();
  for (const f of alle.slice(0, Math.max(0, alle.length - r.behalten))) fs.rmSync(path.join(r.ordner, f), { force: true });
  r.letzte = new Date().toISOString(); r.letzterFehler = ""; rohSpeichern(r);
  return { datei, groesse: aus.length, dokumente: n };
}

export function liste() {
  const r = roh();
  if (!fs.existsSync(r.ordner)) return [];
  return fs.readdirSync(r.ordner).filter((f) => /^Kanzlei-Sicherung_.*\.kzb$/.test(f)).sort().reverse()
    .map((f) => ({ name: f, groesse: fs.statSync(path.join(r.ordner, f)).size }));
}

function entpacken(buf: Buffer, pw: string) {
  if (buf.length < 48 || !buf.subarray(0, 4).equals(MAGIC)) throw new Error("Keine Kanzlei-Sicherung");
  const salz = buf.subarray(4, 20), iv = buf.subarray(20, 32), tag = buf.subarray(32, 48);
  let klar: Buffer;
  try {
    const d = crypto.createDecipheriv("aes-256-gcm", schluessel(pw, salz), iv); d.setAuthTag(tag);
    klar = zlib.gunzipSync(Buffer.concat([d.update(buf.subarray(48)), d.final()]));
  } catch { throw new Error("Passwort falsch oder Datei beschädigt"); }
  const kl = klar.readUInt32BE(0);
  const kopf = JSON.parse(klar.subarray(4, 4 + kl).toString("utf8")) as { erstellt: string; index: { name: string; laenge: number }[] };
  let pos = 4 + kl;
  const dateien = kopf.index.map((e) => { const b = klar.subarray(pos, pos + e.laenge); pos += e.laenge; return { name: e.name, inhalt: b }; });
  return { erstellt: kopf.erstellt, dateien };
}

/** Stellt eine Sicherung wieder her. Vorher wird der aktuelle Stand gesichert (falls möglich). */
export async function wiederherstellen(buf: Buffer, pw: string): Promise<{ erstellt: string; dokumente: number }> {
  const inhalt = entpacken(buf, pw); // prüft Passwort, bevor etwas verändert wird
  const dbDatei = inhalt.dateien.find((d) => d.name === "kanzlei.db");
  if (!dbDatei) throw new Error("Sicherung enthält keine Datenbank");
  try { await sichern("vor Wiederherstellung"); } catch { /* ohne Passwort/Ordner: weiter */ }
  dbSchliessen();
  for (const f of ["kanzlei.db-wal", "kanzlei.db-shm"]) fs.rmSync(path.join(DATEN, f), { force: true });
  fs.writeFileSync(path.join(DATEN, "kanzlei.db"), dbDatei.inhalt);
  fs.mkdirSync(ABLAGE, { recursive: true });
  let n = 0;
  for (const d of inhalt.dateien) {
    if (!d.name.startsWith("dokumente/")) continue;
    const name = path.basename(d.name); // nie außerhalb der Ablage schreiben
    if (!name || name.startsWith(".")) continue;
    fs.writeFileSync(path.join(ABLAGE, name), d.inhalt); n++;
  }
  return { erstellt: inhalt.erstellt, dokumente: n };
}

/** Automatisch: einmal täglich, geprüft beim Start und stündlich. */
let geplant = false;
export function automatikStarten() {
  if (geplant) return; geplant = true;
  const pruefen = async () => {
    try {
      const r = roh();
      if (!r.aktiv || !r.passwort) return;
      if (r.letzte && Date.now() - new Date(r.letzte).getTime() < 23 * 3600_000) return;
      await sichern("automatisch");
    } catch (x) {
      try { const r = roh(); r.letzterFehler = `${new Date().toLocaleString("de-DE")}: ${(x as Error).message}`; rohSpeichern(r); } catch { /* egal */ }
    }
  };
  setTimeout(pruefen, 30_000);
  setInterval(pruefen, 3600_000).unref?.();
}
