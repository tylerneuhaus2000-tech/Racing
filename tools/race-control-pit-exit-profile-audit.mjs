import vm from "node:vm";
import { loadGame } from "./race-control-harness.mjs";

const ctx = loadGame();
const results = vm.runInContext(`Object.keys(TRACKS).map(key=>{
  setTrack(key);
  const profile=PITROUTES[key]||PITROUTES.ring,
    scale=TRACK.len?L/TRACK.len:1,
    lastBox=L+BOX0+24*(TEAM_KEYS.length-1),
    minPitOut=Math.max(0,lastBox-L+25),
    expected=Math.max(minPitOut,Math.min(Math.max(0,PIT_EXIT_S-profile.exit*scale*PIT_ROUTE_SCALE),PIT_EXIT_S-30)),
    curveLength=PIT_EXIT_S-PIT_OUT_S,
    exitStart=L+PIT_OUT_S,exitEnd=L+PIT_EXIT_S,merge=L+PIT_EXIT_S+PIT_ROUTE.rejoin,
    near=(a,b)=>Math.abs(a-b)<0.02,
    vegasEnd=key==="vegas"&&CORNERS[0]?CORNERS[0].i1*DS+35*scale*PIT_ROUTE_SCALE:PIT_EXIT_S,
    continuous=near(pitRouteExitLatAt(exitStart-0.01),pitRouteExitLatAt(exitStart+0.01))
      &&near(pitRouteExitLatAt(exitEnd-0.01),pitRouteExitLatAt(exitEnd+0.01))
      &&near(pitRouteExitLatAt(merge-0.01),pitRouteLineAt(merge+0.01));
  return {key,ok:Object.hasOwn(PITROUTES,key)&&near(PIT_OUT_S,expected)&&near(curveLength,PIT_ROUTE.exit)
    &&PIT_OUT_S>=minPitOut&&PIT_OUT_S<PIT_EXIT_S-30&&PIT_ROUTE.rejoin>0&&continuous,
    actual:PIT_OUT_S,expected,curveLength,profileExit:profile.exit*scale*PIT_ROUTE_SCALE,rejoin:PIT_ROUTE.rejoin,continuous,
    vegasEnd:near(PIT_EXIT_S,vegasEnd)};
})`,ctx);

let failed=false;
for(const r of results){
  const ok=r.ok&&r.vegasEnd;
  console.log(`${ok?"PASS":"FAIL"} ${r.key}: exit start ${r.actual.toFixed(1)} m (expected ${r.expected.toFixed(1)}), curve ${r.curveLength.toFixed(1)} m (profile ${r.profileExit.toFixed(1)}), rejoin ${r.rejoin.toFixed(1)} m, continuous ${r.continuous}`);
  if(!ok)failed=true;
}
if(failed)process.exitCode=1;
else console.log(`OK: all ${results.length} built-in track exits respect per-track profiles, garage clearance and merge continuity.`);
