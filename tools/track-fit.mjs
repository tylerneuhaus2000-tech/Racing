#!/usr/bin/env node
/* ============================================================================
   track-fit — ein Strecken-GLB auf eine BESTEHENDE Centerline legen
   ----------------------------------------------------------------------------
   Statt die Mittellinie blind aus dem Modell zu extrahieren (scheitert bei
   Sketchfab-Rips ohne benannte Fahrbahn-Mesh), wird hier andersrum gerechnet:
   die vorhandene, funktionierende Linie aus tracks.js ist die WAHRHEIT, und
   das Modell wird per Ähnlichkeitstransformation (Skalierung, Y-Rotation,
   Versatz) darauf gelegt — genau die drei Werte, die das Spiel in
   `mesh.scale`, `mesh.rotY`, `mesh.offset` anwendet.

   Ablauf:
     1. flache Dreiecks-Zentroide aus dem GLB (Welt, Y-up, optional --scale)
     2. Momenten-Abgleich (Schwerpunkt, Hauptachse, RMS-Radius) → Startlösung
     3. ICP-Verfeinerung (nächster Nachbar + Umeyama) über wenige Runden
     4. Qualitätsbericht + Höhenprofil für jeden Linienpunkt

   Aufruf:
     node tools/track-fit.mjs <glb> <trackId> [--scale=0.125] [--band=8]
                              [--icp=12] [--flip] [--out=name]
   Schreibt: assets/tracks/<trackId>.fit.json
             { mesh:{offset,rotY,scale}, ptsY:[...], quality:{...} }
   ============================================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';

const [inFile, trackId, ...rest] = process.argv.slice(2);
if (!inFile || !trackId) { console.error('node tools/track-fit.mjs <glb> <trackId> [--scale=] [--band=] [--icp=] [--flip]'); process.exit(1); }
const opt = Object.fromEntries(rest.map(a => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const GSCALE = parseFloat(opt.scale || '1');
const BAND = parseFloat(opt.band || '8');
const ICP = parseInt(opt.icp || '12');

/* ── 1) Linie aus tracks.js holen ─────────────────────────────────────── */
const tsrc = fs.readFileSync(path.join(ROOT, 'assets/tracks.js'), 'utf8');
const TRACKS = eval('(' + tsrc.replace(/^[\s\S]*?const TRACKS\s*=\s*/, '').replace(/;\s*$/, '') + ')');
const track = TRACKS.find(t => t.id === trackId);
if (!track) { console.error('Track nicht gefunden:', trackId); process.exit(1); }
const guide = track.pts.map(p => [p[0], p[1]]);          // [x, z]
console.log(`Linie "${track.name}": ${guide.length} Punkte`);

/* ── 2) flache Zentroide aus dem GLB ──────────────────────────────────── */
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
await MeshoptDecoder.ready;
const doc = await io.read(inFile);
function mvp(m, p) {
  return [m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12], m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13], m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14]];
}
const C = [];
for (const node of doc.getRoot().listNodes()) {
  const mesh = node.getMesh(); if (!mesh) continue;
  const M = node.getWorldMatrix();
  for (const prim of mesh.listPrimitives()) {
    const pa = prim.getAttribute('POSITION'); if (!pa) continue;
    const pos = pa.getArray();
    const ia = prim.getIndices(); const idx = ia ? ia.getArray() : null;
    const nT = idx ? idx.length/3 : pos.length/9;
    for (let t = 0; t < nT; t++) {
      let a, b, c;
      if (idx) { a = idx[t*3]*3; b = idx[t*3+1]*3; c = idx[t*3+2]*3; } else { a = t*9; b = t*9+3; c = t*9+6; }
      const A = mvp(M, [pos[a],pos[a+1],pos[a+2]]), B = mvp(M, [pos[b],pos[b+1],pos[b+2]]), D = mvp(M, [pos[c],pos[c+1],pos[c+2]]);
      const u = [B[0]-A[0],B[1]-A[1],B[2]-A[2]], v = [D[0]-A[0],D[1]-A[1],D[2]-A[2]];
      const n = [u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0]];
      const nl = Math.hypot(n[0],n[1],n[2]) || 1;
      if (Math.abs(n[1]/nl) < 0.86) continue;
      if (nl/2 > 900) continue;                                  // Riesenflächen (Terrain) raus
      C.push([GSCALE*(A[0]+B[0]+D[0])/3, GSCALE*(A[1]+B[1]+D[1])/3, GSCALE*(A[2]+B[2]+D[2])/3]);
    }
  }
}
console.log(`GLB: ${C.length} flache Zentroide (scale ${GSCALE})`);
// dominantes Höhenband (die Fahrbahn-Ebene)
const ys = C.map(p => p[1]).sort((a,b)=>a-b);
let bestY = ys[(ys.length/2)|0], bestN = 0;
for (let i = 0; i < ys.length; i += Math.max(1, (ys.length/400)|0)) {
  const y = ys[i]; let lo = 0, hi = ys.length;
  // Anzahl im Band [y-BAND, y+BAND] per Binärsuche
  let a = lowerBound(ys, y-BAND), b = lowerBound(ys, y+BAND);
  if (b - a > bestN) { bestN = b - a; bestY = y; }
}
const inBand = C.filter(p => Math.abs(p[1]-bestY) < BAND * 3);   // großzügiger fürs Fitting
/* WICHTIG: räumlich ausdünnen (1 Punkt je Zelle). Ohne das dominieren
   hochauflösende Detail-Meshes die Momente und ICP läuft in die Irre —
   die Momente sollen den GRUNDRISS abbilden, nicht die Dreiecksdichte. */
const DS = 5, dsMap = new Map();
for (const p of inBand) {
  const k = ((p[0]/DS)|0) + ',' + ((p[2]/DS)|0);
  if (!dsMap.has(k)) dsMap.set(k, p);
}
const S = [...dsMap.values()];
console.log(`Höhenband y≈${bestY.toFixed(1)} → ${inBand.length} Punkte, nach ${DS}-m-Ausdünnung ${S.length}`);
{ let bb=[1e9,1e9,-1e9,-1e9]; for(const p of S){bb[0]=Math.min(bb[0],p[0]);bb[1]=Math.min(bb[1],p[2]);bb[2]=Math.max(bb[2],p[0]);bb[3]=Math.max(bb[3],p[2]);}
  console.log(`  Modell-Grundriss: ${(bb[2]-bb[0]).toFixed(0)} × ${(bb[3]-bb[1]).toFixed(0)} m`); }
function lowerBound(arr, v){ let lo=0, hi=arr.length; while(lo<hi){const m=(lo+hi)>>1; if(arr[m]<v) lo=m+1; else hi=m;} return lo; }

/* ── 3) Momenten-Abgleich ─────────────────────────────────────────────── */
function moments(P, gx = p => p[0], gz = p => p[1]) {
  let mx=0, mz=0; for (const p of P) { mx += gx(p); mz += gz(p); }
  mx /= P.length; mz /= P.length;
  let sxx=0, szz=0, sxz=0;
  for (const p of P) { const dx = gx(p)-mx, dz = gz(p)-mz; sxx+=dx*dx; szz+=dz*dz; sxz+=dx*dz; }
  sxx/=P.length; szz/=P.length; sxz/=P.length;
  const ang = 0.5 * Math.atan2(2*sxz, sxx - szz);
  const rms = Math.sqrt(sxx + szz);
  return { mx, mz, ang, rms };
}
const mG = moments(guide);
const mS = moments(S, p => p[0], p => p[2]);
let s = mG.rms / mS.rms;
let th = mG.ang - mS.ang;
let tx = mG.mx - s*(Math.cos(th)*mS.mx - Math.sin(th)*mS.mz);
let tz = mG.mz - s*(Math.sin(th)*mS.mx + Math.cos(th)*mS.mz);
console.log(`Start: scale ${s.toFixed(4)}  rotY ${(th*180/Math.PI).toFixed(1)}°  t [${tx.toFixed(1)}, ${tz.toFixed(1)}]`);

/* ── 3b) Direkte Suche über (Skalierung, Rotation) ─────────────────────
   ICP scheitert hier, weil das Modell eine FLÄCHE ist (Strecke + Infield +
   Fahrerlager + Auslauf) und die Linie nur ihr Rand. Deshalb wird direkt das
   optimiert, worauf es ankommt: wie viele Linienpunkte liegen auf Asphalt?
   Gitter über die (transformierten) Modellpunkte, Score = Trefferquote. */
function buildGrid(pts, cell) {
  const g = new Map();
  for (const p of pts) { const k = ((p[0]/cell)|0)+','+((p[1]/cell)|0); (g.get(k)||g.set(k,[]).get(k)).push(p); }
  return g;
}
function scoreFit(sc, ang, ox, oz, tol) {
  const cs = Math.cos(ang), sn = Math.sin(ang), cell = 10;
  const g = new Map();
  for (const p of S) {
    const X = sc*(cs*p[0] - sn*p[2]) + ox, Z = sc*(sn*p[0] + cs*p[2]) + oz;
    const k = ((X/cell)|0)+','+((Z/cell)|0);
    (g.get(k)||g.set(k,[]).get(k)).push([X, Z, p[1]]);
  }
  let hit = 0, sum = 0;
  for (const [gx, gz] of guide) {
    let bd = Infinity;
    const cx = (gx/cell)|0, cz = (gz/cell)|0;
    for (let i=-1;i<=1;i++) for (let j=-1;j<=1;j++) {
      const arr = g.get((cx+i)+','+(cz+j)); if (!arr) continue;
      for (const q of arr) { const d = (q[0]-gx)**2 + (q[1]-gz)**2; if (d < bd) bd = d; }
    }
    if (bd < tol*tol) { hit++; sum += Math.sqrt(bd); }
  }
  return { frac: hit/guide.length, mean: hit ? sum/hit : 1e9 };
}
{
  const cS = moments(S, p=>p[0], p=>p[2]);
  let best = { frac: -1 };
  const S_MIN = parseFloat(opt.smin || '0.4'), S_MAX = parseFloat(opt.smax || '3.5');
  for (let si = 0; si <= 30; si++) {
    const sc = S_MIN * Math.pow(S_MAX/S_MIN, si/30);
    for (let ai = 0; ai < 72; ai++) {
      const ang = ai * Math.PI/36;
      const ox = mG.mx - sc*(Math.cos(ang)*cS.mx - Math.sin(ang)*cS.mz);
      const oz = mG.mz - sc*(Math.sin(ang)*cS.mx + Math.cos(ang)*cS.mz);
      const r = scoreFit(sc, ang, ox, oz, 14);
      if (r.frac > best.frac) best = { frac: r.frac, mean: r.mean, sc, ang, ox, oz };
    }
  }
  console.log(`Grobsuche: scale ${best.sc.toFixed(3)}  rotY ${(best.ang*180/Math.PI).toFixed(1)}°  Treffer ${(best.frac*100).toFixed(0)}%`);
  // lokale Verfeinerung inkl. Versatz
  let cur = best;
  for (let round = 0; round < 4; round++) {
    const dS = 0.06/(round+1), dA = 0.10/(round+1), dT = 30/(round+1);
    for (let i = 0; i < 400; i++) {
      const sc = cur.sc * (1 + (Math.random()-0.5)*dS);
      const ang = cur.ang + (Math.random()-0.5)*dA;
      const ox = cur.ox + (Math.random()-0.5)*dT;
      const oz = cur.oz + (Math.random()-0.5)*dT;
      const r = scoreFit(sc, ang, ox, oz, 10);
      if (r.frac > cur.frac || (r.frac === cur.frac && r.mean < cur.mean)) cur = { ...r, sc, ang, ox, oz };
    }
  }
  s = cur.sc; th = cur.ang; tx = cur.ox; tz = cur.oz;
  console.log(`Feinsuche: scale ${s.toFixed(4)}  rotY ${(th*180/Math.PI).toFixed(2)}°  t [${tx.toFixed(1)}, ${tz.toFixed(1)}]  Treffer ${(cur.frac*100).toFixed(0)}%  Ø ${cur.mean.toFixed(2)} m`);
}

/* ── 5) Qualität + Höhenprofil je Linienpunkt ─────────────────────────── */
// transformierte Modellpunkte in ein Gitter, dann je Linienpunkt Höhe suchen
const TC = 12, tg = new Map();
for (const p of S) {
  const X = s*(Math.cos(th)*p[0] - Math.sin(th)*p[2]) + tx;
  const Z = s*(Math.sin(th)*p[0] + Math.cos(th)*p[2]) + tz;
  const k = ((X/TC)|0)+','+((Z/TC)|0);
  (tg.get(k)||tg.set(k,[]).get(k)).push([X, p[1], Z]);
}
const ptsY = []; let hit = 0; const resid = [];
for (const [gx, gz] of guide) {
  let best = null, bd = Infinity;
  const cx = (gx/TC)|0, cz = (gz/TC)|0;
  for (let i=-2;i<=2;i++) for (let j=-2;j<=2;j++) {
    const arr = tg.get((cx+i)+','+(cz+j)); if (!arr) continue;
    for (const q of arr) { const d = (q[0]-gx)**2 + (q[2]-gz)**2; if (d < bd) { bd = d; best = q; } }
  }
  if (best && bd < 30*30) { hit++; resid.push(Math.sqrt(bd)); ptsY.push(best[1]); }
  else ptsY.push(null);
}
// Lücken füllen + glätten + auf 0 normieren
for (let i=0;i<ptsY.length;i++) if (ptsY[i]==null) {
  let a=i, b=i; while(a>=0 && ptsY[a]==null) a--; while(b<ptsY.length && ptsY[b]==null) b++;
  const va = a>=0?ptsY[a]:(b<ptsY.length?ptsY[b]:0), vb = b<ptsY.length?ptsY[b]:va;
  ptsY[i] = (va+vb)/2;
}
for (let k=0;k<4;k++) for (let i=0;i<ptsY.length;i++) {
  const p=ptsY[(i-1+ptsY.length)%ptsY.length], c=ptsY[i], nn=ptsY[(i+1)%ptsY.length];
  ptsY[i]=(p+2*c+nn)/4;
}
const yBase = ptsY.reduce((a,b)=>a+b,0)/ptsY.length;
const yOut = ptsY.map(v => Math.round((v - yBase)*100)/100);
resid.sort((a,b)=>a-b);
const q = {
  treffer: `${hit}/${guide.length}  (${(100*hit/guide.length).toFixed(0)}%)`,
  residuumMedian: resid.length ? +resid[(resid.length/2)|0].toFixed(2) : null,
  residuumP90: resid.length ? +resid[(resid.length*0.9)|0].toFixed(2) : null,
  hoehenspanne: +(Math.max(...yOut) - Math.min(...yOut)).toFixed(1),
};
console.log('Qualität:', JSON.stringify(q));

const out = {
  trackId, source: path.basename(inFile), glbScale: GSCALE,
  mesh: { offset: [r2(tx), r2(-yBase), r2(tz)], rotY: +th.toFixed(5), scale: +(s*GSCALE).toFixed(5) },
  quality: q,
  ptsY: yOut,
  note: 'mesh.* in tracks.js übernehmen; ptsY sind die y-Werte je Linienpunkt (dritter Wert in pts). Im Spiel gegenprüfen.',
};
const f = path.join(ROOT, 'assets/tracks', (opt.out || trackId) + '.fit.json');
fs.writeFileSync(f, JSON.stringify(out, null, 1));
console.log('✎', path.relative(ROOT, f));
function r2(x){ return Math.round(x*100)/100; }
