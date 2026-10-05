import { NextResponse } from "next/server";
import { KiFehler, kiLaden } from "@/lib/ki";
import { kiFallaufnahme } from "@/lib/kiauswertung";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!kiLaden().aktiv) return NextResponse.json({ fehler: "KI ist ausgeschaltet (Einstellungen)" }, { status: 409 });
  const b = await req.json().catch(() => ({}));
  const text = typeof b.text === "string" ? b.text : "";
  if (text.trim().length < 10) return NextResponse.json({ fehler: "Zu wenig Text" }, { status: 400 });
  try {
    return NextResponse.json(await kiFallaufnahme(text));
  } catch (x) {
    return NextResponse.json({ fehler: x instanceof KiFehler ? x.message : "KI-Fehler" }, { status: 502 });
  }
}
