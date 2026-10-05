import { NextResponse } from "next/server";
import { protokoll } from "@/lib/protokoll";
import { KiFehler, kiLaden } from "@/lib/ki";
import { kiFallaufnahme } from "@/lib/kiauswertung";

export const dynamic = "force-dynamic";

// Antwort als NDJSON-Stream: {typ:"status",…} … dann {typ:"ergebnis",…} oder {typ:"fehler",…}.
// Bricht der Browser ab (Abbrechen-Knopf), wird auch die Anfrage an Ollama gestoppt.
export async function POST(req: Request) {
  if (!kiLaden().aktiv) return NextResponse.json({ fehler: "KI ist ausgeschaltet (Einstellungen)" }, { status: 409 });
  const b = await req.json().catch(() => ({}));
  const text = typeof b.text === "string" ? b.text : "";
  if (text.trim().length < 10) return NextResponse.json({ fehler: "Zu wenig Text" }, { status: 400 });
  // Protokoll braucht die Anfrage-Header – vor dem Stream erfassen
  const h = req.headers;
  const wer = { id: Number(h.get("x-benutzer")) || null, kuerzel: h.get("x-kuerzel") ?? "" };
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim();
  const log = (aktion: string, details: string) => protokoll({ kategorie: "ki", aktion, details, benutzer: wer, ip });

  const enc = new TextEncoder();
  const start = Date.now();
  const stream = new ReadableStream({
    async start(ctrl) {
      const senden = (o: object) => { try { ctrl.enqueue(enc.encode(JSON.stringify(o) + "\n")); } catch { /* geschlossen */ } };
      let letzt = 0;
      try {
        const r = await kiFallaufnahme(text, {
          signal: req.signal,
          status: (s) => {
            const jetzt = Date.now();
            if (s.schritt === "schreiben" && jetzt - letzt < 150) return; // nicht jedes Token senden
            letzt = jetzt;
            senden({ typ: "status", ...s, sek: Math.round((jetzt - start) / 1000) });
          },
        });
        senden({ typ: "ergebnis", ...r });
        log("KI-Auswertung Fallaufnahme", `${Object.keys(r.werte).length} Felder erkannt, ${r.ersetzt} Angaben pseudonymisiert, ${Math.round((Date.now() - start) / 1000)} s`);
      } catch (x) {
        const m = x instanceof KiFehler ? x.message : "KI-Fehler";
        if (m === "abgebrochen") log("KI-Auswertung abgebrochen", `nach ${Math.round((Date.now() - start) / 1000)} s`);
        senden({ typ: "fehler", fehler: m });
      }
      try { ctrl.close(); } catch { /* schon zu */ }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}
