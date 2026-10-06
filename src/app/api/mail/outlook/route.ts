import { NextResponse } from "next/server";
import { anmeldungPruefen, anmeldungStarten, graphAbmelden, graphLaden, graphSpeichern } from "@/lib/graph";
import { protokoll } from "@/lib/protokoll";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Zugriff nur für Admin (src/middleware.ts)

export function GET() { return NextResponse.json(graphLaden()); }

// Body: { clientId?, tenant?, aktiv? }
export async function PUT(req: Request) {
  const b = await req.json().catch(() => ({}));
  try {
    const k = graphSpeichern(b);
    protokoll({ kategorie: "einstellungen", aktion: "Outlook-Einstellungen geändert", details: `Tenant ${k.tenant}, ${k.aktiv ? "aktiv" : "aus"}` });
    return NextResponse.json(k);
  } catch (e) { return NextResponse.json({ fehler: (e as Error).message }, { status: 400 }); }
}

// Body: { aktion: "start" | "pruefen" | "abmelden" }
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  try {
    if (b.aktion === "start") return NextResponse.json(await anmeldungStarten());
    if (b.aktion === "pruefen") {
      const r = await anmeldungPruefen();
      if (r.status === "fertig") protokoll({ kategorie: "einstellungen", aktion: "Bei Microsoft angemeldet", details: r.konto });
      return NextResponse.json(r);
    }
    if (b.aktion === "abmelden") { graphAbmelden(); protokoll({ kategorie: "einstellungen", aktion: "Bei Microsoft abgemeldet" }); return NextResponse.json(graphLaden()); }
    return NextResponse.json({ fehler: "Unbekannte Aktion" }, { status: 400 });
  } catch (e) { return NextResponse.json({ fehler: (e as Error).message }, { status: 502 }); }
}
