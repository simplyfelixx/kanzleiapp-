// Lokale KI über Ollama (https://ollama.com). Es werden nur Adressen im lokalen Netz akzeptiert (§ 203 StGB).
import { db } from "./db";

export interface KiEinstellungen { aktiv: boolean; url: string; modell: string }
const STANDARD: KiEinstellungen = { aktiv: false, url: "http://127.0.0.1:11434", modell: "qwen2.5:7b" };

function tabelle() {
  db().exec("CREATE TABLE IF NOT EXISTS ki (id INTEGER PRIMARY KEY CHECK (id=1), daten TEXT NOT NULL)");
}
export function kiLaden(): KiEinstellungen {
  tabelle();
  const r = db().prepare("SELECT daten FROM ki WHERE id=1").get() as { daten: string } | undefined;
  return { ...STANDARD, ...(r ? JSON.parse(r.daten) : {}) };
}
export function kiSpeichern(e: KiEinstellungen) {
  tabelle();
  db().prepare("INSERT INTO ki (id,daten) VALUES (1,?) ON CONFLICT(id) DO UPDATE SET daten=excluded.daten").run(JSON.stringify(e));
}

/** Nur localhost oder private Netze (10/8, 172.16/12, 192.168/16) – keine Daten ins Internet. */
export function lokaleUrl(u: string): boolean {
  try {
    const url = new URL(u);
    if (!/^https?:$/.test(url.protocol) || url.username || url.password) return false;
    const h = url.hostname.replace(/^\[|\]$/g, "");
    if (h === "localhost" || h === "::1" || /^127\./.test(h)) return true;
    if (/^10\./.test(h) || /^192\.168\./.test(h)) return true;
    const m = h.match(/^172\.(\d+)\./);
    return !!m && +m[1] >= 16 && +m[1] <= 31;
  } catch { return false; }
}

export class KiFehler extends Error {}

function basis(e: KiEinstellungen) {
  if (!lokaleUrl(e.url)) throw new KiFehler("KI-Adresse ist nicht lokal");
  return e.url.replace(/\/+$/, "");
}

export async function kiStatus(e = kiLaden()): Promise<{ ok: boolean; modelle: string[]; fehler?: string }> {
  try {
    const r = await fetch(basis(e) + "/api/tags", { signal: AbortSignal.timeout(4000), cache: "no-store" });
    if (!r.ok) return { ok: false, modelle: [], fehler: `Ollama antwortet mit ${r.status}` };
    const j = (await r.json()) as { models?: { name: string }[] };
    const modelle = (j.models ?? []).map((m) => m.name);
    if (!modelle.includes(e.modell)) return { ok: false, modelle, fehler: `Modell ${e.modell} nicht installiert (ollama pull ${e.modell})` };
    return { ok: true, modelle };
  } catch (x) {
    return { ok: false, modelle: [], fehler: x instanceof KiFehler ? x.message : "Ollama nicht erreichbar – läuft es?" };
  }
}

export interface KiOptionen {
  signal?: AbortSignal;
  /** wird bei jedem Stück der Antwort aufgerufen: bisheriger Text, Anzahl Tokens */
  beiToken?: (bisher: string, tokens: number) => void;
}

/** Fragt das Modell und erzwingt eine JSON-Antwort nach Schema. Antwort wird gestreamt, Abbruch über signal. */
export async function kiJson<T>(system: string, eingabe: string, schema: object, o: KiOptionen = {}, e = kiLaden()): Promise<T> {
  if (!e.aktiv) throw new KiFehler("KI ist ausgeschaltet");
  const zeit = AbortSignal.timeout(300_000);
  const signal = o.signal ? AbortSignal.any([o.signal, zeit]) : zeit;
  let r: Response;
  try {
    r = await fetch(basis(e) + "/api/chat", {
      method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store", signal,
      body: JSON.stringify({
        model: e.modell, stream: true, format: schema,
        options: { temperature: 0, num_ctx: 8192 },
        messages: [{ role: "system", content: system }, { role: "user", content: eingabe }],
      }),
    });
  } catch (x) {
    throw fehlerText(x, o.signal);
  }
  if (!r.ok || !r.body) throw new KiFehler(`Ollama: ${(await r.text()).slice(0, 200)}`);
  const leser = r.body.getReader(), dec = new TextDecoder();
  let puffer = "", text = "", tokens = 0;
  try {
    for (;;) {
      const { done, value } = await leser.read();
      if (done) break;
      puffer += dec.decode(value, { stream: true });
      let nl: number;
      while ((nl = puffer.indexOf("\n")) >= 0) {
        const zeile = puffer.slice(0, nl).trim(); puffer = puffer.slice(nl + 1);
        if (!zeile) continue;
        const j = JSON.parse(zeile) as { message?: { content?: string }; error?: string };
        if (j.error) throw new KiFehler(`Ollama: ${j.error}`);
        if (j.message?.content) { text += j.message.content; tokens++; o.beiToken?.(text, tokens); }
      }
    }
  } catch (x) {
    leser.cancel().catch(() => {});
    if (x instanceof KiFehler) throw x;
    throw fehlerText(x, o.signal);
  }
  try { return JSON.parse(text) as T; }
  catch { throw new KiFehler("KI-Antwort war kein gültiges JSON"); }
}

function fehlerText(x: unknown, nutzer?: AbortSignal) {
  if (nutzer?.aborted) return new KiFehler("abgebrochen");
  if (x instanceof KiFehler) return x;
  const n = (x as Error)?.name;
  if (n === "TimeoutError" || n === "AbortError") return new KiFehler("KI hat zu lange gebraucht");
  return new KiFehler("Ollama nicht erreichbar");
}
