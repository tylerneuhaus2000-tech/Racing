#!/usr/bin/env node
/* ============================================================================
   track-render — Draufsicht eines Strecken-GLB als PNG, mit Koordinatengitter.
   Verschiedene Materialgruppen in verschiedenen Farben, damit man die
   Rennstrecke von Zufahrten/Fahrerlager unterscheiden kann.

   node tools/track-render.mjs <glb> <out.png> [--w=1600] [--scale=1]
        [--layer='road:^roada:200,200,200' --layer='wall:^(wall|twal):255,80,80' ...]
   Default-Layer: road (grau), wall (rot), pit (blau), start (grün)
   ============================================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';

const [inFile, outPng, ...rest] = process.argv.slice(2);
if (!inFile || !outPng) { console.error('node tools/track-render.mjs <glb> <out.png> [--w=1600] [--scale=1] [--layer=name:regex:r,g,b]'); process.exit(1); }
const opt = {}; const layerArgs = [];
for (const a of rest) { const m = a.match(/^--([^=]+)(?:=(.*))?$/); if (!m) continue; if (m[1] === 'layer') layerArgs.push(m[2]); else opt[m[1]] = m[2] ?? true; }
const IMGW = parseInt(opt.w || '1600');
const GS = parseFloat(opt.scale || '1');

const LAYERS = layerArgs.length ? layerArgs.map(s => { const [n, re, col] = s.split(':'); return { n, re: new RegExp(re, 'i'), col: col.split(',').map(Number) }; })
  : [
    { n: 'road',  re: /^roada|^rdta|^road/i,        col: [170, 170, 170] },
    { n: 'pit',   re: /pitl|pitcentral/i,           col: [80, 140, 255] },
    { n: 'wall',  re: /^wall|^twal/i,               col: [255, 70, 70] },
    { n: 'start', re: /^start(green|red)/i,         col: [60, 255, 60] },
    { n: 'kerb',  re: /kerb|curb|rumble/i,          col: [255, 210, 60] },
  ];

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
await MeshoptDecoder.ready;
const doc = await io.read(inFile);
const mv = (m, p) => [m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12], m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13], m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14]];

const items = [];   // {layer, tri}
for (const node of doc.getRoot().listNodes()) {
  const mesh = node.getMesh(); if (!mesh) continue;
  const M = node.getWorldMatrix();
  for (const prim of mesh.listPrimitives()) {
    const mt = prim.getMaterial(); const mn = mt ? (mt.getName() || '') : '';
    const li = LAYERS.findIndex(L => L.re.test(mn));
    if (li < 0) continue;
    const pa = prim.getAttribute('POSITION'); if (!pa) continue;
    const ia = prim.getIndices(); const idx = ia ? ia.getArray() : null;
    const nT = idx ? idx.length/3 : pa.getCount()/3;
    for (let t = 0; t < nT; t++) {
      const a=idx ? idx[t*3] : t*3, b=idx ? idx[t*3+1] : t*3+1, c=idx ? idx[t*3+2] : t*3+2;
      /* getElement decodiert quantisierte/meshopt-komprimierte Accessors. Ein
         direktes getArray lieferte hier Rohwerte und machte die Strecke in der
         Diagnose fälschlich zigtausend Kilometer groß. */
      const A=mv(M,pa.getElement(a,[])), B=mv(M,pa.getElement(b,[])), D=mv(M,pa.getElement(c,[]));
      items.push([li, [GS*A[0],GS*A[2]], [GS*B[0],GS*B[2]], [GS*D[0],GS*D[2]]]);
    }
  }
}
console.log(`Dreiecke in Layern: ${items.length}`);
let x0=Infinity,z0=Infinity,x1=-Infinity,z1=-Infinity;
for (const it of items) for (let k=1;k<=3;k++){ x0=Math.min(x0,it[k][0]); x1=Math.max(x1,it[k][0]); z0=Math.min(z0,it[k][1]); z1=Math.max(z1,it[k][1]); }
if (opt.crop) { const c=opt.crop.split(',').map(Number); x0=c[0]; z0=c[1]; x1=c[2]; z1=c[3]; }
const pad = 20;
const spanX = x1-x0, spanZ = z1-z0;
const IMGH = Math.round(IMGW * spanZ / spanX);
const px = x => Math.round((x - x0) / spanX * (IMGW - 2*pad)) + pad;
const pz = z => Math.round((z - z0) / spanZ * (IMGH - 2*pad)) + pad;
console.log(`Fläche ${spanX.toFixed(0)}×${spanZ.toFixed(0)} m → Bild ${IMGW}×${IMGH}`);

const buf = Buffer.alloc(IMGW*IMGH*3, 16);
function setpx(i,j,col,strong){ if(i<0||j<0||i>=IMGW||j>=IMGH) return; const k=(j*IMGW+i)*3;
  if (!strong && buf[k]>60 && col[0]<buf[k]) return;   // hellere Layer nicht überschreiben
  buf[k]=col[0]; buf[k+1]=col[1]; buf[k+2]=col[2]; }
// Layer von unten nach oben zeichnen
for (let li=0; li<LAYERS.length; li++) {
  const col = LAYERS[li].col;
  for (const it of items) {
    if (it[0]!==li) continue;
    const A=[px(it[1][0]),pz(it[1][1])], B=[px(it[2][0]),pz(it[2][1])], C=[px(it[3][0]),pz(it[3][1])];
    const mnx=Math.min(A[0],B[0],C[0]), mxx=Math.max(A[0],B[0],C[0]);
    const mnz=Math.min(A[1],B[1],C[1]), mxz=Math.max(A[1],B[1],C[1]);
    if ((mxx-mnx)*(mxz-mnz) > 40000) continue;                 // Riesenflächen überspringen
    for (let i=mnx;i<=mxx;i++) for (let j=mnz;j<=mxz;j++) {
      const d1=(i-B[0])*(A[1]-B[1])-(A[0]-B[0])*(j-B[1]);
      const d2=(i-C[0])*(B[1]-C[1])-(B[0]-C[0])*(j-C[1]);
      const d3=(i-A[0])*(C[1]-A[1])-(C[0]-A[0])*(j-A[1]);
      if (((d1<0)||(d2<0)||(d3<0)) && ((d1>0)||(d2>0)||(d3>0))) continue;
      setpx(i,j,col, li>0);
    }
    if (mxx-mnx<2 && mxz-mnz<2) setpx(A[0],A[1],col,li>0);
  }
}
/* Koordinatengitter alle 100 m + Beschriftung als Punktraster */
const GRID = parseFloat(opt.grid || '100');
for (let X=Math.ceil(x0/GRID)*GRID; X<=x1; X+=GRID) { const i=px(X); for(let j=0;j<IMGH;j+=3) setpx(i,j,[70,70,110],true); }
for (let Z=Math.ceil(z0/GRID)*GRID; Z<=z1; Z+=GRID) { const j=pz(Z); for(let i=0;i<IMGW;i+=3) setpx(i,j,[70,70,110],true); }
// 500-m-Linien kräftiger
for (let X=Math.ceil(x0/500)*500; X<=x1; X+=500) { const i=px(X); for(let j=0;j<IMGH;j++){setpx(i,j,[120,120,190],true);setpx(i+1,j,[120,120,190],true);} }
for (let Z=Math.ceil(z0/500)*500; Z<=z1; Z+=500) { const j=pz(Z); for(let i=0;i<IMGW;i++){setpx(i,j,[120,120,190],true);setpx(i,j+1,[120,120,190],true);} }

await sharp(buf, { raw: { width: IMGW, height: IMGH, channels: 3 } }).png().toFile(outPng);
console.log('✎', outPng);
console.log(`WELT-BEZUG:  x ${x0.toFixed(0)} … ${x1.toFixed(0)}   z ${z0.toFixed(0)} … ${z1.toFixed(0)}`);
console.log(`Bildpunkt(i,j) → Welt:  x = ${x0.toFixed(1)} + (i-${pad})/${IMGW-2*pad} * ${spanX.toFixed(1)}`);
console.log(`                        z = ${z0.toFixed(1)} + (j-${pad})/${IMGH-2*pad} * ${spanZ.toFixed(1)}`);
console.log(`Gitter: dünn ${GRID} m, kräftig 500 m`);
console.log('Layer:', LAYERS.map(L=>`${L.n}=rgb(${L.col})`).join('  '));
