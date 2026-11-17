/* Numerical route audit: the simulation and road renderer share these centerlines. */
import vm from "node:vm";
import { loadGame } from "./race-control-harness.mjs";

const ctx = loadGame();
const results = vm.runInContext(`Object.keys(TRACKS).map(key=>{
  setTrack(key);
  const entry=PIT_ENTRY_S,end=L+PIT_EXIT_S+PIT_ROUTE.rejoin,
    route=s=>s<entry?pitRouteApproachLatAt(s):s<L?pitRouteEntryLatAt(s):pitRouteExitLatAt(s),
    heading=s=>{const q=posXY(s,route(s)),n=posXY(s+0.1,route(s+0.1));return {q,n,a:Math.atan2(n.y-q.y,n.x-q.x)};};
  let minForward=Infinity,minWall=Infinity,minExitLine=Infinity,minRoad=Infinity,maxJump=0;
  for(let s=entry-PIT_ROUTE.approach;s<end;s+=0.5){
    const {q,n,a}=heading(s),lat=route(s),forward=((n.x-q.x)*Math.cos(q.ang)+(n.y-q.y)*Math.sin(q.ang))/0.1,
      lateralExtent=7.45*Math.abs(Math.sin(a-q.ang))+2.55*Math.abs(Math.cos(a-q.ang));
    minForward=Math.min(minForward,forward);
    if(s>=entry)minRoad=Math.min(minRoad,10.5-Math.abs(lat-pitRouteRoadLatAt(s))-lateralExtent);
    if(s>PIT_IN_S+4*DS&&s<L+PIT_OUT_S-4*DS)minWall=Math.min(minWall,-22.5-lat-lateralExtent);
    if(s>L+PIT_OUT_S+6*DS&&s<L+PIT_EXIT_S)minExitLine=Math.min(minExitLine,PITLINE-lat-lateralExtent);
  }
  for(const s of [entry,PIT_IN_S,L+PIT_OUT_S,L+PIT_EXIT_S,end])maxJump=Math.max(maxJump,Math.abs(route(s-0.001)-route(s+0.001)));
  const ordered=PIT_ENTRY_S<PIT_IN_S&&PIT_IN_S<=L+BOX0-69.99&&PIT_OUT_S<PIT_EXIT_S,
    ok=ordered&&minForward>0.15&&minWall>0&&minExitLine>0&&minRoad>0&&maxJump<0.01;
  return {key,ok,ordered,minForward,minWall,minExitLine,minRoad,maxJump};
})`, ctx);
let failed=false;
for(const r of results){
  console.log(`${r.ok?"PASS":"FAIL"} ${r.key}: forward ${r.minForward.toFixed(3)}, road clearance ${r.minRoad.toFixed(2)}, wall ${r.minWall.toFixed(2)}, exit line ${r.minExitLine.toFixed(2)}, join jump ${r.maxJump.toFixed(4)}`);
  if(!r.ok)failed=true;
}
if(failed)process.exitCode=1;
else console.log(`OK: ${results.length} routes remain forward, continuous and within the modeled road boundaries.`);
