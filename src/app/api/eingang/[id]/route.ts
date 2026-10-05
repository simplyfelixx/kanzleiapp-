import { NextResponse } from "next/server";
import { db, verlaufEintrag, wirkungAusfuehren, Wirkung } from "@/lib/db";

export const dynamic = "force-dynamic";

// Body: { aktion: "bestaetigen" | "verwerfen", akteId?: string }
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const d = db();
  const e = d.prepare("SELECT * FROM eingang WHERE id=? AND status='offen'").get(Number(params.id)) as
    | { id: number; akte_id: string | null; typ: string; absender: string; dateiname: string; wirkung: string }
    | undefined;
  if (!e) return NextResponse.json({ fehler: "Dokument nicht gefunden oder schon erledigt" }, { status: 404 });
  const b = await req.json().catch(() => ({}));
  if (b.aktion === "verwerfen") {
    d.prepare("UPDATE eingang SET status='verworfen', erledigt_am=datetime('now','localtime') WHERE id=?").run(e.id);
    return NextResponse.json({ ok: true });
  }
  const akte = String(b.akteId || e.akte_id || "");
  if (!akte || !d.prepare("SELECT 1 FROM akten WHERE id=?").get(akte))
    return NextResponse.json({ fehler: "Bitte zuerst eine Akte wählen" }, { status: 400 });
  d.transaction(() => {
    wirkungAusfuehren(akte, JSON.parse(e.wirkung || "{}") as Wirkung);
    verlaufEintrag(akte, `Eingang abgelegt: ${e.typ} von ${e.absender} (${e.dateiname})`, "bestätigt FK");
    d.prepare("UPDATE eingang SET status='erledigt', akte_id=?, erledigt_am=datetime('now','localtime') WHERE id=?").run(akte, e.id);
  })();
  return NextResponse.json({ ok: true, akte });
}
