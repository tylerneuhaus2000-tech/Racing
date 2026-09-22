import fs from 'node:fs';
import path from 'node:path';

const sourcePath = path.resolve('assets/tracks.js');
const outputPath = path.resolve(
  'native/GridlineRacing/Assets/Resources/Tracks/silverstone-gp.json'
);
const source = fs.readFileSync(sourcePath, 'utf8');
const entryStart = source.indexOf('id: "silverstone-gp"');
if (entryStart < 0) throw new Error('Silverstone entry not found');

const ptsStart = source.indexOf('pts:', entryStart);
const arrayStart = source.indexOf('[', ptsStart);
let depth = 0;
let arrayEnd = -1;
for (let i = arrayStart; i < source.length; i += 1) {
  if (source[i] === '[') depth += 1;
  if (source[i] === ']') {
    depth -= 1;
    if (depth === 0) {
      arrayEnd = i + 1;
      break;
    }
  }
}
if (arrayEnd < 0) throw new Error('Silverstone points array not closed');

const points = JSON.parse(source.slice(arrayStart, arrayEnd));
const track = {
  id: 'silverstone-gp',
  name: 'Silverstone Circuit',
  source: 'assets/tracks.js',
  halfWidth: 10,
  lengthMeters: 5891,
  points: points.map(([x, z, y]) => ({ x, y, z }))
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(track, null, 2)}\n`);
console.log(`Exported ${track.points.length} Silverstone points to ${outputPath}`);
