import { NextResponse } from "next/server";
import { einstLaden, einstSpeichern, liste, sichern } from "@/lib/sicherung";
import { protokoll } from "@/lib/protokoll";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET() {
  let dateien: ReturnType<typeof liste> = [];
  try { dateien = liste(); } catch { /* Ordner nicht erreichbar */ }
  return NextResponse.json({ ...einstLaden(), dateien });
}
export async function PUT(req: Request) {
  const b = await req.json().catch(() => ({}));
  try {
    const e = einstSpeichern(b);
    protokoll({ kategorie: "einstellungen", aktion: "Datensicherung eingestellt", details: `aktiv=${e.aktiv}, ${e.ordner}, ${e.behalten} behalten${b.passwort ? ", Passwort neu" : ""}` });
    return NextResponse.json(e);
  } catch (x) { return NextResponse.json({ fehler: (x as Error).message }, { status: 400 }); }
}
/** Jetzt sichern */
export async function POST() {
  try {
    const r = await sichern("manuell");
    protokoll({ kategorie: "einstellungen", aktion: "Datensicherung erstellt", details: `${r.datei} · ${r.dokumente} Dokumente` });
    return NextResponse.json(r);
  } catch (x) { return NextResponse.json({ fehler: (x as Error).message }, { status: 400 }); }
}
