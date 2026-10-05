import { wer } from "@/lib/auth";
import { NextResponse } from "next/server";
import { aktenIndex, dateiSpeichern, db, verlaufEintrag, Wirkung } from "@/lib/db";
import { erkenneDokument, schemaName } from "@/lib/dokerkennung";
import { kiLaden } from "@/lib/ki";
import { kiDokument } from "@/lib/kiauswertung";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ERLAUBT = /\.(pdf|jpe?g|png|heic|txt)$/i;
const MAX = 25 * 1024 * 1024;

async function pdfText(buf: Buffer): Promise<string> {
  try {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(buf));
    const { text } = await extractText(pdf, { mergePages: true });
    return Array.isArray(text) ? text.join(" ") : text;
  } catch {
    return "";
  }
}

const KONTO_POS: Record<string, string> = { Reparaturrechnung: "Reparatur", Mietwagenrechnung: "Mietwagen", Gutachterrechnung: "Gutachterkosten", Abschleppkostenrechnung: "Abschleppkosten" };

/**
 * Datei hochladen. FormData: datei (eine oder mehrere), akteId (optional: direkt in diese Akte ablegen).
 * Ohne akteId landet das Dokument im Eingang mit Erkennung zum Bestätigen.
 */
export async function POST(req: Request) {
  const form = await req.formData();
  const dateien = form.getAll("datei").filter((x): x is File => typeof x !== "string");
  const zielAkte = String(form.get("akteId") ?? "") || null;
  if (!dateien.length) return NextResponse.json({ fehler: "Keine Datei" }, { status: 400 });
  const d = db();
  const index = aktenIndex();
  const ergebnis: { id: number; name: string; ziel: string }[] = [];
  const kiAn = kiLaden().aktiv;
  const namen = kiAn ? Array.from(new Set(index.flatMap((a) => a.namen))) : [];

  for (const f of dateien) {
    if (!ERLAUBT.test(f.name)) return NextResponse.json({ fehler: `${f.name}: nur PDF, Bilder oder TXT` }, { status: 400 });
    if (f.size > MAX) return NextResponse.json({ fehler: `${f.name}: größer als 25 MB` }, { status: 400 });
    const buf = Buffer.from(await f.arrayBuffer());
    const endung = (f.name.match(/\.\w+$/)?.[0] ?? ".pdf").toLowerCase();
    if (endung === ".pdf" && buf.subarray(0, 4).toString() !== "%PDF") return NextResponse.json({ fehler: `${f.name}: keine gültige PDF-Datei` }, { status: 400 });
    const text = endung === ".pdf" ? await pdfText(buf) : endung === ".txt" ? buf.toString("utf8") : "";
    const e = erkenneDokument(text, f.name, index);
    // KI (lokal, pseudonymisiert) verfeinert Typ, Absender und Zusammenfassung; Beträge/Fristen bleiben regelbasiert
    let kiText = "";
    if (kiAn && text) {
      const k = await kiDokument(text, namen).catch(() => null);
      if (k) {
        if (k.typ !== "Sonstiges" || e.typ === "Sonstiges") e.typ = k.typ;
        if (k.absender) e.absender = k.absender;
        e.dateiname = schemaName(e.datum, e.typ, e.absender, endung);
        kiText = k.zusammenfassung;
      }
    }
    const datei = dateiSpeichern(buf, endung);

    if (zielAkte) {
      if (!d.prepare("SELECT 1 FROM akten WHERE id=?").get(zielAkte)) return NextResponse.json({ fehler: "Akte unbekannt" }, { status: 400 });
      const r = d.prepare("INSERT INTO dokumente (akte_id,richtung,name,typ,absender,datum,datei,groesse) VALUES (?,?,?,?,?,?,?,?)")
        .run(zielAkte, "ein", e.dateiname, e.typ, e.absender, e.datum, datei, buf.length);
      verlaufEintrag(zielAkte, `Dokument abgelegt: ${e.dateiname}`, wer());
      ergebnis.push({ id: Number(r.lastInsertRowid), name: e.dateiname, ziel: zielAkte });
      continue;
    }

    const wirkung: Wirkung = { verlauf: `${e.typ} von ${e.absender} eingegangen` };
    const summe = e.betraege.find((b) => /gesamt|summe|endbetrag/i.test(b.label)) ?? e.betraege[e.betraege.length - 1];
    if (KONTO_POS[e.typ] && summe) wirkung.konto = [{ position: KONTO_POS[e.typ], gefordert: summe.wert }];
    if (e.typ === "Abrechnungsschreiben") wirkung.wv = { tage: 7, titel: "Abrechnung prüfen – Kürzungen nachfordern?" };
    if (e.frist) wirkung.frist = { tage: Math.max(1, Math.round((new Date(e.frist.datum).getTime() - Date.now()) / 864e5)), titel: `Frist aus ${e.typ}: ${e.frist.text.slice(0, 80)}` };

    const folge = [
      wirkung.konto ? `Aktenkonto: ${wirkung.konto[0].position} ${summe!.wert.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €` : "",
      wirkung.wv ? `Wiedervorlage: ${wirkung.wv.titel}` : "",
      wirkung.frist ? `Frist vormerken (bis ${e.frist!.datum.split("-").reverse().join(".")}) – bitte bestätigen` : "",
      `Ablage als ${e.dateiname}`,
    ].filter(Boolean);
    const felder = [
      ...e.betraege.map((b) => ({ label: b.label, wert: b.wert.toLocaleString("de-DE", { minimumFractionDigits: 2 }) + " €", quelle: "Text im Dokument" })),
      ...(e.zeichen ? [{ label: "Zeichen", wert: e.zeichen, quelle: "Text im Dokument" }] : []),
      ...(e.akteGrund ? [{ label: "Zuordnung", wert: e.akteGrund, quelle: "Abgleich mit Beteiligten" }] : []),
      ...(kiText ? [{ label: "Inhalt", wert: kiText, quelle: "KI (lokal) – bitte gegenlesen" }] : []),
    ];
    const zeit = new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
    const r = d.prepare(`INSERT INTO eingang (quelle,zeit,typ,absender,akte_id,sicher,erkannt,dateiname,felder,folgeaktionen,vorschau,wirkung,datei,datum)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      "UPLOAD", zeit, e.typ, e.absender, e.akteId, e.sicher ? 1 : 0,
      e.zusammenfassung + (!e.sicher && e.kandidaten.length > 1 ? ` · Mögliche Akten: ${e.kandidaten.join(", ")}` : ""),
      e.dateiname, JSON.stringify(felder), JSON.stringify(folge), text.slice(0, 4000), JSON.stringify(wirkung), datei, e.datum);
    ergebnis.push({ id: Number(r.lastInsertRowid), name: e.dateiname, ziel: e.akteId ?? "unklar" });
  }
  return NextResponse.json({ dateien: ergebnis });
}
