#!/usr/bin/env node
import fs from 'node:fs';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
const file='assets/tracks/redbull_ring_2025_layout.glb';
const centerFile='assets/tracks/redbull-ring.centerline.json';
const data=JSON.parse(fs.readFileSync(centerFile,'utf8'));
const doc=await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(file);
const materials=doc.getRoot().listMaterials();
const surface=[];
const off=data.meshOffset;
const mvp=(m,p)=>[m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12]+off[0],m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13]+off[1],m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14]+off[2]];
for(const node of doc.getRoot().listNodes()){
 const mesh=node.getMesh();if(!mesh)continue;const M=node.getWorldMatrix();
 for(const prim of mesh.listPrimitives()){
  if(materials.indexOf(prim.getMaterial())!==79)continue;
  const pos=prim.getAttribute('POSITION'),ind=prim.getIndices();if(!pos)continue;
  const count=ind?ind.getCount()/3:pos.getCount()/3;
  for(let t=0;t<count;t++){
   const ids=ind?[ind.getScalar(t*3),ind.getScalar(t*3+1),ind.getScalar(t*3+2)]:[t*3,t*3+1,t*3+2];
   const a=mvp(M,pos.getElement(ids[0],[])),b=mvp(M,pos.getElement(ids[1],[])),c=mvp(M,pos.getElement(ids[2],[]));
   surface.push([(a[0]+b[0]+c[0])/3,(a[1]+b[1]+c[1])/3,(a[2]+b[2]+c[2])/3]);
  }
 }
}
if(surface.length<1000)throw Error('Road surface material not found');
const oldYs=data.pts.map(p=>p[2]);
const raw=data.pts.map(p=>{
 const nearest=surface.map(q=>({q,d:(q[0]-p[0])**2+(q[2]-p[1])**2})).sort((a,b)=>a.d-b.d).slice(0,10);
 if(nearest[0].d>64)throw Error(`No road below ${p[0]},${p[1]}`);
 let sy=0,sw=0;for(const {q,d} of nearest){const w=1/(d+.35);sy+=q[1]*w;sw+=w;}
 return sy/sw;
});
let ys=raw;
for(let pass=0;pass<2;pass++)ys=ys.map((v,i)=>(ys[(i-1+ys.length)%ys.length]+2*v+ys[(i+1)%ys.length])/4);
data.pts=data.pts.map((p,i)=>[p[0],p[1],Math.round(ys[i]*1000)/1000]);
data.heightSpan=Math.round((Math.max(...ys)-Math.min(...ys))*10)/10;
data.heightSource='GLB road material 79 centroid fit, inverse-distance weighted and periodically smoothed';
fs.writeFileSync(centerFile,JSON.stringify(data,null,2)+'\n');
console.log(`Red Bull Ring heights: ${surface.length} road triangles · span ${data.heightSpan} m · max correction ${Math.max(...ys.map((y,i)=>Math.abs(y-oldYs[i]))).toFixed(3)} m`);
