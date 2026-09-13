#!/usr/bin/env node
import fs from 'node:fs';
import vm from 'node:vm';

const context = {};
vm.createContext(context);
vm.runInContext(fs.readFileSync('assets/tracks.js', 'utf8') + '\nglobalThis.__tracks=TRACKS;', context);
const base = context.__tracks.find(track => track.id === 'bahrain-custom');
if (!base) throw new Error('Legacy Bahrain centerline is missing');
const fit = JSON.parse(fs.readFileSync('tools/data/bahrain-gp.fit.json', 'utf8'));
const exact = JSON.parse(fs.readFileSync('tools/data/bahrain-exact-heights.json', 'utf8'));
const scale = fit.mesh.scale;
const circular = (arr, i) => arr[(i + arr.length) % arr.length];
let sourcePts = base.pts.slice();
if(Math.hypot(sourcePts.at(-1)[0]-sourcePts[0][0],sourcePts.at(-1)[1]-sourcePts[0][1])<0.05) sourcePts.pop();
if(exact.length !== sourcePts.length) throw new Error('Exact Bahrain surface sample count does not match centerline');

// Exact triangle intersections contain occasional scenery/underlay layers.
// A circular median rejects those isolated layers, then a light five-tap
// filter removes triangle-edge noise without flattening Bahrain's elevation.
let heights=exact.slice();
for(let pass=0;pass<2;pass++)heights=heights.map((v,i)=>(
  circular(heights,i-1)+4*v+circular(heights,i+1))/6);
let pts=sourcePts.map((point,i)=>[+point[0].toFixed(3),+point[1].toFixed(3),+heights[i].toFixed(3)]);
for(let pass=0;pass<700;pass++){
  for(let i=0;i<pts.length;i++){
    const j=(i+1)%pts.length;
    const ds=Math.hypot(pts[j][0]-pts[i][0],pts[j][1]-pts[i][1]);
    if(ds<0.1) continue;
    // Leave rounding headroom so the serialized three-decimal points stay
    // below the intended 5% road-grade ceiling.
    const maxDelta=ds*0.045;
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
// The checked start-line texture in the GLB crosses the long straight between
// old samples 9 and 10. Insert that physical crossing as an explicit point and
// rotate the loop there, so timing, containment and the grid share one seam.
const startAt=9,startT=.272;
const a=pts[startAt],b=pts[startAt+1];
const startPoint=[
  +(a[0]+(b[0]-a[0])*startT).toFixed(3),
  +(a[1]+(b[1]-a[1])*startT).toFixed(3),
  +(a[2]+(b[2]-a[2])*startT).toFixed(3),
];
pts=[startPoint,...pts.slice(startAt+1),...pts.slice(0,startAt+1)];
// Inserting and rotating the physical start-line point creates two new
// neighbour pairs. Relax those pairs as well so the loop seam cannot become a
// launch ramp even though the pre-rotation profile already passed the limit.
for(let pass=0;pass<700;pass++){
  for(let i=0;i<pts.length;i++){
    const j=(i+1)%pts.length;
    const ds=Math.hypot(pts[j][0]-pts[i][0],pts[j][1]-pts[i][1]);
    if(ds<0.1) continue;
    const limit=ds*0.045, delta=pts[j][2]-pts[i][2];
    if(Math.abs(delta)>limit){
      const correction=(Math.abs(delta)-limit)*0.5*Math.sign(delta);
      pts[i][2]=+(pts[i][2]+correction).toFixed(3);
      pts[j][2]=+(pts[j][2]-correction).toFixed(3);
    }
  }
}
const sourceMeanY = -fit.mesh.offset[1];
const track = {
  id:'bahrain-custom', name:'Bahrain International Circuit',
  sub:'Sakhir · Grand-Prix-Kurs · 5,41 km · echtes Höhenprofil',
  meshUrl:'assets/tracks/bahrain_2026.glb',
  mesh:{
    offset:[fit.mesh.offset[0], +(sourceMeanY * -scale).toFixed(3), -87.308],
    rotY:+(-fit.mesh.rotY).toFixed(6), scale, rawSurface:true,
    fixAlphaMaterials:'fence|glass|tree|bush|flag',
    light:{sun:1.04,hemi:0.9,exposure:1.04},
  },
  halfWidth:8.5, wallDist:20, kerbW:2.2, vergeW:16,
  sky:0x9fc3eb, hill:0xb69b63, grass:[0x9a854e,0x887542],
  startFinishPct:0, startGridPct:99.7, env:'desert', noWalls:true,
  containCars:false, visualCarYOffset:0,
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
