// Text aus Dateien holen: PDF-Text direkt, sonst (Scan/Foto) per lokaler Texterkennung.
import { KiFehler, kiBildText, kiLaden } from "./ki";

export interface DateiText { text: string; quelle: "pdf" | "ocr" | "txt" | "keiner"; seiten?: number; hinweis?: string }

const MAX_OCR_SEITEN = 4;

async function pdfDirekt(buf: Buffer): Promise<{ text: string; seiten: number }> {
  try {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(buf));
    const { text, totalPages } = await extractText(pdf, { mergePages: true });
    return { text: (Array.isArray(text) ? text.join(" ") : text).trim(), seiten: totalPages };
  } catch { return { text: "", seiten: 0 }; }
}

// Seiten selbst rendern: pdf.js bekommt eine Leinwand-Fabrik auf Basis von @napi-rs/canvas
// (vorkompiliert, läuft auch unter Windows ohne Build-Werkzeuge).
async function pdfSeitenBilder(buf: Buffer, anzahl: number): Promise<Buffer[]> {
  const { createCanvas } = await import("@napi-rs/canvas");
  type Lw = { width: number; height: number; getContext: (t: "2d") => unknown; toBuffer: (m: "image/png") => Buffer };
  type CC = { canvas: Lw; context: unknown };
  class Fabrik {
    create(w: number, h: number): CC { const c = createCanvas(Math.max(1, Math.ceil(w)), Math.max(1, Math.ceil(h))) as unknown as Lw; return { canvas: c, context: c.getContext("2d") }; }
    reset(cc: CC, w: number, h: number) { cc.canvas.width = Math.ceil(w); cc.canvas.height = Math.ceil(h); }
    destroy(cc: CC) { cc.canvas.width = 0; cc.canvas.height = 0; }
  }
  const { getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(buf), { canvasFactory: new Fabrik() } as never);
  const bilder: Buffer[] = [];
  for (let i = 1; i <= Math.min(anzahl, pdf.numPages); i++) {
    const seite = await pdf.getPage(i);
    // Skala 2 ≈ 150 dpi: gut lesbar für das Modell, nicht zu groß
    const vp = seite.getViewport({ scale: 2 });
    const f = new Fabrik(), cc = f.create(vp.width, vp.height);
    const ctx = cc.context as { fillStyle: string; fillRect: (...a: number[]) => void };
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, vp.width, vp.height);
    await seite.render({ canvasContext: cc.context as never, viewport: vp, canvasFactory: f } as never).promise;
    bilder.push(cc.canvas.toBuffer("image/png"));
    f.destroy(cc);
  }
  return bilder;
}

/** Liefert den lesbaren Text einer Datei. OCR nur, wenn eingeschaltet und das PDF keinen Text enthält. */
export async function dateiText(buf: Buffer, endung: string, o: { signal?: AbortSignal } = {}): Promise<DateiText> {
  const e = endung.toLowerCase();
  if (e === ".txt") return { text: buf.toString("utf8"), quelle: "txt" };
  const ki = kiLaden();
  const ocrAn = ki.aktiv && ki.ocr;

  if (e === ".pdf") {
    const d = await pdfDirekt(buf);
    // Genug echter Text? Dann kein OCR nötig (ca. 40 Zeichen pro Seite als Schwelle)
    if (d.text.replace(/\s/g, "").length >= Math.max(40, d.seiten * 40)) return { text: d.text, quelle: "pdf", seiten: d.seiten };
    if (!ocrAn) return { text: d.text, quelle: d.text ? "pdf" : "keiner", seiten: d.seiten, hinweis: "Gescanntes PDF – Texterkennung in den Einstellungen einschalten" };
    try {
      const bilder = await pdfSeitenBilder(buf, MAX_OCR_SEITEN);
      const teile: string[] = [];
      for (const b of bilder) teile.push(await kiBildText(b, o));
      const hinweis = d.seiten > MAX_OCR_SEITEN ? `Texterkennung nur für die ersten ${MAX_OCR_SEITEN} von ${d.seiten} Seiten` : undefined;
      return { text: teile.join("\n\n"), quelle: "ocr", seiten: d.seiten, hinweis };
    } catch (x) {
      console.error("Texterkennung:", x);
      return { text: d.text, quelle: "keiner", seiten: d.seiten, hinweis: x instanceof KiFehler ? x.message : "Texterkennung fehlgeschlagen" };
    }
  }

  if ([".png", ".jpg", ".jpeg"].includes(e)) {
    if (!ocrAn) return { text: "", quelle: "keiner", hinweis: "Bild – Texterkennung in den Einstellungen einschalten" };
    try { return { text: await kiBildText(buf, o), quelle: "ocr", seiten: 1 }; }
    catch (x) { return { text: "", quelle: "keiner", hinweis: x instanceof KiFehler ? x.message : "Texterkennung fehlgeschlagen" }; }
  }
  return { text: "", quelle: "keiner" };
}
