#!/usr/bin/env node
/* Zieht aus einer Strecken-GLB automatisch eine Mittellinie.
   Welt-Koordinaten via node.getWorldMatrix() (glTF Y-up).
   node tools/track-extract.mjs <glb> <name> [--band=3] [--step=14] [--r=26] [--dump] */
import fs from 'node:fs';
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';

const [inFile, name, ...rest] = process.argv.slice(2);
if (!inFile || !name) { console.error('node tools/track-extract.mjs <glb> <name> [--band=3] [--step=14] [--r=26] [--dump]'); process.exit(1); }
const opt = Object.fromEntries(rest.map(a => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
await MeshoptDecoder.ready;
const SCALE = parseFloat(opt.scale || "1");

const doc = await io.read(inFile);

function mvp(m, p) {   // column-major mat4 * vec3(w=1)
  return [
    m[0]*p[0] + m[4]*p[1] + m[8]*p[2] + m[12],
    m[1]*p[0] + m[5]*p[1] + m[9]*p[2] + m[13],
    m[2]*p[0] + m[6]*p[1] + m[10]*p[2] + m[14],
  ];
}

// alle ~horizontalen Dreiecke, Zentroide, in Welt-Y-up
const C = [];   // {x,z,y,a}
const MESHRE = opt.mesh ? new RegExp(opt.mesh,'i') : null;
for (const node of doc.getRoot().listNodes()) {
  const mesh = node.getMesh(); if (!mesh) continue;
  if (MESHRE && !MESHRE.test((mesh.getName()||'') + ' ' + (node.getName()||''))) continue;
  const M = node.getWorldMatrix();
  for (const prim of mesh.listPrimitives()) {
    const pa = prim.getAttribute('POSITION'); if (!pa) continue;
    const pos = pa.getArray();
    const ia = prim.getIndices(); const idx = ia ? ia.getArray() : null;
    const nTri = idx ? idx.length / 3 : pos.length / 9;
    for (let t = 0; t < nTri; t++) {
      let a, b, c;
      if (idx) { a = idx[t*3]*3; b = idx[t*3+1]*3; c = idx[t*3+2]*3; }
      else { a = t*9; b = t*9+3; c = t*9+6; }
      const A = mvp(M, [pos[a], pos[a+1], pos[a+2]]);
      const B = mvp(M, [pos[b], pos[b+1], pos[b+2]]);
      const D = mvp(M, [pos[c], pos[c+1], pos[c+2]]);
      const u = [B[0]-A[0], B[1]-A[1], B[2]-A[2]], v = [D[0]-A[0], D[1]-A[1], D[2]-A[2]];
      const n = [u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0]];
      const nl = Math.hypot(n[0], n[1], n[2]) || 1;
      if (Math.abs(n[1]/nl) < 0.86) continue;
      const area = nl/2;
      C.push({ x: SCALE*(A[0]+B[0]+D[0])/3, y: SCALE*(A[1]+B[1]+D[1])/3, z: SCALE*(A[2]+B[2]+D[2])/3, a: area*SCALE*SCALE });
    }
  }
}
const bb=[1e9,1e9,-1e9,-1e9]; for(const p of C){bb[0]=Math.min(bb[0],p.x);bb[1]=Math.min(bb[1],p.z);bb[2]=Math.max(bb[2],p.x);bb[3]=Math.max(bb[3],p.z);}
console.log(`flache Zentroide: ${C.length}  ·  Welt-BBox XZ ${(bb[2]-bb[0]).toFixed(0)} × ${(bb[3]-bb[1]).toFixed(0)} m`);
// Höhen-Histogramm
C.sort((p,q)=>p.y-q.y);
const yMin=C[0].y, yMax=C[C.length-1].y;
const H = new Array(20).fill(0);
for (const p of C) H[Math.min(19, Math.floor((p.y-yMin)/(yMax-yMin+1e-6)*20))]++;
console.log(`Höhe ${yMin.toFixed(0)}..${yMax.toFixed(0)} m  Histogramm: ${H.join(' ')}`);

if (opt.dump) process.exit(0);

/* Fahrbahn = dichtestes schmales Höhenband: nimm den y-Median, Band ±band(m).
   Dann Streifen-March. */
const BAND = parseFloat(opt.band || '3');
const STEP = parseFloat(opt.step || '14');
const R = parseFloat(opt.r || '26');
const yMed = C[Math.floor(C.length/2)].y;
// besser: gleitendes Fenster mit den meisten Punkten
let bestC = 0, bestY = yMed;
for (let yy = yMin; yy <= yMax; yy += 2) { let k = 0; for (const p of C) if (Math.abs(p.y-yy) < BAND) k++; if (k > bestC) { bestC = k; bestY = yy; } }
const band = C.filter(p => Math.abs(p.y - bestY) < BAND && p.a < 25);
console.log(`Band y≈${bestY.toFixed(1)} ±${BAND} m, kleine Dreiecke: ${band.length}`);

const CELL = 7;
const grid = new Map();
for (const p of band) { const k = ((p.x/CELL)|0) + ',' + ((p.z/CELL)|0); (grid.get(k) || grid.set(k, []).get(k)).push(p); }
function near(x, z, r) {
  const out = [], cr = Math.ceil(r/CELL), cx = (x/CELL)|0, cz = (z/CELL)|0;
  for (let i=-cr;i<=cr;i++) for (let j=-cr;j<=cr;j++) { const arr = grid.get((cx+i)+','+(cz+j)); if (!arr) continue;
    for (const p of arr) if ((p.x-x)**2 + (p.z-z)**2 <= r*r) out.push(p); }
  return out;
}
function pca(pts) {
  let mx=0,mz=0; for (const p of pts){mx+=p.x;mz+=p.z;} mx/=pts.length; mz/=pts.length;
  let sxx=0,szz=0,sxz=0; for (const p of pts){const dx=p.x-mx,dz=p.z-mz;sxx+=dx*dx;szz+=dz*dz;sxz+=dx*dz;}
  const tr=sxx+szz, det=sxx*szz-sxz*sxz, l1=tr/2+Math.sqrt(Math.max(0,tr*tr/4-det));
  let vx=l1-szz, vz=sxz; if (Math.abs(vx)+Math.abs(vz)<1e-6){vx=1;vz=0;}
  const L=Math.hypot(vx,vz); return { mx, mz, tx:vx/L, tz:vz/L, aniso: l1/Math.max(1e-6,tr-l1) };
}
// Seed: Punkt am weitesten vom Schwerpunkt (Rand der Schleife)
let gx=0,gz=0; for (const p of band){gx+=p.x;gz+=p.z;} gx/=band.length; gz/=band.length;
let seed = band[0]; for (const p of band) if ((p.x-gx)**2+(p.z-gz)**2 > (seed.x-gx)**2+(seed.z-gz)**2) seed = p;
let cur = { x: seed.x, z: seed.z };
let dir; { const nb = near(cur.x, cur.z, R*1.5); const pc = pca(nb.length>8?nb:band); dir = { x: pc.tx, z: pc.tz }; }
const line = []; let closed = false;
for (let s = 0; s < 3000; s++) {
  let nb = near(cur.x, cur.z, R); if (nb.length < 6) nb = near(cur.x, cur.z, R*1.8);
  if (nb.length < 4) break;
  const pc = pca(nb);
  let tx = pc.tx, tz = pc.tz; if (tx*dir.x + tz*dir.z < 0) { tx=-tx; tz=-tz; }
  dir = { x: tx, z: tz };
  const nx = -tz, nz = tx;
  const off = nb.map(p => (p.x-cur.x)*nx + (p.z-cur.z)*nz).sort((a,b)=>a-b);
  const om = off[Math.floor(off.length/2)];
  const ym = nb.map(p=>p.y).sort((a,b)=>a-b)[Math.floor(nb.length/2)];
  const cx = cur.x + nx*om, cz = cur.z + nz*om;
  line.push({ x: cx, z: cz, y: ym, w: (off[off.length-1]-off[0])/2 });
  cur = { x: cx + tx*STEP, z: cz + tz*STEP };
  if (line.length > 40) { const d0 = Math.hypot(cur.x-line[0].x, cur.z-line[0].z); if (d0 < STEP*1.8) { closed = true; break; } }
}
let L2 = 0; for (let i=1;i<line.length;i++) L2 += Math.hypot(line[i].x-line[i-1].x, line[i].z-line[i-1].z);
if (closed) L2 += Math.hypot(line[0].x-line[line.length-1].x, line[0].z-line[line.length-1].z);
const halfW = med(line.map(p=>p.w).filter(w=>w>1.5&&w<30)) || 6;
console.log(`March: ${line.length} Punkte · ${(L2/1000).toFixed(2)} km · geschlossen: ${closed?'JA':'NEIN'} · halbe Breite ≈ ${halfW.toFixed(1)} m`);

// zentrieren + auf ~320 ausdünnen
let cx0=0,cz0=0,cy0=0; for (const p of line){cx0+=p.x;cz0+=p.z;cy0+=p.y;} cx0/=line.length; cz0/=line.length; cy0/=line.length;
const N = 320, out = [];
for (let i=0;i<Math.min(N,line.length);i++) { const p = line[Math.round(i*(line.length-1)/Math.max(1,Math.min(N,line.length)-1))];
  out.push([r2(p.x-cx0), r2(p.z-cz0), r2(p.y-cy0)]); }
const j = {
  name, source: path.basename(inFile), closed, lengthKm:+(L2/1000).toFixed(3),
  halfWidth:+halfW.toFixed(1), meshOffset:[r2(cx0), r2(cy0), r2(cz0)], n: out.length,
  note: 'AUTO-EXTRAHIERT — im Spiel prüfen (Deckung mit der GLB-Fahrbahn, Start/Ziel-Rotation, Boxengasse).',
  pts: out,
};
const f = path.join(ROOT, 'assets/tracks', name + '.centerline.json');
fs.writeFileSync(f, JSON.stringify(j, null, 1));
console.log('✎', path.relative(ROOT, f));

function med(a){ if(!a.length) return 0; const s=[...a].sort((x,y)=>x-y); return s[Math.floor(s.length/2)]; }
function r2(x){ return Math.round(x*100)/100; }
