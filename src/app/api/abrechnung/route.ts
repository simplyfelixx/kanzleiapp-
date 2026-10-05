import { NextResponse } from "next/server";
import { wer } from "@/lib/auth";
import { db } from "@/lib/db";
import { erstellen, pruefen, rechnungen, vorschlag } from "@/lib/abrechnung";
import { kostennote } from "@/lib/rvg";
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

// Body: { akte, wert, posten:[{vv,faktor}], empfaenger, nurBerechnen? }
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const p = pruefen(b);
  if ("fehler" in p) return NextResponse.json(p, { status: 400 });
  if (b.nurBerechnen) return NextResponse.json(kostennote(p.wert, p.posten));
  if (!p.empfaenger.trim()) return NextResponse.json({ fehler: "Empfänger fehlt" }, { status: 400 });
  const r = await erstellen(p.akte, p.wert, p.posten, p.empfaenger, wer());
  protokoll({ kategorie: "akte", aktion: "Kostennote erstellt", akte: p.akte, details: `${r.nr} · ${r.brutto.toFixed(2)} €` });
  return NextResponse.json(r);
}
