import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { kanzleiLaden } from "@/lib/schreiben";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(kanzleiLaden());
}

export async function PUT(req: Request) {
  const alt = kanzleiLaden();
  const b = await req.json().catch(() => ({}));
  const felder = ["name", "zusatz", "strasse", "ort", "telefon", "email", "web", "bank", "akzent", "signatur"] as const;
  const neu = { ...alt };
  for (const f of felder) if (typeof b[f] === "string") neu[f] = b[f].slice(0, f === "signatur" ? 500 : 160);
  if (!/^#[0-9a-f]{6}$/i.test(neu.akzent)) neu.akzent = alt.akzent;
  db().prepare("UPDATE kanzlei SET daten=? WHERE id=1").run(JSON.stringify(neu));
  return NextResponse.json(neu);
}
