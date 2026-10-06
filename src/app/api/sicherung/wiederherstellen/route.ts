import { NextResponse } from "next/server";
import { wiederherstellen } from "@/lib/sicherung";
import { protokoll } from "@/lib/protokoll";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// FormData: datei (.kzb), passwort, bestaetigung="WIEDERHERSTELLEN"
export async function POST(req: Request) {
  const f = await req.formData();
  const datei = f.get("datei"), pw = String(f.get("passwort") ?? "");
  if (String(f.get("bestaetigung")) !== "WIEDERHERSTELLEN") return NextResponse.json({ fehler: "Bestätigung fehlt" }, { status: 400 });
  if (!datei || typeof datei === "string") return NextResponse.json({ fehler: "Keine Datei" }, { status: 400 });
  const wer = { id: Number(req.headers.get("x-benutzer")) || null, kuerzel: req.headers.get("x-kuerzel") ?? "" };
  try {
    const r = await wiederherstellen(Buffer.from(await datei.arrayBuffer()), pw);
    protokoll({ kategorie: "einstellungen", aktion: "Sicherung wiederhergestellt", details: `Stand ${r.erstellt} · ${r.dokumente} Dokumente`, benutzer: wer });
    return NextResponse.json(r);
  } catch (x) { return NextResponse.json({ fehler: (x as Error).message }, { status: 400 }); }
}
