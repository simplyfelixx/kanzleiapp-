import { protokoll } from "@/lib/protokoll";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { PLATZHALTER_HILFE, vorlagenLaden } from "@/lib/schreiben";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ vorlagen: vorlagenLaden(), platzhalter: PLATZHALTER_HILFE });
}

export async function POST(req: Request) {
  vorlagenLaden();
  const b = await req.json().catch(() => ({}));
  const r = db().prepare("INSERT INTO vorlagen (name,typ,empfaenger,text,wv_tage,wv_titel) VALUES (?,?,?,?,?,?)").run(
    String(b.name || "Neue Vorlage").slice(0, 120), String(b.typ || "Schreiben").slice(0, 60), String(b.empfaenger || "Versicherung"),
    String(b.text || "Sehr geehrte Damen und Herren,\n\n").slice(0, 20000), Number(b.wv_tage) || 0, String(b.wv_titel || "").slice(0, 200));
  protokoll({ kategorie: "einstellungen", aktion: "Vorlage angelegt", details: String(b.name ?? "") });
  return NextResponse.json({ id: Number(r.lastInsertRowid) });
}
