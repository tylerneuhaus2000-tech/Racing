#!/usr/bin/env node
import fs from 'node:fs';

const candidatePath = 'assets/tracks/madring_candidate.centerline.json';
const centerlinePath = 'assets/tracks/madring_2026.centerline.json';
const overlayPath = 'assets/tracks/madring_2026.js';
const line = JSON.parse(fs.readFileSync(candidatePath, 'utf8'));

if (!Array.isArray(line.pts) || line.pts.length < 300) throw new Error('Madring centerline is incomplete.');
if (line.lengthKm < 5.35 || line.lengthKm > 5.65) throw new Error(`Implausible Madring length: ${line.lengthKm} km`);

/* Until the pit/start complex is rebuilt, place the grid on the broad, open
   racing surface shown around 49% of the original lap. This point has asphalt
   and open vertical clearance in the supplied in-game reference. */
const target = [-360, -805];
const [ox, , oz] = line.meshOffset;
const meshOffset = line.meshOffset.map(value => -value);
let start = 0;
let best = Infinity;
for (let i = 0; i < line.pts.length; i++) {
  const dx = line.pts[i][0] + ox - target[0];
  const dz = line.pts[i][1] + oz - target[1];
  const d = dx * dx + dz * dz;
  if (d < best) { best = d; start = i; }
}
let pts = line.pts.slice(start).concat(line.pts.slice(0, start));
const heading = [pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]];
if (heading[0] > 0) pts = [pts[0]].concat(pts.slice(1).reverse());
let measuredLength = 0;
for (let i = 0; i < pts.length; i++) {
  const a = pts[i];
  const b = pts[(i + 1) % pts.length];
  measuredLength += Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
}

const centerline = {
  name: 'Circuito de Madring 2026',
  source: 'madring_2026.glb',
  method: 'decoded asphalt mesh centerline',
  closed: true,
  lengthKm: +(measuredLength / 1000).toFixed(3),
  halfWidth: 10.5,
  sourceCentroid: line.meshOffset,
  meshOffset,
  startWorld: [+(pts[0][0] + ox).toFixed(2), +(pts[0][2] + line.meshOffset[1]).toFixed(2), +(pts[0][1] + oz).toFixed(2)],
  direction: 'temporary open-track grid near the 49% reference point',
  n: pts.length,
  pts
};

const track = {
  id: 'madring-2026',
  name: 'Circuito de Madring',
  sub: 'Madrid · F1-Layout 2026 · 5,47 km · TRACK-LAB',
  meshUrl: 'assets/tracks/madring_2026.glb',
  mesh: {
    offset: meshOffset,
    rawSurface: true,
    hideMaterialsAlways: '^rubber\\.001$',
    fixAlphaMaterials: 'tree|bush|fence|grass|cypress|maple',
    light: { sun: 0.98, hemi: 0.84, exposure: 1 }
  },
  halfWidth: 10.5,
  wallDist: 14,
  kerbW: 3,
  vergeW: 10,
  sky: 0xa8c4e8,
  hill: 0x5e8a42,
  grass: [0x4e8b3a, 0x407531],
  startFinishPct: 0,
  startGridPct: 99,
  env: 'city',
  noWalls: false,
  containCars: true,
  pts
};

fs.writeFileSync(centerlinePath, `${JSON.stringify(centerline, null, 1)}\n`);
fs.writeFileSync(overlayPath,
  `/* Generated from the decoded Madring asphalt mesh. Track-Lab only. */\n`
  + `for (let i = TRACKS.length - 1; i >= 0; i--) if (TRACKS[i].id === "madring-2026") TRACKS.splice(i, 1);\n`
  + `TRACKS.push(${JSON.stringify(track)});\n`);

console.log(`Madring: ${pts.length} points, ${(measuredLength / 1000).toFixed(3)} km, start ${centerline.startWorld.join('/')}, width ${track.halfWidth} m`);
