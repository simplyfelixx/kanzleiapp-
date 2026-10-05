// Geheimer Schlüssel für Login-Sitzungen: aus AUTH_SECRET oder daten/.geheim (wird beim ersten Start erzeugt).
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
if (!process.env.AUTH_SECRET) {
  const datei = path.join(__dirname, "daten", ".geheim");
  fs.mkdirSync(path.dirname(datei), { recursive: true });
  if (!fs.existsSync(datei)) fs.writeFileSync(datei, crypto.randomBytes(32).toString("hex"), { mode: 0o600 });
  process.env.AUTH_SECRET = fs.readFileSync(datei, "utf8").trim();
}

/** @type {import('next').NextConfig} */
module.exports = { experimental: { serverComponentsExternalPackages: ["better-sqlite3"] } };
