// Status der Ersteinrichtung; Abschließen/Überspringen; optional Beispieldaten entfernen.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { protokoll } from "@/lib/protokoll";

export const dynamic = "force-dynamic";
const tab = () => db().exec("CREATE TABLE IF NOT EXISTS app_status (schluessel TEXT PRIMARY KEY, wert TEXT NOT NULL)");

export function GET() {
  tab();
  const r = db().prepare("SELECT wert FROM app_status WHERE schluessel='einrichtung'").get() as { wert: string } | undefined;
  return NextResponse.json({ erledigt: !!r, wie: r?.wert ?? null, akten: (db().prepare("SELECT COUNT(*) n FROM akten").get() as { n: number }).n });
}

// Body: { wie: "abgeschlossen" | "übersprungen", beispieldatenLoeschen?: boolean }
export async function POST(req: Request) {
  tab();
  const b = await req.json().catch(() => ({}));
  const wie = b.wie === "übersprungen" ? "übersprungen" : "abgeschlossen";
  const d = db();
  const schonFertig = !!d.prepare("SELECT 1 FROM app_status WHERE schluessel='einrichtung'").get();
  if (b.beispieldatenLoeschen && !schonFertig) {
    // Nur während der Ersteinrichtung möglich – danach nie wieder über diesen Weg
    d.transaction(() => {
      d.prepare("DELETE FROM eingang").run();
      d.prepare("DELETE FROM akten").run(); // Beteiligte, Konto, Fristen, Dokumente, Verlauf, Vorgänge hängen per CASCADE daran
    })();
    protokoll({ kategorie: "einstellungen", aktion: "Beispieldaten entfernt" });
  }
  d.prepare("INSERT INTO app_status (schluessel,wert) VALUES ('einrichtung',?) ON CONFLICT(schluessel) DO UPDATE SET wert=excluded.wert").run(wie);
  protokoll({ kategorie: "einstellungen", aktion: `Ersteinrichtung ${wie}` });
  return NextResponse.json({ ok: true });
}
