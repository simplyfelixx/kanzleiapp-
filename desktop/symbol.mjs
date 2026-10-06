// Erzeugt das Programmsymbol (PNG + ICO) – ruhig, Akzentfarbe, Initialen „KN“.
import { createCanvas } from "@napi-rs/canvas";
import fs from "fs";
import path from "path";

export function symbolPng(groesse = 256, text = "KN", farbe = "#1E3A6E") {
  const c = createCanvas(groesse, groesse), x = c.getContext("2d");
  const r = groesse * 0.18;
  x.fillStyle = farbe;
  x.beginPath(); x.moveTo(r, 0); x.arcTo(groesse, 0, groesse, groesse, r); x.arcTo(groesse, groesse, 0, groesse, r); x.arcTo(0, groesse, 0, 0, r); x.arcTo(0, 0, groesse, 0, r); x.fill();
  x.fillStyle = "#fff"; x.font = `600 ${Math.round(groesse * 0.42)}px sans-serif`; x.textAlign = "center"; x.textBaseline = "middle";
  x.fillText(text, groesse / 2, groesse / 2 + groesse * 0.02);
  return c.toBuffer("image/png");
}

/** ICO mit eingebettetem PNG (ab Windows Vista unterstützt) */
export function icoAusPng(png) {
  const kopf = Buffer.alloc(22);
  kopf.writeUInt16LE(0, 0); kopf.writeUInt16LE(1, 2); kopf.writeUInt16LE(1, 4);
  kopf.writeUInt8(0, 6); kopf.writeUInt8(0, 7); kopf.writeUInt8(0, 8); kopf.writeUInt8(0, 9);
  kopf.writeUInt16LE(1, 10); kopf.writeUInt16LE(32, 12); kopf.writeUInt32LE(png.length, 14); kopf.writeUInt32LE(22, 18);
  return Buffer.concat([kopf, png]);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"))) {
  const png = symbolPng();
  fs.writeFileSync(path.join("src", "app", "icon.png"), symbolPng(64));
  fs.writeFileSync(path.join("desktop", "kanzlei.ico"), icoAusPng(png));
  console.log("Symbol erzeugt");
}
