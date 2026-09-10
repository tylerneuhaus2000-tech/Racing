#!/usr/bin/env node
// Uses the game's actual spline, driver and 120 Hz physics; only rendering is stubbed.
// Usage: node tools/ai-drive-audit.cjs /path/to/three-r128.cjs [track-id] [seconds] [cars]
const fs = require('node:fs');
const vm = require('node:vm');
if(!process.argv[2])throw Error('Usage: node tools/ai-drive-audit.cjs /path/to/three-r128.cjs [track-id] [seconds] [cars]');
const THREE = require(require('node:path').resolve(process.argv[2]));
const html = fs.readFileSync(process.env.AI_HTML || 'gt3-web-racer.html', 'utf8');
const slice = (a,b) => {const start=html.indexOf(a),end=html.indexOf(b,start);if(start<0||end<0)throw Error('Game extraction marker missing: '+a);return html.slice(start,end);};
let seed = 12345, now = 0;
const math = Object.create(Math);
math.random = () => ((seed = (Math.imul(seed,1664525)+1013904223)>>>0) / 4294967296);
const ctx = vm.createContext({THREE, console, assert:require('node:assert/strict'), Math:math, performance:{now:()=>now*1000}});
vm.runInContext([
  slice('const CARS = [','const SHOP_ITEMS'),
  slice('const G = 9.81;','class Input {'),
  slice('class Track {','class Particles {'),
  slice('let AI_GRIP_CALIBRATION','class DetachedPart {'),
  `const Game = {pitStopsEnabled:false, weather:{...WEATHER_PRESETS.dry,lineDry:1}, _raceTimeS:0};
   Car.prototype.buildMesh = function(){this.group=new THREE.Group();this.parts={};};
   Car.prototype.updateMesh = function(){};`
].join('\n'),ctx);
for (const file of ['assets/tracks.js','assets/tracks/redbull-ring.js','assets/tracks/monza-mesh.js','assets/tracks/sachsenring.js','assets/tracks/silverstone-gp-ai.js'])
  vm.runInContext(fs.readFileSync(file,'utf8'),ctx);
if(process.env.AI_GRIP)vm.runInContext('AI_GRIP_CALIBRATION='+Number(process.env.AI_GRIP),ctx);
if(process.env.AI_DISABLE_LEARNED_LINE)ctx.AI_DISABLE_LEARNED_LINE=true;
// Targeted regressions: stationary traffic must win over attack state, and
// queueing must never trigger reverse recovery.
vm.runInContext(`(()=>{
  const driver=new AIDriver(92,0,1,AI_PERSONALITY_PRESETS[3]);
  const track={N:100,segLen:5,def:{halfWidth:8},samples:Array.from({length:100},(_,i)=>({pos:{x:0,y:0,z:i*5},tan:{x:0,z:1},side:{x:1,z:0},curv:0}))};
  const q={idx:0,lat:0,tan:{x:0,z:1},side:{x:1,z:0}};
  const car={pos:{x:0,z:0},heading:0,vx:20,vy:0,yawRate:0,def:{classType:'gt3'},L:2.7};
  const obstacle={_uid:'stopped',pos:{x:0,z:10},heading:0,vx:0,vy:0,query:{...q,idx:2}};
  driver._ov={phase:'attack',side:1,targetId:'stopped',timer:5};
  assert.equal(driver.scanTraffic(car,[car,obstacle],20,track,q).vCap,0);
  driver.stuckT=2;Game._raceTimeS=3;
  assert.equal(driver.handleRecovery(car,q,0,1/120,track,[]),null);
  assert.equal(driver.revT,0);assert.equal(driver.fwdRescueT,0);
  driver.stuckT=2;Game._raceTimeS=30;
  assert.equal(driver.handleRecovery(car,q,0,1/120,track,[car,obstacle]),null);
  assert.equal(driver.revT,0);assert.equal(driver.stuckT,0);
  assert.equal(new AIDriver(0,0,1).skill,0);
  // An established constant-radius turn must not be cancelled by yaw damping.
  const radius=100, angle=0.18;
  const target={x:radius*(1-Math.cos(angle)),z:radius*Math.sin(angle)};
  track.samples.forEach(s=>s.pos=target);
  car.vx=30;car.yawRate=car.vx/radius;
  driver.applySteering(car,track,q,{target:0,maxOff:6},1);
  const expected=Math.atan(car.L/radius)/(0.38/(1+30*0.035));
  assert.ok(Math.abs(driver.input.steer-expected)<0.001);
  // Identical nominal segment lengths must not hide a physically nearer hairpin.
  const makeTrack=spacing=>({...track,samples:Array.from({length:100},(_,i)=>({
    pos:{x:0,y:0,z:i*spacing},tan:{x:0,z:1},side:{x:1,z:0},curv:i===20?0.1:0
  }))});
  driver._effALat=6;car.def.topSpeed=80;
  const near=makeTrack(1),far=makeTrack(5);
  const nearV=driver.planCornerSpeed(car,near,q,40,0,null);
  const farV=driver.planCornerSpeed(car,far,q,40,0,null);
  assert.ok(nearV<farV-10);
  driver._buildCache(near);
  const oldCache=driver._tcache;
  driver._buildCache(far);
  assert.notEqual(driver._tcache,oldCache);
  assert.equal(driver._tcacheTrack,far);
})()`,ctx);
if(process.env.AI_SELF_TEST){console.log('AI controller regressions: PASS');process.exit(0);}
const defs=vm.runInContext('TRACKS',ctx);
const rows=[];
for(const def of defs.filter(d=>d && (!process.argv[3] || d.id===process.argv[3]))){
  seed=12345;now=0;
  ctx.latScale=Number(process.env.AI_LAT_SCALE??1);ctx.debugContacts=!!process.env.AI_DEBUG_CONTACTS;ctx.difficulty=Number(process.env.AI_DIFFICULTY??92);ctx.debug=!!process.env.AI_DEBUG;ctx.carId=process.env.AI_CAR;ctx.carClass=process.env.AI_CLASS;ctx.wet=process.env.AI_WEATHER==='wet';ctx.mixed=!!process.env.AI_MIXED;ctx.def=structuredClone(def);ctx.duration=+(process.argv[4]||1000);ctx.count=+(process.argv[5]||1);ctx.simulatedFieldSize=Number(process.env.AI_FIELD_SIZE)||ctx.count;
  const state=vm.runInContext(`(()=>{
    const track=Object.create(Track.prototype);
    Object.assign(track,{def,halfW:def.halfWidth,kerbW:def.kerbW||1.4,wallDist:def.wallDist||(def.halfWidth+13)});
    track.buildSpline(); Game.track=track;Game._raceTimeS=0;Game.weather={...WEATHER_PRESETS[wet?'wet':'dry'],lineDry:wet?0:1};
    const cd=CARS.find(c=>carId&&c.id===carId)
      || CARS.find(c=>c.classType===(def.kartOnly?'kart':carClass||'gt3'));
    if(!cd)throw Error('No matching car for '+(carId||carClass));
    const cars=Array.from({length:count},(_,i)=>{
      const c=new Car(cd,new THREE.Scene(),null);c.rd={lap:1};
      const columns=mixed&&track.halfW>=3.2?2:1;
      const rows=Math.ceil(count/columns);
      const gap=Math.min(13,track.totalLen/(rows+3));
      c.placeAtGrid(track,(track.N-Math.ceil(Math.floor(i/columns)*gap/track.segLen))%track.N,columns===2?(i%2?1:-1)*Math.min(count>=20?2.3:2.9,Math.max(0,track.halfW-1.2)):0);return c;
    });
    if(${Boolean(process.env.AI_FLYING_START)})cars.forEach(c=>{
      c.vx=Math.min(c.def.topSpeed*0.78,62);
      c.tireTemp={FL:88,FR:88,RL:88,RR:88};
      c.engineState.throttleFiltered=1;
    });
    const drivers=cars.map((c,i)=>{const d=new AIDriver(difficulty,i,simulatedFieldSize,AI_PERSONALITY_PRESETS[mixed?i%4:3]);d.aLatBase*=latScale;d.setupForRace(3,0);d._buildCache(track);return d;});
    return {track,cars,drivers,stats:cars.map(()=>({progress:0,laps:0,lapStartedAt:0,lapTimes:[],off:0,grass:0,stuck:0,maxStuck:0,maxKmh:0})),steps:0};
  })()`,ctx);
  ctx.state=state;
  for(let t=0;t<ctx.duration;t+=1){
    now=t;
    vm.runInContext(`for(let tick=0;tick<120;tick++){
      Game._raceTimeS+=PHYS_DT;state.steps++;
      const inputs=state.cars.map((c,i)=>({...state.drivers[i].control(c,state.track,PHYS_DT,true,state.cars,c.rd)}));
      state.cars.forEach((c,i)=>{const prev=c.sampleIdx;c.step(PHYS_DT,inputs[i],state.track,null);
        const s=state.stats[i],N=state.track.N;
        s.progress+=((c.sampleIdx-prev+N*1.5)%N)-N*.5;
        const completed=Math.floor(s.progress/N);
        while(s.laps<completed){
          const lapAt=Game._raceTimeS;
          s.lapTimes.push(lapAt-s.lapStartedAt);
          s.lapStartedAt=lapAt;
          s.laps++;
        }
        if(Math.abs(c.query.lat)>state.track.halfW-(c.def.classType==='kart'?0.6:1))s.off++;
        if(c.surf===SURF.GRASS)s.grass++;
        if(debug && Math.abs(c.query.lat)>state.track.halfW-1 && (!s.logT||Game._raceTimeS-s.logT>0.5)){s.logT=Game._raceTimeS;console.log({t:s.logT,idx:c.sampleIdx,lat:c.query.lat,v:c.vx,steer:inputs[i].steer,curv:c.query.curv,heading:c.heading,brake:inputs[i].brake});}
        s.stuck=c.vx<2 && Game._raceTimeS>10?s.stuck+PHYS_DT:0;
        s.maxStuck=Math.max(s.maxStuck,s.stuck);s.maxKmh=Math.max(s.maxKmh,c.speedKmh);
        if(!Number.isFinite(c.pos.x+c.pos.z+c.vx))throw Error('Non-finite physics');
      });
      if(debugContacts)for(let a=0;a<state.cars.length;a++)for(let b=a+1;b<state.cars.length;b++){
        const ca=state.cars[a],cb=state.cars[b];
        if(Math.hypot(ca.pos.x-cb.pos.x,ca.pos.z-cb.pos.z)<3.6 && (!state.contactT || Game._raceTimeS-state.contactT>1)){
          state.contactT=Game._raceTimeS;console.log(JSON.stringify({contactAt:state.contactT,a,b,cars:[ca,cb].map(c=>({x:c.pos.x,z:c.pos.z,idx:c.sampleIdx,lat:c.query.lat,v:c.vx,heading:c.heading})),inputs:[inputs[a],inputs[b]],drivers:[a,b].map(i=>({lo:state.drivers[i].loS,target:state.drivers[i]._trafficLine,err:state.drivers[i].lastErr,rev:state.drivers[i].revT,fwd:state.drivers[i].fwdRescueT,turn:state.drivers[i].turnT}))}));
        }
      }
      if(state.cars.length>1)collideCars(state.cars);
    }`,ctx);
    if(state.stats.every(s=>s.laps>=3))break;
  }
  const row={track:def.id,seconds:+(state.steps/120).toFixed(1),cars:state.stats.map((s,i)=>({laps:s.laps,lapTimes:s.lapTimes.map(v=>+v.toFixed(3)),bestLap:s.lapTimes.length?+Math.min(...s.lapTimes).toFixed(3):null,offPct:+(100*s.off/state.steps).toFixed(2),grassPct:+(100*s.grass/state.steps).toFixed(2),stuck:+s.maxStuck.toFixed(1),maxKmh:Math.round(s.maxKmh),walls:state.cars[i].wallContacts,contacts:state.cars[i].carContacts}))};
  rows.push(row);console.log(JSON.stringify(row));
}
if(process.env.AI_REPORT)fs.writeFileSync(process.env.AI_REPORT,JSON.stringify(rows,null,2)+'\n');
if(!rows.length)throw Error('No matching tracks');
/* A full grid can legitimately queue for several seconds at a hairpin. Keep
   the strict five-second limit for solo/small-field driving, but allow ten
   seconds once 20+ cars are sharing the circuit. */
const stuckLimit=ctx.count>=20?10:5;
if(rows.some(r=>r.cars.some(c=>c.laps<3||c.offPct>1||c.stuck>stuckLimit||c.walls>0||c.contacts>0)))process.exitCode=1;
