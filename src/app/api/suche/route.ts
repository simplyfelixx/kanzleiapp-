// Globale Suche (F2): Akten, Beteiligte, Dokumente, Mails, Adressbuch.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { kontakteListe } from "@/lib/kontakte";
import { mailListe } from "@/lib/mail";

export const dynamic = "force-dynamic";
type Treffer = { art: string; titel: string; info: string; link: string };

export function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 80);
  if (q.length < 2) return NextResponse.json([]);
  kontakteListe(); mailListe(); // Tabellen sicherstellen
  const d = db(), like = `%${q}%`, ohneLeer = q.replace(/\s/g, "");
  const akte = (id: string) => `/akte/${encodeURIComponent(id)}`;
  const t: Treffer[] = [];

  for (const a of d.prepare(`SELECT a.id, a.titel, a.phase FROM akten a WHERE a.id LIKE ? OR a.titel LIKE ? OR a.worum LIKE ? ORDER BY a.angelegt DESC LIMIT 8`).all(like, like, like) as { id: string; titel: string; phase: string }[])
    t.push({ art: "Akte", titel: `${a.id} ${a.titel}`, info: a.phase, link: akte(a.id) });

  for (const b of d.prepare(`SELECT b.akte_id, b.rolle, b.name, b.zeichen, b.telefon, a.titel FROM beteiligte b JOIN akten a ON a.id=b.akte_id
      WHERE b.name LIKE ? OR replace(b.zeichen,' ','') LIKE ? OR replace(b.telefon,' ','') LIKE ? OR b.email LIKE ? LIMIT 10`).all(like, `%${ohneLeer}%`, `%${ohneLeer}%`, like) as { akte_id: string; rolle: string; name: string; zeichen: string; telefon: string; titel: string }[])
    t.push({ art: b.rolle, titel: b.name || b.zeichen, info: `${b.akte_id} ${b.titel}${b.zeichen ? " · " + b.zeichen : ""}`, link: akte(b.akte_id) });

  for (const x of d.prepare(`SELECT akte_id, name, typ, absender, datum FROM dokumente WHERE name LIKE ? OR typ LIKE ? OR absender LIKE ? ORDER BY datum DESC LIMIT 8`).all(like, like, like) as { akte_id: string; name: string; typ: string; absender: string; datum: string }[])
    t.push({ art: "Dokument", titel: x.name, info: `${x.akte_id} · ${x.typ}${x.absender ? " von " + x.absender : ""}`, link: akte(x.akte_id) });

  for (const m of d.prepare(`SELECT id, betreff, von_name, von, datum FROM mails WHERE betreff LIKE ? OR von LIKE ? OR von_name LIKE ? ORDER BY datum DESC LIMIT 6`).all(like, like, like) as { id: number; betreff: string; von_name: string; von: string; datum: string }[])
    t.push({ art: "Mail", titel: m.betreff, info: `${m.von_name || m.von} · ${m.datum.slice(0, 10).split("-").reverse().join(".")}`, link: `/mail?id=${m.id}` });

  for (const k of kontakteListe(undefined, q).slice(0, 6))
    t.push({ art: "Adressbuch", titel: k.name, info: `${k.art}${k.plz_ort ? " · " + k.plz_ort : ""}`, link: `/adressbuch?id=${k.id}` });

  // Doppelte Ziele (z. B. Akte und deren Mandant) nur einmal pro Titel
  const seen = new Set<string>();
  return NextResponse.json(t.filter((x) => { const k = x.art + x.titel + x.link; if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 30));
}
