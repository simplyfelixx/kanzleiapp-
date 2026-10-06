// Mail senden (SMTP). Wird nur auf ausdrücklichen Klick „Senden“ ausgelöst – nie automatisch.
// Gesendete Mails landen in der Mail-Liste (Quelle „gesendet“) und im Verlauf der Akte.
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { ABLAGE, db, verlaufEintrag } from "./db";
import { entschluesseln, kontoRoh, tabellenMail } from "./mail";
import { graphAbsender, graphAktiv, graphSenden } from "./graph";

export interface Versand { an: string; cc: string; betreff: string; text: string; akteId: string | null; dokumente: number[]; antwortAuf: number | null }

// Ohne TLS nur an einen Server auf demselben Rechner (z. B. lokales Relay)
const LOKAL = /^(localhost|127\.0\.0\.1|::1)$/;
const ADRESSE = /^[^\s@<>,;"]+@[^\s@<>,;"]+\.[^\s@<>,;"]+$/;
export function adressen(s: string): string[] {
  return s.split(/[,;\s]+/).map((x) => x.trim()).filter(Boolean);
}

/** Eingaben prüfen; gibt Fehlertext oder geprüften Versand zurück */
export function versandPruefen(b: Record<string, unknown>): Versand | { fehler: string } {
  const an = String(b.an ?? "").slice(0, 1000), cc = String(b.cc ?? "").slice(0, 1000);
  const alle = [...adressen(an), ...adressen(cc)];
  if (!adressen(an).length) return { fehler: "Empfänger fehlt" };
  const falsch = alle.find((a) => !ADRESSE.test(a));
  if (falsch) return { fehler: `Ungültige Adresse: ${falsch}` };
  if (alle.length > 20) return { fehler: "Höchstens 20 Empfänger" };
  const betreff = String(b.betreff ?? "").replace(/[\r\n]+/g, " ").trim().slice(0, 300);
  if (!betreff) return { fehler: "Betreff fehlt" };
  const akteId = b.akteId ? String(b.akteId) : null;
  if (akteId && !db().prepare("SELECT 1 FROM akten WHERE id=?").get(akteId)) return { fehler: "Akte unbekannt" };
  const dokumente = (Array.isArray(b.dokumente) ? b.dokumente : []).map(Number).filter(Number.isInteger).slice(0, 15);
  if (dokumente.length && !akteId) return { fehler: "Anhänge nur aus einer Akte" };
  return { an, cc, betreff, text: String(b.text ?? "").slice(0, 50000), akteId, dokumente, antwortAuf: Number(b.antwortAuf) || null };
}

export async function senden(v: Versand, wer: string) {
  const k = kontoRoh();
  const outlook = graphAktiv();
  if (!outlook && (!k.smtpHost || !k.benutzer || !k.passwort)) throw new Error("Versand nicht eingerichtet (Einstellungen → Mailkonto oder Outlook)");
  const absender = outlook ? graphAbsender() : k.absender || k.benutzer;
  if (!ADRESSE.test(absender)) throw new Error("Absenderadresse fehlt (Einstellungen → Mailkonto)");
  tabellenMail();
  const d = db();

  const doks = v.dokumente.length
    ? (d.prepare(`SELECT id, name, datei FROM dokumente WHERE akte_id=? AND id IN (${v.dokumente.map(() => "?").join(",")})`).all(v.akteId, ...v.dokumente) as { id: number; name: string; datei: string }[])
    : [];
  if (doks.length !== v.dokumente.length) throw new Error("Anhang nicht in dieser Akte");
  const anhaenge = doks.map((x) => {
    const p = path.join(ABLAGE, path.basename(x.datei));
    if (!fs.existsSync(p)) throw new Error(`Datei fehlt: ${x.name}`);
    return { filename: x.name, path: p };
  });
  const groesse = anhaenge.reduce((s, a) => s + fs.statSync(a.path).size, 0);
  // Outlook nimmt per sendMail höchstens ca. 4 MB je Anfrage an (Base64 macht die Datei ein Drittel größer)
  if (outlook && groesse > 2.8 * 1024 * 1024) throw new Error("Anhänge zusammen über 2,8 MB – über Outlook nicht möglich");
  if (groesse > 20 * 1024 * 1024) throw new Error("Anhänge zusammen über 20 MB");

  const vorher = v.antwortAuf ? (d.prepare("SELECT message_id FROM mails WHERE id=?").get(v.antwortAuf) as { message_id: string } | undefined) : undefined;
  const ref = vorher && !vorher.message_id.startsWith("sha:") ? vorher.message_id : undefined;
  const text = k.signatur ? `${v.text.trimEnd()}\n\n-- \n${k.signatur}` : v.text;
  const domain = absender.split("@")[1];
  const messageId = `<${crypto.randomUUID()}@${domain}>`;

  const nodemailer = (await import("nodemailer")).default;
  const nachricht = {
    from: k.absenderName ? { name: k.absenderName, address: absender } : absender,
    to: adressen(v.an), cc: adressen(v.cc), subject: v.betreff, text, attachments: anhaenge, messageId,
    ...(ref ? { inReplyTo: ref, references: ref } : {}),
  };
  if (outlook) {
    // MIME hier erzeugen, Microsoft versendet und legt in „Gesendete Elemente“ ab
    const info = await nodemailer.createTransport({ streamTransport: true, buffer: true }).sendMail(nachricht);
    await graphSenden(info.message as Buffer);
  } else {
    const t = nodemailer.createTransport({
      host: k.smtpHost, port: k.smtpPort, secure: k.smtpPort === 465, requireTLS: k.smtpPort !== 465 && !LOKAL.test(k.smtpHost),
      auth: { user: k.benutzer, pass: entschluesseln(k.passwort ?? "") }, connectionTimeout: 15000,
    });
    await t.sendMail(nachricht);
  }

  const jetzt = new Date(), p = (n: number) => String(n).padStart(2, "0");
  const datum = `${jetzt.getFullYear()}-${p(jetzt.getMonth() + 1)}-${p(jetzt.getDate())} ${p(jetzt.getHours())}:${p(jetzt.getMinutes())}:${p(jetzt.getSeconds())}`;
  let id = 0;
  d.transaction(() => {
    id = Number(d.prepare(`INSERT INTO mails (message_id,quelle,von,von_name,an,betreff,datum,text,akte_id,akte_grund,gelesen,status) VALUES (?,?,?,?,?,?,?,?,?,?,1,'gesendet')`)
      .run(messageId, "gesendet", absender, k.absenderName, [v.an, v.cc && `cc ${v.cc}`].filter(Boolean).join(", "), v.betreff, datum, text, v.akteId, v.akteId ? "gesendet aus Akte" : "").lastInsertRowid);
    for (const x of doks) d.prepare("INSERT INTO mail_anhang (mail_id,name,datei,groesse,typ,abgelegt_in) VALUES (?,?,?,?,?,?)").run(id, x.name, x.datei, fs.statSync(path.join(ABLAGE, path.basename(x.datei))).size, "", v.akteId);
    if (v.antwortAuf) d.prepare("UPDATE mails SET status='beantwortet' WHERE id=? AND status='offen'").run(v.antwortAuf);
    if (v.akteId) verlaufEintrag(v.akteId, `Mail gesendet an ${v.an}: ${v.betreff}${doks.length ? ` (${doks.length} Anhang/Anhänge)` : ""}`, wer);
  })();
  return { id, anhaenge: doks.length };
}

/** Verbindung prüfen, ohne zu senden */
export async function versandTesten() {
  if (graphAktiv()) { await (await import("./graph")).graphTesten(); return; }
  const k = kontoRoh();
  if (!k.smtpHost || !k.passwort) throw new Error("Server oder Passwort fehlt");
  const nodemailer = (await import("nodemailer")).default;
  const t = nodemailer.createTransport({ host: k.smtpHost, port: k.smtpPort, secure: k.smtpPort === 465, requireTLS: k.smtpPort !== 465 && !LOKAL.test(k.smtpHost), auth: { user: k.benutzer, pass: entschluesseln(k.passwort) }, connectionTimeout: 10000 });
  await t.verify();
}
