import vm from "node:vm";
import { loadGame } from "./race-control-harness.mjs";

const ctx = loadGame();
const results = vm.runInContext(`Object.keys(TRACKS).map(key=>{
  setTrack(key);
  const profile=PITROUTES[key]||PITROUTES.ring,
    scale=TRACK.len?L/TRACK.len:1,
    lastBox=L+BOX0+24*(TEAM_KEYS.length-1),
    minPitOut=Math.max(0,lastBox-L+25),
    expected=Math.max(minPitOut,Math.min(Math.min(PIT_EXIT_S-60,160),PIT_EXIT_S-30)),
    curveLength=PIT_EXIT_S-PIT_OUT_S,
    exitStart=L+PIT_OUT_S,exitEnd=L+PIT_EXIT_S,merge=L+PIT_EXIT_S+PIT_ROUTE.rejoin,
    near=(a,b)=>Math.abs(a-b)<0.02,
    vegasEnd=key==="vegas"&&CORNERS[0]?CORNERS[0].i1*DS+35*scale:PIT_EXIT_S,
    oldExitShape=near(pitRouteExitLatAt(exitStart+0.01),-34+9.4*0.01/Math.max(1,PIT_EXIT_S-PIT_OUT_S))
      &&near(pitRouteExitLatAt(exitEnd-0.01),-24.6)
      &&near(pitRouteExitBoundaryAt(exitEnd),PIT_EXIT_LINE)
      &&near(pitRouteExitLatAt(exitEnd+0.01),pitRouteLineAt(exitEnd+0.01));
  return {key,ok:Object.hasOwn(PITROUTES,key)&&near(PIT_OUT_S,expected)&&near(curveLength,PIT_ROUTE.exit)
    &&PIT_OUT_S>=minPitOut&&PIT_OUT_S<PIT_EXIT_S-30&&PIT_ROUTE.rejoin>0&&oldExitShape,
    actual:PIT_OUT_S,expected,curveLength,profileExit:profile.exit*scale,rejoin:PIT_ROUTE.rejoin,oldExitShape,
    vegasEnd:near(PIT_EXIT_S,vegasEnd)};
})`,ctx);

let failed=false;
for(const r of results){
  const ok=r.ok&&r.vegasEnd;
  console.log(`${ok?"PASS":"FAIL"} ${r.key}: exit start ${r.actual.toFixed(1)} m (expected ${r.expected.toFixed(1)}), curve ${r.curveLength.toFixed(1)} m, old line and boundary ${r.oldExitShape}`);
  if(!ok)failed=true;
}
if(failed)process.exitCode=1;
else console.log(`OK: all ${results.length} built-in track exits use the earlier straight exit line and keep garage clearance.`);
