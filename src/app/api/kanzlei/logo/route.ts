import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { ABLAGE, dateiSpeichern, db } from "@/lib/db";
import { kanzleiLaden } from "@/lib/schreiben";

export const dynamic = "force-dynamic";

// Logo hochladen (PNG oder JPG, max. 2 MB). Wird in Schreiben, Rechnungen und Portal verwendet.
export async function POST(req: Request) {
  const f = (await req.formData()).get("logo");
  if (!f || typeof f === "string") return NextResponse.json({ fehler: "Keine Datei" }, { status: 400 });
  const buf = Buffer.from(await f.arrayBuffer());
  const png = buf.subarray(0, 4).toString("hex") === "89504e47", jpg = buf.subarray(0, 2).toString("hex") === "ffd8";
  if (!png && !jpg) return NextResponse.json({ fehler: "Bitte PNG oder JPG" }, { status: 400 });
  if (buf.length > 2 * 1024 * 1024) return NextResponse.json({ fehler: "Logo größer als 2 MB" }, { status: 400 });
  const k = kanzleiLaden();
  k.logo = dateiSpeichern(buf, png ? ".png" : ".jpg");
  db().prepare("UPDATE kanzlei SET daten=? WHERE id=1").run(JSON.stringify(k));
  return NextResponse.json(k);
}

export function DELETE() {
  const k = kanzleiLaden();
  k.logo = null;
  db().prepare("UPDATE kanzlei SET daten=? WHERE id=1").run(JSON.stringify(k));
  return NextResponse.json(k);
}

export function GET() {
  const k = kanzleiLaden();
  if (!k.logo) return NextResponse.json({ fehler: "kein Logo" }, { status: 404 });
  const datei = path.join(ABLAGE, path.basename(k.logo));
  if (!fs.existsSync(datei)) return NextResponse.json({ fehler: "fehlt" }, { status: 404 });
  return new NextResponse(fs.readFileSync(datei), { headers: { "Content-Type": /\.png$/.test(datei) ? "image/png" : "image/jpeg", "Cache-Control": "no-store" } });
}
