import { NextResponse } from "next/server";
import { alleAkten, db, naechstesAz } from "@/lib/db";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(alleAkten());
}

// Neue Akte anlegen
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const titel = String(b.titel ?? "").trim();
  const mandant = String(b.mandant ?? "").trim();
  if (!titel && !mandant) return NextResponse.json({ fehler: "Titel oder Mandant fehlt" }, { status: 400 });
  const id = naechstesAz();
  const d = db();
  d.transaction(() => {
    d.prepare("INSERT INTO akten (id,titel,gebiet,prioritaet,phase) VALUES (?,?,?,?,?)")
      .run(id, titel || `${mandant} ./. ?`, String(b.gebiet ?? "VR"), "pruefen", "Mandat");
    if (mandant) d.prepare("INSERT INTO beteiligte (akte_id,rolle,name) VALUES (?,?,?)").run(id, "Mandant", mandant);
  })();
  return NextResponse.json({ id });
}
