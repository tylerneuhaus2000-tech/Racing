#!/usr/bin/env node
import fs from 'node:fs';
import vm from 'node:vm';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';

const glb='/Users/tylerneuhaus/Downloads/bahrain-international-circuit/source/bahrain.glb';
const context={}; vm.createContext(context);
vm.runInContext(fs.readFileSync('assets/tracks.js','utf8')+'\nglobalThis.track=TRACKS.find(t=>t.id==="bahrain-custom");',context);
const fit=JSON.parse(fs.readFileSync('tools/data/bahrain-gp.fit.json','utf8'));
const track=context.track;
if(Math.hypot(track.pts.at(-1)[0]-track.pts[0][0],track.pts.at(-1)[1]-track.pts[0][1])<.05)track.pts.pop();
// The broad-surface fit was 22.96 m across the pit complex. Material 79 is
// the actual circuit ribbon; aligning its centre on the main straight gives
// this corrected Z translation.
const cfg={scale:fit.mesh.scale,rotY:-fit.mesh.rotY,offset:[fit.mesh.offset[0],+(-fit.mesh.offset[1]*-fit.mesh.scale).toFixed(3),-87.308]};
const cell=20, grid=new Map();
const c=Math.cos(cfg.rotY),s=Math.sin(cfg.rotY),sc=cfg.scale,off=cfg.offset;
const xf=p=>[sc*(c*p[0]+s*p[2])+off[0],sc*p[1]+off[1],sc*(-s*p[0]+c*p[2])+off[2]];
const mv=(m,p)=>[m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12],m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13],m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14]];
const doc=await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(glb);
let nt=0;
for(const node of doc.getRoot().listNodes()){
  const mesh=node.getMesh(); if(!mesh)continue; const M=node.getWorldMatrix();
  for(const prim of mesh.listPrimitives()){
    if(doc.getRoot().listMaterials().indexOf(prim.getMaterial())!==79)continue;
    const pos=prim.getAttribute('POSITION'),ind=prim.getIndices();if(!pos)continue;
    const count=(ind?ind.getCount():pos.getCount())/3;
    for(let i=0;i<count;i++){
      const ids=ind?[ind.getScalar(i*3),ind.getScalar(i*3+1),ind.getScalar(i*3+2)]:[i*3,i*3+1,i*3+2];
      const a=xf(mv(M,pos.getElement(ids[0],[]))),b=xf(mv(M,pos.getElement(ids[1],[]))),d=xf(mv(M,pos.getElement(ids[2],[])));
      const ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2],vx=d[0]-a[0],vy=d[1]-a[1],vz=d[2]-a[2];
      const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx,nl=Math.hypot(nx,ny,nz)||1;
      if(Math.abs(ny/nl)<0.65||nl*.5>1800)continue;
      const t={a,b,d,minx:Math.min(a[0],b[0],d[0]),maxx:Math.max(a[0],b[0],d[0]),minz:Math.min(a[2],b[2],d[2]),maxz:Math.max(a[2],b[2],d[2])};
      const x0=Math.floor(t.minx/cell),x1=Math.floor(t.maxx/cell),z0=Math.floor(t.minz/cell),z1=Math.floor(t.maxz/cell);
      for(let x=x0;x<=x1;x++)for(let z=z0;z<=z1;z++){const k=x+','+z;(grid.get(k)||grid.set(k,[]).get(k)).push(t);} nt++;
    }
  }
}
function height(t,x,z){const {a,b,d}=t,den=(b[2]-d[2])*(a[0]-d[0])+(d[0]-b[0])*(a[2]-d[2]);if(Math.abs(den)<1e-8)return null;const u=((b[2]-d[2])*(x-d[0])+(d[0]-b[0])*(z-d[2]))/den,v=((d[2]-a[2])*(x-d[0])+(a[0]-d[0])*(z-d[2]))/den,w=1-u-v;if(u<-.002||v<-.002||w<-.002)return null;return u*a[1]+v*b[1]+w*d[1];}
let exact=0; const out=[];
for(let pi=0;pi<track.pts.length;pi++){
  const p=track.pts[pi], referenceY=fit.ptsY[pi]*cfg.scale;
  const arr=grid.get(Math.floor(p[0]/cell)+','+Math.floor(p[1]/cell))||[],hits=[];
  for(const t of arr){if(p[0]<t.minx-.01||p[0]>t.maxx+.01||p[1]<t.minz-.01||p[1]>t.maxz+.01)continue;const y=height(t,p[0],p[1]);if(y!=null)hits.push(y);}
  if(hits.length){hits.sort((a,b)=>Math.abs(a-referenceY)-Math.abs(b-referenceY));out.push(hits[0]);exact++;}else out.push(null);
}
// Fill short gaps circularly between the nearest exact road intersections.
for(let i=0;i<out.length;i++)if(out[i]==null){
  let a=i-1,b=i+1;while(out[(a+out.length)%out.length]==null)a--;while(out[b%out.length]==null)b++;
  const ai=(a+out.length)%out.length,bi=b%out.length,t=(i-a)/(b-a);
  out[i]=out[ai]+(out[bi]-out[ai])*t;
}
const delta=out.map((v,i)=>v-fit.ptsY[i]*cfg.scale).sort((a,b)=>a-b);
let maxGrade=0;
for(let i=0;i<out.length;i++){const j=(i+1)%out.length,ds=Math.hypot(track.pts[j][0]-track.pts[i][0],track.pts[j][1]-track.pts[i][1]);if(ds>.1)maxGrade=Math.max(maxGrade,Math.abs(out[j]-out[i])/ds);}
console.log(JSON.stringify({triangles:nt,exact,total:out.length,misses:out.length-exact,deltaMin:delta[0],deltaMedian:delta[delta.length>>1],deltaMax:delta.at(-1),maxGrade},null,2));
fs.writeFileSync('tools/data/bahrain-exact-heights.json',JSON.stringify(out.map(v=>+v.toFixed(4)),null,1)+'\n');
