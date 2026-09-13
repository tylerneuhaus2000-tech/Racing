#!/usr/bin/env node
import fs from 'node:fs';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';

const [,,centerFile,glbFile,materialArg]=process.argv;
if(!centerFile||!glbFile||!materialArg) throw Error('usage: centerline.json track.glb materialIndexes');
const wanted=new Set(materialArg.split(',').map(Number));
const data=JSON.parse(fs.readFileSync(centerFile,'utf8'));
const off=data.meshOffset||[0,0,0];
await MeshoptDecoder.ready;
const doc=await new NodeIO().registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({'meshopt.decoder':MeshoptDecoder}).read(glbFile);
const materials=doc.getRoot().listMaterials(), tris=[];
const world=(m,p)=>[m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12]+off[0],m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13]+off[1],m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14]+off[2]];
for(const node of doc.getRoot().listNodes()){
  const mesh=node.getMesh(); if(!mesh) continue; const M=node.getWorldMatrix();
  for(const prim of mesh.listPrimitives()){
    if(!wanted.has(materials.indexOf(prim.getMaterial()))) continue;
    const pos=prim.getAttribute('POSITION'), ind=prim.getIndices(); if(!pos) continue;
    const count=(ind?ind.getCount():pos.getCount())/3;
    for(let i=0;i<count;i++){
      const ids=ind?[ind.getScalar(i*3),ind.getScalar(i*3+1),ind.getScalar(i*3+2)]:[i*3,i*3+1,i*3+2];
      const a=world(M,pos.getElement(ids[0],[])),b=world(M,pos.getElement(ids[1],[])),c=world(M,pos.getElement(ids[2],[]));
      tris.push({a,b,c,minx:Math.min(a[0],b[0],c[0]),maxx:Math.max(a[0],b[0],c[0]),minz:Math.min(a[2],b[2],c[2]),maxz:Math.max(a[2],b[2],c[2])});
    }
  }
}
const heightAt=(t,x,z)=>{
  const {a,b,c}=t, d=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);
  if(Math.abs(d)<1e-9)return null;
  const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/d;
  const v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/d, w=1-u-v;
  return u>=-.015&&v>=-.015&&w>=-.015 ? u*a[1]+v*b[1]+w*c[1] : null;
};
let misses=0,maxCorrection=0;
const ys=data.pts.map(p=>{
  const [x,z,old]=p, hits=[];
  for(const t of tris){if(x<t.minx-.2||x>t.maxx+.2||z<t.minz-.2||z>t.maxz+.2)continue;const y=heightAt(t,x,z);if(y!==null&&Math.abs(y-old)<2.5)hits.push(y);}
  if(!hits.length){misses++;return old;}
  hits.sort((a,b)=>Math.abs(a-old)-Math.abs(b-old)); maxCorrection=Math.max(maxCorrection,Math.abs(hits[0]-old)); return hits[0];
});
data.pts=data.pts.map((p,i)=>[p[0],p[1],Math.round(ys[i]*1000)/1000]);
data.heightSpan=Math.round((Math.max(...ys)-Math.min(...ys))*10)/10;
data.heightSource=`Exact barycentric GLB asphalt fit (materials ${materialArg})`;
fs.writeFileSync(centerFile,JSON.stringify(data,null,2)+'\n');
console.log(`${centerFile}: ${tris.length} triangles, ${misses}/${ys.length} misses, max correction ${maxCorrection.toFixed(3)}m`);
