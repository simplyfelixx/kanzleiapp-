// Kanzlei-Seite des Portals: Links erzeugen/sperren, Freigaben, Statusmeldungen, Aufgaben.
import { NextResponse } from "next/server";
import { wer } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  aufgabeAnlegen, aufgabeErledigt, aufgaben, freigabenSetzen, meldungAnlegen, meldungen, meldungFreigeben, meldungLoeschen,
  portalAnsicht, STANDARD_FREIGABEN, zugangErstellen, zugangLaden, zugangSperren,
} from "@/lib/portal";
import { protokoll } from "@/lib/protokoll";

export const dynamic = "force-dynamic";

const status = (akteId: string) => {
  const z = zugangLaden(akteId);
  const abgelaufen = z ? z.ablauf < new Date().toISOString().slice(0, 19).replace("T", " ") : false;
  return z ? { aktiv: !!z.aktiv && !abgelaufen, abgelaufen, erstellt: z.erstellt, ablauf: z.ablauf, letzter_zugriff: z.letzter_zugriff, freigaben: z.f } : null;
};

// ohne ?akte: Übersicht aller Akten; mit ?akte: Details + Vorschau
export function GET(req: Request) {
  const akte = new URL(req.url).searchParams.get("akte");
  if (!akte) {
    const liste = db().prepare(`SELECT a.id, a.titel, a.phase,
      (SELECT name FROM beteiligte b WHERE b.akte_id=a.id AND b.rolle='Mandant' LIMIT 1) AS mandant
      FROM akten a ORDER BY a.angelegt DESC, a.id DESC`).all() as { id: string; titel: string; phase: string; mandant: string | null }[];
    return NextResponse.json(liste.map((a) => ({ ...a, zugang: status(a.id), offeneAufgaben: aufgaben(a.id).filter((x) => !x.erledigt).length })));
  }
  if (!db().prepare("SELECT 1 FROM akten WHERE id=?").get(akte)) return NextResponse.json({ fehler: "Akte unbekannt" }, { status: 404 });
  const z = status(akte);
  return NextResponse.json({
    zugang: z, meldungen: meldungen(akte), aufgaben: aufgaben(akte),
    vorschau: portalAnsicht(akte, z?.freigaben ?? STANDARD_FREIGABEN),
  });
}

// Body: { akte, aktion, … }
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const akte = String(b.akte ?? "");
  if (!db().prepare("SELECT 1 FROM akten WHERE id=?").get(akte)) return NextResponse.json({ fehler: "Akte unbekannt" }, { status: 404 });
  const text = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
  const log = (aktion: string, details = "") => protokoll({ kategorie: "portal", aktion, akte, details });

  switch (b.aktion) {
    case "link": {
      const tage = Math.min(365, Math.max(1, Number(b.tage) || 90));
      const token = zugangErstellen(akte, tage);
      log("Portal-Link erstellt", `gültig ${tage} Tage, alter Link gesperrt`);
      return NextResponse.json({ link: new URL(`/p/${token}`, req.url).toString() });
    }
    case "sperren": zugangSperren(akte); log("Portal-Zugang gesperrt"); break;
    case "freigaben": { const f = freigabenSetzen(akte, b.freigaben ?? {}); log("Portal-Freigaben geändert", Object.entries(f).map(([k, v]) => `${k}=${v ? "an" : "aus"}`).join(", ")); break; }
    case "meldung": { const t = text(b.text, 1000); if (!t) return NextResponse.json({ fehler: "Text fehlt" }, { status: 400 }); meldungAnlegen(akte, t, wer()); break; }
    case "meldung_freigeben": if (meldungFreigeben(akte, Number(b.id), b.text ? text(b.text, 1000) : undefined)) log("Statusmeldung freigegeben"); break;
    case "meldung_loeschen": meldungLoeschen(akte, Number(b.id)); break;
    case "aufgabe": { const t = text(b.titel, 120); if (!t) return NextResponse.json({ fehler: "Titel fehlt" }, { status: 400 }); aufgabeAnlegen(akte, t); log("Aufgabe angefordert", t); break; }
    case "aufgabe_erledigt": aufgabeErledigt(akte, Number(b.id), !!b.erledigt); break;
    default: return NextResponse.json({ fehler: "unbekannte Aktion" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
