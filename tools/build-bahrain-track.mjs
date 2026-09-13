#!/usr/bin/env node
import fs from 'node:fs';
import vm from 'node:vm';

const context = {};
vm.createContext(context);
vm.runInContext(fs.readFileSync('assets/tracks.js', 'utf8') + '\nglobalThis.__tracks=TRACKS;', context);
const base = context.__tracks.find(track => track.id === 'bahrain-custom');
if (!base) throw new Error('Legacy Bahrain centerline is missing');
const fit = JSON.parse(fs.readFileSync('tools/data/bahrain-gp.fit.json', 'utf8'));
if (fit.ptsY.length !== base.pts.length) throw new Error('Bahrain height sample count does not match centerline');

const circular = (arr, i) => arr[(i + arr.length) % arr.length];
let heights = fit.ptsY.map((_, i) => {
  const window = [];
  for (let d = -7; d <= 7; d++) window.push(circular(fit.ptsY, i + d));
  window.sort((a, b) => a - b);
  return window[window.length >> 1];
});
for (let pass = 0; pass < 2; pass++) {
  heights = heights.map((v, i) =>
    (circular(heights, i - 2) + 2*circular(heights, i - 1) + 4*v +
     2*circular(heights, i + 1) + circular(heights, i + 2)) / 10);
}

// Bahrain's GP surface has gradual elevation changes. Limit remaining local
// jumps from elevated scenery to a plausible road grade in both directions.
for (let pass = 0; pass < 500; pass++) {
  for (let i = 0; i < heights.length; i++) {
    const j = (i + 1) % heights.length;
    const ds = Math.hypot(base.pts[j][0]-base.pts[i][0], base.pts[j][1]-base.pts[i][1]);
    if (ds < 0.1) continue;
    const maxDelta = ds * 0.085 / fit.mesh.scale;
    const delta = heights[j] - heights[i];
    if (Math.abs(delta) > maxDelta) {
      const correction = (Math.abs(delta)-maxDelta) * 0.5 * Math.sign(delta);
      heights[i] += correction;
      heights[j] -= correction;
    }
  }
}

const scale = fit.mesh.scale;
let pts = base.pts.map((point, i) => [
  +point[0].toFixed(3), +point[1].toFixed(3), +(heights[i] * scale).toFixed(3),
]);
// The legacy line repeats its first X/Z point at the end, while the surface
// fitter may pick a different overlapping mesh layer for that duplicate. A
// zero-length closing segment with two Y values creates a vertical seam at
// start/finish. Remove the duplicate and grade-limit the real closing segment.
if(Math.hypot(pts.at(-1)[0]-pts[0][0],pts.at(-1)[1]-pts[0][1])<0.05) pts.pop();
for(let pass=0;pass<700;pass++){
  for(let i=0;i<pts.length;i++){
    const j=(i+1)%pts.length;
    const ds=Math.hypot(pts[j][0]-pts[i][0],pts[j][1]-pts[i][1]);
    if(ds<0.1) continue;
    // Leave rounding headroom so the serialized three-decimal points stay
    // below the intended 8.5% road-grade ceiling.
    const maxDelta=ds*0.075;
    const delta=pts[j][2]-pts[i][2];
    if(Math.abs(delta)>maxDelta){
      const excess=(Math.abs(delta)-maxDelta)*Math.sign(delta);
      // Point 0 is the verified start/finish road layer. Keep that height
      // anchored and relax the other side of the seam towards it.
      if(j===0) pts[i][2]=+(pts[i][2]+excess).toFixed(3);
      else if(i===0) pts[j][2]=+(pts[j][2]-excess).toFixed(3);
      else {
        pts[i][2]=+(pts[i][2]+excess*0.5).toFixed(3);
        pts[j][2]=+(pts[j][2]-excess*0.5).toFixed(3);
      }
    }
  }
}
const sourceMeanY = -fit.mesh.offset[1];
const track = {
  id:'bahrain-custom', name:'Bahrain International Circuit',
  sub:'Sakhir · Grand-Prix-Kurs · 5,41 km · echtes Höhenprofil',
  meshUrl:'assets/tracks/bahrain_2026.glb',
  mesh:{
    offset:[fit.mesh.offset[0], +(sourceMeanY * -scale).toFixed(3), fit.mesh.offset[2]],
    rotY:+(-fit.mesh.rotY).toFixed(6), scale, rawSurface:true,
    fixAlphaMaterials:'fence|glass|tree|bush|flag', fixAllBlendMaterials:true,
    light:{sun:1.04,hemi:0.9,exposure:1.04},
  },
  halfWidth:8.5, wallDist:20, kerbW:2.2, vergeW:16,
  sky:0x9fc3eb, hill:0xb69b63, grass:[0x9a854e,0x887542],
  startFinishPct:0, startGridPct:99, env:'desert', noWalls:true,
  containCars:true, containmentOpenAtFinish:8, visualCarYOffset:0.03,
  pitLane:{side:-1,idxStart:49,idxEnd:111,innerOff:10,outerOff:20,
    slowInnerOff:20,slowOuterOff:31,boxStopOff:25,pathHalfWidth:6.5},
  pts, aiFullGridPace:true, aiWorldPace:true,
};
fs.writeFileSync('assets/tracks/bahrain-gp.js',
  `/* Generated from the downloaded Bahrain GP mesh and fitted to the GP centerline. */\n`+
  `for(let i=TRACKS.length-1;i>=0;i--)if(TRACKS[i].id==='bahrain-custom')TRACKS.splice(i,1);\n`+
  `TRACKS.push(${JSON.stringify(track)});\n`);

let length=0,maxGrade=0;
for(let i=0;i<pts.length;i++){
  const next=pts[(i+1)%pts.length],ds=Math.hypot(next[0]-pts[i][0],next[1]-pts[i][1]);
  length+=ds;if(ds)maxGrade=Math.max(maxGrade,Math.abs(next[2]-pts[i][2])/ds);
}
console.log(`Bahrain GP: ${pts.length} points · ${(length/1000).toFixed(3)} km · elevation ${(Math.max(...heights)-Math.min(...heights)).toFixed(1)} m · max grade ${(maxGrade*100).toFixed(1)}%`);
