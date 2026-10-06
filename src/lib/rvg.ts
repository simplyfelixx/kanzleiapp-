// Gebühren nach RVG § 13 Abs. 1.
// "2025": Fassung KostBRÄG 2025, Aufträge ab 01.06.2025. "2021": KostRÄG 2021, Aufträge 01.01.2021–31.05.2025 (§ 60 RVG).

export type Tabelle = "2025" | "2021";
type Staffel = [bis: number, schritt: number, plus: number][];

const STAFFEL_2025: Staffel = [
  [2_000, 500, 41.5],
  [10_000, 1_000, 59.5],
  [25_000, 3_000, 55],
  [50_000, 5_000, 86],
  [200_000, 15_000, 99.5],
  [500_000, 30_000, 140],
  [Infinity, 50_000, 175],
];
const STAFFEL_2021: Staffel = [
  [2_000, 500, 39],
  [10_000, 1_000, 56],
  [25_000, 3_000, 52],
  [50_000, 5_000, 81],
  [200_000, 15_000, 94],
  [500_000, 30_000, 132],
  [Infinity, 50_000, 165],
];
const TABELLEN: Record<Tabelle, { basis: number; staffel: Staffel }> = {
  "2025": { basis: 51.5, staffel: STAFFEL_2025 },
  "2021": { basis: 49, staffel: STAFFEL_2021 },
};

/** Maßgebliche Tabelle nach Datum der Auftragserteilung (JJJJ-MM-TT) */
export function tabelleFuer(auftrag: string): Tabelle {
  return auftrag && auftrag.slice(0, 10) < "2025-06-01" ? "2021" : "2025";
}
export const TABELLE_NAME: Record<Tabelle, string> = { "2025": "ab 01.06.2025", "2021": "bis 31.05.2025" };

/** Volle Gebühr (1,0) für einen Gegenstandswert */
export function gebuehr(wert: number, tabelle: Tabelle = "2025"): number {
  const t = TABELLEN[tabelle];
  let g = t.basis, unten = 500;
  if (wert <= 500) return g;
  for (const [bis, schritt, plus] of t.staffel) {
    const oben = Math.min(wert, bis);
    if (oben > unten) g += Math.ceil((oben - unten) / schritt) * plus;
    if (wert <= bis) break;
    unten = bis;
  }
  return Math.round(g * 100) / 100;
}

export const VV: Record<string, { name: string; faktor: number; min: number; max: number }> = {
  "2300": { name: "Geschäftsgebühr", faktor: 1.3, min: 0.5, max: 2.5 },
  "1000": { name: "Einigungsgebühr", faktor: 1.5, min: 1.5, max: 1.5 },
  "1008": { name: "Erhöhung mehrere Auftraggeber", faktor: 0.3, min: 0.3, max: 2.0 },
};

export interface Posten { vv: string; faktor: number }
export interface Kostennote {
  wert: number; voll: number; tabelle: Tabelle;
  zeilen: { text: string; betrag: number }[];
  netto: number; ust: number; ustSatz: number; brutto: number;
}
const r2 = (n: number) => Math.round(n * 100) / 100;
const fx = (f: number) => f.toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 2 });

/** abzug: bereits berechnete Nettobeträge (Nachliquidation) */
export function kostennote(wert: number, posten: Posten[], o: { auslagen?: boolean; ustSatz?: number; tabelle?: Tabelle; abzug?: { text: string; betrag: number }[] } = {}): Kostennote {
  const tabelle = o.tabelle ?? "2025";
  const voll = gebuehr(wert, tabelle);
  const zeilen: Kostennote["zeilen"] = [];
  let gebSumme = 0;
  for (const p of posten) {
    const v = VV[p.vv]; if (!v) continue;
    const f = Math.min(v.max, Math.max(v.min, p.faktor));
    const b = r2(Math.max(15, voll * f));
    zeilen.push({ text: `${fx(f)} ${v.name} Nr. ${p.vv} VV RVG`, betrag: b });
    gebSumme += b;
  }
  if (o.auslagen !== false) {
    const pausch = r2(Math.min(20, gebSumme * 0.2));
    zeilen.push({ text: "Pauschale Post und Telekommunikation Nr. 7002 VV RVG", betrag: pausch });
  }
  for (const a of o.abzug ?? []) zeilen.push({ text: a.text, betrag: -r2(a.betrag) });
  const netto = r2(zeilen.reduce((s, z) => s + z.betrag, 0));
  const ustSatz = o.ustSatz ?? 19;
  const ust = r2(netto * ustSatz / 100);
  return { wert, voll, tabelle, zeilen, netto, ust, ustSatz, brutto: r2(netto + ust) };
}
