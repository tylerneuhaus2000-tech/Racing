#!/usr/bin/env node
/* Der bisherige "8x kleinere Modelle"-Kompressionslauf hat beim Audi nicht
   nur Texturen verkleinert, sondern dabei still Inhalte verloren: von den
   66 Materialien/73 Meshes/54 Texturen der Quelle sind im aktuellen
   assets/models/audi.glb nur noch 49/50/30 übrig — daher sieht das Modell
   kaputt aus (fehlende Materialien/Texturen).

   Dieses Skript nimmt die vollständige (unkomprimierte) Quelle aus der
   Git-Historie und komprimiert sie sauber neu: weld + dedup + WebP-Texturen
   + meshopt-Geometriekompression — ohne Mesh/Material/Textur-Verlust. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import { weld, dedup, textureCompress, meshopt, prune } from '@gltf-transform/functions';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [inPath, outPath] = process.argv.slice(2);
if (!inPath || !outPath) {
  console.error('node tools/recompress-audi.mjs <in.glb> <out.glb>');
  process.exit(1);
}

await MeshoptEncoder.ready;
await MeshoptDecoder.ready;

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });

const doc = await io.read(inPath);

function counts(label) {
  const r = doc.getRoot();
  console.log(label, {
    meshes: r.listMeshes().length,
    materials: r.listMaterials().length,
    textures: r.listTextures().length,
  });
}
counts('vorher:');

// Nur echte Duplikate zusammenlegen und tatsächlich unbenutzte Dinge weg —
// KEIN aggressives Pruning, das ist vermutlich genau das, was beim letzten
// Mal versehentlich benutzte Materialien mit entfernt hat.
await doc.transform(
  dedup(),
  weld({ tolerance: 0.0001 }),
  textureCompress({ targetFormat: 'webp', resize: [2048, 2048], quality: 92 }),
  prune({ keepAttributes: true, keepIndices: true, keepLeaves: false }),
);

counts('nach dedup/weld/texture (vor meshopt):');

await doc.transform(meshopt({ encoder: MeshoptEncoder, level: 'medium' }));

counts('nachher:');

fs.writeFileSync(outPath, Buffer.from(await io.writeBinary(doc)));
console.log('geschrieben:', path.relative(root, outPath), fs.statSync(outPath).size, 'bytes');
