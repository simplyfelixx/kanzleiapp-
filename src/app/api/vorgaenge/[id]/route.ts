import { NextResponse } from "next/server";
import { db, verlaufEintrag, wirkungAusfuehren, Wirkung } from "@/lib/db";

export const dynamic = "force-dynamic";

// Body: { aktion: "bestaetigen" | "verwerfen", entwurf?: string }
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const d = db();
  const v = d.prepare("SELECT * FROM vorgaenge WHERE id=? AND status='offen'").get(Number(params.id)) as
    | { id: number; akte_id: string; titel: string; aktion: string; wirkung: string }
    | undefined;
  if (!v) return NextResponse.json({ fehler: "Vorgang nicht gefunden oder schon erledigt" }, { status: 404 });
  const b = await req.json().catch(() => ({}));
  d.transaction(() => {
    if (b.aktion === "bestaetigen") {
      if (typeof b.entwurf === "string") d.prepare("UPDATE vorgaenge SET entwurf=? WHERE id=?").run(b.entwurf.slice(0, 20000), v.id);
      wirkungAusfuehren(v.akte_id, JSON.parse(v.wirkung || "{}") as Wirkung);
      verlaufEintrag(v.akte_id, `${v.aktion}: ${v.titel}`, "bestätigt FK");
      d.prepare("UPDATE vorgaenge SET status='erledigt', erledigt_am=datetime('now','localtime') WHERE id=?").run(v.id);
    } else {
      verlaufEintrag(v.akte_id, `Verworfen: ${v.titel}`, "FK");
      d.prepare("UPDATE vorgaenge SET status='verworfen', erledigt_am=datetime('now','localtime') WHERE id=?").run(v.id);
    }
  })();
  return NextResponse.json({ ok: true, akte: v.akte_id });
}
