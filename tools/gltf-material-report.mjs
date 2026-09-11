#!/usr/bin/env node
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';

const input = process.argv[2];
if (!input) {
  console.error('node tools/gltf-material-report.mjs <track.glb>');
  process.exit(1);
}

await MeshoptDecoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const doc = await io.read(input);
const rows = new Map();

for (const node of doc.getRoot().listNodes()) {
  const mesh = node.getMesh();
  if (!mesh) continue;
  for (const primitive of mesh.listPrimitives()) {
    const material = primitive.getMaterial()?.getName() || '(none)';
    const position = primitive.getAttribute('POSITION');
    const indices = primitive.getIndices();
    const triangles = indices ? indices.getCount() / 3 : (position?.getCount() || 0) / 3;
    const row = rows.get(material) || { primitives: 0, triangles: 0, min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
    row.primitives++;
    row.triangles += triangles;
    if (position) {
      const matrix = node.getWorldMatrix();
      for (let i = 0; i < position.getCount(); i++) {
        const p = position.getElement(i, []);
        const world = [
          matrix[0] * p[0] + matrix[4] * p[1] + matrix[8] * p[2] + matrix[12],
          matrix[1] * p[0] + matrix[5] * p[1] + matrix[9] * p[2] + matrix[13],
          matrix[2] * p[0] + matrix[6] * p[1] + matrix[10] * p[2] + matrix[14]
        ];
        for (let axis = 0; axis < 3; axis++) {
          row.min[axis] = Math.min(row.min[axis], world[axis]);
          row.max[axis] = Math.max(row.max[axis], world[axis]);
        }
      }
    }
    rows.set(material, row);
  }
}

for (const [material, row] of [...rows].sort((a, b) => b[1].triangles - a[1].triangles)) {
  const center = row.min.map((value, axis) => (value + row.max[axis]) / 2);
  console.log(`${String(Math.round(row.triangles)).padStart(9)}  ${String(row.primitives).padStart(4)}  ${material}  @ ${center.map(value => value.toFixed(1)).join(',')}`);
}
