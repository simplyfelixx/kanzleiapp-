import { wer } from "@/lib/auth";
import { NextResponse } from "next/server";
import { dateiSpeichern, db, verlaufEintrag, wirkungAusfuehren, Wirkung } from "@/lib/db";
import { schemaName } from "@/lib/dokerkennung";

export const dynamic = "force-dynamic";

// Body: { aktion: "bestaetigen" | "verwerfen", entwurf?: string }
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const d = db();
  const v = d.prepare("SELECT * FROM vorgaenge WHERE id=? AND status='offen'").get(Number(params.id)) as
    | { id: number; akte_id: string; titel: string; aktion: string; wirkung: string; entwurf: string | null }
    | undefined;
  if (!v) return NextResponse.json({ fehler: "Vorgang nicht gefunden oder schon erledigt" }, { status: 404 });
  const b = await req.json().catch(() => ({}));
  d.transaction(() => {
    if (b.aktion === "bestaetigen") {
      if (typeof b.entwurf === "string") d.prepare("UPDATE vorgaenge SET entwurf=? WHERE id=?").run(b.entwurf.slice(0, 20000), v.id);
      const text = typeof b.entwurf === "string" ? b.entwurf : v.entwurf;
      if (text) {
        // Ausgehendes Schreiben in der Akte ablegen (später als PDF mit Briefkopf)
        const heute = new Date().toISOString().slice(0, 10);
        const typ = /erinnerung|nachfrist/i.test(v.titel) ? "Erinnerung" : /nachforderung/i.test(v.titel) ? "Nachforderung" : "Schreiben";
        d.prepare("INSERT INTO dokumente (akte_id,richtung,name,typ,absender,datum,datei,groesse) VALUES (?,?,?,?,?,?,?,?)")
          .run(v.akte_id, "aus", schemaName(heute, typ, "Kanzlei", ".txt"), typ, "Kanzlei", heute, dateiSpeichern(Buffer.from(text, "utf8"), ".txt"), text.length);
      }
      wirkungAusfuehren(v.akte_id, JSON.parse(v.wirkung || "{}") as Wirkung, wer());
      verlaufEintrag(v.akte_id, `${v.aktion}: ${v.titel}`, `bestätigt ${wer()}`);
      d.prepare("UPDATE vorgaenge SET status='erledigt', erledigt_am=datetime('now','localtime') WHERE id=?").run(v.id);
    } else {
      verlaufEintrag(v.akte_id, `Verworfen: ${v.titel}`, wer());
      d.prepare("UPDATE vorgaenge SET status='verworfen', erledigt_am=datetime('now','localtime') WHERE id=?").run(v.id);
    }
  })();
  return NextResponse.json({ ok: true, akte: v.akte_id });
}
