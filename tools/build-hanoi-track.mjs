#!/usr/bin/env node
import fs from 'node:fs';

const TARGET_LEN = 5607;
const STEP = 11.5;

function dist(a,b){ return Math.hypot(b[0]-a[0], b[1]-a[1]); }
function lerp(a,b,t){ return a+(b-a)*t; }
function catmull(p0,p1,p2,p3,t){
  const t2=t*t,t3=t2*t;
  return [
    0.5*((2*p1[0])+(-p0[0]+p2[0])*t+(2*p0[0]-5*p1[0]+4*p2[0]-p3[0])*t2+(-p0[0]+3*p1[0]-3*p2[0]+p3[0])*t3),
    0.5*((2*p1[1])+(-p0[1]+p2[1])*t+(2*p0[1]-5*p1[1]+4*p2[1]-p3[1])*t2+(-p0[1]+3*p1[1]-3*p2[1]+p3[1])*t3),
  ];
}

let anchors = [
  [-930,20],[-720,20],[-430,20],[-120,20],[220,20],[560,20],[900,18],
  [1090,-20],[1165,-115],[1120,-245],[965,-285],[785,-245],[685,-132],[580,-70],
  [405,-72],[305,-170],[318,-318],[455,-392],[640,-388],[828,-340],[1002,-360],
  [1125,-485],[1090,-620],[920,-682],[680,-650],[420,-570],[165,-520],[-65,-558],
  [-245,-668],[-430,-642],[-520,-500],[-478,-342],[-615,-248],[-820,-265],[-1010,-356],
  [-1190,-302],[-1255,-140],[-1172,-35],[-930,20]
];

function splineSample(points, samplesPerSeg=16){
  const p = dist(points[0], points.at(-1)) < 0.01 ? points.slice(0,-1) : points.slice();
  const out=[];
  const n=p.length;
  for(let i=0;i<n;i++){
    const p0=p[(i-1+n)%n], p1=p[i], p2=p[(i+1)%n], p3=p[(i+2)%n];
    for(let k=0;k<samplesPerSeg;k++) out.push(catmull(p0,p1,p2,p3,k/samplesPerSeg));
  }
  return out;
}
function length2(points){ let L=0; for(let i=0;i<points.length;i++) L+=dist(points[i],points[(i+1)%points.length]); return L; }
let rough=splineSample(anchors,12);
const scale=TARGET_LEN/length2(rough);
anchors=anchors.map(([x,z])=>[x*scale,z*scale]);
rough=splineSample(anchors,18);

const cumulative=[0];
let L=0;
for(let i=0;i<rough.length;i++){ L+=dist(rough[i],rough[(i+1)%rough.length]); cumulative.push(L); }
function pointAt(s){
  s=((s%L)+L)%L;
  let lo=0,hi=rough.length;
  while(lo<hi){ const mid=(lo+hi)>>1; if(cumulative[mid+1] < s) lo=mid+1; else hi=mid; }
  const a=rough[lo], b=rough[(lo+1)%rough.length];
  const span=cumulative[lo+1]-cumulative[lo] || 1;
  const t=(s-cumulative[lo])/span;
  return [lerp(a[0],b[0],t), lerp(a[1],b[1],t)];
}
let pts=[];
const count=Math.round(TARGET_LEN/STEP);
for(let i=0;i<count;i++) pts.push(pointAt(i*L/count));

function heightAt(progress){
  const waves = 0.35*Math.sin(progress*Math.PI*2+0.4) + 0.18*Math.sin(progress*Math.PI*8-0.8);
  return (progress < 0.18 || progress > 0.92) ? 0 : waves;
}
pts=pts.map((p,i)=>[+p[0].toFixed(3), +p[1].toFixed(3), +heightAt(i/pts.length).toFixed(3)]);
for(let pass=0;pass<60;pass++){
  pts=pts.map((p,i)=>{
    const a=pts[(i-1+pts.length)%pts.length], b=pts[(i+1)%pts.length];
    return [p[0],p[1],+((a[2]+6*p[2]+b[2])/8).toFixed(3)];
  });
}
for(let pass=0;pass<200;pass++){
  for(let i=0;i<pts.length;i++){
    const j=(i+1)%pts.length;
    const ds=dist(pts[i],pts[j]);
    const d=pts[j][2]-pts[i][2];
    const lim=ds*0.012;
    if(Math.abs(d)>lim){
      const corr=(Math.abs(d)-lim)*0.5*Math.sign(d);
      pts[i][2]=+(pts[i][2]+corr).toFixed(3);
      pts[j][2]=+(pts[j][2]-corr).toFixed(3);
    }
  }
}

let measured=0,maxGrade=0,minH=Infinity,maxH=-Infinity;
for(let i=0;i<pts.length;i++){
  const j=(i+1)%pts.length, ds=dist(pts[i],pts[j]);
  measured+=ds; maxGrade=Math.max(maxGrade, Math.abs(pts[j][2]-pts[i][2])/Math.max(ds,1e-6));
  minH=Math.min(minH,pts[i][2]); maxH=Math.max(maxH,pts[i][2]);
}

const track = {
  id:'hanoi-street-circuit', name:'Hanoi Street Circuit',
  sub:'Vietnam GP · Hanoi · 5,61 km · 23 Kurven',
  meshUrl:'assets/tracks/hanoi_street_circuit.glb',
  mesh:{
    offset:[0,0,0], rawSurface:false, hideGround:true,
    hideMaterials:'road|asphalt|tarmac|lane|line|marking|kerb|curb|rumble|runoff|safer|barrier|wall|guard|armco|pitwall|skid',
    hideMaterialsAlways:'^(roada|road|asphalt|tarmac|kerb|curb|rumble|gutter|safer|guard|armco|pitwall|wall)',
    fixAlphaMaterials:'tree|bush|fence|glass|banner|flag|palm|plant',
    groundPlane:{y:-0.08,maxSize:3900,tile:18},
    light:{sun:1.02,hemi:0.86,exposure:1.02}
  },
  halfWidth:8.2, wallDist:13.6, kerbW:1.6, vergeW:9,
  sky:0xa8c4e8, hill:0x8e906e, grass:[0x6f8b4a,0x58783d],
  startFinishPct:0, startGridPct:99.4, env:'city', noWalls:false, containCars:true,
  pitLane:{side:-1,startPct:93.0,endPct:8.0,innerOff:9.6,outerOff:18.5,slowInnerOff:18.5,slowOuterOff:29,boxStopOff:23.5,pathHalfWidth:6.5},
  aiFullGridPace:true, aiWorldPace:true,
  pts
};
fs.writeFileSync('assets/tracks/hanoi-street-circuit.js',
  `/* Generated Hanoi/Vietnam GP street circuit. Clean procedural driving surface; imported GLB is scenery only. */\n`+
  `for (let i=TRACKS.length-1;i>=0;i--) if(TRACKS[i].id==='hanoi-street-circuit'||TRACKS[i].id==='vietnam-hanoi') TRACKS.splice(i,1);\n`+
  `TRACKS.push(${JSON.stringify(track)});\n`);
console.log(`Hanoi: ${pts.length} points · ${(measured/1000).toFixed(3)} km · elevation ${(maxH-minH).toFixed(2)} m · max grade ${(maxGrade*100).toFixed(2)}% · scale ${scale.toFixed(4)}`);
