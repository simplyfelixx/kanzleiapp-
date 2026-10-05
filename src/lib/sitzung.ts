// Signierte Sitzung im Cookie (HMAC-SHA256). Läuft auch in der Middleware (Edge), daher nur Web Crypto.
export type Rolle = "admin" | "anwalt" | "refa";
export const ROLLEN: { key: Rolle; label: string }[] = [
  { key: "admin", label: "Admin" },
  { key: "anwalt", label: "Anwalt" },
  { key: "refa", label: "ReFa" },
];
export interface Sitzung { u: number; k: string; r: Rolle; e: number } // Benutzer-ID, Kürzel, Rolle, Ablauf (ms)
export const COOKIE = "kz_sitzung";
export const DAUER_MS = 12 * 60 * 60 * 1000;

const enc = new TextEncoder();
const b64 = (b: ArrayBuffer | Uint8Array) => {
  const a = b instanceof Uint8Array ? b : new Uint8Array(b);
  let s = ""; for (const x of a) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const unb64 = (s: string) => {
  const t = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(t, (c) => c.charCodeAt(0));
};
async function schluessel() {
  const g = process.env.AUTH_SECRET;
  if (!g || g.length < 32) throw new Error("AUTH_SECRET fehlt");
  return crypto.subtle.importKey("raw", enc.encode(g), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}
export async function signieren(s: Sitzung): Promise<string> {
  const daten = b64(enc.encode(JSON.stringify(s)));
  const sig = await crypto.subtle.sign("HMAC", await schluessel(), enc.encode(daten));
  return daten + "." + b64(sig);
}
export async function pruefen(token: string | undefined): Promise<Sitzung | null> {
  if (!token) return null;
  const [daten, sig] = token.split(".");
  if (!daten || !sig) return null;
  try {
    const ok = await crypto.subtle.verify("HMAC", await schluessel(), unb64(sig), enc.encode(daten));
    if (!ok) return null;
    const s = JSON.parse(new TextDecoder().decode(unb64(daten))) as Sitzung;
    if (typeof s.e !== "number" || s.e < Date.now()) return null;
    if (!ROLLEN.some((r) => r.key === s.r)) return null;
    return s;
  } catch { return null; }
}
