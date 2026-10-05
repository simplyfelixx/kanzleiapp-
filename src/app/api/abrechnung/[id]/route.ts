import { NextResponse } from "next/server";
import { wer } from "@/lib/auth";
import { stornieren, zahlung } from "@/lib/abrechnung";
import { protokoll } from "@/lib/protokoll";

export const dynamic = "force-dynamic";

// Body: { aktion: "bezahlt" | "offen" | "storno" }
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const b = await req.json().catch(() => ({}));
  const id = Number(params.id);
  const r = b.aktion === "storno" ? stornieren(id, wer()) : zahlung(id, b.aktion === "bezahlt", wer());
  if (!r) return NextResponse.json({ fehler: "Nicht möglich" }, { status: 400 });
  protokoll({ kategorie: "akte", aktion: b.aktion === "storno" ? "Kostennote storniert" : b.aktion === "bezahlt" ? "Zahlung erfasst" : "Zahlung zurückgenommen", akte: r.akte_id, details: r.nr });
  return NextResponse.json({ ok: true });
}
