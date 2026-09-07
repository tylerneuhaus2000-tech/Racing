#!/usr/bin/env node
/* ============================================================================
   track-osm-fit — echte OSM-Streckengeometrie auf ein Strecken-GLB legen
   ----------------------------------------------------------------------------
   Die Mittellinie kommt aus OpenStreetMap (highway=raceway) — vermessen und
   geschlossen. Sie wird per Ähnlichkeitstransformation (Skalierung, Drehung,
   Versatz) in die Koordinaten des GLB gelegt; bewertet wird direkt das
   Entscheidende: wie viele Linienpunkte liegen auf dem Asphalt des Modells.
   Danach Höhenprofil aus dem Modell abgreifen.

   node tools/track-osm-fit.mjs <glb> <osm.json> <name> --mat='^roada'
        [--matnot=] [--cell=2] [--n=340] [--png=/tmp/x.png] [--pit=<osm-name>]
   ============================================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';

const [inGlb, inOsm, name, ...rest] = process.argv.slice(2);
if (!inGlb || !inOsm || !name) { console.error("node tools/track-osm-fit.mjs <glb> <osm.json> <name> --mat='^roada'"); process.exit(1); }
const opt = Object.fromEntries(rest.map(a => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const CELL = parseFloat(opt.cell || '2');
const NOUT = parseInt(opt.n || '340');
const MATRE = opt.mat ? new RegExp(opt.mat, 'i') : null;
const MATNOT = opt.matnot ? new RegExp(opt.matnot, 'i') : null;

/* ── OSM: lat/lon → lokale Meter ──────────────────────────────────────── */
const osm = JSON.parse(fs.readFileSync(inOsm, 'utf8'));
const ways = osm.elements.filter(e => e.type === 'way' && e.geometry && e.geometry.length > 20);
const circuit = ways.find(w => (w.tags && w.tags.highway === 'raceway') &&
  (!opt.way || String(w.id) === String(opt.way)) &&
  w.geometry.length === Math.max(...ways.filter(x => x.tags && x.tags.highway === 'raceway').map(x => x.geometry.length)));
if (!circuit) { console.error('Keine raceway-Linie gefunden.'); process.exit(1); }
const pit = opt.pit ? ways.find(w => w.tags && (w.tags.name || '').toLowerCase().includes(String(opt.pit).toLowerCase())) : null;
const lat0 = circuit.geometry.reduce((s, g) => s + g.lat, 0) / circuit.geometry.length;
const lon0 = circuit.geometry.reduce((s, g) => s + g.lon, 0) / circuit.geometry.length;
const MPD = 111320, cosL = Math.cos(lat0 * Math.PI / 180);
const toM = g => [(g.lon - lon0) * MPD * cosL, -(g.lat - lat0) * MPD];   // x=Ost, z=Süd (Y-up-Rechtssystem)
let osmLine = circuit.geometry.map(toM);
if (osmLine.length > 2) { const a = osmLine[0], b = osmLine[osmLine.length - 1];
  if (Math.hypot(a[0]-b[0], a[1]-b[1]) < 1) osmLine.pop(); }
const osmPit = pit ? pit.geometry.map(toM) : null;
console.log(`OSM "${circuit.tags.name}": ${osmLine.length} Punkte, ${(plen(osmLine, true)/1000).toFixed(3)} km` + (osmPit ? `  · Boxengasse ${osmPit.length} Punkte` : ''));

/* ── GLB-Asphalt rastern ──────────────────────────────────────────────── */
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
await MeshoptDecoder.ready;
const doc = await io.read(inGlb);
const mv = (m,p)=>[m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12], m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13], m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14]];
const tris = [];
for (const node of doc.getRoot().listNodes()) {
  const mesh = node.getMesh(); if (!mesh) continue;
  const M = node.getWorldMatrix();
  for (const prim of mesh.listPrimitives()) {
    const mt = prim.getMaterial(); const mn = mt ? (mt.getName()||'') : '';
    if (MATRE && !MATRE.test(mn)) continue;
    if (MATNOT && MATNOT.test(mn)) continue;
    const pa = prim.getAttribute('POSITION'); if (!pa) continue;
    // getElement() dequantisiert (KHR_mesh_quantization/meshopt normalisierte
    // Koordinaten); pa.getArray() liefert dagegen die rohen, unskalierten
    // Integer-Werte — damit landet die Bounding-Box im Kilometerbereich und
    // die Rasterallokation weiter unten schlaegt fehl.
    const vertCount = pa.getCount();
    const verts = new Array(vertCount);
    for (let i=0;i<vertCount;i++) verts[i] = pa.getElement(i, []);
    const ia = prim.getIndices();
    const nT = ia ? ia.getCount()/3 : vertCount/3;
    for (let t=0;t<nT;t++){ let a,b,c;
      if(ia){a=ia.getScalar(t*3);b=ia.getScalar(t*3+1);c=ia.getScalar(t*3+2);}else{a=t*3;b=t*3+1;c=t*3+2;}
      tris.push([mv(M,verts[a]), mv(M,verts[b]), mv(M,verts[c])]); }
  }
}
let x0=Infinity,z0=Infinity,x1=-Infinity,z1=-Infinity;
for(const T of tris) for(const P of T){x0=Math.min(x0,P[0]);x1=Math.max(x1,P[0]);z0=Math.min(z0,P[2]);z1=Math.max(z1,P[2]);}
const PAD=6, W=Math.ceil((x1-x0)/CELL)+2*PAD, H=Math.ceil((z1-z0)/CELL)+2*PAD;
const gi=x=>Math.round((x-x0)/CELL)+PAD, gj=z=>Math.round((z-z0)/CELL)+PAD;
const wx=i=>(i-PAD)*CELL+x0, wz=j=>(j-PAD)*CELL+z0;
const road=new Uint8Array(W*H); const yA=new Float64Array(W*H), yN=new Uint32Array(W*H);
for (const T of tris) {
  const i0=gi(Math.min(T[0][0],T[1][0],T[2][0])), i1=gi(Math.max(T[0][0],T[1][0],T[2][0]));
  const j0=gj(Math.min(T[0][2],T[1][2],T[2][2])), j1=gj(Math.max(T[0][2],T[1][2],T[2][2]));
  const yv=(T[0][1]+T[1][1]+T[2][1])/3;
  for(let i=i0;i<=i1;i++) for(let j=j0;j<=j1;j++){
    if(i<0||j<0||i>=W||j>=H) continue;
    const px=wx(i), pz=wz(j);
    const d1=(px-T[1][0])*(T[0][2]-T[1][2])-(T[0][0]-T[1][0])*(pz-T[1][2]);
    const d2=(px-T[2][0])*(T[1][2]-T[2][2])-(T[1][0]-T[2][0])*(pz-T[2][2]);
    const d3=(px-T[0][0])*(T[2][2]-T[0][2])-(T[2][0]-T[0][0])*(pz-T[0][2]);
    if(((d1<0)||(d2<0)||(d3<0))&&((d1>0)||(d2>0)||(d3>0))) continue;
    const k=j*W+i; road[k]=1; yA[k]+=yv; yN[k]++;
  }
}
// Manche Modelle speichern die präzisen Fahrbahnkanten als sehr dünne
// Decal-Streifen. Deren Dreiecke können zwischen Rasterzellen verschwinden;
// im Punktmodus werden deshalb ihre Kanten explizit eingebrannt.
if (opt.points) {
  const mark=(x,z,y)=>{const i=gi(x),j=gj(z);for(let dj=-1;dj<=1;dj++)for(let di=-1;di<=1;di++){
    const ii=i+di,jj=j+dj;if(ii<0||jj<0||ii>=W||jj>=H)continue;
    const k=jj*W+ii;road[k]=1;yA[k]+=y;yN[k]++;
  }};
  for(const T of tris) for(let e=0;e<3;e++){
    const A=T[e],B=T[(e+1)%3],steps=Math.max(1,Math.ceil(Math.hypot(B[0]-A[0],B[2]-A[2])/CELL));
    for(let s=0;s<=steps;s++){const t=s/steps;mark(A[0]+(B[0]-A[0])*t,A[2]+(B[2]-A[2])*t,A[1]+(B[1]-A[1])*t);}
  }
}
let nR=0; for(let k=0;k<road.length;k++) if(road[k]) nR++;
console.log(`GLB-Asphalt: ${tris.length} Dreiecke → ${nR} Zellen (${CELL} m), Fläche ${(x1-x0).toFixed(0)}×${(z1-z0).toFixed(0)} m`);
const onRoad=(x,z)=>{ const i=gi(x), j=gj(z); return i>=0&&j>=0&&i<W&&j<H&&road[j*W+i]===1; };
const distToRoad=(x,z,maxR)=>{ // in Zellen suchen
  const i0=gi(x), j0=gj(z);
  for(let r=0;r<=maxR;r++){ for(let dj=-r;dj<=r;dj++) for(let di=-r;di<=r;di++){
    if(Math.max(Math.abs(di),Math.abs(dj))!==r) continue;
    const i=i0+di, j=j0+dj; if(i<0||j<0||i>=W||j>=H) continue;
    if(road[j*W+i]) return r*CELL; } }
  return Infinity; };

/* ── Fit: Skalierung × Drehung × Versatz ──────────────────────────────── */
function moments(P){ let mx=0,mz=0; for(const p of P){mx+=p[0];mz+=p[1];} mx/=P.length; mz/=P.length;
  let sxx=0,szz=0; for(const p of P){sxx+=(p[0]-mx)**2; szz+=(p[1]-mz)**2;} return {mx,mz,rms:Math.sqrt((sxx+szz)/P.length)}; }
const mO = moments(osmLine);
// Schwerpunkt des GLB-Asphalts (räumlich ausgedünnt, damit Dichte nicht dominiert)
const ds=new Map(); for(let j=0;j<H;j++)for(let i=0;i<W;i++){ if(road[j*W+i]) ds.set((i>>2)+','+(j>>2), [wx(i),wz(j)]); }
const gpts=[...ds.values()]; const mG = moments(gpts);
console.log(`OSM-RMS ${mO.rms.toFixed(1)} m · GLB-Asphalt-RMS ${mG.rms.toFixed(1)} m`);

/* Zielfunktion: MITTLERER Abstand jedes Linienpunkts zum nächsten Asphalt
   (gedeckelt). Anders als eine Trefferquote belohnt das kein Schrumpfen der
   Linie in dichte Flächen — kleiner ist strikt besser. */
const CAP = 45;
function score(sc, ang, ox, oz, mirror) {
  const cs=Math.cos(ang), sn=Math.sin(ang); let sum=0, on=0;
  for (const p of osmLine) {
    const px=mirror*p[0];
    const X = sc*(cs*px-sn*p[1])+ox, Z = sc*(sn*px+cs*p[1])+oz;
    let d = distToRoad(X, Z, Math.ceil(CAP/CELL));
    if (!isFinite(d)) d = CAP; else if (d>CAP) d = CAP;
    sum += d; if (d<=8) on++;
  }
  return { cost: sum/osmLine.length, frac: on/osmLine.length };
}
/* Skalierung ist durch die Realität gepinnt: OSM ist vermessen, das Modell
   steht in Metern (Gelände 1947x1384 m). Daher nur ein schmales Fenster. */
const SMIN = parseFloat(opt.smin || '0.90'), SMAX = parseFloat(opt.smax || '1.12');
let best={cost:Infinity};
if (opt.fixed) {
  const [sc,deg,ox,oz,mirror=1]=String(opt.fixed).split(',').map(Number);
  const ang=deg*Math.PI/180, r=score(sc,ang,ox,oz,mirror);
  best={...r,sc,ang,ox,oz,mirror};
}
for (const mirror of opt.fixed ? [] : [1,-1]) {
  for (let si=0; si<=16; si++) {
    const sc = SMIN + (SMAX-SMIN)*si/16;
    for (let ai=0; ai<180; ai++) {
      const ang = ai*Math.PI/90;
      const ox = mG.mx - sc*(Math.cos(ang)*mirror*mO.mx - Math.sin(ang)*mO.mz);
      const oz = mG.mz - sc*(Math.sin(ang)*mirror*mO.mx + Math.cos(ang)*mO.mz);
      const r = score(sc, ang, ox, oz, mirror);
      if (r.cost < best.cost) best={...r, sc, ang, ox, oz, mirror};
    }
  }
}
console.log(`Grobsuche: scale ${best.sc.toFixed(4)} · rot ${(best.ang*180/Math.PI).toFixed(1)}° · gespiegelt ${best.mirror<0?'ja':'nein'} · Ø ${best.cost.toFixed(2)} m · auf Asphalt ${(best.frac*100).toFixed(1)}%`);
let cur = best;
for (let round=0; round<(opt.fixed?0:8); round++) {
  const dS=0.05/(round+1), dA=0.18/(round+1), dT=90/(round+1);
  for (let i=0;i<900;i++) {
    let sc=cur.sc*(1+(Math.random()-0.5)*dS);
    sc = Math.max(SMIN, Math.min(SMAX, sc));
    const ang=cur.ang+(Math.random()-0.5)*dA;
    const ox=cur.ox+(Math.random()-0.5)*dT, oz=cur.oz+(Math.random()-0.5)*dT;
    const r=score(sc,ang,ox,oz,cur.mirror);
    if (r.cost < cur.cost) cur={...r,sc,ang,ox,oz,mirror:cur.mirror};
  }
}
const { sc, ang, ox, oz, mirror } = cur;
console.log(`Feinsuche: scale ${sc.toFixed(4)} · rot ${(ang*180/Math.PI).toFixed(2)}° · Versatz [${ox.toFixed(1)}, ${oz.toFixed(1)}]`);
console.log(`QUALITÄT : Ø Abstand ${cur.cost.toFixed(2)} m · ${(cur.frac*100).toFixed(1)}% der Punkte auf Asphalt (<8 m)`);

const T = p => { const cs=Math.cos(ang), sn=Math.sin(ang);
  const px=mirror*p[0];
  return [sc*(cs*px-sn*p[1])+ox, sc*(sn*px+cs*p[1])+oz]; };

/* ── Höhe aus dem Modell ──────────────────────────────────────────────── */
function sampleY(x,z){ const i0=gi(x), j0=gj(z);
  for(let r=0;r<=8;r++){ let s=0,n=0;
    for(let dj=-r;dj<=r;dj++) for(let di=-r;di<=r;di++){
      if(Math.max(Math.abs(di),Math.abs(dj))!==r) continue;
      const i=i0+di,j=j0+dj; if(i<0||j<0||i>=W||j>=H) continue;
      const k=j*W+i; if(yN[k]){ s+=yA[k]/yN[k]; n++; } }
    if(n) return s/n; }
  return null; }

let line = osmLine.map(p => { const q=T(p); const y=sampleY(q[0],q[1]); return [q[0], q[1], y]; });
// Lücken füllen
for(let i=0;i<line.length;i++) if(line[i][2]==null){
  let a=i,b=i; while(a>=0&&line[a][2]==null)a--; while(b<line.length&&line[b][2]==null)b++;
  const va=a>=0?line[a][2]:(b<line.length?line[b][2]:0), vb=b<line.length?line[b][2]:va;
  line[i][2]=(va+vb)/2; }
line = resample(line, NOUT);
for(let k=0;k<parseInt(opt.smooth||'2');k++) line = smooth(line);
const L = plen(line, true);
let cx=0,cz=0,cy=0; for(const p of line){cx+=p[0];cz+=p[1];cy+=p[2];} cx/=line.length; cz/=line.length; cy/=line.length;
const pts = line.map(p=>[r2(p[0]-cx), r2(p[1]-cz), r2(p[2]-cy)]);
const ysp = Math.max(...pts.map(p=>p[2])) - Math.min(...pts.map(p=>p[2]));
console.log(`\nERGEBNIS: ${pts.length} Punkte · ${(L/1000).toFixed(3)} km · Höhenspanne ${ysp.toFixed(1)} m`);

// Boxengasse mittransformieren (Weltkoordinaten, gleiche Zentrierung)
let pitPts = null;
if (osmPit) { pitPts = osmPit.map(p=>{ const q=T(p); const y=sampleY(q[0],q[1]);
  return [r2(q[0]-cx), r2(q[1]-cz), r2((y==null?cy:y)-cy)]; }); }

/* Kontrollbild */
if (opt.png) {
  const IW=1400, IH=Math.round(IW*(z1-z0)/(x1-x0)); const b=Buffer.alloc(IW*IH*3,16);
  const P=(x,z)=>[Math.round((x-x0)/(x1-x0)*(IW-1)), Math.round((z-z0)/(z1-z0)*(IH-1))];
  for(let j=0;j<H;j++)for(let i=0;i<W;i++){ if(!road[j*W+i])continue; const q=P(wx(i),wz(j));
    if(q[0]>=0&&q[1]>=0&&q[0]<IW&&q[1]<IH){const k=(q[1]*IW+q[0])*3;b[k]=70;b[k+1]=70;b[k+2]=70;} }
  for(const p of line){ const q=P(p[0],p[1]);
    for(let dj=-1;dj<=1;dj++)for(let di=-1;di<=1;di++){ const ii=q[0]+di,jj=q[1]+dj;
      if(ii<0||jj<0||ii>=IW||jj>=IH)continue; const k=(jj*IW+ii)*3;b[k]=255;b[k+1]=50;b[k+2]=50;} }
  if(osmPit) for(const p of osmPit){ const t=T(p); const q=P(t[0],t[1]);
    for(let dj=-1;dj<=1;dj++)for(let di=-1;di<=1;di++){ const ii=q[0]+di,jj=q[1]+dj;
      if(ii<0||jj<0||ii>=IW||jj>=IH)continue; const k=(jj*IW+ii)*3;b[k]=60;b[k+1]=140;b[k+2]=255;} }
  await sharp(b,{raw:{width:IW,height:IH,channels:3}}).png().toFile(opt.png);
  console.log('✎ Kontrollbild', opt.png);
}

const out = { name, source:path.basename(inGlb), osm:{ id:circuit.id, name:circuit.tags.name, km:+(plen(osmLine,true)/1000).toFixed(3) },
  fit:{ scale:+sc.toFixed(5), rotDeg:+(ang*180/Math.PI).toFixed(3), mirrored:mirror<0, offset:[r2(ox),r2(oz)], onAsphaltPct:+(cur.frac*100).toFixed(1), meanDist:+cur.cost.toFixed(2) },
  lengthKm:+(L/1000).toFixed(3), heightSpan:+ysp.toFixed(1),
  meshOffset:[r2(-cx), r2(-cy), r2(-cz)], n:pts.length, pts, pitPts };
const f = path.join(ROOT,'assets/tracks', name+'.centerline.json');
fs.writeFileSync(f, JSON.stringify(out,null,1));
console.log('✎', path.relative(ROOT,f));

function plen(P,c){let s=0;for(let i=1;i<P.length;i++)s+=Math.hypot(P[i][0]-P[i-1][0],P[i][1]-P[i-1][1]);if(c)s+=Math.hypot(P[0][0]-P[P.length-1][0],P[0][1]-P[P.length-1][1]);return s;}
function resample(P,n){const q=P.concat([P[0]]);const cu=[0];
  for(let i=1;i<q.length;i++)cu.push(cu[i-1]+Math.hypot(q[i][0]-q[i-1][0],q[i][1]-q[i-1][1]));
  const tt=cu[cu.length-1],o=[];
  for(let i=0;i<n;i++){const d=tt*i/n;let k=1;while(k<cu.length&&cu[k]<d)k++;
   const t=(d-cu[k-1])/Math.max(1e-6,cu[k]-cu[k-1]);
   o.push([lp(q[k-1][0],q[k][0],t),lp(q[k-1][1],q[k][1],t),lp(q[k-1][2]??0,q[k][2]??0,t)]);} return o;}
function smooth(P){return P.map((_,i)=>{const a=P[(i-1+P.length)%P.length],b=P[i],c=P[(i+1)%P.length];
  return [(a[0]+2*b[0]+c[0])/4,(a[1]+2*b[1]+c[1])/4,(a[2]+2*b[2]+c[2])/4];});}
function lp(a,b,t){return a+(b-a)*t;}
function r2(x){return Math.round(x*100)/100;}
