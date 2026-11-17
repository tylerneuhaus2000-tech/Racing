import fs from 'node:fs';
import path from 'node:path';

const sourcePath = path.resolve('assets/tracks/monza.centerline.json');
const outputPath = path.resolve(
  'native/GridlineRacing/Assets/Resources/Tracks/monza.json'
);
const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));

if (!Array.isArray(source.pts) || source.pts.length < 4) {
  throw new Error('Monza centerline is missing or too short');
}

if (!Array.isArray(source.meshOffset) || !Number.isFinite(source.meshOffset[0])) {
  throw new Error('Monza centerline is missing the GLB mesh offset');
}

// glTFast converts this left-handed source asset to Unity coordinates by
// reflecting X around the imported root origin. Keep the physical GLB exactly
// as supplied and apply the same coordinate conversion to the native spline.
// The browser data remains unchanged; this is only the Unity export boundary.
const unityMirrorOriginX = source.meshOffset[0];
const unityPoints = source.pts.map(([x, z, y]) => ({
  x: +(2 * unityMirrorOriginX - x).toFixed(2),
  y,
  z
}));

const track = {
  id: 'monza',
  name: 'Autodromo Nazionale Monza',
  source: 'assets/tracks/monza.centerline.json · Unity glTFast X-mirror applied',
  halfWidth: 6.5,
  lengthMeters: Math.round(source.lengthKm * 1000),
  // Keep the browser/GLB centerline ordering. The supplied Monza asset and
  // its existing web driving slice use this direction as the race direction.
  reverseDirection: false,
  startGridPct: 99,
  points: unityPoints
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(track, null, 2)}\n`);
console.log(`Exported ${track.points.length} Monza points to ${outputPath}`);
