import { protokoll } from "@/lib/protokoll";
import { NextResponse } from "next/server";
import { anmelden, anzahlBenutzer, sitzungsCookie } from "@/lib/auth";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ einrichtung: anzahlBenutzer() === 0 });
}

export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const login = typeof b.login === "string" ? b.login.trim().slice(0, 80) : "";
  const pw = typeof b.passwort === "string" ? b.passwort.slice(0, 200) : "";
  const r = anmelden(login, pw);
  if (!r.ok) {
    protokoll({ kategorie: "anmeldung", aktion: "Anmeldung fehlgeschlagen", details: `Benutzername: ${login}`, benutzer: { id: null, kuerzel: "" } });
    await new Promise((x) => setTimeout(x, 400));
    return NextResponse.json({ fehler: r.fehler }, { status: 401 });
  }
  protokoll({ kategorie: "anmeldung", aktion: "Angemeldet", benutzer: { id: r.s.u, kuerzel: r.s.k } });
  const res = NextResponse.json({ ok: true, kuerzel: r.s.k, rolle: r.s.r });
  res.cookies.set(await sitzungsCookie(r.s));
  return res;
}
