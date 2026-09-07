#!/usr/bin/env node
/* ============================================================================
   track-ring — Mittellinie aus einem Strecken-GLB über die RING-TOPOLOGIE
   ----------------------------------------------------------------------------
   Statt eine Punktwolke zu "marchen" (bricht an Kurven/Auslaufzonen ab) wird
   hier die Struktur ausgenutzt: eine Rennstrecke ist ein geschlossener Ring.

     1. Fahrbahn-Dreiecke (Material-Filter) in ein 2D-Raster einbrennen
     2. Löcher/Fugen schließen (morphologisches Closing)
     3. Hintergrund fluten: was NICHT vom Rand aus erreichbar ist, ist Infield
     4. Rand des Infields per Moore-Nachbar-Tracing umlaufen  -> geordnete Schleife
     5. je Randpunkt quer nach außen messen bis die Fahrbahn endet
        -> Breite + Mittelpunkt; Höhe aus den Fahrbahn-Dreiecken darunter
     6. resamplen, glätten, schließen

   Aufruf:
     node tools/track-ring.mjs <glb> <name> --mat='^roada' [--matnot='pitl']
          [--cell=2] [--close=2] [--n=340] [--scale=1] [--maxw=30]
   Schreibt: assets/tracks/<name>.centerline.json
   ============================================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';

const [inFile, name, ...rest] = process.argv.slice(2);
if (!inFile || !name) { console.error("node tools/track-ring.mjs <glb> <name> --mat='^roada' [--matnot=] [--cell=2] [--close=2] [--n=340]"); process.exit(1); }
const opt = Object.fromEntries(rest.map(a => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const CELL = parseFloat(opt.cell || '2');
const CLOSE = parseInt(opt.close || '2');
const NOUT = parseInt(opt.n || '340');
const GS = parseFloat(opt.scale || '1');
const MAXW = parseFloat(opt.maxw || '30');
const MATRE = opt.mat ? new RegExp(opt.mat, 'i') : null;
const MATNOT = opt.matnot ? new RegExp(opt.matnot, 'i') : null;

/* ── 1) Fahrbahn-Dreiecke laden ───────────────────────────────────────── */
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
await MeshoptDecoder.ready;
const doc = await io.read(inFile);
const mv = (m, p) => [m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12], m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13], m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14]];
const tris = [];
for (const node of doc.getRoot().listNodes()) {
  const mesh = node.getMesh(); if (!mesh) continue;
  const M = node.getWorldMatrix();
  for (const prim of mesh.listPrimitives()) {
    const mt = prim.getMaterial(); const mn = mt ? (mt.getName() || '') : '';
    if (MATRE && !MATRE.test(mn)) continue;
    if (MATNOT && MATNOT.test(mn)) continue;
    const pa = prim.getAttribute('POSITION'); if (!pa) continue;
    const verts = new Array(pa.getCount());
    for (let i=0;i<verts.length;i++) verts[i]=pa.getElement(i, []);
    const ia = prim.getIndices();
    const nT = ia ? ia.getCount()/3 : verts.length/3;
    for (let t = 0; t < nT; t++) {
      let a,b,c;
      if (ia) { a=ia.getScalar(t*3); b=ia.getScalar(t*3+1); c=ia.getScalar(t*3+2); } else { a=t*3; b=t*3+1; c=t*3+2; }
      const A = mv(M,verts[a]), B = mv(M,verts[b]), D = mv(M,verts[c]);
      tris.push([[GS*A[0],GS*A[1],GS*A[2]],[GS*B[0],GS*B[1],GS*B[2]],[GS*D[0],GS*D[1],GS*D[2]]]);
    }
  }
}
console.log(`Fahrbahn-Dreiecke: ${tris.length}`);
if (!tris.length) { console.error('Nichts gefunden — Material-Filter prüfen.'); process.exit(1); }

/* ── 2) Raster ────────────────────────────────────────────────────────── */
let minX=Infinity,minZ=Infinity,maxX=-Infinity,maxZ=-Infinity;
for (const T of tris) for (const P of T) { minX=Math.min(minX,P[0]); maxX=Math.max(maxX,P[0]); minZ=Math.min(minZ,P[2]); maxZ=Math.max(maxZ,P[2]); }
const PAD = 6;
const W = Math.ceil((maxX-minX)/CELL) + 2*PAD, H = Math.ceil((maxZ-minZ)/CELL) + 2*PAD;
const gx = x => Math.round((x-minX)/CELL) + PAD, gz = z => Math.round((z-minZ)/CELL) + PAD;
const wx = i => (i-PAD)*CELL + minX,           wz = j => (j-PAD)*CELL + minZ;
console.log(`Raster ${W}×${H} (${CELL} m/Zelle), Fläche ${(maxX-minX).toFixed(0)}×${(maxZ-minZ).toFixed(0)} m`);
let road = new Uint8Array(W*H);
const yAcc = new Float64Array(W*H), yCnt = new Uint32Array(W*H);
// Dreiecke rastern (Bounding-Box + Punkt-in-Dreieck)
function edge(ax,az,bx,bz,px,pz){ return (px-ax)*(bz-az) - (pz-az)*(bx-ax); }
for (const T of tris) {
  const x0=Math.min(T[0][0],T[1][0],T[2][0]), x1=Math.max(T[0][0],T[1][0],T[2][0]);
  const z0=Math.min(T[0][2],T[1][2],T[2][2]), z1=Math.max(T[0][2],T[1][2],T[2][2]);
  const i0=gx(x0), i1=gx(x1), j0=gz(z0), j1=gz(z1);
  const yAvg=(T[0][1]+T[1][1]+T[2][1])/3;
  for (let i=i0;i<=i1;i++) for (let j=j0;j<=j1;j++) {
    if (i<0||j<0||i>=W||j>=H) continue;
    const px=wx(i), pz=wz(j);
    const d1=edge(T[0][0],T[0][2],T[1][0],T[1][2],px,pz);
    const d2=edge(T[1][0],T[1][2],T[2][0],T[2][2],px,pz);
    const d3=edge(T[2][0],T[2][2],T[0][0],T[0][2],px,pz);
    const neg=(d1<0)||(d2<0)||(d3<0), pos=(d1>0)||(d2>0)||(d3>0);
    if (neg&&pos) continue;
    const k=j*W+i; road[k]=1; yAcc[k]+=yAvg; yCnt[k]++;
  }
}
let nRoad=0; for (let k=0;k<road.length;k++) if (road[k]) nRoad++;
console.log(`belegte Zellen: ${nRoad}`);

/* ── 2b) Closing (dilate → erode), schließt Fugen zwischen den Materialien */
function dilate(src, r) {
  const out = new Uint8Array(src.length);
  for (let j=0;j<H;j++) for (let i=0;i<W;i++) {
    if (!src[j*W+i]) continue;
    for (let dj=-r;dj<=r;dj++) for (let di=-r;di<=r;di++) {
      const ii=i+di, jj=j+dj; if (ii<0||jj<0||ii>=W||jj>=H) continue;
      if (di*di+dj*dj<=r*r) out[jj*W+ii]=1;
    }
  }
  return out;
}
function erode(src, r) {
  const out = new Uint8Array(src.length);
  for (let j=0;j<H;j++) for (let i=0;i<W;i++) {
    let ok=1;
    for (let dj=-r;dj<=r && ok;dj++) for (let di=-r;di<=r && ok;di++) {
      if (di*di+dj*dj>r*r) continue;
      const ii=i+di, jj=j+dj;
      if (ii<0||jj<0||ii>=W||jj>=H||!src[jj*W+ii]) ok=0;
    }
    out[j*W+i]=ok;
  }
  return out;
}
if (CLOSE>0) { road = erode(dilate(road, CLOSE), CLOSE); let n2=0; for(let k=0;k<road.length;k++) if(road[k]) n2++; console.log(`nach Closing(${CLOSE}): ${n2}`); }

/* ── 3) Infield finden: Hintergrund vom Rand fluten, Rest sind Löcher ─── */
const outside = new Uint8Array(W*H);
{
  const st=[];
  for (let i=0;i<W;i++){ st.push(i); st.push((H-1)*W+i); }
  for (let j=0;j<H;j++){ st.push(j*W); st.push(j*W+W-1); }
  while (st.length) {
    const k=st.pop(); if (k<0||k>=W*H||outside[k]||road[k]) continue;
    outside[k]=1;
    const i=k%W, j=(k/W)|0;
    if(i>0)st.push(k-1); if(i<W-1)st.push(k+1); if(j>0)st.push(k-W); if(j<H-1)st.push(k+W);
  }
}
// Löcher = nicht road, nicht outside -> größte Komponente = Infield
const holeId = new Int32Array(W*H).fill(-1);
let bestHole=-1, bestSize=0, nHoles=0;
for (let k=0;k<W*H;k++) {
  if (road[k]||outside[k]||holeId[k]>=0) continue;
  const id=nHoles++; const st=[k]; holeId[k]=id; let size=0;
  while (st.length) {
    const c=st.pop(); size++;
    const i=c%W, j=(c/W)|0;
    const nb=[]; if(i>0)nb.push(c-1); if(i<W-1)nb.push(c+1); if(j>0)nb.push(c-W); if(j<H-1)nb.push(c+W);
    for (const n of nb) if (!road[n] && !outside[n] && holeId[n]<0) { holeId[n]=id; st.push(n); }
  }
  if (size>bestSize){ bestSize=size; bestHole=id; }
}
console.log(`Löcher: ${nHoles}, größtes (Infield): ${bestSize} Zellen ≈ ${(bestSize*CELL*CELL/10000).toFixed(1)} ha`);
if (bestHole<0) { console.error('Kein Infield gefunden — Ring nicht geschlossen. --close erhöhen oder --cell vergrößern.'); process.exit(1); }
const infield = new Uint8Array(W*H);
for (let k=0;k<W*H;k++) if (holeId[k]===bestHole) infield[k]=1;

/* ── 4) Rand des Infields umlaufen (Moore-Nachbar-Tracing) ────────────── */
const N8 = [[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]];
let sI=-1,sJ=-1;
outer: for (let j=0;j<H;j++) for (let i=0;i<W;i++) if (infield[j*W+i]) { sI=i; sJ=j; break outer; }
const contour=[];
{
  let ci=sI, cj=sJ, dir=0;
  const startI=ci, startJ=cj;
  let guard=0;
  do {
    contour.push([ci,cj]);
    let found=false;
    for (let s=0;s<8;s++) {
      const d=(dir+6+s)%8;                 // ab "rechts hinten" im Uhrzeigersinn suchen
      const ni=ci+N8[d][0], nj=cj+N8[d][1];
      if (ni<0||nj<0||ni>=W||nj>=H) continue;
      if (infield[nj*W+ni]) { ci=ni; cj=nj; dir=d; found=true; break; }
    }
    if (!found) break;
  } while ((ci!==startI||cj!==startJ) && ++guard<400000);
  console.log(`Infield-Rand: ${contour.length} Zellen (Umlauf ${guard<400000?'geschlossen':'ABBRUCH'})`);
}
if (contour.length<50) { console.error('Randumlauf zu kurz.'); process.exit(1); }

/* ── 5) je Randpunkt quer nach außen bis Fahrbahnende → Mitte + Breite ── */
function isRoad(i,j){ return i>=0&&j>=0&&i<W&&j<H&&road[j*W+i]===1; }
// glatte Kontur-Normale aus Nachbarn im Abstand k
const K = Math.max(3, Math.round(8/CELL));
const mid=[], widths=[];
for (let n=0;n<contour.length;n++) {
  const a=contour[(n-K+contour.length)%contour.length], b=contour[(n+K)%contour.length];
  let tx=b[0]-a[0], tz=b[1]-a[1]; const tl=Math.hypot(tx,tz)||1; tx/=tl; tz/=tl;
  // Von der Infield-Zelle aus liegt der Asphalt je nach Konturrichtung auf
  // einer der beiden Normalen. Erst den Eintritt suchen, dann bis zum
  // gegenüberliegenden Fahrbahnrand messen.
  let nx=-tz, nz=tx;
  const [ci,cj]=contour[n];
  const probe=(sx,sz)=>{const stepC=.25,maxSteps=Math.ceil(MAXW/CELL/stepC);let first=-1,last=-1;
    for(let s=1;s<=maxSteps;s++){const d=s*stepC,hit=isRoad(Math.round(ci+sx*d),Math.round(cj+sz*d));
      if(hit&&first<0)first=d;if(hit)last=d;else if(first>=0)break;}
    return first<0?null:{first,last,width:last-first+1};};
  const pa=probe(nx,nz),pb=probe(-nx,-nz);
  let q=pa;
  if(!q||(pb&&pb.width>q.width)){q=pb;nx=-nx;nz=-nz;}
  if(!q||q.width*CELL<3) continue;
  const wM=q.width*CELL, center=(q.first+q.last)/2;
  const mi=ci+nx*center, mj=cj+nz*center;
  // Höhe aus dem Raster (Umgebung mitteln)
  let ys=0, yn=0;
  for (let di=-1;di<=1;di++) for (let dj=-1;dj<=1;dj++) {
    const ii=Math.round(mi)+di, jj=Math.round(mj)+dj;
    if (ii<0||jj<0||ii>=W||jj>=H) continue;
    const k=jj*W+ii; if (yCnt[k]) { ys+=yAcc[k]/yCnt[k]; yn++; }
  }
  mid.push([wx(mi), wz(mj), yn?ys/yn:0]);
  widths.push(wM);
}
console.log(`Mittelpunkte: ${mid.length}, Breite Median ${med(widths).toFixed(1)} m`);

/* ── 6) resamplen + glätten ───────────────────────────────────────────── */
function plen(P, closed){ let s=0; for(let i=1;i<P.length;i++) s+=Math.hypot(P[i][0]-P[i-1][0],P[i][1]-P[i-1][1]); if(closed) s+=Math.hypot(P[0][0]-P[P.length-1][0],P[0][1]-P[P.length-1][1]); return s; }
function resample(P,n){ const q=P.concat([P[0]]); const cum=[0];
  for(let i=1;i<q.length;i++) cum.push(cum[i-1]+Math.hypot(q[i][0]-q[i-1][0],q[i][1]-q[i-1][1]));
  const tot=cum[cum.length-1], out=[];
  for(let i=0;i<n;i++){ const d=tot*i/n; let k=1; while(k<cum.length&&cum[k]<d)k++;
    const t=(d-cum[k-1])/Math.max(1e-6,cum[k]-cum[k-1]);
    out.push([lerp(q[k-1][0],q[k][0],t), lerp(q[k-1][1],q[k][1],t), lerp(q[k-1][2],q[k][2],t)]); }
  return out; }
function smooth(P){ return P.map((_,i)=>{ const a=P[(i-1+P.length)%P.length], b=P[i], c=P[(i+1)%P.length];
  return [(a[0]+2*b[0]+c[0])/4,(a[1]+2*b[1]+c[1])/4,(a[2]+2*b[2]+c[2])/4]; }); }
function lerp(a,b,t){ return a+(b-a)*t; }
function med(a){ if(!a.length) return 0; const s=[...a].sort((x,y)=>x-y); return s[(s.length/2)|0]; }

let line = resample(mid, NOUT);
for (let k=0;k<parseInt(opt.smooth||'3');k++) line = smooth(line);
const L = plen(line, true);
const halfW = Math.max(3, Math.min(14, med(widths)/2));
// zentrieren
let cx=0,cz=0,cy=0; for(const p of line){cx+=p[0];cz+=p[1];cy+=p[2];} cx/=line.length; cz/=line.length; cy/=line.length;
const pts = line.map(p=>[r2(p[0]-cx), r2(p[1]-cz), r2(p[2]-cy)]);
const yspan = Math.max(...pts.map(p=>p[2])) - Math.min(...pts.map(p=>p[2]));
console.log(`ERGEBNIS: ${pts.length} Punkte · ${(L/1000).toFixed(3)} km · halbe Breite ${halfW.toFixed(1)} m · Höhenspanne ${yspan.toFixed(1)} m`);

const out = { name, source: path.basename(inFile), method:'ring-topologie',
  lengthKm:+(L/1000).toFixed(3), halfWidth:+halfW.toFixed(1), heightSpan:+yspan.toFixed(1),
  meshOffset:[r2(-cx), r2(-cy), r2(-cz)], n: pts.length, pts };
const f = path.join(ROOT,'assets/tracks', name+'.centerline.json');
fs.writeFileSync(f, JSON.stringify(out,null,1));
console.log('✎', path.relative(ROOT,f));
function r2(x){ return Math.round(x*100)/100; }
