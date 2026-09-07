#!/usr/bin/env node
/* ============================================================================
   track-build — rohe Strecken-GLB → spielfertige, komprimierte GLB
   ----------------------------------------------------------------------------
   dedup / weld / prune / simplify / Texturen→WebP / quantize / meshopt.
   three.js r128 (assets/GLTFLoader.js, MeshoptDecoder gesetzt) lädt das
   Ergebnis nativ: EXT_meshopt_compression, KHR_mesh_quantization,
   EXT_texture_webp, KHR_texture_transform sind alle im GLTFLoader unterstützt.

   Die Mittellinie (`pts` in tracks.js) entsteht NICHT hier — das braucht Augen.
   Rezept + tracks.js-Vorlage: docs/gt3-prep/track-pipeline.md

   Aufruf:
     node tools/track-build.mjs compress <roh.glb> <out-name> [--simplify=0.5]
   Beispiel:
     node tools/track-build.mjs compress ~/Downloads/redbull_ring_2025_layout.glb redbull_ring --simplify=0.45
   Schreibt: assets/tracks/<out-name>.glb
   ============================================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { dedup, weld, prune, quantize, simplify, textureCompress, reorder } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';

const [cmd, inFile, outName, ...rest] = process.argv.slice(2);
if (cmd !== 'compress' || !inFile || !outName) {
  console.error('Aufruf: node tools/track-build.mjs compress <roh.glb> <out-name> [--simplify=0.5]');
  process.exit(1);
}
const opt = Object.fromEntries(rest.map(a => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });

await MeshoptEncoder.ready;
await MeshoptSimplifier.ready;

const outGlb = path.join(ROOT, 'assets/tracks', outName + '.glb');
console.log('▶ lese', path.basename(inFile), `(${(fs.statSync(inFile).size / 1048576).toFixed(1)} MB)`);
const doc = await io.read(inFile);
const ratio = parseFloat(opt.simplify || '0.5');

await doc.transform(
  dedup(),
  weld({ tolerance: 0.0001 }),
  prune(),
  simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.01 }),
  textureCompress({ encoder: sharp, targetFormat: 'webp', quality: 80, resize: [2048, 2048] }),
  quantize({ pattern: /.*/, quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12 }),
  reorder({ encoder: MeshoptEncoder }),
);
doc.createExtension(EXTMeshoptCompression).setRequired(true)
  .setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });

await io.write(outGlb, doc);
const outSize = fs.statSync(outGlb).size;

// Gegencheck: wieder einlesen, Geometrie + Extensions bestätigen
const chk = await io.read(outGlb);
const r = chk.getRoot();
let verts = 0, tris = 0;
for (const m of r.listMeshes()) for (const p of m.listPrimitives()) {
  const a = p.getAttribute('POSITION'); if (a) verts += a.getCount();
  const i = p.getIndices(); if (i) tris += i.getCount() / 3;
}
console.log(`  ✎ ${path.relative(ROOT, outGlb)}  (${(outSize / 1048576).toFixed(1)} MB, simplify=${ratio})`);
console.log(`  Gegencheck OK: ${r.listMeshes().length} Meshes · ${verts.toLocaleString('de-DE')} Verts · ${Math.round(tris).toLocaleString('de-DE')} Tris`);
console.log(`  Extensions: ${r.listExtensionsUsed().map(e => e.extensionName).join(', ')}`);
