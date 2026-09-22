#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { textureCompress } from '@gltf-transform/functions';
import sharp from 'sharp';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  console.error('Aufruf: node tools/prepare-unity-glb.mjs <in.glb> <out.glb>');
  process.exit(1);
}

await MeshoptDecoder.ready;
await MeshoptEncoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });

const document = await io.read(input);
await document.transform(
  textureCompress({
    encoder: sharp,
    targetFormat: 'png',
    resize: [1024, 1024]
  })
);

fs.mkdirSync(path.dirname(output), { recursive: true });
await io.write(output, document);
console.log(`Unity-GLB geschrieben: ${output} (${(fs.statSync(output).size / 1048576).toFixed(1)} MiB)`);
