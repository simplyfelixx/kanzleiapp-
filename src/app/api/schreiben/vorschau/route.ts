import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { briefanschrift } from "@/lib/kontakte";
import { befuellen, platzhalterWerte, vorlagenLaden } from "@/lib/schreiben";

export const dynamic = "force-dynamic";

// Body: { akteId, vorlageId } → befüllter Text, fehlende Platzhalter, Empfängeranschrift
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const v = vorlagenLaden().find((x) => x.id === Number(b.vorlageId));
  if (!v) return NextResponse.json({ fehler: "Vorlage unbekannt" }, { status: 404 });
  let werte: Record<string, string>;
  try { werte = platzhalterWerte(String(b.akteId)); } catch { return NextResponse.json({ fehler: "Akte unbekannt" }, { status: 404 }); }
  const { text, fehlend } = befuellen(v.text, werte);
  const emp = db().prepare("SELECT name, ansprechpartner, adresse, kontakt_id FROM beteiligte WHERE akte_id=? AND rolle=? LIMIT 1").get(String(b.akteId), v.empfaenger) as { name: string; ansprechpartner: string; adresse: string; kontakt_id: number | null } | undefined;
  const empfaenger = emp ? briefanschrift(emp) : "";
  return NextResponse.json({ text, fehlend, empfaenger, empfaengerRolle: v.empfaenger, vorlage: v });
}
