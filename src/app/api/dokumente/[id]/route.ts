import { wer } from "@/lib/auth";
import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { ABLAGE, db, verlaufEintrag } from "@/lib/db";

export const dynamic = "force-dynamic";

const TYPEN: Record<string, string> = { ".pdf": "application/pdf", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".txt": "text/plain; charset=utf-8", ".heic": "image/heic" };

/** Datei anzeigen. id = Dokument-ID, oder „e123“ für eine Datei im Eingang. */
export function GET(_: Request, { params }: { params: { id: string } }) {
  const d = db();
  const row = params.id.startsWith("e")
    ? (d.prepare("SELECT datei, dateiname AS name FROM eingang WHERE id=?").get(Number(params.id.slice(1))) as { datei: string | null; name: string } | undefined)
    : (d.prepare("SELECT datei, name FROM dokumente WHERE id=?").get(Number(params.id)) as { datei: string | null; name: string } | undefined);
  if (!row?.datei) return NextResponse.json({ fehler: "keine Datei" }, { status: 404 });
  const datei = path.join(ABLAGE, path.basename(row.datei)); // nur Dateien aus der Ablage
  if (!fs.existsSync(datei)) return NextResponse.json({ fehler: "Datei fehlt" }, { status: 404 });
  const typ = TYPEN[path.extname(datei).toLowerCase()] ?? "application/octet-stream";
  return new NextResponse(fs.readFileSync(datei), {
    headers: { "Content-Type": typ, "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(row.name)}`, "X-Content-Type-Options": "nosniff" },
  });
}

/** Umbenennen / Typ ändern. Body: { name?, typ? } */
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const d = db();
  const dok = d.prepare("SELECT * FROM dokumente WHERE id=?").get(Number(params.id)) as { id: number; akte_id: string; name: string } | undefined;
  if (!dok) return NextResponse.json({ fehler: "nicht gefunden" }, { status: 404 });
  const b = await req.json().catch(() => ({}));
  const name = String(b.name ?? dok.name).replace(/[\\/:*?"<>|]/g, "_").trim().slice(0, 180) || dok.name;
  d.prepare("UPDATE dokumente SET name=?, typ=COALESCE(?, typ) WHERE id=?").run(name, b.typ ? String(b.typ).slice(0, 60) : null, dok.id);
  if (name !== dok.name) verlaufEintrag(dok.akte_id, `Dokument umbenannt: ${dok.name} → ${name}`, wer());
  return NextResponse.json({ ok: true });
}
