import { NextResponse } from "next/server";
import { ketteGueltig, protokoll, protokollListe } from "@/lib/protokoll";

export const dynamic = "force-dynamic";

// ?von=JJJJ-MM-TT&bis=…&kuerzel=…&kategorie=…&akte=…&suche=…&format=csv
export function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const f = {
    von: q.get("von") || undefined, bis: q.get("bis") || undefined, kuerzel: q.get("kuerzel") || undefined,
    kategorie: q.get("kategorie") || undefined, akte: q.get("akte") || undefined, suche: q.get("suche")?.slice(0, 100) || undefined,
  };
  if (q.get("format") === "csv") {
    const zeilen = protokollListe({ ...f, limit: 5000 });
    protokoll({ kategorie: "einstellungen", aktion: "Protokoll exportiert", details: `${zeilen.length} Einträge` });
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""').replace(/^([=+\-@])/, "'$1")}"`;
    const csv = "﻿Zeit;Benutzer;Bereich;Aktion;Akte;Details;IP;Hash\n" +
      zeilen.map((r) => [r.zeit, r.kuerzel, r.kategorie, r.aktion, r.akte_id, r.details, r.ip, r.hash].map(esc).join(";")).join("\n");
    return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="protokoll_${new Date().toISOString().slice(0, 10)}.csv"` } });
  }
  return NextResponse.json({ eintraege: protokollListe({ ...f, limit: 500 }), kette: ketteGueltig() });
}
