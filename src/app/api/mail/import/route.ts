// .eml/.msg-Dateien importieren (z. B. aus Outlook herausgezogen)
import { NextResponse } from "next/server";
import { emlLesen, mailSpeichern, msgLesen } from "@/lib/mail";
import { protokoll } from "@/lib/protokoll";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 600;

export async function POST(req: Request) {
  const form = await req.formData();
  const dateien = form.getAll("datei").filter((x): x is File => typeof x !== "string");
  if (!dateien.length) return NextResponse.json({ fehler: "Keine Datei" }, { status: 400 });
  const ergebnis: { name: string; id?: number; neu?: boolean; fehler?: string }[] = [];
  for (const f of dateien.slice(0, 50)) {
    if (f.size > 40 * 1024 * 1024) { ergebnis.push({ name: f.name, fehler: "größer als 40 MB" }); continue; }
    const buf = Buffer.from(await f.arrayBuffer());
    try {
      const m = /\.msg$/i.test(f.name) ? await msgLesen(buf) : /\.eml$/i.test(f.name) ? await emlLesen(buf) : null;
      if (!m) { ergebnis.push({ name: f.name, fehler: "nur .eml oder .msg" }); continue; }
      const r = await mailSpeichern(m, "datei");
      ergebnis.push({ name: f.name, ...r });
      if (r.neu) protokoll({ kategorie: "dokument", aktion: "Mail importiert", details: `${m.betreff.slice(0, 100)} · ${m.anhaenge.length} Anhänge` });
    } catch {
      ergebnis.push({ name: f.name, fehler: "Datei konnte nicht gelesen werden" });
    }
  }
  return NextResponse.json({ ergebnis });
}
