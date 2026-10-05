import { NextResponse } from "next/server";
import { alleBenutzer, benutzerAnlegen, passwortFehler } from "@/lib/auth";
import { ROLLEN, type Rolle } from "@/lib/sitzung";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(alleBenutzer());
}

export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const name = String(b.name ?? "").trim().slice(0, 80);
  const kuerzel = String(b.kuerzel ?? "").trim().slice(0, 4);
  const login = String(b.login ?? "").trim().slice(0, 80);
  const rolle = b.rolle as Rolle;
  if (!name || !kuerzel || !login) return NextResponse.json({ fehler: "Name, Kürzel und Login angeben" }, { status: 400 });
  if (!ROLLEN.some((r) => r.key === rolle)) return NextResponse.json({ fehler: "Unbekannte Rolle" }, { status: 400 });
  const pf = passwortFehler(b.passwort);
  if (pf) return NextResponse.json({ fehler: pf }, { status: 400 });
  try {
    benutzerAnlegen({ name, kuerzel, login, passwort: b.passwort, rolle });
  } catch {
    return NextResponse.json({ fehler: "Login ist schon vergeben" }, { status: 409 });
  }
  return NextResponse.json(alleBenutzer());
}
