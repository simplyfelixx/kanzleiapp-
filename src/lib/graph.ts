// Microsoft 365 / Outlook über Microsoft Graph.
// Anmeldung per Gerätecode (kein Client-Geheimnis, keine Weiterleitungs-URL nötig):
// Die App zeigt einen Code, der Benutzer bestätigt ihn unter microsoft.com/devicelogin.
// Gespeichert wird nur das Refresh-Token, verschlüsselt. Abruf und Versand laufen über
// den MIME-Inhalt, damit dieselbe Verarbeitung wie bei .eml/IMAP greift.
import { db } from "./db";
import { emlLesen, entschluesseln, mailSpeichern, tabellenMail, verschluesseln } from "./mail";

const LOGIN = process.env.GRAPH_LOGIN_URL || "https://login.microsoftonline.com";
const API = process.env.GRAPH_URL || "https://graph.microsoft.com/v1.0";
const SCOPE = "offline_access User.Read Mail.Read Mail.Send";

export interface GraphKonto { clientId: string; tenant: string; aktiv: boolean; konto: string; verbunden: boolean }
type Roh = Omit<GraphKonto, "verbunden"> & { token?: string };

function tabelle() { db().exec("CREATE TABLE IF NOT EXISTS graph_konto (id INTEGER PRIMARY KEY CHECK (id=1), daten TEXT NOT NULL)"); }
function roh(): Roh {
  tabelle();
  const r = db().prepare("SELECT daten FROM graph_konto WHERE id=1").get() as { daten: string } | undefined;
  return { clientId: "", tenant: "organizations", aktiv: false, konto: "", ...(r ? JSON.parse(r.daten) : {}) };
}
function speichernRoh(k: Roh) {
  tabelle();
  db().prepare("INSERT INTO graph_konto (id,daten) VALUES (1,?) ON CONFLICT(id) DO UPDATE SET daten=excluded.daten").run(JSON.stringify(k));
}
export function graphLaden(): GraphKonto { const { token, ...k } = roh(); return { ...k, verbunden: !!token }; }
/** Ist Outlook gewählt? Dann laufen Abruf und Versand nur darüber – auch wenn die Anmeldung
 *  abgelaufen ist (dann Fehlermeldung statt stillem Wechsel auf IMAP/SMTP). */
export function graphAktiv() { return roh().aktiv; }

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TENANT = /^(organizations|common|consumers|[0-9a-f-]{36}|[a-z0-9-]+(\.[a-z0-9-]+)+)$/i;

export function graphSpeichern(b: Partial<GraphKonto>) {
  const alt = roh();
  const clientId = typeof b.clientId === "string" ? b.clientId.trim() : alt.clientId;
  const tenant = typeof b.tenant === "string" && b.tenant.trim() ? b.tenant.trim() : alt.tenant;
  if (clientId && !GUID.test(clientId)) throw new Error("Anwendungs-ID (Client-ID) hat nicht das richtige Format");
  if (!TENANT.test(tenant)) throw new Error("Mandant (Tenant) ungültig");
  // Andere App oder anderer Mandant → alte Anmeldung gilt nicht mehr
  const wechsel = clientId !== alt.clientId || tenant !== alt.tenant;
  const token = wechsel ? undefined : alt.token;
  if (b.aktiv === true && !token) throw new Error("Erst bei Microsoft anmelden");
  const aktiv = wechsel ? false : typeof b.aktiv === "boolean" ? b.aktiv : alt.aktiv;
  speichernRoh({ ...alt, clientId, tenant, aktiv, token, konto: wechsel ? "" : alt.konto });
  if (wechsel) zugriff = null;
  return graphLaden();
}
export function graphAbmelden() { const k = roh(); speichernRoh({ ...k, token: undefined, konto: "", aktiv: false }); zugriff = null; }

// ---- Anmeldung per Gerätecode ----
let geraet: { code: string; bis: number } | null = null;
let zugriff: { token: string; bis: number } | null = null;

async function formular(url: string, felder: Record<string, string>) {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(felder), signal: AbortSignal.timeout(20000) });
  return { ok: r.ok, j: await r.json().catch(() => ({})) as Record<string, string | number> };
}
const tokenUrl = (k: Roh) => `${LOGIN}/${encodeURIComponent(k.tenant)}/oauth2/v2.0/token`;

export async function anmeldungStarten() {
  const k = roh();
  if (!k.clientId) throw new Error("Erst die Anwendungs-ID eintragen und speichern");
  const { ok, j } = await formular(`${LOGIN}/${encodeURIComponent(k.tenant)}/oauth2/v2.0/devicecode`, { client_id: k.clientId, scope: SCOPE });
  if (!ok || !j.device_code) throw new Error(String(j.error_description || j.error || "Microsoft hat keinen Code geliefert"));
  geraet = { code: String(j.device_code), bis: Date.now() + Number(j.expires_in || 900) * 1000 };
  return { code: String(j.user_code), url: String(j.verification_uri || "https://microsoft.com/devicelogin"), intervall: Number(j.interval || 5) };
}

/** Fragt nach, ob der Code bestätigt wurde. */
export async function anmeldungPruefen(): Promise<{ status: "wartet" | "fertig" | "abgelaufen" | "fehler"; konto?: string; fehler?: string }> {
  if (!geraet || Date.now() > geraet.bis) { geraet = null; return { status: "abgelaufen" }; }
  const k = roh();
  const { ok, j } = await formular(tokenUrl(k), { grant_type: "urn:ietf:params:oauth:grant-type:device_code", client_id: k.clientId, device_code: geraet.code });
  if (!ok) {
    if (j.error === "authorization_pending" || j.error === "slow_down") return { status: "wartet" };
    geraet = null;
    if (j.error === "expired_token") return { status: "abgelaufen" };
    return { status: "fehler", fehler: String(j.error_description || j.error || "Anmeldung abgelehnt").split("\n")[0].slice(0, 300) };
  }
  geraet = null;
  tokenUebernehmen(k, j);
  const ich = await api("/me?$select=userPrincipalName,mail") as Record<string, unknown>;
  const konto = String(ich.mail || ich.userPrincipalName || "");
  speichernRoh({ ...roh(), konto });
  return { status: "fertig", konto };
}

function tokenUebernehmen(k: Roh, j: Record<string, string | number>) {
  if (!j.access_token) throw new Error("Kein Zugriffstoken erhalten");
  zugriff = { token: String(j.access_token), bis: Date.now() + (Number(j.expires_in || 3600) - 120) * 1000 };
  if (j.refresh_token) speichernRoh({ ...k, token: verschluesseln(String(j.refresh_token)) });
}

async function zugriffstoken(): Promise<string> {
  if (zugriff && Date.now() < zugriff.bis) return zugriff.token;
  const k = roh();
  if (!k.token) throw new Error("Nicht bei Microsoft angemeldet (Einstellungen → Outlook)");
  const { ok, j } = await formular(tokenUrl(k), { grant_type: "refresh_token", client_id: k.clientId, refresh_token: entschluesseln(k.token), scope: SCOPE });
  if (!ok) {
    // Abgelaufen oder widerrufen → neu anmelden
    if (j.error === "invalid_grant") speichernRoh({ ...k, token: undefined });
    throw new Error("Microsoft-Anmeldung abgelaufen – bitte unter Einstellungen neu anmelden");
  }
  tokenUebernehmen(k, j);
  return zugriff!.token;
}

async function api(pfad: string, o: { methode?: string; body?: string | Buffer; typ?: string; roh?: boolean } = {}) {
  const r = await fetch(API + pfad, {
    method: o.methode ?? "GET", body: o.body,
    headers: { Authorization: `Bearer ${await zugriffstoken()}`, ...(o.typ ? { "Content-Type": o.typ } : {}) },
    signal: AbortSignal.timeout(60000),
  });
  if (r.status === 429) throw new Error("Microsoft drosselt gerade – bitte gleich noch einmal");
  if (!r.ok) {
    const j = await r.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(`Microsoft Graph ${r.status}: ${j.error?.message?.slice(0, 200) || r.statusText}`);
  }
  if (o.roh) return Buffer.from(await r.arrayBuffer());
  return r.status === 202 || r.status === 204 ? {} : (await r.json() as Record<string, unknown>);
}

/** Neueste Mails aus dem Posteingang holen (nur lesen, nichts als gelesen markieren). */
export async function graphAbrufen(max = 25): Promise<{ neu: number; gesamt: number }> {
  tabellenMail();
  const liste = await api(`/me/mailFolders/inbox/messages?$top=${max}&$select=id,internetMessageId&$orderby=receivedDateTime desc`) as { value?: { id: string; internetMessageId?: string }[] };
  const schon = db().prepare("SELECT 1 FROM mails WHERE message_id=?");
  let neu = 0, gesamt = 0;
  for (const m of (liste.value ?? []).reverse()) {
    gesamt++;
    if (m.internetMessageId && schon.get(m.internetMessageId)) continue;
    const mime = await api(`/me/messages/${encodeURIComponent(m.id)}/$value`, { roh: true }) as Buffer;
    if ((await mailSpeichern(await emlLesen(mime), "outlook")).neu) neu++;
  }
  return { neu, gesamt };
}

/** Fertige MIME-Nachricht über das Outlook-Konto senden (landet in „Gesendete Elemente“). */
export async function graphSenden(mime: Buffer) {
  await api("/me/sendMail", { methode: "POST", body: mime.toString("base64"), typ: "text/plain" });
}
export function graphAbsender() { return roh().konto; }
/** Verbindung prüfen: liest nur das eigene Profil */
export async function graphTesten() { await api("/me?$select=id"); }
