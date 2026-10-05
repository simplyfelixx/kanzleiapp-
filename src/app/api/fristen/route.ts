import { protokoll } from "@/lib/protokoll";
import { wer } from "@/lib/auth";
import { NextResponse } from "next/server";
import { db, verlaufEintrag } from "@/lib/db";

export const dynamic = "force-dynamic";

export function GET() {
  const rows = db().prepare(`
    SELECT f.*, a.titel AS akte_titel, a.gebiet FROM fristen f JOIN akten a ON a.id=f.akte_id
    WHERE f.status='offen' ORDER BY f.bestaetigt, f.datum`).all();
  return NextResponse.json(rows);
}

// Neue Frist / Wiedervorlage. Body: { akteId, art: "wv"|"frist", datum: "yyyy-mm-dd", titel, wer }
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const akte = String(b.akteId ?? "");
  const datum = String(b.datum ?? "");
  const titel = String(b.titel ?? "").trim().slice(0, 300);
  if (!db().prepare("SELECT 1 FROM akten WHERE id=?").get(akte)) return NextResponse.json({ fehler: "Akte wählen" }, { status: 400 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datum)) return NextResponse.json({ fehler: "Datum fehlt" }, { status: 400 });
  if (!titel) return NextResponse.json({ fehler: "Worum geht es?" }, { status: 400 });
  const art = b.art === "frist" ? "frist" : "wv";
  const r = db().prepare("INSERT INTO fristen (akte_id,art,datum,titel,wer,bestaetigt) VALUES (?,?,?,?,?,1)").run(akte, art, datum, titel, String(b.wer ?? wer()).slice(0, 20));
  verlaufEintrag(akte, `${art === "frist" ? "Frist" : "Wiedervorlage"} notiert: ${titel} (${datum.split("-").reverse().join(".")})`, String(b.wer ?? wer()));
  protokoll({ kategorie: "frist", aktion: art === "frist" ? "Frist notiert" : "Wiedervorlage notiert", akte, details: `${titel} (${datum})` });
  return NextResponse.json({ id: r.lastInsertRowid });
}
