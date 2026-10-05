import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { wer } from "@/lib/auth";
import { ABLAGE, db, verlaufEintrag } from "@/lib/db";
import { schemaName } from "@/lib/dokerkennung";
import { anhangAbgelegt, anhangLaden } from "@/lib/mail";
import { protokoll } from "@/lib/protokoll";

export const dynamic = "force-dynamic";
const TYPEN: Record<string, string> = { ".pdf": "application/pdf", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".txt": "text/plain; charset=utf-8" };

/** Anhang öffnen */
export function GET(_: Request, { params }: { params: { id: string } }) {
  const a = anhangLaden(Number(params.id));
  if (!a?.datei) return NextResponse.json({ fehler: "nicht gefunden" }, { status: 404 });
  const datei = path.join(ABLAGE, path.basename(a.datei));
  if (!fs.existsSync(datei)) return NextResponse.json({ fehler: "Datei fehlt" }, { status: 404 });
  protokoll({ kategorie: "dokument", aktion: "Mail-Anhang geöffnet", details: a.name });
  const typ = TYPEN[path.extname(datei).toLowerCase()];
  return new NextResponse(fs.readFileSync(datei), {
    headers: {
      "Content-Type": typ ?? "application/octet-stream", "X-Content-Type-Options": "nosniff",
      // Unbekannte Typen (Word, Excel …) nur herunterladen, nie im Browser ausführen
      "Content-Disposition": `${typ ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(a.name)}`,
    },
  });
}

/** Anhang in Akte ablegen. Body: { akteId } */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const a = anhangLaden(Number(params.id));
  if (!a?.datei) return NextResponse.json({ fehler: "nicht gefunden" }, { status: 404 });
  const b = await req.json().catch(() => ({}));
  const akte = String(b.akteId ?? "");
  const d = db();
  if (!d.prepare("SELECT 1 FROM akten WHERE id=?").get(akte)) return NextResponse.json({ fehler: "Bitte Akte wählen" }, { status: 400 });
  const e = a.erkannt ? JSON.parse(a.erkannt) : null;
  const endung = (a.name.match(/\.\w+$/)?.[0] ?? ".pdf").toLowerCase();
  const datum = e?.datum ?? a.mail_datum.slice(0, 10);
  const name = e ? schemaName(datum, e.typ, e.absender, endung) : a.name;
  d.prepare("INSERT INTO dokumente (akte_id,richtung,name,typ,absender,datum,datei,groesse) VALUES (?,?,?,?,?,?,?,?)")
    .run(akte, "ein", name, e?.typ ?? "Sonstiges", e?.absender ?? "", datum, a.datei, a.groesse);
  verlaufEintrag(akte, `Mail-Anhang abgelegt: ${name}`, wer());
  anhangAbgelegt(a.id, akte);
  protokoll({ kategorie: "dokument", aktion: "Mail-Anhang abgelegt", akte, details: name });
  return NextResponse.json({ ok: true, name });
}
