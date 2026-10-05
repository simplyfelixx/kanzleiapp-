import { NextResponse } from "next/server";
import { kontoLaden, kontoSpeichern } from "@/lib/mail";
import { protokoll } from "@/lib/protokoll";

export const dynamic = "force-dynamic";
export function GET() { return NextResponse.json(kontoLaden()); }
export async function PUT(req: Request) {
  const b = await req.json().catch(() => ({}));
  const k = kontoSpeichern(b);
  protokoll({ kategorie: "einstellungen", aktion: "Mailkonto geändert", details: `${k.benutzer}@${k.host}:${k.port}${b.passwort ? ", Passwort neu" : ""}` });
  return NextResponse.json(k);
}
