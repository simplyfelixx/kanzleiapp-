import { protokoll } from "@/lib/protokoll";
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
  const ocrModell = typeof b.ocrModell === "string" && /^[\w.:\/-]{1,80}$/.test(b.ocrModell.trim()) ? b.ocrModell.trim() : alt.ocrModell;
  const neu = { aktiv: typeof b.aktiv === "boolean" ? b.aktiv : alt.aktiv, url, modell, ocr: typeof b.ocr === "boolean" ? b.ocr : alt.ocr, ocrModell };
  kiSpeichern(neu);
  protokoll({ kategorie: "einstellungen", aktion: "KI-Einstellungen geändert", details: `aktiv=${neu.aktiv}, Modell ${neu.modell}, OCR=${neu.ocr} (${neu.ocrModell}), ${neu.url}` });
  return NextResponse.json(neu);
}
