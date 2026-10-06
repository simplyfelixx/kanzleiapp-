import { NextResponse } from "next/server";
import { wer } from "@/lib/auth";
import { senden, versandPruefen, versandTesten } from "@/lib/mailsenden";
import { protokoll } from "@/lib/protokoll";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Body: { an, cc?, betreff, text, akteId?, dokumente?: [ids], antwortAuf?: mailId } – oder { test: true }
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  if (b.test) {
    try { await versandTesten(); return NextResponse.json({ ok: true }); }
    catch (e) { return NextResponse.json({ fehler: `Verbindung fehlgeschlagen: ${(e as Error).message}` }, { status: 400 }); }
  }
  const v = versandPruefen(b);
  if ("fehler" in v) return NextResponse.json(v, { status: 400 });
  try {
    const r = await senden(v, wer());
    protokoll({ kategorie: "dokument", aktion: "Mail gesendet", akte: v.akteId, details: `an ${v.an}${r.anhaenge ? `, ${r.anhaenge} Anhang` : ""}` });
    return NextResponse.json(r);
  } catch (e) {
    return NextResponse.json({ fehler: `Nicht gesendet: ${(e as Error).message}` }, { status: 400 });
  }
}
