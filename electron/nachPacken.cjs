// electron-builder afterPack: eigenständigen Server nach resources/server kopieren.
// (extraResources würde .next und node_modules auslassen.)
const fs = require("fs");
const path = require("path");
exports.default = async function (ctx) {
  const quelle = path.join(__dirname, "..", "build", "server");
  const res = ctx.electronPlatformName === "darwin" ? path.join(ctx.appOutDir, `${ctx.packager.appInfo.productFilename}.app`, "Contents", "Resources") : path.join(ctx.appOutDir, "resources");
  const ziel = path.join(res, "server");
  fs.rmSync(ziel, { recursive: true, force: true });
  fs.cpSync(quelle, ziel, { recursive: true });
  for (const p of ["server.js", "start.cjs", ".next/BUILD_ID", "node_modules/next", "node_modules/better-sqlite3/build/Release/better_sqlite3.node"])
    if (!fs.existsSync(path.join(ziel, p))) throw new Error("Server unvollständig, fehlt: " + p);
};
