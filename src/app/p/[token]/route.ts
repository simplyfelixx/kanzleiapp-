// Einstieg für Mandanten: Link prüfen, Schlüssel ins Cookie, dann ohne Schlüssel in der Adresse weiter.
import { NextResponse } from "next/server";
import { tokenPruefen } from "@/lib/portal";
import { protokoll } from "@/lib/protokoll";

export const dynamic = "force-dynamic";
const PORTAL_COOKIE = "kz_portal";

export function GET(req: Request, { params }: { params: { token: string } }) {
  const z = tokenPruefen(params.token);
  const ziel = new URL(z ? "/portal" : "/portal?ungueltig=1", req.url);
  const res = NextResponse.redirect(ziel, 303);
  res.headers.set("Referrer-Policy", "no-referrer");
  res.headers.set("Cache-Control", "no-store");
  if (z) {
    res.cookies.set({
      name: PORTAL_COOKIE, value: params.token, httpOnly: true, sameSite: "lax", path: "/",
      secure: process.env.NODE_ENV === "production" && process.env.AUTH_HTTP !== "1", maxAge: 60 * 60 * 8,
    });
    protokoll({ kategorie: "portal", aktion: "Mandant hat Portal geöffnet", akte: z.akte_id, benutzer: { id: null, kuerzel: "Mandant" } });
  }
  return res;
}
