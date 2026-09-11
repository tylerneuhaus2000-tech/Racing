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
    const row = rows.get(material) || { primitives: 0, triangles: 0 };
    row.primitives++;
    row.triangles += triangles;
    rows.set(material, row);
  }
}

for (const [material, row] of [...rows].sort((a, b) => b[1].triangles - a[1].triangles)) {
  console.log(`${String(Math.round(row.triangles)).padStart(9)}  ${String(row.primitives).padStart(4)}  ${material}`);
}
