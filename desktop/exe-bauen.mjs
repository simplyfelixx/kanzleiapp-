// Baut die Windows-Anwendung (Installer „Kanzlei-Setup-x.y.z.exe“ in dist/).
// Auf dem Windows-PC ausführen: npm run exe
// Ablauf: Next.js bauen → eigenständigen Server nach build/server kopieren →
// better-sqlite3 für Electron einsetzen → Electron-Hülle (build/app) packen.
// Kanzleidaten (daten/) werden NIE mitgenommen – das wird am Ende geprüft.
import { execSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BUILD = path.join(WURZEL, "build");
const nurOrdner = process.argv.includes("--nur-ordner"); // ohne Installer (zum Testen)
const plattform = process.argv.includes("--linux") ? "linux" : "win";
const pkg = JSON.parse(fs.readFileSync(path.join(WURZEL, "package.json"), "utf8"));
const electronVersion = JSON.parse(fs.readFileSync(path.join(WURZEL, "node_modules", "electron", "package.json"), "utf8")).version;
const sqliteVersion = JSON.parse(fs.readFileSync(path.join(WURZEL, "node_modules", "better-sqlite3", "package.json"), "utf8")).version;

const lauf = (cmd, o = {}) => { console.log("› " + cmd); execSync(cmd, { stdio: "inherit", cwd: WURZEL, ...o }); };
const schritt = (t) => console.log(`\n== ${t} ==`);

schritt("1/5 App bauen");
lauf("npm run build", { env: { ...process.env, KANZLEI_STANDALONE: "1" } });
if (!fs.existsSync(path.join(WURZEL, ".next", "standalone", "server.js"))) throw new Error("Eigenständiger Server wurde nicht erzeugt");

schritt("2/5 Server zusammenstellen");
fs.rmSync(BUILD, { recursive: true, force: true });
const server = path.join(BUILD, "server");
fs.cpSync(path.join(WURZEL, ".next", "standalone"), server, { recursive: true });
fs.cpSync(path.join(WURZEL, ".next", "static"), path.join(server, ".next", "static"), { recursive: true });
// Startdatei: beendet den Server, sobald das App-Fenster (Elternprozess) weg ist – auch bei hartem Abbruch
fs.writeFileSync(path.join(server, "start.cjs"), 'process.on("disconnect", () => process.exit(0));\nrequire("./server.js");\n');
if (fs.existsSync(path.join(WURZEL, "public"))) fs.cpSync(path.join(WURZEL, "public"), path.join(server, "public"), { recursive: true });

schritt(`3/5 better-sqlite3 ${sqliteVersion} für Electron ${electronVersion}`);
// Vorgefertigtes Modul für Electron holen (kein Compiler nötig) und einsetzen
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "kanzlei-sqlite-"));
fs.writeFileSync(path.join(tmp, "package.json"), '{"name":"t","version":"1.0.0","private":true}');
lauf(`npm install better-sqlite3@${sqliteVersion} --no-save --no-audit --no-fund`, {
  cwd: tmp,
  env: { ...process.env, npm_config_runtime: "electron", npm_config_target: electronVersion, npm_config_disturl: "https://electronjs.org/headers", npm_config_arch: "x64", ...(plattform === "win" ? { npm_config_platform: "win32" } : {}) },
});
const modul = path.join(tmp, "node_modules", "better-sqlite3", "build", "Release", "better_sqlite3.node");
if (!fs.existsSync(modul)) throw new Error("better-sqlite3 für Electron nicht gefunden");
const ziel = path.join(server, "node_modules", "better-sqlite3", "build", "Release", "better_sqlite3.node");
fs.mkdirSync(path.dirname(ziel), { recursive: true });
fs.copyFileSync(modul, ziel);
fs.rmSync(tmp, { recursive: true, force: true });

schritt("4/5 Electron-Hülle");
const appDir = path.join(BUILD, "app");
fs.mkdirSync(appDir, { recursive: true });
fs.copyFileSync(path.join(WURZEL, "electron", "main.cjs"), path.join(appDir, "main.cjs"));
fs.copyFileSync(path.join(WURZEL, "desktop", "kanzlei.ico"), path.join(appDir, "kanzlei.ico"));
fs.writeFileSync(path.join(appDir, "package.json"), JSON.stringify({ name: "kanzlei", productName: "Kanzlei", version: pkg.version, description: "Kanzlei-App", author: "Kanzlei", main: "main.cjs", dependencies: {} }, null, 2));

// Sicherheitsprüfung: keine Datenbank, keine Dokumente, kein Schlüssel im Paket
const verboten = [];
(function suche(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (e.name === "daten") verboten.push(p); else suche(p); }
    else if (/\.(db|db-wal|db-shm|kzb)$/i.test(e.name) || e.name === ".geheim") verboten.push(p);
  }
})(BUILD);
if (verboten.length) throw new Error("Abbruch – Daten im Paket gefunden:\n" + verboten.join("\n"));

schritt("5/5 Packen");
lauf(`npx electron-builder --${plattform} ${nurOrdner ? "--dir" : ""} --config electron/builder.json -c.electronVersion=${electronVersion}`);
console.log(`\nFertig: ${path.join(WURZEL, "dist")}`);
