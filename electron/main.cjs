// Windows-Anwendung „Kanzlei“: startet den eingebauten Server (Next.js, nur 127.0.0.1)
// und zeigt die App in einem eigenen Fenster. Daten liegen außerhalb des Programmordners.
const { app, BrowserWindow, shell, dialog, Menu } = require("electron");
const { fork } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const net = require("net");
const path = require("path");

if (!app.requestSingleInstanceLock()) { app.quit(); process.exit(0); }

// Datenordner: KANZLEI_DATEN, sonst %APPDATA%\Kanzlei\daten
const DATEN = process.env.KANZLEI_DATEN ? path.resolve(process.env.KANZLEI_DATEN) : path.join(app.getPath("userData"), "daten");
// Gepackt: resources/server. Zum Testen ungepackt: build/app → build/server
const SERVER = app.isPackaged ? path.join(process.resourcesPath, "server") : path.join(__dirname, "..", "server");
const LOG = path.join(DATEN, "server.log");

let server = null, fenster = null, adresse = "";

function geheimnis() {
  const datei = path.join(DATEN, ".geheim");
  if (!fs.existsSync(datei)) fs.writeFileSync(datei, crypto.randomBytes(32).toString("hex"), { mode: 0o600 });
  return fs.readFileSync(datei, "utf8").trim();
}

function freierPort() {
  return new Promise((ok, fehler) => {
    const s = net.createServer().once("error", fehler).listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => ok(p)); });
  });
}

async function bereit(url) {
  for (let i = 0; i < 120; i++) {
    if (!server || server.exitCode !== null) throw new Error("Server beendet – siehe " + LOG);
    try { const r = await fetch(url + "/api/auth/login", { signal: AbortSignal.timeout(1500) }); if (r.status < 500) return; } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("Server antwortet nicht – siehe " + LOG);
}

async function serverStarten() {
  fs.mkdirSync(DATEN, { recursive: true });
  const port = await freierPort();
  const log = fs.openSync(LOG, "a");
  fs.writeSync(log, `\n[${new Date().toISOString()}] Start, Port ${port}, Daten ${DATEN}\n`);
  // Läuft mit dem Node von Electron (ELECTRON_RUN_AS_NODE), native Module sind dafür gebaut
  server = fork(path.join(SERVER, "start.cjs"), [], {
    cwd: SERVER, stdio: ["ignore", log, log, "ipc"], windowsHide: true,
    env: {
      ...process.env, ELECTRON_RUN_AS_NODE: "1", NODE_ENV: "production",
      PORT: String(port), HOSTNAME: "127.0.0.1", AUTH_HTTP: "1",
      KANZLEI_DATEN: DATEN, AUTH_SECRET: process.env.AUTH_SECRET || geheimnis(),
    },
  });
  adresse = `http://127.0.0.1:${port}`;
  await bereit(adresse);
}

function istApp(url) { try { return new URL(url).origin === adresse; } catch { return false; } }

function fensterOeffnen() {
  fenster = new BrowserWindow({
    width: 1500, height: 950, minWidth: 1100, minHeight: 700, title: "Kanzlei", show: false,
    icon: path.join(__dirname, "kanzlei.ico"), backgroundColor: "#f6f7f8",
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: true, plugins: true },
  });
  fenster.webContents.session.setSpellCheckerLanguages(["de-DE"]);
  // Links: eigene Seiten (z. B. PDFs) in neuem App-Fenster, alles andere im normalen Browser
  fenster.webContents.setWindowOpenHandler(({ url }) => {
    if (istApp(url) || url.startsWith("blob:" + adresse)) return { action: "allow", overrideBrowserWindowOptions: { width: 1100, height: 900, autoHideMenuBar: true, webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, plugins: true } } };
    if (/^https:\/\//.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  fenster.webContents.on("will-navigate", (e, url) => { if (!istApp(url)) { e.preventDefault(); if (/^https:\/\//.test(url)) shell.openExternal(url); } });
  fenster.once("ready-to-show", () => fenster.show());
  fenster.on("closed", () => { fenster = null; });
  fenster.loadURL(adresse);
}

app.on("second-instance", () => { if (fenster) { if (fenster.isMinimized()) fenster.restore(); fenster.focus(); } });
app.on("window-all-closed", () => app.quit());
app.on("before-quit", () => { if (server && server.exitCode === null) server.kill(); });

app.whenReady().then(async () => {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: "Datei", submenu: [
      { label: "Datenordner öffnen", click: () => shell.openPath(DATEN) },
      { type: "separator" }, { role: "quit", label: "Beenden" },
    ] },
    { label: "Bearbeiten", submenu: [{ role: "undo", label: "Rückgängig" }, { role: "redo", label: "Wiederholen" }, { type: "separator" }, { role: "cut", label: "Ausschneiden" }, { role: "copy", label: "Kopieren" }, { role: "paste", label: "Einfügen" }, { role: "selectAll", label: "Alles markieren" }] },
    { label: "Ansicht", submenu: [{ role: "reload", label: "Neu laden" }, { role: "zoomIn", label: "Größer" }, { role: "zoomOut", label: "Kleiner" }, { role: "resetZoom", label: "Normalgröße" }, { role: "togglefullscreen", label: "Vollbild" }] },
  ]));
  try {
    await serverStarten();
    fensterOeffnen();
  } catch (x) {
    dialog.showErrorBox("Kanzlei", `Die App konnte nicht starten.\n\n${x.message}`);
    app.quit();
  }
});
