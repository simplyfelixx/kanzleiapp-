import { protokoll } from "@/lib/protokoll";
// Ersten Admin anlegen – nur solange es noch keinen Benutzer gibt.
import { NextResponse } from "next/server";
import { anmelden, anzahlBenutzer, benutzerAnlegen, passwortFehler, sitzungsCookie } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const name = String(b.name ?? "").trim().slice(0, 80);
  const kuerzel = String(b.kuerzel ?? "").trim().slice(0, 4);
  const login = String(b.login ?? "").trim().slice(0, 80);
  if (!name || !kuerzel || !login) return NextResponse.json({ fehler: "Name, Kürzel und Benutzername angeben" }, { status: 400 });
  const pf = passwortFehler(b.passwort);
  if (pf) return NextResponse.json({ fehler: pf }, { status: 400 });
  // In einer Transaktion prüfen, damit nicht zwei Admins gleichzeitig entstehen
  const angelegt = db().transaction(() => {
    if (anzahlBenutzer() > 0) return false;
    benutzerAnlegen({ name, kuerzel, login, passwort: b.passwort, rolle: "admin" });
    return true;
  }).immediate();
  if (!angelegt) return NextResponse.json({ fehler: "Einrichtung bereits abgeschlossen" }, { status: 403 });
  const r = anmelden(login, b.passwort);
  if (r.ok) protokoll({ kategorie: "benutzer", aktion: "Ersten Admin angelegt", details: `${name} (${kuerzel.toUpperCase()})`, benutzer: { id: r.s.u, kuerzel: r.s.k } });
  const res = NextResponse.json({ ok: true });
  if (r.ok) res.cookies.set(await sitzungsCookie(r.s));
  return res;
}
