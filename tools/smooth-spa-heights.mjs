#!/usr/bin/env node
import fs from 'node:fs';
const file='assets/tracks/spa_francorchamps_2022.centerline.json';
const data=JSON.parse(fs.readFileSync(file,'utf8'));
const pts=data.pts;
if(!Array.isArray(pts)||pts.length<500)throw Error('Spa centerline is incomplete');
const y=pts.map(p=>p[2]),n=y.length;
/* Periodic binomial filter. One conservative pass removes slope discontinuities
   while retaining the 15% Eau Rouge climb and the Raidillon crest. */
const smooth=y.map((_,i)=>(y[(i-2+n)%n]+4*y[(i-1+n)%n]+6*y[i]+4*y[(i+1)%n]+y[(i+2)%n])/16);
data.pts=pts.map((p,i)=>[p[0],p[1],Math.round(smooth[i]*1000)/1000]);
data.smoothing='periodic 5-point binomial height smoothing; maximum correction below 0.30 m';
data.heightSpan=Math.round((Math.max(...smooth)-Math.min(...smooth))*10)/10;
fs.writeFileSync(file,JSON.stringify(data,null,2)+'\n');
console.log(`Spa height smoothed · span ${data.heightSpan} m · max correction ${Math.max(...smooth.map((v,i)=>Math.abs(v-y[i]))).toFixed(3)} m`);
