#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import sharp from 'sharp';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';

const [trackInput, vehicleInput, outputRoot,
  trackFolder = 'SilverstoneGP', vehicleFolder = 'Ferrari296'] = process.argv.slice(2);
if (!trackInput || !vehicleInput || !outputRoot) {
  console.error('Aufruf: node tools/extract-unity-glb-textures.mjs <track.glb> <vehicle.glb> <Assets/Resources/...>');
  process.exit(1);
}

await MeshoptDecoder.ready;
await MeshoptEncoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });

function safeName(value) {
  return value.replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'material';
}

async function extract(input, folder) {
  const document = await io.read(input);
  const output = path.join(outputRoot, folder);
  fs.rmSync(output, { recursive: true, force: true });
  fs.mkdirSync(output, { recursive: true });

  let count = 0;
  const used = new Set();
  for (const material of document.getRoot().listMaterials()) {
    const texture = material.getBaseColorTexture();
    const image = texture?.getImage();
    if (!image) continue;

    let fileName = `${safeName(material.getName() || `material_${count}`)}.png`;
    if (used.has(fileName)) fileName = `${safeName(material.getName() || `material_${count}`)}_${count}.png`;
    used.add(fileName);

    const outputPath = path.join(output, fileName);
    await sharp(image)
      .resize({ width: 512, height: 512, fit: 'inside', withoutEnlargement: true })
      .png({ compressionLevel: 9 })
      .toFile(outputPath);
    count += 1;
  }

  console.log(`${folder}: ${count} BaseColor-Texturen nach ${output}`);
}

await extract(trackInput, trackFolder);
await extract(vehicleInput, vehicleFolder);
