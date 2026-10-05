import { NextResponse } from "next/server";
import { kiLaden, kiSpeichern, lokaleUrl } from "@/lib/ki";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(kiLaden());
}

export async function PUT(req: Request) {
  const b = await req.json().catch(() => ({}));
  const alt = kiLaden();
  const url = typeof b.url === "string" ? b.url.trim().slice(0, 200) : alt.url;
  if (!lokaleUrl(url)) return NextResponse.json({ fehler: "Nur lokale Adressen erlaubt (localhost oder lokales Netz)" }, { status: 400 });
  const modell = typeof b.modell === "string" && /^[\w.:\/-]{1,80}$/.test(b.modell.trim()) ? b.modell.trim() : alt.modell;
  const neu = { aktiv: typeof b.aktiv === "boolean" ? b.aktiv : alt.aktiv, url, modell };
  kiSpeichern(neu);
  return NextResponse.json(neu);
}
