// Revisionssicheres Protokoll: nur anhängen, jede Zeile mit Hash der vorherigen verkettet.
// Änderungen oder Löschungen blockiert die Datenbank (Trigger); Manipulation fällt bei der Kettenprüfung auf.
import crypto from "crypto";
import { headers } from "next/headers";
import { db } from "./db";

export type Kategorie = "anmeldung" | "benutzer" | "einstellungen" | "akte" | "dokument" | "eingang" | "frist" | "ki" | "portal";
export interface ProtokollRow {
  id: number; zeit: string; benutzer_id: number | null; kuerzel: string; kategorie: Kategorie;
  aktion: string; akte_id: string | null; details: string; ip: string; hash: string;
}

let bereit = false;
function tabelle() {
  if (bereit) return;
  db().exec(`
    CREATE TABLE IF NOT EXISTS protokoll (
      id INTEGER PRIMARY KEY AUTOINCREMENT, zeit TEXT NOT NULL, benutzer_id INTEGER, kuerzel TEXT NOT NULL DEFAULT '',
      kategorie TEXT NOT NULL, aktion TEXT NOT NULL, akte_id TEXT, details TEXT NOT NULL DEFAULT '',
      ip TEXT NOT NULL DEFAULT '', hash TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS protokoll_akte ON protokoll(akte_id);
    CREATE INDEX IF NOT EXISTS protokoll_zeit ON protokoll(zeit);
    CREATE TRIGGER IF NOT EXISTS protokoll_kein_update BEFORE UPDATE ON protokoll BEGIN SELECT RAISE(ABORT, 'Protokoll ist unveränderlich'); END;
    CREATE TRIGGER IF NOT EXISTS protokoll_kein_delete BEFORE DELETE ON protokoll BEGIN SELECT RAISE(ABORT, 'Protokoll ist unveränderlich'); END;
  `);
  bereit = true;
}

const zeile = (r: Omit<ProtokollRow, "id" | "hash">, vorher: string) =>
  crypto.createHash("sha256").update(JSON.stringify([vorher, r.zeit, r.benutzer_id, r.kuerzel, r.kategorie, r.aktion, r.akte_id, r.details, r.ip])).digest("hex");

function lokaleZeit() {
  const d = new Date(), p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** Eintrag schreiben. Benutzer und IP kommen aus der Anfrage (Middleware), wenn nicht angegeben. */
export function protokoll(e: { kategorie: Kategorie; aktion: string; akte?: string | null; details?: string; benutzer?: { id: number | null; kuerzel: string }; ip?: string }) {
  try {
    tabelle();
    let bid: number | null = e.benutzer?.id ?? null, kz = e.benutzer?.kuerzel ?? "", ip = e.ip ?? "";
    try {
      const h = headers();
      if (!e.benutzer) { const x = Number(h.get("x-benutzer")); bid = x || null; kz = h.get("x-kuerzel") ?? ""; }
      ip ||= (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "";
    } catch { /* außerhalb einer Anfrage */ }
    const r = { zeit: lokaleZeit(), benutzer_id: bid, kuerzel: kz, kategorie: e.kategorie, aktion: e.aktion.slice(0, 200), akte_id: e.akte ?? null, details: (e.details ?? "").slice(0, 1000), ip: ip.slice(0, 64) };
    const d = db();
    d.transaction(() => {
      const vorher = (d.prepare("SELECT hash FROM protokoll ORDER BY id DESC LIMIT 1").get() as { hash: string } | undefined)?.hash ?? "";
      d.prepare("INSERT INTO protokoll (zeit,benutzer_id,kuerzel,kategorie,aktion,akte_id,details,ip,hash) VALUES (@zeit,@benutzer_id,@kuerzel,@kategorie,@aktion,@akte_id,@details,@ip,@hash)")
        .run({ ...r, hash: zeile(r, vorher) });
    }).immediate();
  } catch (x) {
    console.error("Protokoll konnte nicht geschrieben werden:", x);
  }
}

export function protokollListe(f: { von?: string; bis?: string; kuerzel?: string; kategorie?: string; akte?: string; suche?: string; limit?: number }) {
  tabelle();
  const w: string[] = [], p: unknown[] = [];
  if (f.von) { w.push("zeit >= ?"); p.push(f.von); }
  if (f.bis) { w.push("zeit <= ?"); p.push(f.bis + " 23:59:59"); }
  if (f.kuerzel) { w.push("kuerzel = ?"); p.push(f.kuerzel); }
  if (f.kategorie) { w.push("kategorie = ?"); p.push(f.kategorie); }
  if (f.akte) { w.push("akte_id = ?"); p.push(f.akte); }
  if (f.suche) { w.push("(aktion LIKE ? OR details LIKE ?)"); p.push(`%${f.suche}%`, `%${f.suche}%`); }
  const sql = `SELECT * FROM protokoll ${w.length ? "WHERE " + w.join(" AND ") : ""} ORDER BY id DESC LIMIT ?`;
  return db().prepare(sql).all(...p, Math.min(f.limit ?? 500, 5000)) as ProtokollRow[];
}

/** Prüft die gesamte Hash-Kette. */
export function ketteGueltig(): { ok: boolean; anzahl: number; fehlerBei?: number } {
  tabelle();
  let vorher = "", n = 0;
  for (const r of db().prepare("SELECT * FROM protokoll ORDER BY id").iterate() as Iterable<ProtokollRow>) {
    n++;
    if (zeile(r, vorher) !== r.hash) return { ok: false, anzahl: n, fehlerBei: r.id };
    vorher = r.hash;
  }
  return { ok: true, anzahl: n };
}
