import { protokoll } from "@/lib/protokoll";
import { wer } from "@/lib/auth";
import { NextResponse } from "next/server";
import { dateiSpeichern, db, plusTage, verlaufEintrag } from "@/lib/db";
import { schemaName } from "@/lib/dokerkennung";
import { briefPdf, vorlagenLaden } from "@/lib/schreiben";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Body: { akteId, vorlageId, text, empfaenger, entwurf?: boolean } → PDF erstellen und in der Akte ablegen
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const akteId = String(b.akteId ?? "");
  const d = db();
  if (!d.prepare("SELECT 1 FROM akten WHERE id=?").get(akteId)) return NextResponse.json({ fehler: "Akte unbekannt" }, { status: 404 });
  const v = vorlagenLaden().find((x) => x.id === Number(b.vorlageId));
  const text = String(b.text ?? "").slice(0, 30000);
  if (!text.trim()) return NextResponse.json({ fehler: "Text fehlt" }, { status: 400 });
  if (/\[\[[\w.]+\]\]/.test(text) && !b.trotzdem) return NextResponse.json({ fehler: "Es fehlen noch Angaben (rot markiert). Bitte ergänzen.", fehlt: true }, { status: 400 });
  const pdf = await briefPdf({ empfaenger: String(b.empfaenger ?? ""), text, az: akteId });
  const heute = new Date().toISOString().slice(0, 10);
  const typ = v?.typ ?? "Schreiben";
  const empfName = String(b.empfaenger ?? "").split("\n")[0] || "Empfaenger";
  const name = schemaName(heute, typ, empfName, ".pdf");
  const r = d.prepare("INSERT INTO dokumente (akte_id,richtung,name,typ,absender,datum,datei,groesse) VALUES (?,?,?,?,?,?,?,?)")
    .run(akteId, "aus", name, typ, "Kanzlei", heute, dateiSpeichern(pdf, ".pdf"), pdf.length);
  verlaufEintrag(akteId, `${typ} an ${empfName} erstellt (${name})`, wer());
  protokoll({ kategorie: "dokument", aktion: "Schreiben erstellt", akte: akteId, details: name });
  if (v?.wv_tage) {
    d.prepare("INSERT INTO fristen (akte_id,art,datum,titel,wer) VALUES (?,?,?,?,?)").run(akteId, "wv", plusTage(v.wv_tage), v.wv_titel || `${typ}: Antwort prüfen`, wer());
  }
  return NextResponse.json({ dokId: Number(r.lastInsertRowid), name, wv: v?.wv_tage ? plusTage(v.wv_tage) : null });
}
