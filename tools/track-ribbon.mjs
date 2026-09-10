#!/usr/bin/env node
/* ============================================================================
   track-ribbon — Mittellinie aus einem Strecken-GLB
   ----------------------------------------------------------------------------
   Kern-Idee: die Rennstrecke ist ein SCHMALES BAND (~10-14 m), Fahrerlager,
   Parkplätze und Zufahrten sind breite Flächen oder dünne Stichwege. Über eine
   Distanztransformation (Abstand jeder Asphaltzelle zum Asphaltrand) lässt sich
   das Band exakt herausschneiden:  minHalf ≤ dist ≤ maxHalf.

   Danach:  größte Komponente → Ring-Loch (Infield) → Rand umlaufen →
            quer messen → Mitte + Höhe → resamplen/glätten.

   node tools/track-ribbon.mjs <glb> <name> --mat='^roada' [--matnot='pitl']
        [--cell=2] [--min=3] [--max=13] [--close=1] [--n=340] [--png=/tmp/x.png]
   ============================================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';

const [inFile, name, ...rest] = process.argv.slice(2);
if (!inFile || !name) { console.error("node tools/track-ribbon.mjs <glb> <name> --mat='^roada' [--min=3] [--max=13] [--cell=2] [--png=]"); process.exit(1); }
const opt = Object.fromEntries(rest.map(a => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const CELL = parseFloat(opt.cell || '2');
const MINH = parseFloat(opt.min || '3');
const MAXH = parseFloat(opt.max || '13');
const CLOSE = parseInt(opt.close ?? '1');
const NOUT = parseInt(opt.n || '340');
const MATRE = opt.mat ? new RegExp(opt.mat, 'i') : null;
const MATNOT = opt.matnot ? new RegExp(opt.matnot, 'i') : null;

/* ── Dreiecke ─────────────────────────────────────────────────────────── */
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
await MeshoptDecoder.ready;
const doc = await io.read(inFile);
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
    const verts = new Array(pa.getCount());
    for (let i=0;i<verts.length;i++) verts[i]=pa.getElement(i, []);
    const ia = prim.getIndices();
    const nT = ia?ia.getCount()/3:verts.length/3;
    for (let t=0;t<nT;t++){ let a,b,c;
      if(ia){a=ia.getScalar(t*3);b=ia.getScalar(t*3+1);c=ia.getScalar(t*3+2);}else{a=t*3;b=t*3+1;c=t*3+2;}
      tris.push([mv(M,verts[a]), mv(M,verts[b]), mv(M,verts[c])]); }
  }
}
console.log(`Dreiecke: ${tris.length}`);

/* ── Raster ───────────────────────────────────────────────────────────── */
let x0=Infinity,z0=Infinity,x1=-Infinity,z1=-Infinity;
for(const T of tris) for(const P of T){x0=Math.min(x0,P[0]);x1=Math.max(x1,P[0]);z0=Math.min(z0,P[2]);z1=Math.max(z1,P[2]);}
const PAD=8, W=Math.ceil((x1-x0)/CELL)+2*PAD, H=Math.ceil((z1-z0)/CELL)+2*PAD;
const gi=x=>Math.round((x-x0)/CELL)+PAD, gj=z=>Math.round((z-z0)/CELL)+PAD;
const wx=i=>(i-PAD)*CELL+x0, wz=j=>(j-PAD)*CELL+z0;
console.log(`Raster ${W}×${H} (${CELL} m), Fläche ${(x1-x0).toFixed(0)}×${(z1-z0).toFixed(0)} m`);
let road=new Uint8Array(W*H); const yA=new Float64Array(W*H), yN=new Uint32Array(W*H);
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
const cnt=a=>{let n=0;for(let k=0;k<a.length;k++) if(a[k])n++;return n;};
console.log(`Asphaltzellen: ${cnt(road)}`);
function dil(src,r){const o=new Uint8Array(src.length);
  for(let j=0;j<H;j++)for(let i=0;i<W;i++){ if(!src[j*W+i])continue;
   for(let dj=-r;dj<=r;dj++)for(let di=-r;di<=r;di++){ if(di*di+dj*dj>r*r)continue;
    const ii=i+di,jj=j+dj; if(ii>=0&&jj>=0&&ii<W&&jj<H) o[jj*W+ii]=1; } } return o;}
function ero(src,r){const o=new Uint8Array(src.length);
  for(let j=0;j<H;j++)for(let i=0;i<W;i++){ let ok=1;
   for(let dj=-r;dj<=r&&ok;dj++)for(let di=-r;di<=r&&ok;di++){ if(di*di+dj*dj>r*r)continue;
    const ii=i+di,jj=j+dj; if(ii<0||jj<0||ii>=W||jj>=H||!src[jj*W+ii]) ok=0; } o[j*W+i]=ok; } return o;}
if(CLOSE>0){ road=ero(dil(road,CLOSE),CLOSE); console.log(`nach Closing(${CLOSE}): ${cnt(road)}`); }

/* ── Distanztransformation (Chamfer 3-4) → Bandbreite je Zelle ────────── */
const INF=1e9; const dist=new Float64Array(W*H);
for(let k=0;k<W*H;k++) dist[k]= road[k]?INF:0;
for(let j=0;j<H;j++) for(let i=0;i<W;i++){ const k=j*W+i; if(!road[k])continue; let d=dist[k];
  if(i>0)d=Math.min(d,dist[k-1]+1); if(j>0)d=Math.min(d,dist[k-W]+1);
  if(i>0&&j>0)d=Math.min(d,dist[k-W-1]+1.41421); if(i<W-1&&j>0)d=Math.min(d,dist[k-W+1]+1.41421); dist[k]=d; }
for(let j=H-1;j>=0;j--) for(let i=W-1;i>=0;i--){ const k=j*W+i; if(!road[k])continue; let d=dist[k];
  if(i<W-1)d=Math.min(d,dist[k+1]+1); if(j<H-1)d=Math.min(d,dist[k+W]+1);
  if(i<W-1&&j<H-1)d=Math.min(d,dist[k+W+1]+1.41421); if(i>0&&j<H-1)d=Math.min(d,dist[k+W-1]+1.41421); dist[k]=d; }
/* Band = Zellen, deren Randabstand in [MINH, MAXH] liegt (in Metern) */
const ribbon=new Uint8Array(W*H);
for(let k=0;k<W*H;k++){ const dm=dist[k]*CELL; if(road[k]&&dm>=MINH&&dm<=MAXH) ribbon[k]=1; }
console.log(`Band (${MINH}–${MAXH} m Randabstand): ${cnt(ribbon)} Zellen`);

/* größte zusammenhängende Komponente des Bandes */
let band=new Uint8Array(W*H);
{ const id=new Int32Array(W*H).fill(-1); let best=-1,bs=0,n=0;
  for(let k=0;k<W*H;k++){ if(!ribbon[k]||id[k]>=0)continue; const c=n++; const st=[k]; id[k]=c; let sz=0;
   while(st.length){ const q=st.pop(); sz++; const i=q%W,j=(q/W)|0;
    for(let dj=-1;dj<=1;dj++)for(let di=-1;di<=1;di++){ const ii=i+di,jj=j+dj; if(ii<0||jj<0||ii>=W||jj>=H)continue;
     const nk=jj*W+ii; if(ribbon[nk]&&id[nk]<0){id[nk]=c;st.push(nk);} } }
   if(sz>bs){bs=sz;best=c;} }
  for(let k=0;k<W*H;k++) if(id[k]===best) band[k]=1;
  console.log(`größte Band-Komponente: ${bs} Zellen (${(bs*CELL*CELL/10000).toFixed(2)} ha)`); }

if(opt.pngband){ const IW=1300, IH=Math.round(IW*(z1-z0)/(x1-x0)); const b=Buffer.alloc(IW*IH*3,16);
  const P=(x,z)=>[Math.round((x-x0)/(x1-x0)*(IW-1)),Math.round((z-z0)/(z1-z0)*(IH-1))];
  for(let j=0;j<H;j++)for(let i=0;i<W;i++){ if(!road[j*W+i])continue; const q=P(wx(i),wz(j));
    if(q[0]>=0&&q[1]>=0&&q[0]<IW&&q[1]<IH){const k=(q[1]*IW+q[0])*3;b[k]=60;b[k+1]=60;b[k+2]=60;} }
  for(let j=0;j<H;j++)for(let i=0;i<W;i++){ if(!ribbon[j*W+i])continue; const q=P(wx(i),wz(j));
    if(q[0]>=0&&q[1]>=0&&q[0]<IW&&q[1]<IH){const k=(q[1]*IW+q[0])*3;b[k]=80;b[k+1]=130;b[k+2]=80;} }
  for(let j=0;j<H;j++)for(let i=0;i<W;i++){ if(!band[j*W+i])continue; const q=P(wx(i),wz(j));
    if(q[0]>=0&&q[1]>=0&&q[0]<IW&&q[1]<IH){const k=(q[1]*IW+q[0])*3;b[k]=255;b[k+1]=220;b[k+2]=60;} }
  await sharp(b,{raw:{width:IW,height:IH,channels:3}}).png().toFile(opt.pngband);
  console.log('BANDBILD', opt.pngband); }

/* Band wieder etwas verdicken, damit der Ring geschlossen ist */
const solid = dil(band, Math.max(1, Math.round(MAXH/CELL)));

/* ── Infield finden ───────────────────────────────────────────────────── */
const outside=new Uint8Array(W*H);
{ const st=[]; for(let i=0;i<W;i++){st.push(i);st.push((H-1)*W+i);} for(let j=0;j<H;j++){st.push(j*W);st.push(j*W+W-1);}
  while(st.length){ const k=st.pop(); if(k<0||k>=W*H||outside[k]||solid[k])continue; outside[k]=1;
   const i=k%W,j=(k/W)|0; if(i>0)st.push(k-1); if(i<W-1)st.push(k+1); if(j>0)st.push(k-W); if(j<H-1)st.push(k+W); } }
const hid=new Int32Array(W*H).fill(-1); let bh=-1,bhs=0,nh=0;
for(let k=0;k<W*H;k++){ if(solid[k]||outside[k]||hid[k]>=0)continue; const c=nh++; const st=[k]; hid[k]=c; let sz=0;
  while(st.length){ const q=st.pop(); sz++; const i=q%W,j=(q/W)|0;
   const nb=[]; if(i>0)nb.push(q-1); if(i<W-1)nb.push(q+1); if(j>0)nb.push(q-W); if(j<H-1)nb.push(q+W);
   for(const n2 of nb) if(!solid[n2]&&!outside[n2]&&hid[n2]<0){hid[n2]=c;st.push(n2);} }
  if(sz>bhs){bhs=sz;bh=c;} }
console.log(`Löcher: ${nh}, Infield: ${bhs} Zellen (${(bhs*CELL*CELL/10000).toFixed(1)} ha)`);
if(bh<0||bhs<50){ console.error('Kein brauchbares Infield — Ring nicht geschlossen. --max/--close erhöhen.'); process.exit(1); }
const infield=new Uint8Array(W*H); for(let k=0;k<W*H;k++) if(hid[k]===bh) infield[k]=1;

/* ── Rand des Infields umlaufen ───────────────────────────────────────── */
const N8=[[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]];
let sI=-1,sJ=-1; outer: for(let j=0;j<H;j++)for(let i=0;i<W;i++) if(infield[j*W+i]){sI=i;sJ=j;break outer;}
const cont=[]; { let ci=sI,cj=sJ,dir=0,g=0;
  do { cont.push([ci,cj]); let f=false;
    for(let s=0;s<8;s++){ const d=(dir+6+s)%8, ni=ci+N8[d][0], nj=cj+N8[d][1];
      if(ni<0||nj<0||ni>=W||nj>=H) continue;
      if(infield[nj*W+ni]){ci=ni;cj=nj;dir=d;f=true;break;} }
    if(!f) break;
  } while((ci!==sI||cj!==sJ)&&++g<500000); }
console.log(`Infield-Rand: ${cont.length} Zellen`);
if(cont.length<80){ console.error('Randumlauf zu kurz.'); process.exit(1); }

/* ── quer messen: Mitte + Breite + Höhe ───────────────────────────────── */
const isR=(i,j)=>i>=0&&j>=0&&i<W&&j<H&&road[j*W+i]===1;
const K=Math.max(3,Math.round(10/CELL)); const mid=[],wid=[];
for(let n=0;n<cont.length;n++){
  const a=cont[(n-K+cont.length)%cont.length], b=cont[(n+K)%cont.length];
  let tx=b[0]-a[0],tz=b[1]-a[1]; const tl=Math.hypot(tx,tz)||1; tx/=tl; tz/=tl;
  let nx=-tz,nz=tx; const [ci,cj]=cont[n];
  const probe=(sx,sz)=>{ let d=0; for(let s=1;s<=Math.ceil(MAXH*2.5/CELL/0.5);s++){
    const ii=Math.round(ci+sx*s*0.5), jj=Math.round(cj+sz*s*0.5); if(!isR(ii,jj)) break; d=s*0.5; } return d; };
  let dP=probe(nx,nz), dM=probe(-nx,-nz);
  if(dM>dP){ nx=-nx; nz=-nz; dP=dM; }
  if(dP<1) continue;
  const wM=dP*CELL; if(wM<MINH || wM>MAXH*2.4) continue;
  const mi=ci+nx*dP/2, mj=cj+nz*dP/2;
  let ys=0,yn=0; for(let di=-1;di<=1;di++)for(let dj=-1;dj<=1;dj++){
    const ii=Math.round(mi)+di, jj=Math.round(mj)+dj; if(ii<0||jj<0||ii>=W||jj>=H)continue;
    const k=jj*W+ii; if(yN[k]){ys+=yA[k]/yN[k];yn++;} }
  mid.push([wx(mi),wz(mj),yn?ys/yn:0]); wid.push(wM);
}
console.log(`Mittelpunkte: ${mid.length}, Breite Median ${med(wid).toFixed(1)} m`);
if(mid.length<80){ console.error('Zu wenige Mittelpunkte.'); process.exit(1); }

/* ── resample/glätten ─────────────────────────────────────────────────── */
function plen(P,c){let s=0;for(let i=1;i<P.length;i++)s+=Math.hypot(P[i][0]-P[i-1][0],P[i][1]-P[i-1][1]);if(c)s+=Math.hypot(P[0][0]-P[P.length-1][0],P[0][1]-P[P.length-1][1]);return s;}
function resample(P,n){const q=P.concat([P[0]]);const cu=[0];
  for(let i=1;i<q.length;i++)cu.push(cu[i-1]+Math.hypot(q[i][0]-q[i-1][0],q[i][1]-q[i-1][1]));
  const tt=cu[cu.length-1],o=[];
  for(let i=0;i<n;i++){const d=tt*i/n;let k=1;while(k<cu.length&&cu[k]<d)k++;
   const t=(d-cu[k-1])/Math.max(1e-6,cu[k]-cu[k-1]);
   o.push([lp(q[k-1][0],q[k][0],t),lp(q[k-1][1],q[k][1],t),lp(q[k-1][2],q[k][2],t)]);} return o;}
function smooth(P){return P.map((_,i)=>{const a=P[(i-1+P.length)%P.length],b=P[i],c=P[(i+1)%P.length];
  return [(a[0]+2*b[0]+c[0])/4,(a[1]+2*b[1]+c[1])/4,(a[2]+2*b[2]+c[2])/4];});}
function lp(a,b,t){return a+(b-a)*t;} function med(a){if(!a.length)return 0;const s=[...a].sort((x,y)=>x-y);return s[(s.length/2)|0];}
let line=resample(mid,NOUT); for(let k=0;k<parseInt(opt.smooth||'4');k++) line=smooth(line);
const L=plen(line,true), halfW=Math.max(4,Math.min(12,med(wid)/2));
let cx=0,cz=0,cy=0; for(const p of line){cx+=p[0];cz+=p[1];cy+=p[2];} cx/=line.length;cz/=line.length;cy/=line.length;
const pts=line.map(p=>[r2(p[0]-cx),r2(p[1]-cz),r2(p[2]-cy)]);
const ysp=Math.max(...pts.map(p=>p[2]))-Math.min(...pts.map(p=>p[2]));
console.log(`\nERGEBNIS: ${pts.length} Punkte · ${(L/1000).toFixed(3)} km · halbe Breite ${halfW.toFixed(1)} m · Höhenspanne ${ysp.toFixed(1)} m`);

if(opt.png){ const IW=1200, IH=Math.round(IW*(z1-z0)/(x1-x0)); const b=Buffer.alloc(IW*IH*3,16);
  const P=(x,z)=>[Math.round((x-x0)/(x1-x0)*(IW-1)),Math.round((z-z0)/(z1-z0)*(IH-1))];
  for(let j=0;j<H;j++)for(let i=0;i<W;i++){ if(!road[j*W+i])continue; const [a,c]=P(wx(i),wz(j));
    if(a>=0&&c>=0&&a<IW&&c<IH){const k=(c*IW+a)*3;b[k]=70;b[k+1]=70;b[k+2]=70;} }
  for(let j=0;j<H;j++)for(let i=0;i<W;i++){ if(!band[j*W+i])continue; const [a,c]=P(wx(i),wz(j));
    if(a>=0&&c>=0&&a<IW&&c<IH){const k=(c*IW+a)*3;b[k]=200;b[k+1]=200;b[k+2]=90;} }
  for(const p of line){ const [a,c]=P(p[0],p[1]); for(let dj=-1;dj<=1;dj++)for(let di=-1;di<=1;di++){
    const ii=a+di,jj=c+dj; if(ii<0||jj<0||ii>=IW||jj>=IH)continue; const k=(jj*IW+ii)*3;b[k]=255;b[k+1]=40;b[k+2]=40;} }
  await sharp(b,{raw:{width:IW,height:IH,channels:3}}).png().toFile(opt.png);
  console.log('✎ Kontrollbild', opt.png); }

const out={name,source:path.basename(inFile),method:'ribbon+ring',lengthKm:+(L/1000).toFixed(3),
  halfWidth:+halfW.toFixed(1),heightSpan:+ysp.toFixed(1),meshOffset:[r2(cx),r2(cy),r2(cz)],n:pts.length,pts};
const f=path.join(ROOT,'assets/tracks',name+'.centerline.json');
fs.writeFileSync(f,JSON.stringify(out,null,1));
console.log('✎',path.relative(ROOT,f));
function r2(x){return Math.round(x*100)/100;}
