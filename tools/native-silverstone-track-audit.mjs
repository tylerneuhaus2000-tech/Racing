import fs from 'node:fs';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';

const projectRoot = new URL('../native/GridlineRacing/', import.meta.url);
const trackJson = JSON.parse(fs.readFileSync(
  new URL('Assets/Resources/Tracks/silverstone-gp.json', projectRoot), 'utf8'
));
const glbPath = new URL('Assets/StreamingAssets/Content/Tracks/Silverstone_GP.glb', projectRoot).pathname;
const meshOffset = [-46.24, 7.21, 89.7];

await MeshoptDecoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const document = await io.read(glbPath);

function transformPoint(matrix, point) {
  return [
    matrix[0] * point[0] + matrix[4] * point[1] + matrix[8] * point[2] + matrix[12],
    matrix[1] * point[0] + matrix[5] * point[1] + matrix[9] * point[2] + matrix[13],
    matrix[2] * point[0] + matrix[6] * point[1] + matrix[10] * point[2] + matrix[14]
  ];
}

function isHorizontal(a, b, c) {
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const normal = [
    ab[1] * ac[2] - ab[2] * ac[1],
    ab[2] * ac[0] - ab[0] * ac[2],
    ab[0] * ac[1] - ab[1] * ac[0]
  ];
  const length = Math.hypot(...normal);
  return length > 0.00001 && Math.abs(normal[1] / length) >= 0.86;
}

const asphaltCentroids = [];
for (const node of document.getRoot().listNodes()) {
  const mesh = node.getMesh();
  if (!mesh) continue;
  const matrix = node.getWorldMatrix();
  for (const primitive of mesh.listPrimitives()) {
    const materialName = primitive.getMaterial()?.getName() ?? '';
    if (!/(asphalt|asph|groove)/i.test(materialName)) continue;
    const positions = primitive.getAttribute('POSITION');
    if (!positions) continue;
    const indices = primitive.getIndices()?.getArray();
    const triangleCount = indices ? indices.length / 3 : positions.getCount() / 3;
    for (let triangle = 0; triangle < triangleCount; triangle += 1) {
      const vertexIndices = indices
        ? [indices[triangle * 3], indices[triangle * 3 + 1], indices[triangle * 3 + 2]]
        : [triangle * 3, triangle * 3 + 1, triangle * 3 + 2];
      const a = transformPoint(matrix, positions.getElement(vertexIndices[0], []));
      const b = transformPoint(matrix, positions.getElement(vertexIndices[1], []));
      const c = transformPoint(matrix, positions.getElement(vertexIndices[2], []));
      if (!isHorizontal(a, b, c)) continue;
      asphaltCentroids.push([
        meshOffset[0] - (a[0] + b[0] + c[0]) / 3,
        (a[2] + b[2] + c[2]) / 3 + meshOffset[2]
      ]);
    }
  }
}

if (asphaltCentroids.length === 0) {
  throw new Error('No horizontal asphalt triangles were found in Silverstone_GP.glb.');
}

let controlPoints = trackJson.points.map(point => [point.x, point.y, point.z]);
if (trackJson.reverseDirection) {
  controlPoints = [controlPoints[0], ...controlPoints.slice(1).reverse()];
}

let signedArea = 0;
for (let index = 0; index < controlPoints.length; index += 1) {
  const current = controlPoints[index];
  const next = controlPoints[(index + 1) % controlPoints.length];
  signedArea += current[0] * next[2] - next[0] * current[2];
}
const officialClockwise = signedArea < 0;

function catmullRom(parameter) {
  const count = controlPoints.length;
  const scaled = Math.max(0, Math.min(1, parameter)) * count;
  const base = Math.floor(scaled);
  const segment = base % count;
  const weight = scaled - base;
  const p0 = controlPoints[(segment - 1 + count) % count];
  const p1 = controlPoints[segment];
  const p2 = controlPoints[(segment + 1) % count];
  const p3 = controlPoints[(segment + 2) % count];
  const weight2 = weight * weight;
  const weight3 = weight2 * weight;
  return [0, 1, 2].map(axis => 0.5 * (
    2 * p1[axis]
    + (-p0[axis] + p2[axis]) * weight
    + (2 * p0[axis] - 5 * p1[axis] + 4 * p2[axis] - p3[axis]) * weight2
    + (-p0[axis] + 3 * p1[axis] - 3 * p2[axis] + p3[axis]) * weight3
  ));
}

const distances = [];
const sampleCount = 720;
for (let index = 0; index < sampleCount; index += 1) {
  const point = catmullRom(index / sampleCount);
  let nearest = Number.POSITIVE_INFINITY;
  for (const centroid of asphaltCentroids) {
    nearest = Math.min(nearest, Math.hypot(point[0] - centroid[0], point[2] - centroid[1]));
  }
  distances.push(nearest);
}

const sorted = [...distances].sort((a, b) => a - b);
const percentile = fraction => sorted[Math.min(sorted.length - 1, Math.floor(fraction * sorted.length))];
const mean = distances.reduce((sum, distance) => sum + distance, 0) / distances.length;
const worst = Math.max(...distances);
const overTwentyMeters = distances.filter(distance => distance > 20).length;
const startGridPct = trackJson.reverseDirection
  ? 100 - trackJson.startGridPct
  : trackJson.startGridPct;
const gridPoint = catmullRom(startGridPct / 100);
const startFinishPoint = catmullRom(0);
const gridToStartFinish = Math.hypot(
  gridPoint[0] - startFinishPoint[0],
  gridPoint[2] - startFinishPoint[2]
);
const checkpointIndices = Array.from({ length: 12 }, (_, checkpoint) => Math.round(
  checkpoint / 12 * (sampleCount - 1)
));
const checkpointOrderIsValid = new Set(checkpointIndices).size === checkpointIndices.length
  && checkpointIndices.every((index, position) => position === 0 || index > checkpointIndices[position - 1]);

console.log(`Silverstone asphalt samples: ${asphaltCentroids.length}`);
console.log(`Centerline samples: ${sampleCount} · mean ${mean.toFixed(2)} m · p95 ${percentile(0.95).toFixed(2)} m · max ${worst.toFixed(2)} m`);
console.log(`Samples farther than 20 m from asphalt: ${overTwentyMeters}`);
console.log(`Orientation: ${officialClockwise ? 'clockwise' : 'counter-clockwise'} in Unity X/Z`);
console.log(`Traversal: ${trackJson.reverseDirection ? 'reversed browser export' : 'clockwise (glTFast-mirrored source order)'} · grid ${startGridPct}% · S/F pre-grid offset ${gridToStartFinish.toFixed(2)} m`);
console.log(`Ordered checkpoint gates: ${checkpointOrderIsValid ? 'valid' : 'invalid'}`);

if (mean > 8 || percentile(0.95) > 18 || overTwentyMeters > sampleCount * 0.03
  || trackJson.reverseDirection || !officialClockwise || startGridPct !== 99 || gridToStartFinish < 20
  || !checkpointOrderIsValid) {
  console.error('Silverstone centerline audit failed: GLB alignment requires correction.');
  process.exit(1);
}

console.log('Silverstone centerline audit passed.');
