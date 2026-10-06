import { NextResponse } from "next/server";
import { wer } from "@/lib/auth";
import { db } from "@/lib/db";
import { berechnen, erstellen, pruefen, rechnungen, vorschlag } from "@/lib/abrechnung";
import { protokoll } from "@/lib/protokoll";

export const dynamic = "force-dynamic";

// ?akte=… → Vorschlag + Berechnung; sonst Liste aller Rechnungen
export function GET(req: Request) {
  const q = new URL(req.url).searchParams, akte = q.get("akte");
  if (akte) {
    if (!db().prepare("SELECT 1 FROM akten WHERE id=?").get(akte)) return NextResponse.json({ fehler: "Akte unbekannt" }, { status: 404 });
    return NextResponse.json(vorschlag(akte));
  }
  const titel = new Map((db().prepare("SELECT id, titel FROM akten").all() as { id: string; titel: string }[]).map((a) => [a.id, a.titel]));
  return NextResponse.json(rechnungen().map((r) => ({ ...r, akte_titel: titel.get(r.akte_id) ?? "" })));
}

// Body: { akte, wert, posten:[{vv,faktor}], empfaenger, tabelle?: "2025"|"2021", nach?: [rechnungIds], nurBerechnen? }
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const p = pruefen(b);
  if ("fehler" in p) return NextResponse.json(p, { status: 400 });
  if (b.nurBerechnen) return NextResponse.json(berechnen(p));
  if (!p.empfaenger.trim()) return NextResponse.json({ fehler: "Empfänger fehlt" }, { status: 400 });
  let r;
  try { r = await erstellen(p, wer()); } catch (e) { return NextResponse.json({ fehler: (e as Error).message }, { status: 400 }); }
  protokoll({ kategorie: "akte", aktion: "Kostennote erstellt", akte: p.akte, details: `${r.nr} · ${r.brutto.toFixed(2)} €` });
  return NextResponse.json(r);
}
