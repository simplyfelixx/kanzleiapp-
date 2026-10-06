import { NextResponse, type NextRequest } from "next/server";
import { COOKIE, pruefen, type Rolle } from "@/lib/sitzung";

// Ohne Login erreichbar
// Mandantenportal: eigener Zugang per Link, nie mit Kanzlei-Rechten
const OFFEN = ["/login", "/api/auth/login", "/api/auth/einrichten", "/api/auth/pruefen", "/p", "/portal", "/api/portal"];
// Nur für bestimmte Rollen
const NUR: { pfad: string; rollen: Rolle[]; nurSchreiben?: boolean }[] = [
  { pfad: "/benutzer", rollen: ["admin"] },
  { pfad: "/api/benutzer", rollen: ["admin"] },
  { pfad: "/einstellungen", rollen: ["admin"] },
  { pfad: "/einrichtung", rollen: ["admin"] },
  { pfad: "/api/einrichtung", rollen: ["admin"] },
  { pfad: "/protokoll", rollen: ["admin", "anwalt"] },
  { pfad: "/api/protokoll", rollen: ["admin", "anwalt"] },
  { pfad: "/api/kanzlei", rollen: ["admin"], nurSchreiben: true },
  { pfad: "/api/ki/einstellungen", rollen: ["admin"], nurSchreiben: true },
  { pfad: "/api/mail/konto", rollen: ["admin"] },
  { pfad: "/api/sicherung", rollen: ["admin"] },
];
// Deaktivierte Benutzer und Rollenwechsel wirken spätestens nach 30 s (Abgleich mit der Datenbank)
type Stand = { u: number; k: string; r: Rolle } | null;
const cache = new Map<string, { stand: Stand; bis: number }>();
async function aktuell(req: NextRequest, token: string): Promise<Stand> {
  const c = cache.get(token);
  if (c && c.bis > Date.now()) return c.stand;
  let stand: Stand = null;
  try {
    const r = await fetch(new URL("/api/auth/pruefen", req.nextUrl.origin), { headers: { cookie: `${COOKIE}=${token}` }, cache: "no-store" });
    if (r.ok) { const j = await r.json(); stand = { u: j.u, k: j.k, r: j.r }; }
  } catch { return null; }
  if (cache.size > 500) cache.clear();
  cache.set(token, { stand, bis: Date.now() + 30_000 });
  return stand;
}

const passt = (p: string, basis: string) => p === basis || p.startsWith(basis + "/");

export async function middleware(req: NextRequest) {
  const p = req.nextUrl.pathname;
  if (OFFEN.some((o) => passt(p, o))) {
    const h = new Headers(req.headers);
    ["x-benutzer", "x-kuerzel", "x-rolle"].forEach((k) => h.delete(k));
    return NextResponse.next({ request: { headers: h } });
  }
  const api = p.startsWith("/api/");
  const token = req.cookies.get(COOKIE)?.value;
  const s = (await pruefen(token)) ? await aktuell(req, token!) : null;
  if (!s) {
    if (api) return NextResponse.json({ fehler: "Nicht angemeldet" }, { status: 401 });
    const url = new URL("/login", req.url);
    if (p !== "/") url.searchParams.set("weiter", p + req.nextUrl.search);
    const res = NextResponse.redirect(url);
    if (token) res.cookies.set({ name: COOKIE, value: "", path: "/", maxAge: 0 });
    return res;
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
