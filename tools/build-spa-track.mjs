#!/usr/bin/env node
import fs from 'node:fs';
const sourcePath='assets/tracks/spa_francorchamps_2022.centerline.json';
const outputPath='assets/tracks/spa_francorchamps_2022.js';
const source=JSON.parse(fs.readFileSync(sourcePath,'utf8'));
if(!Array.isArray(source.pts)||source.pts.length<500) throw new Error('Spa centerline is incomplete.');
const track={
  id:'spa-francorchamps-2022',name:'Circuit de Spa-Francorchamps',
  sub:'Belgien · Grand-Prix-Kurs · 7,00 km · starkes Höhenprofil',
  meshUrl:'assets/tracks/spa_francorchamps_2022.glb',
  mesh:{offset:source.meshOffset,rawSurface:true,fixAlphaMaterials:'tree|bush|fence|hedge|glass',light:{sun:.94,hemi:.82,exposure:1}},
  halfWidth:7.6,wallDist:14,kerbW:1.8,vergeW:14,
  sky:0x9fc3eb,hill:0x5e8a42,grass:[0x4e8b3a,0x407531],
  startFinishPct:0,startGridPct:99,env:'forest',noWalls:false,containCars:true,
  pitLane:{side:-1,startPct:94,endPct:8,innerOff:10,outerOff:24},
  pts:source.pts,aiFullGridPace:true,aiWorldPace:true
};
const js='/* Generated from the Spa GLB road geometry and complete GP route. Track-Lab only. */\n'
 +'for (let i = TRACKS.length - 1; i >= 0; i--) if (TRACKS[i].id === "spa-francorchamps-2022") TRACKS.splice(i, 1);\n'
 +'TRACKS.push('+JSON.stringify(track)+');\n';
fs.writeFileSync(outputPath,js);
console.log(`Spa: ${source.pts.length} points, ${source.lengthKm.toFixed(3)} km`);
