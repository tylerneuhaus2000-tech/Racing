#!/usr/bin/env node
/* ============================================================================
   track-centerline — grobe Mittellinien-Punkte → fertige tracks.js `pts`
   ----------------------------------------------------------------------------
   Nimmt die Punkte, die du in Blender auf der Fahrbahn-Mitte gesetzt hast
   (Kurve auf die Strecken-Mesh geshrinkwrappt, dann exportiert), und macht:
     · Achsen ins Spielsystem drehen (Blender Z-up → three.js/Spiel Y-up)
     · auf ~N Punkte gleichmäßig resamplen + leicht glätten (Schleife)
     · auf den Schwerpunkt zentrieren  →  liefert auch mesh.offset
   Ausgabe: assets/tracks/<name>.centerline.json  (pts:[[x,z,y],...], offset, len)

   Eingabe-JSON:
     { "axis": "blender", "pts": [ [x,y,z], [x,y,z], ... ] }
     axis: "blender"  = Blender Z-up  (game_x=bx, game_z=-by, game_y=bz)
           "gltf"     = schon Y-up    (game_x=x,  game_z=z,   game_y=y)
           "raw"      = 1:1 übernehmen

   Aufruf:
     node tools/track-centerline.mjs <punkte.json> <name> [--n=320] [--smooth=2] [--no-close]
   ============================================================================ */
import fs from 'node:fs';
import path from 'node:path';

const [inFile, name, ...rest] = process.argv.slice(2);
if (!inFile || !name) { console.error('node tools/track-centerline.mjs <punkte.json> <name> [--n=320] [--smooth=2] [--no-close]'); process.exit(1); }
const opt = Object.fromEntries(rest.map(a => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

const src = JSON.parse(fs.readFileSync(inFile, 'utf8'));
const axis = (src.axis || 'blender').toLowerCase();
const rawN = (src.pts || src.points || []).length;
if (rawN < 8) { console.error('Zu wenige Punkte:', rawN); process.exit(1); }

const conv = axis === 'blender' ? (p => [p[0], -p[1], p[2]])   // bx, -by → z, bz → y
  : axis === 'gltf' ? (p => [p[0], p[2], p[1]])                 // x, z→z, y→y
    : (p => [p[0], p[1], p[2]]);                                // raw: schon [x,z,y]

let pts = (src.pts || src.points).map(conv);   // -> [x, z, y]

const N = parseInt(opt.n || '320');
const SM = parseInt(opt.smooth ?? '2');
const CLOSE = !opt['no-close'];

/* gleichmäßig resamplen (in der x/z-Ebene) */
function resample(P, n, closed) {
  const q = closed ? P.concat([P[0]]) : P;
  const cum = [0];
  for (let i = 1; i < q.length; i++) cum.push(cum[i - 1] + Math.hypot(q[i][0] - q[i - 1][0], q[i][1] - q[i - 1][1]));
  const total = cum[cum.length - 1];
  const out = [];
  for (let i = 0; i < n; i++) {
    const d = total * i / n;
    let k = 1; while (k < cum.length && cum[k] < d) k++;
    const t = (d - cum[k - 1]) / Math.max(1e-6, cum[k] - cum[k - 1]);
    out.push([
      lerp(q[k - 1][0], q[k][0], t),
      lerp(q[k - 1][1], q[k][1], t),
      lerp(q[k - 1][2], q[k][2], t),
    ]);
  }
  return out;
}
function smooth(P) {
  return P.map((_, i) => {
    const a = P[(i - 1 + P.length) % P.length], b = P[i], c = P[(i + 1) % P.length];
    return [(a[0] + 2 * b[0] + c[0]) / 4, (a[1] + 2 * b[1] + c[1]) / 4, (a[2] + 2 * b[2] + c[2]) / 4];
  });
}
function lerp(a, b, t) { return a + (b - a) * t; }
function len(P, closed) { let s = 0; for (let i = 1; i < P.length; i++) s += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]); if (closed) s += Math.hypot(P[0][0] - P[P.length - 1][0], P[0][1] - P[P.length - 1][1]); return s; }

pts = resample(pts, N, CLOSE);
for (let i = 0; i < SM; i++) pts = smooth(pts);

/* Schwerpunkt (x/z) abziehen → Centerline zentriert, offset = Schwerpunkt */
let cx = 0, cz = 0, cy = 0;
for (const p of pts) { cx += p[0]; cz += p[1]; cy += p[2]; }
cx /= pts.length; cz /= pts.length; cy /= pts.length;
const centered = pts.map(p => [round2(p[0] - cx), round2(p[1] - cz), round2(p[2] - cy)]);
const L = len(pts, CLOSE);

const out = {
  name, axis, closed: CLOSE, n: centered.length,
  lengthKm: +(L / 1000).toFixed(3),
  meshOffset: [round2(cx), round2(cy), round2(cz)],   // -> tracks.js  mesh.offset
  note: 'pts sind auf den Schwerpunkt zentriert. In tracks.js: mesh.offset = meshOffset. '
    + 'pts ggf. rotieren (Array-Anfang verschieben), damit Index 0 auf Start/Ziel liegt; startFinishPct entsprechend.',
  pts: centered,
};
const f = path.join(ROOT, 'assets/tracks', name + '.centerline.json');
fs.writeFileSync(f, JSON.stringify(out, null, 1));
console.log(`✎ ${path.relative(ROOT, f)}`);
console.log(`  ${centered.length} Punkte · ${out.lengthKm} km · geschlossen: ${CLOSE} · mesh.offset ${JSON.stringify(out.meshOffset)}`);

function round2(x) { return Math.round(x * 100) / 100; }
