import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { mailAkte, mailGelesen, mailLaden } from "@/lib/mail";
import { protokoll } from "@/lib/protokoll";

export const dynamic = "force-dynamic";

export function GET(_: Request, { params }: { params: { id: string } }) {
  const m = mailLaden(Number(params.id));
  if (!m) return NextResponse.json({ fehler: "nicht gefunden" }, { status: 404 });
  mailGelesen(Number(params.id));
  protokoll({ kategorie: "dokument", aktion: "Mail geöffnet", akte: (m.akte_id as string) ?? null, details: String(m.betreff).slice(0, 120) });
  return NextResponse.json(m);
}

// Body: { akteId } – Mail einer Akte zuordnen (oder null)
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const b = await req.json().catch(() => ({}));
  const akte = b.akteId ? String(b.akteId) : null;
  if (akte && !db().prepare("SELECT 1 FROM akten WHERE id=?").get(akte)) return NextResponse.json({ fehler: "Akte unbekannt" }, { status: 400 });
  mailAkte(Number(params.id), akte);
  return NextResponse.json(mailLaden(Number(params.id)));
}
