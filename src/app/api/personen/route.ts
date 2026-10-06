// Personen (Mandanten, Fahrer, Gegner, Zeugen) aus allen Akten – zum Wiederverwenden in einer neuen Akte.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const suche = (q.get("suche") ?? "").trim().slice(0, 80);
  const ohneAkte = q.get("ohne") ?? "";
  const rows = db().prepare(`
    SELECT name, MAX(adresse) adresse, MAX(telefon) telefon, MAX(email) email, MAX(iban) iban,
      GROUP_CONCAT(DISTINCT rolle) rollen, GROUP_CONCAT(DISTINCT akte_id) akten
    FROM beteiligte
    WHERE rolle IN ('Mandant','Fahrer','Gegner','Zeuge') AND name != '' AND akte_id != ?
      AND (? = '' OR name LIKE ? OR telefon LIKE ? OR email LIKE ?)
    GROUP BY lower(trim(name)) ORDER BY name LIMIT 50`).all(ohneAkte, suche, `%${suche}%`, `%${suche}%`, `%${suche}%`);
  return NextResponse.json(rows);
}
