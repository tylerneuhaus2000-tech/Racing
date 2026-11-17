/* Exercise the real approach -> startPit -> service/double stack -> merge path. */
import vm from "node:vm";
import { loadGame } from "./race-control-harness.mjs";

const option = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i < 0 ? fallback : process.argv[i + 1];
};
const onlyTrack = option("track", null);
const speed = Number(option("speed", "8"));
const seconds = Number(option("seconds", "150"));
const trackCtx = loadGame();
const tracks = vm.runInContext("Object.keys(TRACKS)", trackCtx).filter(k => !onlyTrack || k === onlyTrack);
if (!tracks.length) throw new Error(`Unknown track: ${onlyTrack}`);
let failed = false;

function audit(track, seed) {
  const ctx = loadGame();
  let rng = seed >>> 0;
  const math = Object.create(Math);
  math.random = () => { rng = (rng * 1664525 + 1013904223) >>> 0; return rng / 4294967296; };
  ctx.Math = math;
  const run = source => vm.runInContext(source, ctx);
  run(`setTrack(${JSON.stringify(track)});newWeekend({mode:"quick",format:"race",laps:40,wx:"dry",lapsSel:40},null);
    S.phase="racing";S.started=true;S.pitExitOpen=true;S.flag.mode="green";S.raceT=100;S.goT=0;setSpeed(${speed});
    // Isolate traffic dynamics from randomly scripted steward incidents.
    director=function(){};
    globalThis.__trip={boundaryErrors:0,raceHits:0,count:12,entered:0,stacked:0,completed:0,hits:0,speedErrors:0,jumps:0,turnErrors:0,maxJump:0,maxTurn:0,maxLimitExcess:0,samples:[]};
    (()=>{const selected=[];for(let ti=0;ti<6;ti++)selected.push(...S.cars.filter(c=>c.drv.ti===ti));
      for(const c of S.cars)c.removed=true;
      const start=PIT_ENTRY_S-PIT_ROUTE.approach-150,placed=[];let tail=start+35;
      selected.forEach((c,i)=>{c.removed=false;c.mode="race";c.pit=null;c.inPit=false;c.crash=null;c.retired=false;c.finished=false;
        c.wantPit=true;c.pitGoal="service";c.plan=[];c.stopAt=null;c.spin=0;c.spinT=0;c.yaw=0;c.drift=0;c.garIn=null;c.garOut=null;
        c.speedArm=0;c.speeding=0;c.unsafeArm=false;c.stops=0;c.s=tail-35;c.pos=mod(c.s);c.lat=T.line[sidx(c.pos)];while(placed.some(o=>obbHit(c,o,2))){c.s-=2;c.pos=mod(c.s);c.lat=lineAt(c.pos);}tail=c.s;placed.push(c);c.v=Math.min(80,T.prof[sidx(c.pos)]);
        c._trip=true;c._tripDone=false;c._tripPrevious={box:carBox(c),v:c.v,s:c.s,pit:false};c._pitPos=c.pos;c._pitLat=c.lat;c._pitV=c.v;});})();
    globalThis.__tripStartPit=startPit;startPit=function(c){__tripStartPit(c);if(c._trip){__trip.entered++;if(c.pit&&c.pit.stack)__trip.stacked++;}};
    globalThis.__tripDeoverlap=deoverlap;deoverlap=function(){
      // simStep invokes this after the continuous movement guard. Inspect only
      // committed motion, before any contact solver could conceal penetration.
      for(const c of S.cars){if(!c._trip||c.removed)continue;const old=c._tripPrevious,before=old.box,after=carBox(c),dt=DT,
          jump=Math.hypot(after.x-before.x,after.y-before.y),turn=Math.abs(Math.atan2(after.s*before.c-after.c*before.s,after.c*before.c+after.s*before.s));
        __trip.maxJump=Math.max(__trip.maxJump,jump);__trip.maxTurn=Math.max(__trip.maxTurn,turn);
        if(jump>Math.max(6,3*Math.max(old.v,c.v)*dt+1)){__trip.jumps++;if(__trip.samples.length<12)__trip.samples.push({kind:"jump",code:c.drv.code,pos:c.pos,jump,v:c.v,oldV:old.v,ds:c.s-old.s});}
        if((old.pit||c.pit)&&turn>0.35){__trip.turnErrors++;if(__trip.samples.length<12)__trip.samples.push({kind:"turn",code:c.drv.code,pos:c.pos,turn});}
        if(c.pit&&(c.pos>=PIT_IN_S||c.pos<=PIT_OUT_S)&&!c.speeding){const excess=c.v-PITV;__trip.maxLimitExcess=Math.max(__trip.maxLimitExcess,excess);
          if(excess>1){__trip.speedErrors++;if(__trip.samples.length<12)__trip.samples.push({kind:"speed",code:c.drv.code,pos:c.pos,v:c.v});}}
        if(c.pit){const q=posXY(c.s,c.lat),ca=Math.cos(q.ang),sa=Math.sin(q.ang),extent=BOX_HX*Math.abs(after.s*ca-after.c*sa)+BOX_HY*Math.abs(after.c*ca+after.s*sa),
            pitRoad=10.5-Math.abs(c.lat-pitRouteRoadLatAt(c.pos))-extent,
            wall=(c.pos>PIT_IN_S+4*DS||c.pos<PIT_OUT_S-4*DS)?-22.5-c.lat-extent:Infinity,
            line=c.pos>PIT_OUT_S+6*DS&&c.pos<PIT_EXIT_S?PITLINE-c.lat-extent:Infinity,
            road=Number.isFinite(wall)?pitRoad:Math.min(c.lat-extent-Math.min(-HW,pitRouteRoadLatAt(c.pos)-10.5),Math.max(HW,pitRouteRoadLatAt(c.pos)+10.5)-c.lat-extent);
          if(Math.min(road,wall,line)<-0.05){__trip.boundaryErrors++;if(__trip.samples.length<12)__trip.samples.push({kind:"boundary",code:c.drv.code,pos:c.pos,lat:c.lat,road,wall,line});}}
        if(old.pit&&!c.pit&&!c.inPit&&c.stops>=1&&!c._tripDone){c._tripDone=true;__trip.completed++;}
        c._tripPrevious={box:after,v:c.v,s:c.s,pit:!!c.pit};
      }
      for(let i=0;i<S.cars.length;i++)for(let j=i+1;j<S.cars.length;j++){const a=S.cars[i],b=S.cars[j];
        if(!a.removed&&!b.removed&&a.mode!=="garage"&&b.mode!=="garage"&&obbHit(a,b,0)){if(!pitMotionProtected(a)&&!pitMotionProtected(b)){__trip.raceHits++;continue;}__trip.hits++;if(__trip.samples.length<12)__trip.samples.push({kind:"overlap",a:a.drv.code,b:b.drv.code,aph:a.pit&&a.pit.ph,bph:b.pit&&b.pit.ph,apos:a.pos,bpos:b.pos,alat:a.lat,blat:b.lat});}}
      __tripDeoverlap();
      // Retire audit subjects only after the final merge's collision check.
      for(const c of S.cars)if(c._tripDone)c.removed=true;
    };`);
  const frames = Math.ceil(seconds / (speed / 30));
  for (let i = 0; i < frames; i++) {
    run(`simStep(DT*${speed})`);
    if (run("__trip.completed===__trip.count")) break;
  }
  return run(`({...__trip,lastConflict:S.pitLastConflict,guardStops:S.pitMotionStops||0,guardPreexisting:S.pitPreexistingOverlaps||0,remaining:S.cars.filter(c=>c._trip&&!c._tripDone).map(c=>({code:c.drv.code,ph:c.pit&&c.pit.ph,wantPit:c.wantPit,stack:c.pit&&c.pit.stack,pos:+c.pos.toFixed(1),lat:+c.lat.toFixed(1),v:+c.v.toFixed(1),stops:c.stops,mode:c.mode,crash:!!c.crash,retired:c.retired,removed:c.removed,script:!!c.script,stopAt:c.stopAt,blockBy:c.blockBy&&c.blockBy.drv.code,blockT:c.blockT}))})`);
}

for (const [i, track] of tracks.entries()) {
  const result = audit(track, 20261118);
  const ok = result.entered === result.count && result.stacked > 0 && result.completed === result.count &&
    result.hits === 0 && result.boundaryErrors === 0 && result.speedErrors === 0 && result.jumps === 0 && result.turnErrors === 0;
  console.log(`${ok ? "PASS" : "FAIL"} ${track}: ${result.entered}/${result.count} entered, ${result.stacked} natural stacks, ${result.completed} completed; ${result.hits} overlaps / ${result.boundaryErrors} boundary crossings; ${result.speedErrors} speed-limit errors (max ${result.maxLimitExcess.toFixed(2)}); ${result.jumps} jumps / ${result.turnErrors} abrupt turns`);
  if (!ok) { failed = true; console.log(JSON.stringify({lastConflict:result.lastConflict,guardStops:result.guardStops,guardPreexisting:result.guardPreexisting,remaining:result.remaining,samples:result.samples})); }
}
if (failed) process.exitCode = 1;
else console.log(`OK: all ${tracks.length} tracks completed actual approach, service, natural double stacks and merge at ${speed}x.`);
