// Geheimer Schlüssel für Login-Sitzungen: aus AUTH_SECRET oder daten/.geheim (wird beim ersten Start erzeugt).
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
if (!process.env.AUTH_SECRET) {
  const datei = path.join(process.env.KANZLEI_DATEN || path.join(__dirname, "daten"), ".geheim");
  fs.mkdirSync(path.dirname(datei), { recursive: true });
  if (!fs.existsSync(datei)) fs.writeFileSync(datei, crypto.randomBytes(32).toString("hex"), { mode: 0o600 });
  process.env.AUTH_SECRET = fs.readFileSync(datei, "utf8").trim();
}

/** @type {import('next').NextConfig} */
module.exports = {
  // Eigenständiger Server nur beim Bau der Windows-Anwendung (npm run exe); sonst wie bisher
  ...(process.env.KANZLEI_STANDALONE ? { output: "standalone" } : {}),
  experimental: {
    // Niemals Kanzleidaten in den Programmordner/die .exe übernehmen
    outputFileTracingExcludes: { "*": ["daten/**"] },
    instrumentationHook: true, serverComponentsExternalPackages: ["better-sqlite3", "@napi-rs/canvas", "imapflow", "mailparser", "@kenjiuno/msgreader"] },
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
