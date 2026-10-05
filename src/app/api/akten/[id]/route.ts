import { protokoll } from "@/lib/protokoll";
import { wer } from "@/lib/auth";
import { NextResponse } from "next/server";
import { akteLaden, db, FALLFELDER, verlaufEintrag } from "@/lib/db";
import { schemaName } from "@/lib/dokerkennung";

export const dynamic = "force-dynamic";
type Ctx = { params: { id: string } };
const az = (c: Ctx) => decodeURIComponent(c.params.id);

export function GET(_: Request, c: Ctx) {
  const a = akteLaden(az(c));
  if (a) protokoll({ kategorie: "akte", aktion: "Akte geöffnet", akte: a.akte.id });
  return a ? NextResponse.json(a) : NextResponse.json({ fehler: "nicht gefunden" }, { status: 404 });
}

/**
 * Änderungen an einer Akte. Body: { art, ... }
 *  art=akte        -> Felder der Akte (titel, phase, prioritaet, worum, stand_*)
 *  art=falldaten   -> { werte: {key: wert} }
 *  art=beteiligter -> { id?, rolle, name, ... }   (ohne id = neu)
 *  art=beteiligter_loeschen -> { id }
 *  art=konto       -> { id?, position, gefordert, gezahlt, quelle }
 *  art=konto_loeschen -> { id }
 */
export async function PUT(req: Request, c: Ctx) {
  const id = az(c);
  const d = db();
  if (!d.prepare("SELECT 1 FROM akten WHERE id=?").get(id)) return NextResponse.json({ fehler: "nicht gefunden" }, { status: 404 });
  const b = await req.json().catch(() => ({}));
  const s = (v: unknown) => String(v ?? "").slice(0, 2000);
  const n = (v: unknown) => { const x = Number(String(v ?? "0").replace(/\./g, "").replace(",", ".")); return isFinite(x) ? x : 0; };

  switch (b.art) {
    case "akte": {
      const erlaubt = ["titel", "phase", "prioritaet", "worum", "stand_vorliegend", "stand_ausstehend", "stand_naechster", "gebiet"];
      for (const k of erlaubt) if (k in b) d.prepare(`UPDATE akten SET ${k}=? WHERE id=?`).run(s(b[k]), id);
      break;
    }
    case "falldaten": {
      const alt = JSON.parse((d.prepare("SELECT falldaten FROM akten WHERE id=?").get(id) as { falldaten: string }).falldaten || "{}");
      const keys = new Set(FALLFELDER.map((f) => f.key));
      for (const [k, v] of Object.entries(b.werte ?? {})) if (keys.has(k)) alt[k] = s(v);
      d.prepare("UPDATE akten SET falldaten=? WHERE id=?").run(JSON.stringify(alt), id);
      break;
    }
    case "beteiligter": {
      const f = { rolle: s(b.rolle) || "Mandant", name: s(b.name), adresse: s(b.adresse), telefon: s(b.telefon), email: s(b.email), iban: s(b.iban), ansprechpartner: s(b.ansprechpartner), zeichen: s(b.zeichen), vorsteuer: b.vorsteuer ? 1 : 0, notiz: s(b.notiz) };
      if (b.id) d.prepare(`UPDATE beteiligte SET rolle=@rolle,name=@name,adresse=@adresse,telefon=@telefon,email=@email,iban=@iban,ansprechpartner=@ansprechpartner,zeichen=@zeichen,vorsteuer=@vorsteuer,notiz=@notiz WHERE id=@id AND akte_id=@akte`).run({ ...f, id: Number(b.id), akte: id });
      else d.prepare(`INSERT INTO beteiligte (akte_id,rolle,name,adresse,telefon,email,iban,ansprechpartner,zeichen,vorsteuer,notiz) VALUES (@akte,@rolle,@name,@adresse,@telefon,@email,@iban,@ansprechpartner,@zeichen,@vorsteuer,@notiz)`).run({ ...f, akte: id });
      break;
    }
    case "beteiligter_loeschen":
      d.prepare("DELETE FROM beteiligte WHERE id=? AND akte_id=?").run(Number(b.id), id);
      break;
    case "konto": {
      const f = { position: s(b.position) || "Position", gefordert: n(b.gefordert), gezahlt: n(b.gezahlt), quelle: s(b.quelle) };
      if (b.id) d.prepare("UPDATE konto SET position=@position,gefordert=@gefordert,gezahlt=@gezahlt,quelle=@quelle WHERE id=@id AND akte_id=@akte").run({ ...f, id: Number(b.id), akte: id });
      else d.prepare("INSERT INTO konto (akte_id,position,gefordert,gezahlt,quelle) VALUES (@akte,@position,@gefordert,@gezahlt,@quelle)").run({ ...f, akte: id });
      break;
    }
    case "konto_loeschen":
      d.prepare("DELETE FROM konto WHERE id=? AND akte_id=?").run(Number(b.id), id);
      break;
    case "dokumente_schema": {
      // Sammel-Umbenennung nach Kanzlei-Schema JJJJ-MM-TT_Typ_Absender
      const ids: number[] = Array.isArray(b.ids) ? b.ids.map(Number) : [];
      for (const dokId of ids) {
        const dk = d.prepare("SELECT * FROM dokumente WHERE id=? AND akte_id=?").get(dokId, id) as { name: string; typ: string; absender: string; datum: string } | undefined;
        if (!dk) continue;
        const neu = schemaName(dk.datum, String(b.typ || dk.typ), dk.absender, dk.name.match(/\.\w+$/)?.[0] ?? ".pdf");
        d.prepare("UPDATE dokumente SET name=?, typ=? WHERE id=?").run(neu, String(b.typ || dk.typ), dokId);
      }
      if (ids.length) verlaufEintrag(id, `${ids.length} Dokument(e) nach Schema umbenannt`, wer());
      break;
    }
    default:
      return NextResponse.json({ fehler: "unbekannte Änderung" }, { status: 400 });
  }
  const ART: Record<string, string> = { akte: "Akte bearbeitet", falldaten: "Falldaten geändert", beteiligter: b.id ? "Beteiligten geändert" : "Beteiligten hinzugefügt", beteiligter_loeschen: "Beteiligten gelöscht", konto: "Aktenkonto geändert", konto_loeschen: "Kontoposition gelöscht", dokumente_schema: "Dokumente umbenannt" };
  protokoll({ kategorie: "akte", aktion: ART[b.art] ?? b.art, akte: id, details: b.art === "beteiligter" ? `${b.rolle ?? ""} ${b.name ?? ""}`.trim() : b.art === "konto" ? `${b.position ?? ""}` : "" });
  return NextResponse.json(akteLaden(id));
}
