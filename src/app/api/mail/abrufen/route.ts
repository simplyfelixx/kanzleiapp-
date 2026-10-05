import { NextResponse } from "next/server";
import { imapAbrufen } from "@/lib/mail";
import { protokoll } from "@/lib/protokoll";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 600;

export async function POST() {
  try {
    const r = await imapAbrufen();
    protokoll({ kategorie: "dokument", aktion: "Mails abgerufen (IMAP)", details: `${r.neu} neu von ${r.gesamt}` });
    return NextResponse.json(r);
  } catch (x) {
    const m = (x as Error).message || "";
    return NextResponse.json({ fehler: /auth|login|credential/i.test(m) ? "Anmeldung am Mailserver fehlgeschlagen" : /unvollständig/.test(m) ? m : "Mailserver nicht erreichbar" }, { status: 502 });
  }
}
