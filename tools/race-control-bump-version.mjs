/* Setzt ?v= an allen Race-Control-Skripten in race-control/index.html auf einen neuen Zeitstempel.
   Nach jeder JS-Änderung ausführen (npm run rc:bump), sonst mischen Browser bis zu 4 h alte und neue Dateien. */
import fs from "node:fs";
const p = new URL("../race-control/index.html", import.meta.url);
const v = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 12);
const s = fs.readFileSync(p, "utf8");
let n = 0;
const out = s.replace(/<script src="([a-z0-9-]+\.js)(?:\?v=[^"]*)?"/g, (_, f) => { n++; return `<script src="${f}?v=${v}"`; });
fs.writeFileSync(p, out);
console.log(`race-control/index.html: ${n} Skripte auf ?v=${v} gesetzt`);
