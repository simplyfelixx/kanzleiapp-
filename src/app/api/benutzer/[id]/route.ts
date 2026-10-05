import { protokoll } from "@/lib/protokoll";
import { NextResponse } from "next/server";
import { aktiveAdmins, alleBenutzer, benutzerAendern, passwortFehler } from "@/lib/auth";
import { ROLLEN, type Rolle } from "@/lib/sitzung";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  const ich = Number(req.headers.get("x-benutzer"));
  const b = await req.json().catch(() => ({}));
  const ziel = alleBenutzer().find((u) => u.id === id);
  if (!ziel) return NextResponse.json({ fehler: "Benutzer nicht gefunden" }, { status: 404 });

  const rolle = b.rolle as Rolle | undefined;
  if (rolle && !ROLLEN.some((r) => r.key === rolle)) return NextResponse.json({ fehler: "Unbekannte Rolle" }, { status: 400 });
  if (b.passwort !== undefined) { const pf = passwortFehler(b.passwort); if (pf) return NextResponse.json({ fehler: pf }, { status: 400 }); }

  // Der letzte aktive Admin darf weder herabgestuft noch deaktiviert werden
  const verliertAdmin = ziel.rolle === "admin" && ziel.aktiv && ((rolle && rolle !== "admin") || b.aktiv === false);
  if (verliertAdmin && aktiveAdmins() <= 1) return NextResponse.json({ fehler: "Es muss mindestens ein aktiver Admin bleiben" }, { status: 400 });
  if (id === ich && b.aktiv === false) return NextResponse.json({ fehler: "Eigenes Konto kann nicht deaktiviert werden" }, { status: 400 });

  const was = [rolle && rolle !== ziel.rolle && `Rolle ${ziel.rolle} → ${rolle}`, typeof b.aktiv === "boolean" && (b.aktiv ? "aktiviert" : "deaktiviert"), b.passwort && "Passwort neu gesetzt"].filter(Boolean).join(", ");
  if (was) protokoll({ kategorie: "benutzer", aktion: "Benutzer geändert", details: `${ziel.name} (${ziel.kuerzel}): ${was}` });
  benutzerAendern(id, { rolle, aktiv: typeof b.aktiv === "boolean" ? b.aktiv : undefined, passwort: b.passwort });
  return NextResponse.json(alleBenutzer());
}
