// Von der Middleware genutzt: Ist der Benutzer dieser Sitzung noch aktiv, und welche Rolle hat er jetzt?
import { NextResponse } from "next/server";
import { aktuellerBenutzer } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const u = await aktuellerBenutzer();
  if (!u) return NextResponse.json({ ok: false }, { status: 401 });
  return NextResponse.json({ ok: true, u: u.id, k: u.kuerzel, r: u.rolle });
}
