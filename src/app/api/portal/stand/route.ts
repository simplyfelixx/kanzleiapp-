// Einzige Datenquelle des Mandantenportals. Liefert nur die freigegebene Ansicht der eigenen Akte.
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { portalAnsicht, STANDARD_FREIGABEN, tokenPruefen } from "@/lib/portal";

export const dynamic = "force-dynamic";

export function GET() {
  const z = tokenPruefen(cookies().get("kz_portal")?.value);
  if (!z) return NextResponse.json({ fehler: "Link ungültig oder abgelaufen" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  const a = portalAnsicht(z.akte_id, { ...STANDARD_FREIGABEN, ...JSON.parse(z.freigaben || "{}") });
  if (!a) return NextResponse.json({ fehler: "nicht gefunden" }, { status: 404 });
  return NextResponse.json(a, { headers: { "Cache-Control": "no-store" } });
}
