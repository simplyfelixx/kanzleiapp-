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
module.exports = {
  experimental: { serverComponentsExternalPackages: ["better-sqlite3", "@napi-rs/canvas", "imapflow", "mailparser", "@kenjiuno/msgreader"] },
  async headers() {
    const portal = [
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "X-Robots-Tag", value: "noindex, nofollow" },
      { key: "Cache-Control", value: "no-store" },
      { key: "X-Frame-Options", value: "DENY" },
    ];
    return [{ source: "/portal", headers: portal }, { source: "/p/:token", headers: portal }];
  },
};
