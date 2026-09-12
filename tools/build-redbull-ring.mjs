#!/usr/bin/env node
import fs from 'node:fs';
const source=JSON.parse(fs.readFileSync('assets/tracks/redbull-ring.centerline.json','utf8'));
if(!Array.isArray(source.pts)||source.pts.length<400||source.fit?.onAsphaltPct<99) throw new Error('Red Bull Ring centerline is incomplete or off the GLB road');
// OSM stitching begins at T1. Rotate to the real start/finish straight before T1.
const cut=Math.round(source.pts.length*.96)%source.pts.length;
const pts=source.pts.slice(cut).concat(source.pts.slice(0,cut));
const track={id:'redbullring-custom',name:'Red Bull Ring',sub:'Spielberg · Grand-Prix-Kurs · echtes Höhenprofil',
  meshUrl:'assets/tracks/redbull_ring_2025_layout.glb',
  mesh:{offset:source.meshOffset,rawSurface:true,fixAlphaMaterials:'fence|tree|glass',light:{sun:.95,hemi:.82,exposure:1}},
  halfWidth:8.2,wallDist:12,kerbW:2.5,vergeW:12,sky:0x9fc3eb,hill:0x5e8a42,grass:[0x4e8b3a,0x407531],
  startFinishPct:0,startGridPct:99,env:'forest',noWalls:true,containCars:true,visualCarYOffset:.12,
  pts,aiFullGridPace:true,aiWorldPace:true};
const js=`/* Generated from the Red Bull Ring GP route fitted to the GLB asphalt. */\nfor (let i=TRACKS.length-1;i>=0;i--) if(TRACKS[i].id==='redbullring-custom') TRACKS.splice(i,1);\nTRACKS.push(${JSON.stringify(track)});\n`;
fs.writeFileSync('assets/tracks/redbull-ring.js',js);
console.log(`Red Bull Ring: ${pts.length} points · ${source.lengthKm.toFixed(3)} km · elevation ${source.heightSpan.toFixed(1)} m · ${source.fit.onAsphaltPct}% on asphalt`);
