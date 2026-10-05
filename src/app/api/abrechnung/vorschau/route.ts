import { NextResponse } from "next/server";
import { pruefen, vorschauPdf } from "@/lib/abrechnung";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const p = pruefen(b);
  if ("fehler" in p) return NextResponse.json(p, { status: 400 });
  const pdf = await vorschauPdf(p.akte, p.wert, p.posten, p.empfaenger);
  return new NextResponse(pdf, { headers: { "Content-Type": "application/pdf", "Content-Disposition": "inline; filename=Kostennote_Entwurf.pdf" } });
}
