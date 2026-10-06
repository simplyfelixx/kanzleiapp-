// Startet die Kanzlei-App wie ein Programm: Server im Hintergrund (falls nicht schon läuft),
// dann eigenes App-Fenster (Microsoft Edge im App-Modus, sonst Standardbrowser).
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ORDNER = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = process.env.KANZLEI_PORT || "3000";
const URL_ = `http://localhost:${PORT}`;
const LOG = path.join(ORDNER, "daten", "server.log");

async function laeuft() {
  try { const r = await fetch(URL_ + "/api/auth/login", { signal: AbortSignal.timeout(1500) }); return r.ok; } catch { return false; }
}

async function serverStarten() {
  if (!fs.existsSync(path.join(ORDNER, ".next", "BUILD_ID"))) throw new Error("App ist noch nicht gebaut – bitte zuerst „npm run desktop“ ausführen.");
  fs.mkdirSync(path.dirname(LOG), { recursive: true });
  const out = fs.openSync(LOG, "a");
  const next = path.join(ORDNER, "node_modules", "next", "dist", "bin", "next");
  const p = spawn(process.execPath, [next, "start", "-p", PORT, "-H", "127.0.0.1"], {
    cwd: ORDNER, detached: true, windowsHide: true, stdio: ["ignore", out, out],
    env: { ...process.env, NODE_ENV: "production", AUTH_HTTP: "1" },
  });
  p.unref();
  for (let i = 0; i < 60; i++) { if (await laeuft()) return; await new Promise((r) => setTimeout(r, 1000)); }
  throw new Error("Server startet nicht – siehe daten/server.log");
}

function fensterOeffnen() {
  if (process.platform === "win32") {
    const kandidaten = [
      path.join(process.env["ProgramFiles(x86)"] ?? "", "Microsoft", "Edge", "Application", "msedge.exe"),
      path.join(process.env.ProgramFiles ?? "", "Microsoft", "Edge", "Application", "msedge.exe"),
    ];
    const edge = kandidaten.find((k) => k && fs.existsSync(k));
    if (edge) {
      // Eigenes Profil, damit das Fenster unabhängig vom normalen Browser ist
      const profil = path.join(ORDNER, "daten", "fenster-profil");
      spawn(edge, [`--app=${URL_}`, `--user-data-dir=${profil}`, "--window-size=1500,950", "--no-first-run"], { detached: true, stdio: "ignore" }).on("error", () => {}).unref();
      return;
    }
    spawn("cmd", ["/c", "start", "", URL_], { detached: true, stdio: "ignore", windowsHide: true }).on("error", () => {}).unref();
  } else {
    spawn(process.platform === "darwin" ? "open" : "xdg-open", [URL_], { detached: true, stdio: "ignore" }).on("error", () => {}).unref();
  }
}

try {
  if (!(await laeuft())) await serverStarten();
  fensterOeffnen();
} catch (x) {
  fs.mkdirSync(path.dirname(LOG), { recursive: true });
  fs.appendFileSync(LOG, `[${new Date().toISOString()}] Start fehlgeschlagen: ${x.message}\n`);
  if (process.platform === "win32") spawn("msg", ["*", `Kanzlei: ${x.message}`], { detached: true, stdio: "ignore" }).on("error", () => {}).unref();
  console.error(x.message);
  process.exitCode = 1;
}
