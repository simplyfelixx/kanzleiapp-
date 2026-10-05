import { NextResponse } from "next/server";
import { aktuellerBenutzer } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const u = await aktuellerBenutzer();
  if (!u) return NextResponse.json({ fehler: "Nicht angemeldet" }, { status: 401 });
  return NextResponse.json({ id: u.id, name: u.name, kuerzel: u.kuerzel, rolle: u.rolle });
}
