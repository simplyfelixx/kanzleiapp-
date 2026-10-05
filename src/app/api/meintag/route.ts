import { NextResponse } from "next/server";
import { db, isoTag, plusTage } from "@/lib/db";

export const dynamic = "force-dynamic";

// Alles, was heute bzw. diese Woche zu tun ist: offene Vorgänge + fällige Fristen/Wiedervorlagen.
export function GET() {
  const d = db();
  const vorgaenge = d.prepare(`
    SELECT v.*, a.titel AS akte_titel, a.gebiet FROM vorgaenge v JOIN akten a ON a.id=v.akte_id
    WHERE v.status='offen' ORDER BY v.id`).all();
  const bis = plusTage(7);
  const faellig = d.prepare(`
    SELECT f.*, a.titel AS akte_titel, a.gebiet FROM fristen f JOIN akten a ON a.id=f.akte_id
    WHERE f.status='offen' AND f.datum<=? ORDER BY f.datum, f.art DESC`).all(bis);
  const erledigt = (d.prepare(`SELECT
      (SELECT COUNT(*) FROM vorgaenge WHERE status!='offen' AND date(erledigt_am)=date('now','localtime')) +
      (SELECT COUNT(*) FROM eingang WHERE status!='offen' AND date(erledigt_am)=date('now','localtime')) AS n`).get() as { n: number }).n;
  return NextResponse.json({ heute: isoTag(new Date()), vorgaenge, faellig, erledigt });
}
