/* Pit lane regression audit: queue spacing, double stacks, pit exit priority and fast stepping. */
import vm from "node:vm";
import { loadGame } from "./race-control-harness.mjs";

const arg = (name, fallback = null) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
};
const onlyTrack = arg("track");
const HIGH_SPEED = +(arg("speed", "8"));
const tracksCtx = loadGame();
const tracks = vm.runInContext("Object.keys(TRACKS)", tracksCtx).filter((k) => !onlyTrack || k === onlyTrack);
if (onlyTrack && !tracks.length) throw new Error(`Unknown track: ${onlyTrack}`);
let failed = false;

function fresh(track, seed) {
  const ctx = loadGame();
  let state = seed >>> 0;
  const math = Object.create(Math);
  math.random = () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 4294967296; };
  ctx.Math = math;
  const run = (code) => vm.runInContext(code, ctx);
  run(`setTrack(${JSON.stringify(track)});newWeekend({mode:"quick",format:"race",laps:40,wx:"dry",lapsSel:40},null);
    S.phase="racing";S.started=true;S.pitExitOpen=true;S.flag.mode="green";S.raceT=100;S.goT=0;`);
  run(`globalThis.__pitHits=0;globalThis.__gateWait=0;globalThis.__badGate=0;
    globalThis.__deoverlapOriginal=deoverlap;
    deoverlap=function(){for(let i=0;i<S.cars.length;i++)for(let j=i+1;j<S.cars.length;j++){
      const a=S.cars[i],b=S.cars[j];if(!a.removed&&!b.removed&&(a.pit||b.pit||a.garOut||b.garOut||a.garIn||b.garIn)&&obbHit(a,b,0))__pitHits++;}
      __deoverlapOriginal();};
    globalThis.__pitCtlOriginal=pitCtl;
    pitCtl=function(c,vT,dt){const p=c.pit,hold=mod(PIT_OUT_S-10),before=((hold-c.pos+L)%L)<L/2,
      blocked=p&&p.ph==="exit"&&before&&pitMergeBlocked(c),out=__pitCtlOriginal(c,vT,dt);
      if(blocked){__gateWait++;if(p.gate)__badGate++;}return out;};`);
  return { ctx, run };
}

function frame(ctx, run, n, speed = HIGH_SPEED) {
  run(`setSpeed(${speed})`);
  for (let i = 0; i < n; i++) run(`simStep(DT*${speed})`);
}

function queueAudit(track, seed) {
  const { ctx, run } = fresh(track, seed);
  run(`(()=>{const target=mod(PIT_OUT_S-6),placed=[];let tail=target;for(let i=S.cars.length-1;i>=0;i--){
    const c=S.cars[i],p=tail-22;c.mode="race";c.removed=false;c.crash=null;c.retired=false;c.finished=false;
    c.pit={ph:"in",goal:"queue",timer:0,trap:true,waitU:0};c.inPit=true;c.wantPit=false;c.pitGoal="queue";
    c.s=p;c.pos=mod(p);c.lat=pitEntryTarget(c);while(placed.some(o=>obbHit(c,o,2))){c.s-=2;c.pos=mod(c.s);c.lat=pitEntryTarget(c);}tail=c.s;placed.push(c);c.v=40;c.spin=0;c.yaw=0;c.drift=0;c.stopAt=absAhead(c,target);c.garIn=null;c.garOut=null;}
    for(const c of S.cars){c._pitPos=c.pos;c._pitLat=c.lat;c._pitV=c.v;}})()`);
  frame(ctx, run, 55);
  const before = run(`(()=>{const q=S.cars.filter(c=>c.pit&&c.pit.goal==="queue");let gap=Infinity,clearanceHits=0;
    for(let i=0;i<q.length;i++)for(let j=i+1;j<q.length;j++){gap=Math.min(gap,Math.abs(delta(q[i],q[j])));if(obbHit(q[i],q[j],0.5))clearanceHits++;}
    const target=mod(PIT_OUT_S-6),front=q.reduce((a,b)=>((target-a.pos+L)%L)<((target-b.pos+L)%L)?a:b),
      next=q.filter(c=>c!==front).reduce((a,b)=>!a||((target-b.pos+L)%L)<((target-a.pos+L)%L)?b:a,null);
    return {count:q.length,gap,clearanceHits,front:front&&front.drv.code,next:next&&next.drv.code,nextS:next&&next.s,hits:__pitHits};})()`);
  run(`(()=>{const target=mod(PIT_OUT_S-6),q=S.cars.filter(c=>c.pit&&c.pit.goal==="queue"),front=q.reduce((a,b)=>((target-a.pos+L)%L)<((target-b.pos+L)%L)?a:b);if(front){front.removed=true;front.pit=null;front.inPit=false;}})()`);
  frame(ctx, run, 18);
  const next = before.next;
  const moved = run(`(()=>{const c=S.cars.find(x=>x.drv.code===${JSON.stringify(next)});return c?c.s-(${before.nextS}):0;})()`);
  const after = run(`({hits:__pitHits,removed:S.cars.filter(c=>c.removed).length})`);
  const ok = before.count >= 18 && before.clearanceHits === 0 && moved > 4 && after.hits === 0;
  return { ok, count: before.count, gap: +before.gap.toFixed(1), tailMove: +moved.toFixed(1), overlaps: after.hits };
}

function doubleStopAudit(track, seed) {
  const { ctx, run } = fresh(track, seed);
  const teams = 6;
  run(`(()=>{const used=new Set();for(let ti=0;ti<${teams};ti++){
    const pair=S.cars.filter(c=>c.drv.ti===ti),a=pair[0],b=pair[1],pos=boxPos(ti);
    for(const c of [a,b]){c.mode="race";c.removed=false;c.crash=null;c.retired=false;c.finished=false;c.wantPit=false;c.pitGoal=null;c.speeding=0;c.stopAt=null;c.spin=0;c.yaw=0;c.drift=0;c.garIn=null;c.garOut=null;c.stops=0;}
    a.s=pos;a.pos=mod(pos);a.lat=BOXLAT;a.v=0;a.pit={ph:"svc",goal:"service",timer:0.8,T0:S.t,wait:0,work:0.8,rep:0,stack:false};a.inPit=true;used.add(a); 
    b.s=pos-CAR_L-26;b.pos=mod(b.s);b.lat=PLAT;b.v=0;b.pit={ph:"hold",goal:"service",timer:0,stack:true,waitU:0};b.inPit=true;used.add(b);
  }
  let n=0;for(const c of S.cars){if(used.has(c))continue;c.mode="race";c.removed=false;c.pit=null;c.inPit=false;c.crash=null;c.retired=false;c.finished=false;c.wantPit=false;c.stopAt=null;c.spin=0;c.yaw=0;c.drift=0;
    const pos=mod(PIT_EXIT_S+PIT_ROUTE.rejoin-220+n*24);c.s=pos;c.pos=pos;c.lat=T.line[sidx(pos)];c.v=55;n++;}
  for(const c of S.cars){c._pitPos=c.pos;c._pitLat=c.lat;c._pitV=c.v;}
  globalThis.__stackStart=S.cars.filter(c=>c.pit&&c.pit.ph==="hold").length;})()`);
  frame(ctx, run, 450);
  const out = run(`(()=>({hits:__pitHits,stackStart:__stackStart,stops:S.cars.reduce((n,c)=>n+c.stops,0),
    service:S.cars.filter(c=>c.pit&&c.pit.ph==="svc").length,hold:S.cars.filter(c=>c.pit&&c.pit.ph==="hold").length,
    exit:S.cars.filter(c=>c.pit&&c.pit.ph==="exit").length,remaining:S.cars.filter(c=>c.pit).length,
    pairs:S.cars.filter(c=>c.pit).map(c=>({code:c.drv.code,ti:c.drv.ti,ph:c.pit.ph,stack:c.pit.stack,pos:+c.pos.toFixed(1),lat:+c.lat.toFixed(1),v:+c.v.toFixed(1),timer:+(c.pit.timer||0).toFixed(1)})),
    badGate:__badGate,gateWait:__gateWait}))()`);
  const ok = out.hits === 0 && out.stackStart === teams && out.stops === teams * 2 && out.remaining === 0 && out.badGate === 0;
  return { ok, ...out };
}

function blockedLaneAudit(track, seed) {
  const { ctx, run } = fresh(track, seed);
  run(`(()=>{const c=S.cars[0],front=S.cars[1],rear=S.cars[2],pos=boxPos(c.drv.ti);
    for(const o of S.cars){o.removed=true;o.pit=null;o.inPit=false;o.garIn=null;o.garOut=null;}
    for(const o of [c,front,rear]){o.removed=false;o.mode="race";o.crash=null;o.retired=false;o.finished=false;o.wantPit=false;o.stopAt=null;o.spin=0;o.yaw=0;o.drift=0;o.v=0;}
    c.s=pos;c.pos=mod(pos);c.lat=BOXLAT;c.pit={ph:"svc",goal:"service",timer:0.2,T0:S.t,wait:0,work:0.2,rep:0,stack:false};c.inPit=true;
    for(const [o,offset] of [[front,18],[rear,-18]]){o.drv.ti=c.drv.ti;o.s=pos+offset;o.pos=mod(o.s);o.lat=PLAT;o.pit={ph:"hold",goal:"service",timer:0,stack:true,waitU:0};o.inPit=true;}
    for(const o of [c,front,rear]){o._pitPos=o.pos;o._pitLat=o.lat;o._pitV=o.v;}
    globalThis.__blockedInitially=pitLaneReleaseBlocked(c);globalThis.__blockedDebug={cpos:c.pos,box:pos,lane:S.cars.map(o=>o.pit&&o.pit.ph),gaps:[front,rear].map(o=>({pos:o.pos,gap:(o.pos-c.pos+L)%L,lat:o.lat,pitFlow:pitFlowCar(o),mode:o.mode}))};})()`);
  frame(ctx, run, 10);
  const waiting = run(`(()=>({phase:S.cars[0].pit&&S.cars[0].pit.ph,stops:S.cars[0].stops,hits:__pitHits,blocked:__blockedInitially,debug:__blockedDebug,
    blockers:S.cars.slice(1,3).map(o=>({removed:o.removed,phase:o.pit&&o.pit.ph,pos:o.pos,lat:o.lat,ti:o.drv.ti}))}))()`);
  run(`S.cars[1].removed=true;S.cars[2].removed=true`);
  frame(ctx, run, 14);
  const clear = run(`(()=>({phase:S.cars[0].pit&&S.cars[0].pit.ph,stops:S.cars[0].stops,hits:__pitHits}))()`);
  const ok = waiting.blocked && waiting.phase === "svc" && waiting.stops === 0 && waiting.hits === 0 &&
    (clear.phase === "exit" || clear.stops === 1) && clear.hits === 0;
  return { ok, waiting, clear };
}

function mergeAudit(track, seed) {
  const { ctx, run } = fresh(track, seed);
  run(`(()=>{const r=PIT_ROUTE,c=S.cars[0],sample=PIT_EXIT_S+r.rejoin-12;let pos=mod(PIT_OUT_S-60);
    for(let i=0;i<S.cars.length;i++){const o=S.cars[i];o.mode="race";o.removed=i>9;o.pit=null;o.inPit=false;o.crash=null;o.retired=false;o.finished=false;o.wantPit=false;o.stopAt=null;o.spin=0;o.yaw=0;o.drift=0;}
    c.removed=false;c.pit={ph:"exit",goal:"out",timer:0,waitU:0,trap:true};c.inPit=true;c.s=pos;c.pos=pos;c.lat=PLAT;c.v=40;
    const toOut=(PIT_OUT_S-pos+L)%L,tOut=pitTravelTime(toOut,c.v,PITV,ACC),after=sample-PIT_OUT_S,
      fast=tOut+pitTravelTime(after,PITV,VTOP,ACC),slow=tOut+after/PITV,mid=(fast+slow)/2,o=S.cars[1];
    o.removed=false;o.v=60;o.s=sample-o.v*mid;o.pos=mod(o.s);o.lat=T.line[sidx(o.pos)];
    for(let i=2;i<10;i++){const q=S.cars[i],s=sample-210+(i-2)*22;q.s=s;q.pos=mod(s);q.v=60;q.lat=T.line[sidx(q.pos)];}
    for(const q of S.cars){q._pitPos=q.pos;q._pitLat=q.lat;q._pitV=q.v;}
    globalThis.__blockedInitially=pitMergeBlocked(c);})()`);
  const blockedInitially = run("__blockedInitially");
  frame(ctx, run, 300);
  const out = run(`(()=>({hits:__pitHits,badGate:__badGate,gateWait:__gateWait,
    remaining:S.cars[0].pit?1:0,pos:+S.cars[0].pos.toFixed(1),v:+S.cars[0].v.toFixed(1)}))()`);
  const ok = blockedInitially && out.badGate === 0 && out.hits === 0 && out.remaining === 0 && out.gateWait > 0;
  return { ok, blockedInitially, ...out };
}

for (const [index, track] of tracks.entries()) {
  const seed = 20261117; // Identical traffic fixture; --track reproduces the full-suite case.
  const queue = queueAudit(track, seed);
  const doubleStop = doubleStopAudit(track, seed + 1);
  const blocked = blockedLaneAudit(track, seed + 2);
  const merge = mergeAudit(track, seed + 3);
  const ok = queue.ok && doubleStop.ok && blocked.ok && merge.ok;
  console.log(`${ok ? "PASS" : "FAIL"} ${track}: queue ${queue.count} cars / ${queue.gap} m min gap / ${queue.tailMove} m resumed / ${queue.overlaps} overlaps; double-stop ${doubleStop.stops} stops, ${doubleStop.remaining} still in lane / ${doubleStop.hits} overlaps; fully blocked lane ${blocked.waiting.blocked ? "blocked" : "open"} ${blocked.waiting.phase} -> ${blocked.clear.phase ?? "released"}, ${blocked.waiting.hits + blocked.clear.hits} overlaps; exit ${merge.blockedInitially ? "yielded" : "not blocked"}, ${merge.gateWait} wait checks / ${merge.hits} overlaps / ${merge.remaining} still on route`);
  if(!blocked.ok)console.log("  blocked-lane detail:",JSON.stringify(blocked));
  if(!doubleStop.ok)console.log("  double-stop detail:",JSON.stringify(doubleStop));
  if (!ok) failed = true;
}
if (failed) process.exitCode = 1;
else console.log(`OK: all ${tracks.length} track routes passed queue, double-stop, dense-exit and high-speed checks.`);
