#!/usr/bin/env node
import fs from 'node:fs';

const sourcePath = 'assets/tracks/shanghai_raceline.centerline.json';
const centerlinePath = 'assets/tracks/shanghai_2018.centerline.json';
const trackPath = 'assets/tracks/shanghai_2018.js';
const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
if (!Array.isArray(source.pts) || source.pts.length < 400) throw new Error('Shanghai raceline is incomplete.');

/* The GLB contains dedicated starting-grid geometry around raw X=37.9/Z=345.
   Rotate the recovered loop there, then reverse it so the grid points toward
   the T1/T2 spiral as on the supplied full-layout reference. */
const [mx,,mz] = source.meshOffset;
const target = [37.9, 345.0];
let start = 0, best = Infinity;
for (let i=0;i<source.pts.length;i++) {
  const rawX=source.pts[i][0]-mx, rawZ=source.pts[i][1]-mz;
  const d=(rawX-target[0])**2+(rawZ-target[1])**2;
  if(d<best){best=d;start=i;}
}
let pts=source.pts.slice(start).concat(source.pts.slice(0,start));
pts=[pts[0], ...pts.slice(1).reverse()];
const length=pts.reduce((sum,p,i)=>sum+Math.hypot(p[0]-pts[(i+1)%pts.length][0],p[1]-pts[(i+1)%pts.length][1],p[2]-pts[(i+1)%pts.length][2]),0);
const centerline={...source,name:'Shanghai International Circuit 2018',lengthKm:+(length/1000).toFixed(3),startWorld:[+(pts[0][0]-mx).toFixed(2),+(pts[0][2]-source.meshOffset[1]).toFixed(2),+(pts[0][1]-mz).toFixed(2)],direction:'from the surveyed grid toward the T1/T2 spiral',n:pts.length,pts};
fs.writeFileSync(centerlinePath,JSON.stringify(centerline,null,1)+'\n');

const track={
  id:'shanghai-2018',name:'Shanghai International Circuit',
  sub:'Shanghai · Grand-Prix-Layout · 5,45 km · TRACK-LAB',
  meshUrl:'assets/tracks/shanghai_2018.glb',
  mesh:{offset:source.meshOffset,scale:source.modelScale,rawSurface:true,hideMaterialsAlways:'^(raceline|skid)$',fixAlphaMaterials:'tree|treeline',light:{sun:0.95,hemi:0.82,exposure:1}},
  halfWidth:7.3,wallDist:14,kerbW:1.6,vergeW:16,
  sky:0x9fc3eb,hill:0x5e8a42,grass:[0x4e8b3a,0x407531],
  startFinishPct:0,startGridPct:99,env:'stadium',noWalls:false,containCars:true,pts
};
track.aiFullGridPace=true;
track.aiWorldPace=true;
const js='/* Generated from the Shanghai GLB raceline mesh. Track-Lab only. */\n'
  +'for (let i = TRACKS.length - 1; i >= 0; i--) if (TRACKS[i].id === "shanghai-2018") TRACKS.splice(i, 1);\n'
  +'TRACKS.push('+JSON.stringify(track)+');\n';
fs.writeFileSync(trackPath,js);
const a=pts[0],b=pts[1],heading=Math.atan2(b[0]-a[0],b[1]-a[1])*180/Math.PI;
console.log(`Shanghai: ${pts.length} points, ${(length/1000).toFixed(3)} km, start ${centerline.startWorld.join('/')}, heading ${heading.toFixed(1)}°`);
