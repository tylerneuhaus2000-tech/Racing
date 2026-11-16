/* Aufruf: node tools/race-control-motion-audit.mjs "" madrid  (erstes Argument: anderer Spielordner zum Vergleich, leer = race-control) */
/* Messung "Panzer"-Bewegung: Drehung im Stand, Seitwärtsschieben ohne Drehung, Körper dreht mit Strecke */
import vm from "node:vm";
import { loadGame, autopilot } from "./race-control-harness.mjs";
const root=process.argv[2]||undefined, track=process.argv[3]||"madrid";
const tot={frames:0,pivotStill:0,strafe:0,strafeDist:0,moveDist:0,spins:0,crashes:0,snap:0};
for(let r=0;r<3;r++){
const ctx=loadGame(root?{root}:{});const run=c=>vm.runInContext(c,ctx);const G=ctx.__G;
run(`setTrack("${track}");newWeekend({mode:"quick",format:"race",laps:6,wx:"dry",lapsSel:6},null);`);
for(let i=0;i<9000&&!(G.S.phase==="racing"&&G.S.raceT-G.S.goT>30);i++){run("simStep(DT)");if(i%15===0)autopilot(ctx);}
/* forced events: spins and crashes on several cars, then track motion */
run(`globalThis.__ev=[];const live=S.cars.filter(c=>c.mode==="race"&&!c.pit&&!c.crash&&c.spinT<=0);
for(let j=0;j<live.length;j++){const c=live[j];if(j%3===0){c.spinCo=cornerNear(c.pos);spinCar(c,Math.random()<0.5?1:-1,c.lat>=0?1:-1,pick([null,"off","beach","tap"]));__ev.push(c);}
 else if(j%3===1&&j<12){const co=cornerNear(c.pos);c.soloArm={crash:true};soloEvent(c,co);__ev.push(c);}}`);
tot.spins+=run("__ev.filter(c=>c.spinT>0).length");tot.crashes+=run("__ev.filter(c=>c.crash).length");
const prev={};
for(let i=0;i<30*14;i++){run("simStep(DT)");
  const st=JSON.parse(run(`JSON.stringify(__ev.map(c=>{const b=carBox(c);return [b.x,b.y,Math.atan2(b.s,b.c),c.v,c.removed?1:0,(c.spinT>0?"spin"+(c.sk?c.sk.ph:"?"):"")+(c.crash?"crash"+(c.crash.done?"D":"")+(c.crash.hit?"H":"")+(c.crash.mech?"M":""):"")+(c.rejoin>0?"rejoin":"")+(c.wob?"wob":"")+(c.pit?"pit":"")+c.mode,c.lat,c.crash?c.crash.rest:null,S.cars.filter(o=>o!==c&&!o.removed&&obbMTV(c,o)).map(o=>o.drv.code+":"+o.v.toFixed(0)).join("/")]}))`));
  st.forEach((s,k)=>{const p=prev[k];prev[k]=s;if(!p||s[4]||p[4])return;tot.frames++;
    const dx=s[0]-p[0],dy=s[1]-p[1],d=Math.hypot(dx,dy);let dh=s[2]-p[2];while(dh>Math.PI)dh-=2*Math.PI;while(dh<-Math.PI)dh+=2*Math.PI;
    if(Math.abs(dh)>0.6){tot.snap++;(tot.snapK=tot.snapK||{})[p[5]+">"+s[5]]=1;return;}
    if(d<0.02&&Math.abs(dh)>0.01)tot.pivotStill++;
    const side=Math.abs(-dx*Math.sin(p[2])+dy*Math.cos(p[2]));tot.moveDist+=d;
    if(d>0.03&&side>0.5*d&&Math.abs(dh)<0.004){tot.strafe++;tot.strafeDist+=side;const kk=s[5]+(s[3]<3?"_slow":"");if(false)console.error("STR",s[5],"lat",p[6].toFixed(2),"->",s[6].toFixed(2),"rest",s[7],"ovl",s[8]);(tot.strK=tot.strK||{})[kk]=((tot.strK||{})[kk]||0)+1;}});}
}
console.log(JSON.stringify(tot),"strafe share",(tot.strafeDist/tot.moveDist*100).toFixed(1)+"%");
