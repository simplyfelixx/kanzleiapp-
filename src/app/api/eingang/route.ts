import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export function GET() {
  const rows = db().prepare(`
    SELECT e.*, a.titel AS akte_titel, a.phase AS akte_phase FROM eingang e LEFT JOIN akten a ON a.id=e.akte_id
    WHERE e.status='offen' ORDER BY e.id`).all();
  return NextResponse.json(rows);
}
