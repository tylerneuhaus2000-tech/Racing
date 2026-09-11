#!/usr/bin/env node
import fs from 'node:fs';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';
await MeshoptDecoder.ready;
const input='assets/tracks/shanghai_2018.glb';
const doc=await new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder}).read(input);
let primitive,node;
for(const n of doc.getRoot().listNodes())for(const p of n.getMesh()?.listPrimitives()||[])if(p.getMaterial()?.getName()==='raceline'){primitive=p;node=n;}
if(!primitive)throw Error('raceline material missing');
const pos=primitive.getAttribute('POSITION'), I=Array.from(primitive.getIndices().getArray()), M=node.getWorldMatrix();
const mv=p=>[M[0]*p[0]+M[4]*p[1]+M[8]*p[2]+M[12],M[1]*p[0]+M[5]*p[1]+M[9]*p[2]+M[13],M[2]*p[0]+M[6]*p[1]+M[10]*p[2]+M[14]];
const V=Array.from({length:pos.getCount()},(_,i)=>mv(pos.getElement(i,[])));
const tris=[];for(let i=0;i<I.length;i+=3){const ids=I.slice(i,i+3),p=ids.map(j=>V[j]);tris.push({ids,c:[(p[0][0]+p[1][0]+p[2][0])/3,(p[0][1]+p[1][1]+p[2][1])/3,(p[0][2]+p[1][2]+p[2][2])/3],nb:[]});}
const edges=new Map(); for(let ti=0;ti<tris.length;ti++){const a=tris[ti].ids;for(const [u,v] of [[a[0],a[1]],[a[1],a[2]],[a[2],a[0]]]){const k=u<v?u+','+v:v+','+u;(edges.get(k)||edges.set(k,[]).get(k)).push(ti)}}
for(const arr of edges.values())if(arr.length===2){tris[arr[0]].nb.push(arr[1]);tris[arr[1]].nb.push(arr[0]);}
const seen=new Set(),comps=[];for(let i=0;i<tris.length;i++){if(seen.has(i))continue;let st=[i],c=[];seen.add(i);while(st.length){const x=st.pop();c.push(x);for(const n of tris[x].nb)if(!seen.has(n)){seen.add(n);st.push(n)}}comps.push(c)}
function farthest(src,allowed){const dist=new Map([[src,0]]),prev=new Map(),todo=[[0,src]];while(todo.length){todo.sort((a,b)=>b[0]-a[0]);const [d,u]=todo.pop();if(d!==dist.get(u))continue;for(const v of tris[u].nb){if(!allowed.has(v))continue;const a=tris[u].c,b=tris[v].c,nd=d+Math.hypot(a[0]-b[0],a[2]-b[2]);if(nd<(dist.get(v)??Infinity)){dist.set(v,nd);prev.set(v,u);todo.push([nd,v])}}}let end=src;for(const [v,d]of dist)if(d>dist.get(end))end=v;return{end,dist,prev}}
const lines=[];for(const comp of comps){const allow=new Set(comp),a=farthest(comp[0],allow).end,bfs=farthest(a,allow),b=bfs.end,path=[];for(let u=b;;u=bfs.prev.get(u)){path.push(tris[u].c);if(u===a)break;if(u==null)throw Error('broken path')}path.reverse();lines.push(path)}
function d2(a,b){return(a[0]-b[0])**2+(a[2]-b[2])**2}
let used=new Set(),line=lines.reduce((a,b)=>a.length>b.length?a:b);used.add(line);while(used.size<lines.length){let best=null;for(const q of lines){if(used.has(q))continue;for(const rev of [false,true]){const qq=rev?[...q].reverse():q,ds=d2(line.at(-1),qq[0]);if(!best||ds<best.ds)best={q,qq,ds}}}line.push(...best.qq);used.add(best.q)}
// Remove duplicate/noisy triangle-centroid steps, then resample closed loop.
const clean=[];for(const p of line)if(!clean.length||Math.hypot(p[0]-clean.at(-1)[0],p[2]-clean.at(-1)[2])>.6)clean.push(p);
function resample(P,n){const q=P.concat([P[0]]),cum=[0];for(let i=1;i<q.length;i++)cum.push(cum.at(-1)+Math.hypot(q[i][0]-q[i-1][0],q[i][2]-q[i-1][2]));const out=[];for(let i=0;i<n;i++){const d=cum.at(-1)*i/n;let k=1;while(cum[k]<d)k++;const t=(d-cum[k-1])/(cum[k]-cum[k-1]);out.push([q[k-1][0]+(q[k][0]-q[k-1][0])*t,q[k-1][2]+(q[k][2]-q[k-1][2])*t,q[k-1][1]+(q[k][1]-q[k-1][1])*t])}return{out,L:cum.at(-1)}}
let {out}=resample(clean,420);
/* One conservative pass removes triangle-centroid sawtooth without rounding
   away Shanghai's actual corners. Restore the official GP lap length by a
   uniform scale around the center; the GLB receives the same scale later. */
for(let pass=0;pass<3;pass++) out=out.map((_,i)=>{const a=out[(i-1+out.length)%out.length],b=out[i],c=out[(i+1)%out.length];return[(a[0]+2*b[0]+c[0])/4,(a[1]+2*b[1]+c[1])/4,(a[2]+2*b[2]+c[2])/4]});
let cx=0,cy=0,cz=0;for(const p of out){cx+=p[0];cz+=p[1];cy+=p[2]}cx/=out.length;cy/=out.length;cz/=out.length;
let pts=out.map(p=>p.map((v,i)=>v-[cx,cz,cy][i]));
const measured=pts.reduce((sum,p,i)=>sum+Math.hypot(p[0]-pts[(i+1)%pts.length][0],p[1]-pts[(i+1)%pts.length][1],p[2]-pts[(i+1)%pts.length][2]),0);
const modelScale=5451/measured;
pts=pts.map(p=>p.map(v=>+(v*modelScale).toFixed(2)));
const finalLength=pts.reduce((sum,p,i)=>sum+Math.hypot(p[0]-pts[(i+1)%pts.length][0],p[1]-pts[(i+1)%pts.length][1],p[2]-pts[(i+1)%pts.length][2]),0);
const data={name:'Shanghai International Circuit 2018',source:'shanghai_2018.glb',method:'raceline mesh topology',closed:true,lengthKm:+(finalLength/1000).toFixed(3),heightSpan:+(Math.max(...pts.map(p=>p[2]))-Math.min(...pts.map(p=>p[2]))).toFixed(2),modelScale:+modelScale.toFixed(6),meshOffset:[+(-cx*modelScale).toFixed(2),+(-cy*modelScale).toFixed(2),+(-cz*modelScale).toFixed(2)],n:pts.length,pts};
fs.writeFileSync('assets/tracks/shanghai_raceline.centerline.json',JSON.stringify(data,null,1)+'\n');console.log(data, 'components',comps.length,comps.map(c=>c.length));
