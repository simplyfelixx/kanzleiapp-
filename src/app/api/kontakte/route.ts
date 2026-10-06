import { NextResponse } from "next/server";
import { kontakteListe, kontaktSpeichern } from "@/lib/kontakte";
import { protokoll } from "@/lib/protokoll";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  return NextResponse.json(kontakteListe(q.get("art") || undefined, q.get("suche")?.slice(0, 80) || undefined));
}
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  try {
    const id = kontaktSpeichern({ ...b, id: undefined });
    protokoll({ kategorie: "einstellungen", aktion: "Kontakt angelegt", details: `${b.art}: ${b.name}` });
    return NextResponse.json({ id });
  } catch (x) { return NextResponse.json({ fehler: (x as Error).message }, { status: 400 }); }
}
