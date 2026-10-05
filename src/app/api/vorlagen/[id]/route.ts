import { protokoll } from "@/lib/protokoll";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { vorlagenLaden } from "@/lib/schreiben";

export const dynamic = "force-dynamic";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  vorlagenLaden();
  const b = await req.json().catch(() => ({}));
  db().prepare("UPDATE vorlagen SET name=?, typ=?, empfaenger=?, text=?, wv_tage=?, wv_titel=? WHERE id=?").run(
    String(b.name || "Vorlage").slice(0, 120), String(b.typ || "Schreiben").slice(0, 60), String(b.empfaenger || "Versicherung"),
    String(b.text || "").slice(0, 20000), Number(b.wv_tage) || 0, String(b.wv_titel || "").slice(0, 200), Number(params.id));
  protokoll({ kategorie: "einstellungen", aktion: "Vorlage geändert", details: `#${params.id}` });
  return NextResponse.json({ ok: true });
}

export function DELETE(_: Request, { params }: { params: { id: string } }) {
  db().prepare("DELETE FROM vorlagen WHERE id=?").run(Number(params.id));
  protokoll({ kategorie: "einstellungen", aktion: "Vorlage gelöscht", details: `#${params.id}` });
  return NextResponse.json({ ok: true });
}
