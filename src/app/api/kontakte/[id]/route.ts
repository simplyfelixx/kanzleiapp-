import { NextResponse } from "next/server";
import { kontaktAlsBeteiligter, kontaktLaden, kontaktLoeschen, kontaktSpeichern, personLoeschen, personSpeichern } from "@/lib/kontakte";
import { protokoll } from "@/lib/protokoll";

export const dynamic = "force-dynamic";
type C = { params: { id: string } };

export function GET(req: Request, { params }: C) {
  const id = Number(params.id);
  if (new URL(req.url).searchParams.get("als") === "beteiligter") return NextResponse.json(kontaktAlsBeteiligter(id));
  const k = kontaktLaden(id);
  return k ? NextResponse.json(k) : NextResponse.json({ fehler: "nicht gefunden" }, { status: 404 });
}
// Body: Kontaktfelder, oder { person: {id?,name,telefon,email} } / { personLoeschen: id }
export async function PUT(req: Request, { params }: C) {
  const id = Number(params.id);
  if (!kontaktLaden(id)) return NextResponse.json({ fehler: "nicht gefunden" }, { status: 404 });
  const b = await req.json().catch(() => ({}));
  try {
    if (b.person) { if (!String(b.person.name ?? "").trim()) throw new Error("Name fehlt"); personSpeichern(id, b.person); }
    else if (b.personLoeschen) personLoeschen(id, Number(b.personLoeschen));
    else { kontaktSpeichern({ ...b, id }); protokoll({ kategorie: "einstellungen", aktion: "Kontakt geändert", details: String(b.name ?? "") }); }
  } catch (x) { return NextResponse.json({ fehler: (x as Error).message }, { status: 400 }); }
  return NextResponse.json(kontaktLaden(id));
}
export function DELETE(_: Request, { params }: C) {
  const k = kontaktLaden(Number(params.id));
  if (!k) return NextResponse.json({ fehler: "nicht gefunden" }, { status: 404 });
  kontaktLoeschen(k.id);
  protokoll({ kategorie: "einstellungen", aktion: "Kontakt gelöscht", details: k.name });
  return NextResponse.json({ ok: true });
}
