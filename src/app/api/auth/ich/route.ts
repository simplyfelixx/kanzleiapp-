import { NextResponse } from "next/server";
import { aktuellerBenutzer } from "@/lib/auth";
import { kiVorladen } from "@/lib/ki";

export const dynamic = "force-dynamic";

export async function GET() {
  const u = await aktuellerBenutzer();
  if (!u) return NextResponse.json({ fehler: "Nicht angemeldet" }, { status: 401 });
  kiVorladen();
  return NextResponse.json({ id: u.id, name: u.name, kuerzel: u.kuerzel, rolle: u.rolle });
}
