// Adressbuch: Versicherungen, Werkstätten, Gutachter, Polizei, Banken, Rechtsschutz – einmal anlegen, in allen Akten nutzen.
import { db } from "./db";

export const ARTEN = ["Versicherung", "Rechtsschutz", "Werkstatt", "Gutachter", "Polizei", "Bank", "Gericht", "Sonstige"] as const;
export interface KontaktRow {
  id: number; art: string; name: string; zusatz: string; strasse: string; plz_ort: string;
  telefon: string; email: string; iban: string; notiz: string;
}
export interface PersonRow { id: number; kontakt_id: number; name: string; telefon: string; email: string }

let bereit = false;
function tabellen() {
  if (bereit) return;
  const d = db();
  d.exec(`
    CREATE TABLE IF NOT EXISTS kontakte (
      id INTEGER PRIMARY KEY AUTOINCREMENT, art TEXT NOT NULL DEFAULT 'Sonstige', name TEXT NOT NULL,
      zusatz TEXT NOT NULL DEFAULT '', strasse TEXT NOT NULL DEFAULT '', plz_ort TEXT NOT NULL DEFAULT '',
      telefon TEXT NOT NULL DEFAULT '', email TEXT NOT NULL DEFAULT '', iban TEXT NOT NULL DEFAULT '', notiz TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS kontakt_personen (
      id INTEGER PRIMARY KEY AUTOINCREMENT, kontakt_id INTEGER NOT NULL REFERENCES kontakte(id) ON DELETE CASCADE,
      name TEXT NOT NULL, telefon TEXT NOT NULL DEFAULT '', email TEXT NOT NULL DEFAULT ''
    );
  `);
  const sp = (d.prepare("PRAGMA table_info(beteiligte)").all() as { name: string }[]).map((c) => c.name);
  if (!sp.includes("kontakt_id")) d.exec("ALTER TABLE beteiligte ADD COLUMN kontakt_id INTEGER REFERENCES kontakte(id) ON DELETE SET NULL");
  // Einmalig: vorhandene Firmen-Beteiligte (keine Mandanten/Gegner/Zeugen) ins Adressbuch übernehmen
  if (!(d.prepare("SELECT 1 FROM kontakte LIMIT 1").get())) {
    const rollen = ["Versicherung", "Werkstatt", "Gutachter", "Polizei", "Bank"];
    const bet = d.prepare(`SELECT rolle, name, adresse, telefon, email, ansprechpartner FROM beteiligte WHERE rolle IN (${rollen.map(() => "?").join(",")}) AND name != ''`).all(...rollen) as
      { rolle: string; name: string; adresse: string; telefon: string; email: string; ansprechpartner: string }[];
    const gesehen = new Map<string, number>();
    d.transaction(() => {
      for (const b of bet) {
        const key = b.name.trim().toLowerCase();
        let id = gesehen.get(key);
        if (!id) {
          const [strasse, ...rest] = b.adresse.split(/,\s*/);
          id = Number(d.prepare("INSERT INTO kontakte (art,name,strasse,plz_ort,telefon,email) VALUES (?,?,?,?,?,?)").run(b.rolle, b.name.trim(), strasse ?? "", rest.join(", "), b.telefon, b.email).lastInsertRowid);
          gesehen.set(key, id);
        }
        if (b.ansprechpartner && !d.prepare("SELECT 1 FROM kontakt_personen WHERE kontakt_id=? AND name=?").get(id, b.ansprechpartner))
          d.prepare("INSERT INTO kontakt_personen (kontakt_id,name,telefon) VALUES (?,?,?)").run(id, b.ansprechpartner, b.telefon);
        d.prepare("UPDATE beteiligte SET kontakt_id=? WHERE kontakt_id IS NULL AND lower(trim(name))=?").run(id, key);
      }
    })();
  }
  bereit = true;
}

export function kontakteListe(art?: string, suche?: string) {
  tabellen();
  const w: string[] = [], p: unknown[] = [];
  if (art) { w.push("k.art=?"); p.push(art); }
  if (suche) { w.push("(k.name LIKE ? OR k.plz_ort LIKE ? OR k.email LIKE ?)"); p.push(`%${suche}%`, `%${suche}%`, `%${suche}%`); }
  return db().prepare(`SELECT k.*, (SELECT COUNT(DISTINCT b.akte_id) FROM beteiligte b WHERE b.kontakt_id=k.id) AS akten
    FROM kontakte k ${w.length ? "WHERE " + w.join(" AND ") : ""} ORDER BY k.art, k.name LIMIT 500`).all(...p) as (KontaktRow & { akten: number })[];
}
export function kontaktLaden(id: number) {
  tabellen();
  const k = db().prepare("SELECT * FROM kontakte WHERE id=?").get(id) as KontaktRow | undefined;
  if (!k) return null;
  const personen = db().prepare("SELECT * FROM kontakt_personen WHERE kontakt_id=? ORDER BY name").all(id) as PersonRow[];
  const akten = db().prepare(`SELECT DISTINCT a.id, a.titel, a.phase, b.zeichen FROM beteiligte b JOIN akten a ON a.id=b.akte_id WHERE b.kontakt_id=? ORDER BY a.angelegt DESC`).all(id) as { id: string; titel: string; phase: string; zeichen: string }[];
  return { ...k, personen, akten };
}
const FELDER = ["art", "name", "zusatz", "strasse", "plz_ort", "telefon", "email", "iban", "notiz"] as const;
export function kontaktSpeichern(k: Partial<KontaktRow>): number {
  tabellen();
  const f = Object.fromEntries(FELDER.map((x) => [x, String(k[x] ?? "").trim().slice(0, x === "notiz" ? 2000 : 200)])) as Record<(typeof FELDER)[number], string>;
  if (!(ARTEN as readonly string[]).includes(f.art)) f.art = "Sonstige";
  if (!f.name) throw new Error("Name fehlt");
  const d = db();
  if (k.id) {
    d.prepare(`UPDATE kontakte SET ${FELDER.map((x) => `${x}=@${x}`).join(",")} WHERE id=@id`).run({ ...f, id: k.id });
    // Verknüpfte Beteiligte aktuell halten (Name, Anschrift, Kontaktdaten)
    d.prepare("UPDATE beteiligte SET name=?, adresse=?, email=CASE WHEN email='' THEN ? ELSE email END WHERE kontakt_id=?")
      .run(f.name, anschriftZeile(f), f.email, k.id);
    return k.id;
  }
  return Number(d.prepare(`INSERT INTO kontakte (${FELDER.join(",")}) VALUES (${FELDER.map((x) => "@" + x).join(",")})`).run(f).lastInsertRowid);
}
export function kontaktLoeschen(id: number) { tabellen(); db().prepare("DELETE FROM kontakte WHERE id=?").run(id); }
export function personSpeichern(kontaktId: number, p: { id?: number; name: string; telefon?: string; email?: string }) {
  tabellen();
  const v = [p.name.trim().slice(0, 120), (p.telefon ?? "").slice(0, 60), (p.email ?? "").slice(0, 120)];
  if (p.id) db().prepare("UPDATE kontakt_personen SET name=?, telefon=?, email=? WHERE id=? AND kontakt_id=?").run(...v, p.id, kontaktId);
  else db().prepare("INSERT INTO kontakt_personen (kontakt_id,name,telefon,email) VALUES (?,?,?,?)").run(kontaktId, ...v);
}
export function personLoeschen(kontaktId: number, id: number) { tabellen(); db().prepare("DELETE FROM kontakt_personen WHERE id=? AND kontakt_id=?").run(id, kontaktId); }

const anschriftZeile = (k: { zusatz?: string; strasse: string; plz_ort: string }) => [k.zusatz, k.strasse, k.plz_ort].filter(Boolean).join(", ");

/** Briefanschrift für einen Beteiligten: eigene Adresse, sonst aus dem Adressbuch (verknüpft oder gleicher Name). */
export function briefanschrift(b: { name: string; ansprechpartner?: string; adresse?: string; kontakt_id?: number | null }): string {
  tabellen();
  let adr = (b.adresse ?? "").trim();
  if (!adr) {
    const k = (b.kontakt_id
      ? db().prepare("SELECT * FROM kontakte WHERE id=?").get(b.kontakt_id)
      : db().prepare("SELECT * FROM kontakte WHERE lower(name)=lower(?) OR lower(name) LIKE lower(?) ORDER BY length(name) LIMIT 1").get(b.name.trim(), b.name.trim() + "%")) as KontaktRow | undefined;
    if (k) adr = anschriftZeile(k);
  }
  return [b.name, b.ansprechpartner && `z. Hd. ${b.ansprechpartner}`, ...adr.split(/,\s*/)].filter(Boolean).join("\n");
}
export function kontaktAlsBeteiligter(id: number) {
  const k = kontaktLaden(id);
  return k ? { kontakt_id: k.id, name: k.name, adresse: anschriftZeile(k), telefon: k.telefon, email: k.email, iban: k.iban, rolle: k.art === "Rechtsschutz" ? "Versicherung" : k.art } : null;
}
