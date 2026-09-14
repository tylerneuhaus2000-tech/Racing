#!/usr/bin/env node
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';

const input = '/Users/tylerneuhaus/Downloads/read-description-hanoi-street-circuit/source/hanoicircuit_compressed (1).glb';
const output = 'assets/tracks/hanoi_street_circuit.glb';

await MeshoptDecoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder });

const doc = await io.read(input);
const converted = new Set();

function convertVec3(accessor) {
  if (!accessor || converted.has(accessor) || accessor.getType() !== 'VEC3') return;
  const tmp = [];
  for (let i = 0; i < accessor.getCount(); i++) {
    const v = accessor.getElement(i, tmp);
    accessor.setElement(i, [v[0], v[2], v[1]]);
  }
  converted.add(accessor);
}

for (const mesh of doc.getRoot().listMeshes()) {
  for (const primitive of mesh.listPrimitives()) {
    convertVec3(primitive.getAttribute('POSITION'));
    convertVec3(primitive.getAttribute('NORMAL'));
  }
}

await io.write(output, doc);
console.log(`Wrote ${output}`);
