#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const context = {};
vm.createContext(context);
vm.runInContext(`${fs.readFileSync(path.join(root, 'assets/tracks.js'), 'utf8')}\nthis.TRACKS_REF=TRACKS;`, context);
vm.runInContext(fs.readFileSync(path.join(root, 'assets/tracks/sachsenring.js'), 'utf8'), context);

let failed = false;
for (const track of context.TRACKS_REF) {
  if (!track || !Array.isArray(track.pts)) continue;
  if (track.meshUrl && !fs.existsSync(path.join(root, track.meshUrl))) {
    console.error(`${track.id}: missing ${track.meshUrl}`);
    failed = true;
  }
  if (track.id !== 'sachsenring') continue;

  const segments = track.pts.map((point, index) => {
    const next = track.pts[(index + 1) % track.pts.length];
    return Math.hypot(next[0] - point[0], next[1] - point[1], (next[2] || 0) - (point[2] || 0));
  });
  const length = segments.reduce((sum, value) => sum + value, 0);
  const maxSegment = Math.max(...segments);
  const heights = track.pts.map(point => point[2] || 0);
  const heightSpan = Math.max(...heights) - Math.min(...heights);
  const finite = track.pts.every(point => point.length >= 3 && point.every(Number.isFinite));

  console.log(`${track.name}: ${track.pts.length} points, ${(length / 1000).toFixed(3)} km, `
    + `${heightSpan.toFixed(1)} m height span, max segment ${maxSegment.toFixed(2)} m`);
  if (!finite || track.pts.length < 300 || maxSegment > 15 || length < 3400 || length > 3800) {
    console.error('Sachsenring centerline failed plausibility checks.');
    failed = true;
  }
}

process.exitCode = failed ? 1 : 0;
