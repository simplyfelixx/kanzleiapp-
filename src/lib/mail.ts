// Mail: Import aus .eml/.msg-Dateien oder per IMAP. Anhänge werden gelesen (PDF-Text oder Texterkennung)
// und wie im Eingang erkannt – so steht der Inhalt schon unter der Mail, ohne die PDF zu öffnen.
import crypto from "crypto";
import { aktenIndex, dateiSpeichern, db } from "./db";
import { erkenneDokument } from "./dokerkennung";
import { dateiText } from "./dateitext";
import { kiLaden } from "./ki";
import { kiDokument } from "./kiauswertung";

export interface MailRoh {
  messageId: string; von: string; vonName: string; an: string; betreff: string; datum: string; text: string;
  anhaenge: { name: string; inhalt: Buffer; typ: string }[];
}
export interface AnhangErkannt {
  typ: string; absender: string; datum: string; zusammenfassung: string; kiText: string;
  betraege: { label: string; wert: number }[]; frist: { datum: string; text: string } | null; zeichen: string;
  akteId: string | null; akteGrund: string; sicher: boolean; dateiname: string; textQuelle: string; hinweis: string;
}

let bereit = false;
function tabellen() {
  if (bereit) return;
  db().exec(`
    CREATE TABLE IF NOT EXISTS mails (
      id INTEGER PRIMARY KEY AUTOINCREMENT, message_id TEXT UNIQUE, quelle TEXT NOT NULL,
      von TEXT NOT NULL DEFAULT '', von_name TEXT NOT NULL DEFAULT '', an TEXT NOT NULL DEFAULT '',
      betreff TEXT NOT NULL DEFAULT '', datum TEXT NOT NULL, text TEXT NOT NULL DEFAULT '',
      akte_id TEXT, akte_grund TEXT NOT NULL DEFAULT '', gelesen INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'offen',
      importiert TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS mail_anhang (
      id INTEGER PRIMARY KEY AUTOINCREMENT, mail_id INTEGER NOT NULL REFERENCES mails(id) ON DELETE CASCADE,
      name TEXT NOT NULL, datei TEXT, groesse INTEGER NOT NULL DEFAULT 0, typ TEXT NOT NULL DEFAULT '',
      erkannt TEXT, abgelegt_in TEXT
    );
    CREATE TABLE IF NOT EXISTS mail_konto (id INTEGER PRIMARY KEY CHECK (id=1), daten TEXT NOT NULL);
  `);
  bereit = true;
}

const LESBAR = /\.(pdf|png|jpe?g|txt)$/i;
const ERLAUBT = /\.(pdf|png|jpe?g|heic|txt|docx?|xlsx?)$/i;
// Ortszeit (wie in der übrigen App), nicht UTC
const isoDatum = (d: Date) => {
  const x = isNaN(+d) ? new Date() : d, p = (n: number) => String(n).padStart(2, "0");
  return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())} ${p(x.getHours())}:${p(x.getMinutes())}:${p(x.getSeconds())}`;
};

/** Liest eine .eml (RFC 822) */
export async function emlLesen(raw: Buffer): Promise<MailRoh> {
  const { simpleParser } = await import("mailparser");
  const m = await simpleParser(raw, { skipHtmlToText: false });
  const von = m.from?.value?.[0];
  const an = Array.isArray(m.to) ? m.to.map((x) => x.text).join(", ") : m.to?.text ?? "";
  return {
    messageId: m.messageId || "sha:" + crypto.createHash("sha256").update(raw).digest("hex").slice(0, 32),
    von: von?.address ?? "", vonName: von?.name ?? "", an, betreff: m.subject ?? "(ohne Betreff)",
    datum: isoDatum(m.date ?? new Date()), text: (m.text ?? "").slice(0, 50000),
    anhaenge: m.attachments.filter((a) => a.contentDisposition !== "inline" || a.filename)
      .map((a) => ({ name: a.filename || "anhang", inhalt: a.content, typ: a.contentType })),
  };
}

/** Liest eine Outlook-.msg */
export async function msgLesen(raw: Buffer): Promise<MailRoh> {
  const MsgReader = (await import("@kenjiuno/msgreader")).default;
  const r = new MsgReader(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength) as ArrayBuffer);
  const f = r.getFileData();
  const anhaenge = (f.attachments ?? []).filter((a) => !a.innerMsgContent).map((a) => {
    const x = r.getAttachment(a);
    return { name: x.fileName || a.fileName || "anhang", inhalt: Buffer.from(x.content), typ: "" };
  });
  const mid = (f.headers ?? "").match(/^message-id:\s*(\S+)/im)?.[1];
  return {
    messageId: mid || "sha:" + crypto.createHash("sha256").update(raw).digest("hex").slice(0, 32),
    von: f.senderEmail ?? "", vonName: f.senderName ?? "", an: (f.recipients ?? []).map((x) => x.email || x.name).filter(Boolean).join(", "),
    betreff: f.subject ?? "(ohne Betreff)", datum: isoDatum(new Date(f.messageDeliveryTime || f.clientSubmitTime || Date.now())),
    text: (f.body ?? "").slice(0, 50000), anhaenge,
  };
}

/** Speichert eine Mail mit Anhängen und wertet die Anhänge aus. Doppelte Mails (gleiche Message-ID) werden übersprungen. */
export async function mailSpeichern(m: MailRoh, quelle: string): Promise<{ id: number; neu: boolean }> {
  tabellen();
  const d = db();
  const alt = d.prepare("SELECT id FROM mails WHERE message_id=?").get(m.messageId) as { id: number } | undefined;
  if (alt) return { id: alt.id, neu: false };

  const index = aktenIndex();
  const zuordnung = erkenneDokument(`${m.betreff}\n${m.text}`, "mail.txt", index);
  const mailId = Number(d.prepare(`INSERT INTO mails (message_id,quelle,von,von_name,an,betreff,datum,text,akte_id,akte_grund) VALUES (?,?,?,?,?,?,?,?,?,?)`)
    .run(m.messageId, quelle, m.von.slice(0, 200), m.vonName.slice(0, 200), m.an.slice(0, 500), m.betreff.slice(0, 300), m.datum, m.text,
      zuordnung.sicher ? zuordnung.akteId : null, zuordnung.sicher ? zuordnung.akteGrund : "").lastInsertRowid);

  const ki = kiLaden();
  const namen = ki.aktiv ? Array.from(new Set(index.flatMap((a) => a.namen))) : [];
  for (const a of m.anhaenge.slice(0, 20)) {
    if (!ERLAUBT.test(a.name) || a.inhalt.length > 25 * 1024 * 1024) continue;
    const endung = (a.name.match(/\.\w+$/)?.[0] ?? "").toLowerCase();
    const datei = dateiSpeichern(a.inhalt, endung);
    let erkannt: AnhangErkannt | null = null;
    if (LESBAR.test(a.name)) {
      const dt = await dateiText(a.inhalt, endung);
      // Mail-Text hilft bei der Zuordnung, wenn der Anhang selbst keine Namen/Zeichen enthält
      const e = erkenneDokument(dt.text, a.name, index);
      if (!e.akteId && zuordnung.akteId) { e.akteId = zuordnung.akteId; e.akteGrund = `aus der Mail: ${zuordnung.akteGrund}`; e.sicher = zuordnung.sicher; }
      let kiText = "";
      if (ki.aktiv && dt.text) {
        const k = await kiDokument(dt.text, namen).catch(() => null);
        if (k) { if (k.typ !== "Sonstiges" || e.typ === "Sonstiges") e.typ = k.typ; if (k.absender) e.absender = k.absender; kiText = k.zusammenfassung; }
      }
      erkannt = {
        typ: e.typ, absender: e.absender, datum: e.datum, zusammenfassung: e.zusammenfassung, kiText,
        betraege: e.betraege, frist: e.frist, zeichen: e.zeichen, akteId: e.akteId, akteGrund: e.akteGrund, sicher: e.sicher,
        dateiname: `${e.datum}_${e.typ}_${e.absender}`.replace(/[^\wäöüÄÖÜß.-]+/g, "").slice(0, 80) + endung,
        textQuelle: dt.quelle, hinweis: dt.hinweis ?? "",
      };
    }
    d.prepare("INSERT INTO mail_anhang (mail_id,name,datei,groesse,typ,erkannt) VALUES (?,?,?,?,?,?)")
      .run(mailId, a.name.slice(0, 200), datei, a.inhalt.length, a.typ, erkannt ? JSON.stringify(erkannt) : null);
  }
  return { id: mailId, neu: true };
}

export function mailListe() {
  tabellen();
  return db().prepare(`SELECT m.id, m.quelle, m.an, m.von, m.von_name, m.betreff, m.datum, m.akte_id, m.gelesen, m.status,
    (SELECT COUNT(*) FROM mail_anhang a WHERE a.mail_id=m.id) AS anhaenge
    FROM mails m WHERE m.status != 'geloescht' ORDER BY m.datum DESC LIMIT 300`).all();
}
export function tabellenMail() { tabellen(); }
export function mailLaden(id: number) {
  tabellen();
  const m = db().prepare("SELECT * FROM mails WHERE id=?").get(id) as Record<string, unknown> | undefined;
  if (!m) return null;
  const anhaenge = (db().prepare("SELECT id,name,groesse,typ,erkannt,abgelegt_in FROM mail_anhang WHERE mail_id=? ORDER BY id").all(id) as { erkannt: string | null }[])
    .map((a) => ({ ...a, erkannt: a.erkannt ? JSON.parse(a.erkannt) : null }));
  return { ...m, anhaenge } as Record<string, unknown> & { anhaenge: typeof anhaenge };
}
export function mailGelesen(id: number) { tabellen(); db().prepare("UPDATE mails SET gelesen=1 WHERE id=?").run(id); }
export function mailAkte(id: number, akteId: string | null) { tabellen(); db().prepare("UPDATE mails SET akte_id=?, akte_grund=? WHERE id=?").run(akteId, akteId ? "von Hand" : "", id); }
export function anhangLaden(id: number) {
  tabellen();
  return db().prepare("SELECT a.*, m.datum AS mail_datum FROM mail_anhang a JOIN mails m ON m.id=a.mail_id WHERE a.id=?").get(id) as
    { id: number; mail_id: number; name: string; datei: string | null; groesse: number; erkannt: string | null; abgelegt_in: string | null; mail_datum: string } | undefined;
}
export function anhangAbgelegt(id: number, akteId: string) { tabellen(); db().prepare("UPDATE mail_anhang SET abgelegt_in=? WHERE id=?").run(akteId, id); }

// ---- IMAP-Konto (Passwort verschlüsselt mit dem App-Schlüssel) ----
export interface MailKonto {
  aktiv: boolean; host: string; port: number; benutzer: string; ordner: string; tls: boolean; hatPasswort: boolean;
  // Versand (SMTP), gleiche Zugangsdaten
  smtpHost: string; smtpPort: number; absender: string; absenderName: string; signatur: string;
}
const schl = () => crypto.createHash("sha256").update("mailkonto:" + (process.env.AUTH_SECRET ?? "")).digest();
function verschluesseln(t: string) {
  const iv = crypto.randomBytes(12), c = crypto.createCipheriv("aes-256-gcm", schl(), iv);
  const enc = Buffer.concat([c.update(t, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString("base64")).join(".");
}
export function entschluesseln(s: string) {
  const [iv, tag, enc] = s.split(".").map((x) => Buffer.from(x, "base64"));
  const d = crypto.createDecipheriv("aes-256-gcm", schl(), iv); d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString("utf8");
}
export function kontoRoh(): (Omit<MailKonto, "hatPasswort"> & { passwort?: string }) {
  tabellen();
  const r = db().prepare("SELECT daten FROM mail_konto WHERE id=1").get() as { daten: string } | undefined;
  return { aktiv: false, host: "", port: 993, benutzer: "", ordner: "INBOX", tls: true, smtpHost: "", smtpPort: 587, absender: "", absenderName: "", signatur: "", ...(r ? JSON.parse(r.daten) : {}) };
}
export function kontoLaden(): MailKonto { const { passwort, ...k } = kontoRoh(); return { ...k, hatPasswort: !!passwort }; }
export function kontoSpeichern(k: Partial<MailKonto> & { passwort?: string }) {
  const alt = kontoRoh();
  const neu = {
    aktiv: typeof k.aktiv === "boolean" ? k.aktiv : alt.aktiv,
    host: typeof k.host === "string" ? k.host.trim().slice(0, 120) : alt.host,
    port: Number(k.port) > 0 && Number(k.port) < 65536 ? Number(k.port) : alt.port,
    benutzer: typeof k.benutzer === "string" ? k.benutzer.trim().slice(0, 200) : alt.benutzer,
    ordner: typeof k.ordner === "string" && k.ordner.trim() ? k.ordner.trim().slice(0, 100) : alt.ordner,
    tls: typeof k.tls === "boolean" ? k.tls : alt.tls,
    smtpHost: typeof k.smtpHost === "string" ? k.smtpHost.trim().slice(0, 120) : alt.smtpHost,
    smtpPort: Number(k.smtpPort) > 0 && Number(k.smtpPort) < 65536 ? Number(k.smtpPort) : alt.smtpPort,
    absender: typeof k.absender === "string" ? k.absender.trim().slice(0, 200) : alt.absender,
    absenderName: typeof k.absenderName === "string" ? k.absenderName.trim().slice(0, 120) : alt.absenderName,
    signatur: typeof k.signatur === "string" ? k.signatur.slice(0, 2000) : alt.signatur,
    passwort: k.passwort ? verschluesseln(k.passwort) : alt.passwort,
  };
  db().prepare("INSERT INTO mail_konto (id,daten) VALUES (1,?) ON CONFLICT(id) DO UPDATE SET daten=excluded.daten").run(JSON.stringify(neu));
  return kontoLaden();
}

/** Holt die neuesten Mails per IMAP (liest nur, markiert nichts als gelesen). */
export async function imapAbrufen(max = 25): Promise<{ neu: number; gesamt: number }> {
  const k = kontoRoh();
  if (!k.host || !k.benutzer || !k.passwort) throw new Error("Mailkonto unvollständig (Einstellungen)");
  const { ImapFlow } = await import("imapflow");
  const c = new ImapFlow({ host: k.host, port: k.port, secure: k.tls, auth: { user: k.benutzer, pass: entschluesseln(k.passwort) }, logger: false });
  await c.connect();
  let neu = 0, gesamt = 0;
  try {
    const lock = await c.getMailboxLock(k.ordner);
    try {
      const status = c.mailbox && typeof c.mailbox === "object" ? c.mailbox.exists : 0;
      if (status > 0) {
        const von = Math.max(1, status - max + 1);
        const roh: Buffer[] = [];
        for await (const msg of c.fetch(`${von}:*`, { source: true })) if (msg.source) roh.push(msg.source);
        for (const r of roh.reverse()) { gesamt++; if ((await mailSpeichern(await emlLesen(r), "imap")).neu) neu++; }
      }
    } finally { lock.release(); }
  } finally { await c.logout().catch(() => {}); }
  return { neu, gesamt };
}
