// Richtet die Kanzlei-App als Programm ein: bauen, Symbol, Verknüpfungen (Startmenü + Desktop, optional Autostart).
// Aufruf: npm run desktop   (optional: npm run desktop -- --autostart)
import { execSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { icoAusPng, symbolPng } from "./symbol.mjs";

const ORDNER = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const schritt = (t) => console.log("\n▶ " + t);

schritt("Abhängigkeiten installieren");
execSync("npm install --no-audit --no-fund", { cwd: ORDNER, stdio: "inherit" });
schritt("App bauen (dauert 1–2 Minuten)");
execSync("npm run build", { cwd: ORDNER, stdio: "inherit" });

schritt("Programmsymbol");
const ico = path.join(ORDNER, "desktop", "kanzlei.ico");
fs.writeFileSync(ico, icoAusPng(symbolPng()));

if (process.platform !== "win32") {
  console.log("\nVerknüpfungen werden nur unter Windows angelegt. Start: node desktop/starten.mjs");
  process.exit(0);
}

// Unsichtbarer Starter (kein schwarzes Fenster)
const vbs = path.join(ORDNER, "desktop", "Kanzlei.vbs");
fs.writeFileSync(vbs, [
  'Set sh = CreateObject("WScript.Shell")',
  `sh.CurrentDirectory = "${ORDNER}"`,
  `sh.Run """${process.execPath}"" ""${path.join(ORDNER, "desktop", "starten.mjs")}""", 0, False`,
].join("\r\n"), "latin1");

const ps = (ziel) => [
  "$s = (New-Object -ComObject WScript.Shell).CreateShortcut('" + ziel.replace(/'/g, "''") + "')",
  "$s.TargetPath = '" + path.join(process.env.SystemRoot ?? "C:\\Windows", "System32", "wscript.exe") + "'",
  "$s.Arguments = '\"" + vbs.replace(/'/g, "''") + "\"'",
  "$s.WorkingDirectory = '" + ORDNER.replace(/'/g, "''") + "'",
  "$s.IconLocation = '" + ico.replace(/'/g, "''") + "'",
  "$s.Description = 'Kanzlei'",
  "$s.Save()",
].join("; ");
const appdata = process.env.APPDATA ?? path.join(os.homedir(), "AppData", "Roaming");
const desktop = execSync('powershell -NoProfile -Command "[Environment]::GetFolderPath(\'Desktop\')"', { encoding: "utf8" }).trim();
const ziele = [
  path.join(appdata, "Microsoft", "Windows", "Start Menu", "Programs", "Kanzlei.lnk"),
  path.join(desktop, "Kanzlei.lnk"),
];
if (process.argv.includes("--autostart")) ziele.push(path.join(appdata, "Microsoft", "Windows", "Start Menu", "Programs", "Startup", "Kanzlei.lnk"));

schritt("Verknüpfungen anlegen");
for (const z of ziele) {
  execSync(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${ps(z).replace(/"/g, '\\"')}"`, { stdio: "inherit" });
  console.log("  ✓ " + z);
}
console.log("\nFertig. „Kanzlei“ im Startmenü oder auf dem Desktop öffnen.\nBeenden: npm run desktop:beenden");
