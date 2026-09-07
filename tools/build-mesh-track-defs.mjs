#!/usr/bin/env node
/* Generate runtime track definitions without rewriting the large legacy tracks.js. */
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('assets/tracks.js', 'utf8');
const context = {};
vm.createContext(context);
vm.runInContext(`${source}; globalThis.trackDefs = TRACKS;`, context);
const redbull = context.trackDefs.find(t => t.id === 'redbullring-custom');
const monza = JSON.parse(fs.readFileSync('assets/tracks/monza.centerline.json', 'utf8'));
fs.writeFileSync('assets/tracks/monza.centerline.json', JSON.stringify(monza, null, 1) + '\n');

function write(file, track) {
  fs.writeFileSync(file, `/* Generated from the downloaded track mesh. */\nfor (let i = TRACKS.length - 1; i >= 0; i--) if (TRACKS[i].id === ${JSON.stringify(track.id)}) TRACKS.splice(i, 1);\nTRACKS.push(${JSON.stringify(track)});\n`);
}

write('assets/tracks/redbull-ring.js', {
  id: 'redbullring-custom',
  name: 'Red Bull Ring',
  sub: 'Spielberg · Grand-Prix-Kurs · echtes 3D-Streckenmesh',
  meshUrl: 'assets/tracks/redbull_ring.glb',
  mesh: { offset: [0, 0, 0], rawSurface: true, light: { sun: 0.95, hemi: 0.82, exposure: 1 } },
  halfWidth: 8.5,
  wallDist: 12,
  kerbW: 2.5,
  vergeW: 12,
  sky: 0x9fc3eb,
  hill: 0x5e8a42,
  grass: [0x4e8b3a, 0x407531],
  startFinishPct: 0,
  startGridPct: 99,
  env: 'forest',
  noWalls: true,
  containCars: true,
  pitLane: { side: -1, idxStart: 33, idxEnd: 75, innerOff: 10, outerOff: 20 },
  pts: redbull.pts
});

write('assets/tracks/monza-mesh.js', {
  id: 'monza',
  name: 'Autodromo Nazionale Monza',
  sub: 'Monza · echte Asphalt-Mittellinie aus dem 3D-Modell',
  meshUrl: 'assets/tracks/monza_2020.glb',
  mesh: { offset: monza.meshOffset, rawSurface: true, light: { sun: 0.95, hemi: 0.82, exposure: 1 } },
  halfWidth: 5.5,
  wallDist: 10,
  kerbW: 2.5,
  vergeW: 12,
  sky: 0x9fc3eb,
  hill: 0x5e8a42,
  grass: [0x4e8b3a, 0x407531],
  startFinishPct: 0,
  startGridPct: 99,
  env: 'forest',
  noWalls: true,
  containCars: true,
  pts: monza.pts
});
