#!/usr/bin/env node
/* ============================================================================
   GLB-Inspektor — liest .glb (glTF-Binary) OHNE three.js und listet:
   Meshes, Primitive, Vertex-Anzahl, Material/Textur-Anzahl, Extensions
   (meshopt/draco), Node-Namen, Gesamt-Bounding-Box.

   Nutzen: schnell sehen, was in einem Download-Modell steckt, bevor man es
   integriert (ist es komprimiert? wie schwer? gibt es eine benannte
   Fahrbahn-Mesh für die Centerline?).

   Aufruf:  node tools/glb-inspect.mjs <datei.glb> [<datei2.glb> ...]
            node tools/glb-inspect.mjs ~/Downloads/*.glb
   ============================================================================ */
import fs from 'node:fs';
import path from 'node:path';

const COMP_TYPE_SIZE = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
const NUM_COMPS = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 };

function readGlb(file) {
  const buf = fs.readFileSync(file);
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error('kein glTF-Binary (magic)');
  const version = buf.readUInt32LE(4);
  const total = buf.readUInt32LE(8);
  let off = 12, json = null, bin = null;
  while (off < total) {
    const len = buf.readUInt32LE(off);
    const type = buf.readUInt32LE(off + 4);
    const chunk = buf.subarray(off + 8, off + 8 + len);
    if (type === 0x4e4f534a) json = JSON.parse(chunk.toString('utf8'));
    else if (type === 0x004e4942) bin = chunk;
    off += 8 + len;
  }
  return { version, total, json, bin };
}

function accessorFloats(gltf, bin, idx) {
  const acc = gltf.accessors[idx];
  const bv = gltf.bufferViews[acc.bufferView];
  const start = (bv.byteOffset || 0) + (acc.byteOffset || 0);
  const comps = NUM_COMPS[acc.type];
  const out = [];
  // nur für unkomprimierte float VEC3 gedacht (POSITION)
  if (acc.componentType !== 5126) return null;
  const stride = bv.byteStride || comps * 4;
  for (let i = 0; i < acc.count; i++) {
    const b = start + i * stride;
    const v = [];
    for (let c = 0; c < comps; c++) v.push(bin.readFloatLE(b + c * 4));
    out.push(v);
  }
  return out;
}

function inspect(file) {
  const size = fs.statSync(file).size;
  const { version, json: g, bin } = readGlb(file);
  const ext = g.extensionsUsed || [];
  const extReq = g.extensionsRequired || [];
  const compressed = ext.some(e => /meshopt|draco/i.test(e));

  console.log('\n' + '═'.repeat(78));
  console.log(path.basename(file), ` — ${(size / 1048576).toFixed(1)} MB · glTF v${version}`);
  console.log('─'.repeat(78));
  console.log('extensionsUsed    :', ext.join(', ') || '(keine)');
  if (extReq.length) console.log('extensionsRequired:', extReq.join(', '));
  console.log('Komprimiert       :', compressed ? '⚠ JA (' + ext.filter(e => /meshopt|draco/i.test(e)).join('/') + ')' : 'nein (roh)');
  console.log('Bilder/Texturen   :', (g.images || []).length, 'Bilder /', (g.textures || []).length, 'Texturen /', (g.materials || []).length, 'Materialien');

  const bboxAll = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  let totalVerts = 0, totalTris = 0;
  const meshLines = [];
  (g.meshes || []).forEach((m, mi) => {
    let mv = 0, mt = 0;
    (m.primitives || []).forEach(p => {
      const pa = g.accessors[p.attributes.POSITION];
      if (pa) {
        mv += pa.count;
        if (pa.min && pa.max) {
          bboxAll[0] = Math.min(bboxAll[0], pa.min[0]); bboxAll[1] = Math.min(bboxAll[1], pa.min[1]); bboxAll[2] = Math.min(bboxAll[2], pa.min[2]);
          bboxAll[3] = Math.max(bboxAll[3], pa.max[0]); bboxAll[4] = Math.max(bboxAll[4], pa.max[1]); bboxAll[5] = Math.max(bboxAll[5], pa.max[2]);
        }
      }
      if (p.indices != null && g.accessors[p.indices]) mt += g.accessors[p.indices].count / 3;
    });
    totalVerts += mv; totalTris += mt;
    meshLines.push(`  #${mi}  ${(m.name || '(unbenannt)').padEnd(28)}  ${String(mv).padStart(8)} verts  ${String(Math.round(mt)).padStart(8)} tris  (${(m.primitives || []).length} prim)`);
  });
  console.log(`Meshes            : ${(g.meshes || []).length}  ·  ${totalVerts.toLocaleString('de-DE')} verts  ·  ${Math.round(totalTris).toLocaleString('de-DE')} tris`);
  meshLines.forEach(l => console.log(l));

  if (isFinite(bboxAll[0])) {
    const dx = (bboxAll[3] - bboxAll[0]), dy = (bboxAll[4] - bboxAll[1]), dz = (bboxAll[5] - bboxAll[2]);
    console.log(`Bounding-Box (m)  : X ${dx.toFixed(1)}  Y ${dy.toFixed(1)}  Z ${dz.toFixed(1)}   (Grundfläche ${dx.toFixed(0)}×${dz.toFixed(0)} m)`);
    const looksTrack = Math.max(dx, dz) > 300 && dy < Math.max(dx, dz) * 0.15;
    const guess = looksTrack ? '→ groß & flach: vermutlich RENNSTRECKE'
      : (Math.max(dx, dz) < 15 ? '→ klein: vermutlich FAHRZEUG' : '→ mittelgroß: prüfen');
    console.log('Einschätzung      :', guess);
  }

  // Node-Namen (helfen, die Fahrbahn-Mesh zu finden)
  const nodeNames = (g.nodes || []).map(n => n.name).filter(Boolean);
  if (nodeNames.length) console.log('Node-Namen        :', nodeNames.slice(0, 24).join(', ') + (nodeNames.length > 24 ? ` … (+${nodeNames.length - 24})` : ''));

  // Kandidaten für die Fahrbahn (Name enthält asphalt/track/road/surface/tarmac)
  const trackMeshIdx = (g.meshes || []).findIndex(m => /asphalt|track|road|surface|tarmac|circuit|pist/i.test(m.name || ''));
  if (trackMeshIdx >= 0 && !compressed && bin) {
    const m = g.meshes[trackMeshIdx];
    const pos = accessorFloats(g, bin, m.primitives[0].attributes.POSITION);
    if (pos) {
      console.log(`Fahrbahn-Kandidat : Mesh #${trackMeshIdx} "${m.name}" — ${pos.length} Positionen lesbar (Centerline-Extraktion möglich)`);
    }
  } else if (compressed) {
    console.log('Hinweis           : komprimiert → Positionen erst nach gltfpack-Dekompression lesbar');
  }
}

const files = process.argv.slice(2);
if (!files.length) {
  console.error('Aufruf: node tools/glb-inspect.mjs <datei.glb> [...]');
  process.exit(1);
}
for (const f of files) {
  try { inspect(f); }
  catch (e) { console.log(`\n${path.basename(f)}: FEHLER — ${e.message}`); }
}
console.log('\n' + '═'.repeat(78));
