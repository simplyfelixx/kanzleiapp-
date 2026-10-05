import { NextResponse } from "next/server";
import { db, plusTage, verlaufEintrag } from "@/lib/db";

export const dynamic = "force-dynamic";

// Body: { aktion: "erledigt" | "verschieben" | "bestaetigen" | "datum", tage?, datum?, wer? }
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const d = db();
  const f = d.prepare("SELECT * FROM fristen WHERE id=?").get(Number(params.id)) as
    | { id: number; akte_id: string; art: string; titel: string; datum: string; bestaetigt: number }
    | undefined;
  if (!f) return NextResponse.json({ fehler: "nicht gefunden" }, { status: 404 });
  const b = await req.json().catch(() => ({}));
  const name = f.art === "frist" ? "Frist" : "Wiedervorlage";
  const wer = String(b.wer ?? "FK").slice(0, 20);
  switch (b.aktion) {
    case "erledigt":
      d.prepare("UPDATE fristen SET status='erledigt' WHERE id=?").run(f.id);
      verlaufEintrag(f.akte_id, `${name} erledigt: ${f.titel}`, wer);
      break;
    case "verschieben": {
      const neu = plusTage(Number(b.tage) || 7, new Date(f.datum + "T12:00"));
      d.prepare("UPDATE fristen SET datum=? WHERE id=?").run(neu, f.id);
      verlaufEintrag(f.akte_id, `${name} verschoben auf ${neu.split("-").reverse().join(".")}: ${f.titel}`, wer);
      break;
    }
    case "datum":
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(b.datum))) return NextResponse.json({ fehler: "Datum ungültig" }, { status: 400 });
      d.prepare("UPDATE fristen SET datum=? WHERE id=?").run(b.datum, f.id);
      break;
    case "bestaetigen":
      // Von der KI erkannte Fristen gelten erst nach Bestätigung durch einen Menschen.
      d.prepare("UPDATE fristen SET bestaetigt=1, wer=? WHERE id=?").run(wer, f.id);
      verlaufEintrag(f.akte_id, `Frist bestätigt: ${f.titel} (${f.datum.split("-").reverse().join(".")})`, wer);
      break;
    default:
      return NextResponse.json({ fehler: "unbekannte Aktion" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
