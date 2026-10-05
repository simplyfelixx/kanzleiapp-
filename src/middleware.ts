import { NextResponse, type NextRequest } from "next/server";
import { COOKIE, pruefen, type Rolle } from "@/lib/sitzung";

// Ohne Login erreichbar
const OFFEN = ["/login", "/api/auth/login", "/api/auth/einrichten"];
// Nur für bestimmte Rollen
const NUR: { pfad: string; rollen: Rolle[]; nurSchreiben?: boolean }[] = [
  { pfad: "/benutzer", rollen: ["admin"] },
  { pfad: "/api/benutzer", rollen: ["admin"] },
  { pfad: "/einstellungen", rollen: ["admin"] },
  { pfad: "/einrichtung", rollen: ["admin"] },
  { pfad: "/api/kanzlei", rollen: ["admin"], nurSchreiben: true },
  { pfad: "/api/ki/einstellungen", rollen: ["admin"], nurSchreiben: true },
];
const passt = (p: string, basis: string) => p === basis || p.startsWith(basis + "/");

export async function middleware(req: NextRequest) {
  const p = req.nextUrl.pathname;
  if (OFFEN.some((o) => passt(p, o))) {
    const h = new Headers(req.headers);
    ["x-benutzer", "x-kuerzel", "x-rolle"].forEach((k) => h.delete(k));
    return NextResponse.next({ request: { headers: h } });
  }
  const api = p.startsWith("/api/");
  const s = await pruefen(req.cookies.get(COOKIE)?.value);
  if (!s) {
    if (api) return NextResponse.json({ fehler: "Nicht angemeldet" }, { status: 401 });
    const url = new URL("/login", req.url);
    if (p !== "/") url.searchParams.set("weiter", p + req.nextUrl.search);
    return NextResponse.redirect(url);
  }
  const regel = NUR.find((r) => passt(p, r.pfad) && (!r.nurSchreiben || req.method !== "GET"));
  if (regel && !regel.rollen.includes(s.r)) {
    if (api) return NextResponse.json({ fehler: "Keine Berechtigung" }, { status: 403 });
    return NextResponse.redirect(new URL("/?keine_berechtigung=1", req.url));
  }
  const h = new Headers(req.headers);
  h.set("x-benutzer", String(s.u)); h.set("x-kuerzel", s.k); h.set("x-rolle", s.r);
  return NextResponse.next({ request: { headers: h } });
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
