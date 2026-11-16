"use strict";
/* ============ Autos: Physik, KI, Boxengasse ============ */
let S=null, W=null;
const COI=new Int16Array(NU).fill(-1);
function refreshCOI(){COI.fill(-1);CORNERS.forEach((c,n)=>{for(let i=c.i0;i<=c.i1;i++)COI[i]=n;});}
refreshCOI();
const delta=(a,b)=>{let d=(b.pos-a.pos)%L;if(d>L/2)d-=L;if(d<-L/2)d+=L;return d;};
const grp=c=>(c.inPit&&c.lat<-18)?1:0;
const absAhead=(c,p)=>c.s+((p-c.pos+L)%L);

/* Genaue Hitbox: gedrehte Rechtecke in Weltkoordinaten (Trennachsen-Test) statt Abstand entlang der Strecke */
function carBox(c){const q=posXY(c.s,c.lat),h=q.ang+c.spin+SIDE*(c.yaw+(c.drift||0));return {x:q.x,y:q.y,c:Math.cos(h),s:Math.sin(h)};}
function obbHit(A,B,pad){const a=carBox(A),b=carBox(B),hx=7.45+(pad||0),hy=2.55+(pad||0),dx=b.x-a.x,dy=b.y-a.y;
  if(dx*dx+dy*dy>330)return false;
  for(const [ux,uy] of [[a.c,a.s],[-a.s,a.c],[b.c,b.s],[-b.s,b.c]]){
    const ra=hx*Math.abs(ux*a.c+uy*a.s)+hy*Math.abs(-ux*a.s+uy*a.c),rb=hx*Math.abs(ux*b.c+uy*b.s)+hy*Math.abs(-ux*b.s+uy*b.c);
    if(Math.abs(dx*ux+dy*uy)>ra+rb)return false;}
  return true;}
function mkCar(drv,i){return {i,drv,s:0,pos:0,lat:0,latV:0,v:0,spin:0,inPit:false,pit:null,mode:"garage",
  tyre:"S",wear:0,dmg:0,noise:0,penSec:0,penTot:0,dtPending:false,strikes:0,stops:0,warn:0,dsq:false,
  laps:[],del:new Set(),lapId:0,lapT0:0,outDist:0,pushLeft:0,runs:0,nextOut:0,
  omT:0,omOn:false,ot:null,otCool:0,yieldT:0,yieldSide:1,blockT:0,blockBy:null,holdT:0,defT:0,defLat:null,
  script:null,busy:null,sLat:null,sRate:0,sFree:false,sSpd:1,ram:false,wide:null,wideArm:null,soloArm:null,impede:null,fakeImp:null,
  crash:null,spinT:0,spinDir:1,removed:false,retired:false,finished:false,finT:0,finLaps:0,stopAt:null,wantPit:false,pitGoal:null,
  plan:[],used:new Set(),nextTyre:null,react:0,launch:1,decLap:-99,sparks:0,brk:false,rogue:false,unsafeArm:false,speedArm:0,speeding:0,
  lastCo:-1,_tl:0,onGrid:false,yaw:0,spinH0:0,cold:0,slotK:i,unlap:false,unlapPh:0,lic:0,lockT:0,relT:0,rejoin:0,spinT0:2.6,spinSide:0,dustT:0};}
function placeGarage(c){c.inPit=true;c.mode="garage";c.lat=GARLAT;c.s=boxPos(c.drv.ti)+(c.drv.slot?8:-8);c.pos=mod(c.s);c.v=0;c.pit=null;c.stopAt=null;c.spin=0;}
function bestLap(c){let b=null;for(const l of c.laps)if(!c.del.has(l.id)&&(b===null||l.t<b))b=l.t;return b;}
function wearRate(c){const life=S.type==="race"?(S.sprint?W.opts.laps:S.laps)*(c.tyre==="S"?0.42:c.tyre==="M"?0.68:c.tyre==="H"?1.0:0.8):30;
  let r=1/(life*L);if((c.tyre==="I"||c.tyre==="W")&&S.wx.wet<0.12)r*=4;return r;}
function grip(c,idx){
  const wl=wetAt(c.pos);
  let g=(1-c.drv.perf*(S.type==="race"?0.017:0.0085)+(c.form||0))*tyreGrip(c.tyre,c.wear,wl)*(1+0.006*S.evo)*(1+c.noise);
  if(c.dmg)g*=0.97; if(c.punct)g*=0.6; if(S.type==="race")g*=0.99;
  if(Math.abs(T.k[idx])>0.008)g*=1-0.0003*S.wx.windKmh*Math.abs(Math.sin(T.ang[idx]-S.wx.wind));   // Seitenwind in Kurven
  if(c.cold>0)g*=1-0.04*Math.min(1,c.cold/14);
  if(!c.pit){const offl=Math.abs(c.lat-T.line[idx])>4.5;
    if(Math.abs(T.k[idx])>0.008&&offl)g*=0.975; if(Math.abs(c.lat)>LINE_OUT+1)g*=0.95;
    if(offl&&wl>0.08&&wl<0.5&&S.wx.rain<0.05)g*=0.965; }  // abtrocknende Ideallinie
  return g;}
function laneFree(c,tg,ex){const G0=grp(c),wreck=ex&&ex.crash;
  for(const o of S.cars){if(o===c||o===ex||o.removed||o.mode==="garage"||grp(o)!==G0)continue;
    const d=delta(c,o);if(wreck&&d<-2)continue;   // um ein Wrack herum zählt nur, wer vorn oder neben mir ist
    if(Math.abs(d)<CAR_L+5&&Math.abs(o.lat-tg)<CAR_W+0.6)return false;}
  return true;}
function isSlow(c,o){
  if(S.type==="race")return S.phase==="racing"&&S.flag.mode!=="sc"&&S.flag.mode!=="red"&&!c.finished&&o.s-c.s>L*0.6&&o.mode==="race";
  return (c.mode==="out"||c.mode==="in")&&o.mode==="push";}

function carStep(c,dt){
  c.omOn=false; if(c.sparks>0)c.sparks-=dt; if(c.lockT>0)c.lockT-=dt; if(c.relT>0)c.relT-=dt;
  if(c.removed||c.mode==="garage"||c.mode==="grid"){c.brk=false;return;}
  if(c.crash){crashStep(c,dt);return;}
  if(c.nudge){const n=c.nudge,f=Math.min(dt,n.T-n.t)/n.T;n.t+=dt;c.v=Math.max(0,c.v-n.dv*f);c.lat+=n.dl*f;if(n.t>=n.T)c.nudge=null;}
  if(c.wob){const w=c.wob;w.t+=dt;if(w.t>=w.T){c.wob=null;c.spin=0;}else{const u=w.t/w.T;c.spin=w.amp*1.5*Math.sin(2*Math.PI*u)*Math.sin(Math.PI*u)*(1-0.4*u);}}   // Auto schlägt nach einem Treffer sichtbar aus
  if(c.otCool>0)c.otCool-=dt; if(c.yieldT>0)c.yieldT-=dt; if(c.holdT>0)c.holdT-=dt; if(c.defT>0)c.defT-=dt; if(c.cold>0)c.cold-=dt;
  const F=S.flag,race=S.type==="race",idx=sidx(c.pos),prof=T.prof[idx],G0=grp(c),v0=c.v;
  if(c.spinT>0){spinStep(c,dt);return;}
  if(c.rejoin>0){ c.rejoin-=dt; let busy=false;             // wartet am Rand, bis die Lücke frei ist
    for(const o of S.cars){if(o===c||o.removed||o.mode==="garage"||grp(o)!==0)continue;const d=delta(c,o);if(d>-120&&d<8&&(o.v>8||o.blockBy===c)){busy=true;break;}}
    if(busy&&c.rejoin>0){c.v=0;c.brk=false;c.latV=0;return;}
    c.rejoin=0;c.holdT=1.2;c.cold=5; }
  if(aquaStep(c,DT)&&(c.crash||c.spinT>0)){if(c.crash)crashStep(c,dt);else spinStep(c,dt);return;}
  const ci=COI[idx];
  if(ci<0)c.lastCo=-1;
  else if(!c.pit&&!c.script&&!c.busy&&c.lastCo!==ci&&c.pos>PIT_EXIT_S+60&&c.pos<PIT_ENTRY_S-80){const co=CORNERS[ci];
    if(c.soloArm&&(co.kmax>0.0135||c.soloArm.err)&&soloReady(c,co,idx)&&(c.soloArm.err||aloneCar(c,40))){const sa=c.soloArm;c.lastCo=ci;soloEvent(c,co);if(sa.chain!=null)chainCheck(c,sa.chain);if(c.crash){crashStep(c,dt);return;}if(c.spinT>0){spinStep(c,dt);return;}}
    else if(c.wideArm&&!c.wide&&!c.ot&&co.kmax>0.012&&idx>=co.i0){c.lastCo=ci;
      if(aloneCar(c,40)){c.wide=mkOffTrack(c,co,c.wideArm);c.wideArm=null;if(c.wide.big&&c.mode==="push")c.lapBad=true;if(c.wide.lock&&!(c.lockT>0))c.lockT=rand(0.4,1);}}
    else if(co.kmax>0.008&&idx>=co.i0&&cornerErr(c,co,ci)){if(c.crash){crashStep(c,dt);return;}if(c.spinT>0){spinStep(c,dt);return;}}}
  let vT=prof*grip(c,idx);if(c.limp&&!c.pit)vT*=c.limp;if(c.dmul)vT*=c.dmul;
  const neutral=F.mode==="sc"||F.mode==="vsc"||F.mode==="red";
  const ySec=S.sec[sectorOf(c.pos)], inSec=ySec>0&&!neutral;
  const stuck=o=>(o.crash||o.v<12||(o.dmg&&o.v<c.v*0.6)||o.spinT>0||o.rejoin>0)&&!(S.rsChain&&o.mode==="form"&&!o.crash&&!(o.spinT>0));   // Unfallauto, Wrack oder angeschlagenes Auto: immer vorbeifahren, auch unter Gelb/SC
  const noOT=!c.unlap&&(neutral||S.phase==="form"||(inSec&&!c.rogue)||c.mode==="cool"||c.mode==="in");
  if(c.mode==="out")vT*=(c.gapT>0?0.62:0.82); else if(c.mode==="in"||c.mode==="cool")vT*=0.74;
  if(c.gapT>0)c.gapT-=dt;
  if(S.phase==="form")vT=prof*0.55;
  if(F.mode==="vsc")vT=Math.min(vT,prof*(c.vscFast?0.8:0.6));
  else if(F.mode==="sc")vT=Math.min(vT,prof*(c.unlap||c.scFree?0.93:S.restart&&c===S.leader?0.66:0.8));   // freie Fahrt bis zum Ende des Zuges: aufschließen
  else if(F.mode==="red")vT=Math.min(vT,prof*0.88);
  else if(inSec)vT=Math.min(vT,prof*(ySec>1?0.7:0.85));
  if(race&&S.phase==="racing"&&S.raceT-S.goT<c.react)vT=0;
  vT*=c.sSpd; if(c.wob)vT*=0.8; if(c.wide&&c.wide.lock&&c.wide.t<(c.wide.big?1.4:0.9))vT*=c.wide.big?1.12:1.07;if(c.wide&&c.wide.slow<1&&c.wide.t>c.wide.T*(c.wide.a||0.5)*0.6)vT*=c.wide.slow;   // Verbremser: zu spät auf der Bremse
  if(c.dustT>0)c.dustT-=dt;
  if(c.giveBack){const gb=c.giveBack,o=gb.to;gb.t+=dt;       // Anweisung der Rennleitung: Platz zurückgeben
    if(o.removed||o.retired||o.pit||c.pit||o.finished||neutral)c.giveBack=null;
    else if(delta(c,o)>CAR_L+4){c.giveBack=null;c.otCool=8;c.ot=null;
      if(gb.team){addLog(`Teamorder bei ${TEAMS[c.drv.team].name} ausgeführt: ${c.drv.code} lässt ${o.drv.code} vorbei`);o.gotTeam=c;c.gaveTeam=o;}
      else{addLog(`CAR ${c.drv.num} (${c.drv.code}) hat den Platz an ${o.drv.code} zurückgegeben`,"good");radio(c,"Okay, er ist vorbei. Platz zurückgegeben.",false,true);}}
    else if(gb.t>30){c.giveBack=null;if(!gb.team)givePen(c,5,"Platz nicht zurückgegeben");}
    else{vT*=0.7;c.ot=null;c.otCool=1;if(c.yieldT<=0)c.yieldSide=T.line[idx]>=0?-1:1;c.yieldT=1;}}
  // Nachbarn
  let ahead=null,ad=1e9,tow=false,yieldTo=false,side=null,outYield=false;const kk=Math.abs(T.k[idx]),tight=kk>0.028;
  const ntc=G0===0?nextCorner(c.pos,0,false):null,tz=tight||!!(ntc&&ntc.c.kmax>0.028&&ntc.d<120),tdir=ntc&&ntc.d<120?ntc.c.dir:Math.sign(T.k[idx]);
  if(c.fight>0)c.fight-=dt; if(c.fightT>0)c.fightT-=dt;
  const nearStop=c.stopAt!=null&&c.stopAt-c.s<45;
  for(const o of S.cars){ if(o===c||o.removed||o.mode==="garage"||grp(o)!==G0)continue;
    const d=delta(c,o);
    if(G0===0&&Math.abs(d)<CAR_L*1.1&&Math.abs(o.lat-c.lat)>=CAR_W*0.9&&Math.abs(o.lat-c.lat)<12){side=o;
      if(tz&&Math.abs(d)<=6&&((c.lat-o.lat)*tdir<0||(Math.abs(d)<=4&&d>0)))outYield=true;}  // vor engen Kurven: Außenbahn steckt zurück
    if(d>0&&d<85){const dl=Math.abs(o.lat-c.lat);
      if(dl<9&&d<(race?(c.atk?150:110):50))tow=true;
      if(c.towBy===o&&o.towFor===c&&d<130&&dl<10){tow=true;c.towTeam=0.3;}   // Teamkollege zieht im Windschatten
      let lane=dl<(o.spinT>0?9.8:CAR_W+0.8)||(tz&&!o.crash&&d>4&&d<CAR_L+14&&G0===0&&!isSlow(o,c)&&o.v>25&&!(o.spinT>0)&&!(o.rejoin>0)&&!o.giveBack);
      if(o.crash&&o.crash.done&&dl>=CAR_W+0.8)lane=false;   // stehendes Wrack neben der Linie: einfach vorbei
      if(!lane&&noOT&&G0===0&&!nearStop&&!stuck(o)&&(S.phase!=="form"||S.restartGrid))lane=true;
      if(lane&&c.hitT!==o&&!(c.ram&&c.script&&c.script.B===o)&&!(c.sFree&&(c.busy===o||(c.script&&c.script.B===o)))){let de=d;
        if(d<45&&G0===0&&(kk>0.01||Math.abs(T.k[sidx(o.pos)])>0.01)){const pa=posXY(c.s,c.lat),pb=posXY(o.s,o.lat);de=Math.min(d,Math.hypot(pa.x-pb.x,pa.y-pb.y));}  // echter Abstand: auf der Innenbahn enger Kurven ist er kürzer als entlang der Mittellinie
        if(de<ad){ad=de;ahead=o;}}
      if(c.mode==="out"&&!c.pit&&d<110&&o.mode==="out"&&o.v>20&&c.pos<L*0.75)c.gapT=0.5; // Abstand für die schnelle Runde aufbauen
    }else if(d<0&&d>-90&&G0===0&&!c.pit&&isSlow(c,o))yieldTo=true;
    else if(c.towFor===o&&G0===0&&!c.pit&&d<0&&d>-(CAR_L+14)){yieldTo=true;vT*=0.9;}
  }
  if(c.mode==="form"&&G0===0&&(!S.restartGrid||S.rsChain)){ahead=null;ad=1e9;const p=c.pred;if(p&&p.mode==="form"&&grp(p)===0){const d=delta(c,p);if(d>0&&d<85){ahead=p;ad=d;}}}
  if(S.sc&&S.sc.on&&G0===0){const d=delta(c,S.sc);
    if(c.unlap){if(c.unlapPh===0&&d<-8&&d>-90){c.unlapPh=1;c.unlapS=c.s;}
      // einmal um die Strecke, dann am Ende des Feldes einreihen (egal auf welcher Spur der Letzte fährt)
      const tail=c.unlapPh===1&&c.s-c.unlapS>L*0.35&&S.cars.some(o=>o!==c&&!o.unlap&&!o.removed&&!o.pit&&o.mode==="race"&&delta(c,o)>4&&delta(c,o)<55);
      if(tail){c.unlap=false;c.unlapPh=0;addLog(c.wave?`${c.drv.code} hat sich hinten im Feld eingereiht`:`${c.drv.code} hat sich zurückgerundet`);c.wave=false;}}
    else if(d>0&&d<85&&d<ad){ad=d;ahead=S.sc;}}
  c.scFree=F.mode==="sc"&&!ahead&&!c.pit&&!S.restart;
  if(ahead&&ahead.crash&&ahead.crash.done&&!c.ot&&ad<70){const aw=Math.abs(ahead.lat)>9?Math.sign(-ahead.lat):Math.sign(c.lat-ahead.lat)||1;c.yieldSide=aw;c.yieldT=1.2;c.otCool=0;}   // hinter einem stehenden Wrack: sofort zur freien Seite
  if(side&&!c.pit&&race&&S.phase==="racing"&&!neutral){c.fightT=2.5;   // Rad an Rad: Innenbahn der nächsten Kurve ist im Vorteil
    if(kk>0.008){const ins=Math.sign(T.k[idx])*(c.lat-side.lat)>0;vT*=ins?(c.ot?1.03:1.012):(kk>0.012&&!c.script&&!c.busy?0.93:0.986);}}
  if(c.fight>0&&!c.pit)vT*=1.008;
  if(outYield&&!c.pit&&!c.script&&!c.busy)vT*=0.8;
  if(c.blueT>0)c.blueT-=dt;
  if(yieldTo&&race&&S.phase==="racing"){if(!(c.blueT>0)&&S.t-(c.blueLog||-99)>25){c.blueLog=S.t;addLog(`BLUE FLAG – CAR ${c.drv.num} (${c.drv.code}) – überrundet, muss Platz machen`,"blue");}c.blueT=1.2;}
  if(yieldTo&&!c.impede){if(c.yieldT<=0)c.yieldSide=T.line[idx]>=0?-1:1;c.yieldT=2.5;if(race&&prof>VTOP*0.7)vT*=0.93;}
  if(prof>VTOP*0.8&&!c.pit)vT*=1+0.00035*S.wx.windKmh*Math.cos(T.ang[idx]-S.wx.wind);   // Rücken- oder Gegenwind
  if(c.towTeam>0)c.towTeam-=dt;
  if(c.slipT>0){c.slipT-=dt;vT*=0.9;}
  if(c.ot&&c.ot.dive&&c.atk&&delta(c,c.ot.o)>-5&&c.ot.t<3)vT*=1.13;
  if(c.atk){const k=c.atk;k.t+=dt;if(k.t>22||k.o.removed||k.o.pit||c.pit||neutral||delta(c,k.o)<-(CAR_L+6)||delta(c,k.o)>160)c.atk=null;else vT*=1.025;}   // kleiner Fehler: kurz vom Gas
  if(prof>VTOP*0.8&&!c.pit&&!neutral){ if(tow)vT*=race?(c.atk?1.06:1.028):c.towTeam>0?1.03:1.012; if(c.ot&&race&&c.ot.o.v>40)vT*=c.atk?1.11:1.075; if(c.omT>0)c.omT-=dt; }
  else if(tow&&ad<45&&Math.abs(T.k[idx])>0.008)vT*=0.975;
  vT*=ersMul(c,idx,prof,dt,neutral,race);
  if(c.wantPit&&!c.pit&&c.pos>=PIT_ENTRY_S&&c.pos<(c.pitGoal==="queue"?PIT_IN_S+40:PIT_ENTRY_S+40)&&!(S.pitClosed&&c.pitGoal==="service"))startPit(c);
  if(c.pit)vT=pitCtl(c,vT,dt);
  if(c.stopAt!=null){const dd=c.stopAt-c.s; vT=Math.min(vT,Math.sqrt(2*BRK*0.7*Math.max(0,dd-0.2)));
    if(dd<0.6&&c.v<5){c.s=c.stopAt;c.v=0;c.pos=mod(c.s);c.latV=0;c.brk=false;arrive(c);return;}}
  const vFree=vT;
  if(ahead){const gap=ad-CAR_L,atk=c.ot||c.script||c.omT>0||vFree>ahead.v*1.05||ahead.v<30;
    const gm=(c.mode==="form"&&G0===0&&!nearStop)?6:(F.mode==="sc"&&G0===0)?7:(G0===1||nearStop||S.phase==="form"||atk||!(S.type==="race"&&S.phase==="racing"))?2.4+(kk>0.04?10:tight?5:0):4+0.15*c.v+(kk>0.04?9:tight?4:0);
    const vl=gap>=gm?ahead.v+(gap-gm)*3.5:ahead.v-(gm-gap)*8;
    const vl2=(tz&&G0===0&&ahead.v>10&&gap>-6)?Math.max(vl,ahead.v*0.65):vl;
    if(vl2<vT){vT=Math.max(0,vl2);c.blockT+=dt;c.blockBy=ahead;}else c.blockT=0;
    if(ahead.v<8&&(c.ot&&c.ot.o===ahead||ahead.crash)&&gap>3&&ahead!==S.sc&&Math.abs(c.lat-ahead.lat)>CAR_W*0.6)vT=Math.max(vT,Math.min(16,vFree));
    else if(ahead.v<8&&ahead.crash&&ahead.crash.done)vT=Math.max(vT,Math.abs(c.lat-ahead.lat)>CAR_W*0.6?10:4);}   // um ein stehendes Auto herumrollen   // um ein stehendes Auto herumrollen
  else c.blockT=0;
  let a=ACC*(S.wx.wet>0.2?1-0.3*S.wx.wet:1); if(race&&S.raceT-S.goT<5)a*=c.launch;
  /* Gas/Bremse wie ein Fahrer: kleine Überschüsse durch Gaswegnehmen, echte Bremsung erst bei deutlichem Überschuss, dann bis zum Scheitel durchziehen */
  if(vT>=c.v){c.v=Math.min(vT,c.v+a*dt*Math.min(1,0.3+(vT-c.v)/2));if(c.brkOn&&(c.brkHold=(c.brkHold||0)+dt)>0.12)c.brkOn=false;}
  else{const over=c.v-vT;c.brkHold=0;
    if(!c.brkOn&&over>Math.max(3.5,c.v*0.035))c.brkOn=true;
    c.v=c.brkOn?Math.max(vT,c.v-BRK*dt):Math.max(vT,c.v-Math.min(COAST,over*4)*dt);}
  c.brk=!!c.brkOn;c.decel=c.v<v0-0.02;   // ERS rekuperiert bei jedem Verzögern, auch beim Gaswegnehmen
  const os=c.s; c.s+=c.v*dt; if(c.mode==="out"&&!c.pit)c.outDist+=c.v*dt;
  c.wear=Math.min(1.2,c.wear+c.v*dt*wearRate(c)); c.pos=mod(c.s);
  if(Math.floor(c.s/L)>Math.floor(os/L))onLine(c);
  // Quer
  if(c.lb==null){let h=0;for(const ch of c.drv.code)h=(h*31+ch.charCodeAt(0))%997;c.lb=(h/997-0.5)*2.4;}
  let tl=T.line[idx]+(S.type==="race"&&!c.pit?c.lb*Math.min(1,Math.abs(T.k[idx])/0.012):0),rate=(race&&S.raceT-S.goT<12)?7:11,free=false;
  if(c.pit){tl=c._tl;rate=24;}
  else if(c.wide&&c.wide.exitStart!=null&&idx<c.wide.exitStart&&idx>c.wide.exitStart-60){}
  else if(c.wide){const w=c.wide;w.t+=dt;const A=w.a||0.5,H=w.h!=null?w.h:0.12,u=clamp(w.t/w.T,0,1),q=u<A?0.5-0.5*Math.cos(Math.PI*u/A):u<A+H?1:0.5+0.5*Math.cos(Math.PI*Math.min(1,(u-A-H)/Math.max(0.05,1-A-H)));
    tl=w.base*(1-q)+w.peak*q;rate=w.big?13+Math.random()*6:17;free=true;w.max=Math.max(w.max,Math.abs(c.lat));
    if(Math.abs(c.lat)>LINE_OUT+0.5&&c.v>25)c.dustT=0.25;
    if(!w.rep&&u>=A+H*0.5){w.rep=true;w.viol=w.max>TL_OFF;if(w.max>TL_OFF-0.9)reportTL(c,w);} if(w.t>=w.T){if(w.cut&&!w.rp2){w.rp2=true;reportTL(c,Object.assign(w,{viol:true,gain:true}));}c.wide=null;}}
  else if(c.sLat!=null){tl=c.sLat;rate=c.sRate||16;free=c.sFree;}
  else{
    if(c.mode==="form")tl=(c.stopAt!=null&&c.stopAt-c.s<70)?c.gridLat:0;
    else if(c.wantPit&&((PIT_ENTRY_S-c.pos+L)%L)<160)tl=-10;
    else if(c.holdT>0)tl=c.lat;
    else if(c.yieldT>0)tl=c.yieldSide*10.5;
    else if(c.defT>0&&c.defLat!=null)tl=c.defLat;
    if(F.mode==="sc"&&S.unlapOn&&!c.wantPit){tl=c.unlap?-7.5:Math.max(T.line[idx],4.5);c.ot=null;}
    else if(!c.script&&!c.busy&&(!noOT||(ahead&&stuck(ahead)&&ahead!==S.sc)))tl=otCtl(c,ahead,ad,vFree,tl,dt); else if(noOT)c.ot=null;
    tl=clamp(tl,-12.3,12.3);
    if(c.yieldT<=0&&!c.ot){if(kk>0.034)tl=-Math.sign(T.k[idx])*3.5;else if(tz)tl=clamp(tl,-4.5,4.5);}
  }
  if(!c.pit&&!free)rate=Math.min(rate,Math.max(1.5,c.v*0.2));
  if((c.yieldT>0||c.ot)&&c.v<12)rate=Math.max(rate,6);   // im Stand neben ein Wrack rangieren
  if(c.ot&&c.ot.o.v<8&&!c.pit)rate=Math.max(rate,8);
  let nl;
  if(free||c.pit)nl=c.lat+clamp(tl-c.lat,-rate*dt,rate*dt);
  else{/* Seitenführung mit Trägheit: Querbewegung baut sich auf und ab, statt von 0 auf volle Rate zu springen */
    const lv=c.latV||0,des=clamp((tl-c.lat)*3.2,-rate,rate),la=LATACC*(c.v<12?2:1);let v2=lv+clamp(des-lv,-la*dt,la*dt);
    nl=c.lat+v2*dt;if((tl-c.lat)*(tl-nl)<0&&Math.abs(tl-c.lat)<0.3)nl=tl;}
  if(!free&&nl!==c.lat){for(const o of S.cars){if(o===c||o.removed||o.mode==="garage"||grp(o)!==G0)continue;
    if(Math.abs(delta(c,o))<CAR_L+(G0===0?7:1.5)){const n=Math.abs(nl-o.lat);if(n<CAR_W+0.7&&n<Math.abs(c.lat-o.lat)){nl=c.lat;break;}}}}
  c.latV=(nl-c.lat)/dt; c.lat=nl;
  c.yaw+=(clamp(c.v>8?Math.atan2(c.latV,c.v):0,-0.2,0.2)-c.yaw)*0.08;
  {const kk=T.k[idx],ak=Math.abs(kk),aL=c.v*c.v*ak/ALAT,j=(idx+4)%NU,exiting=Math.abs(T.k[j])<ak*0.92,wl_=wetAt(c.pos),wetF=(1+wl_*1.6)*(tyreClass(c.tyre)==="dry"?1+wl_*3:1);let tg=0;   // Reibkreis: Längs- und Querkraft teilen sich den Grip
    if(!c.pit&&!c.crash&&c.spinT<=0&&c.v>25&&ak>0.004){
      if(!c.brk&&exiting&&aL>0.55)tg=Math.sign(kk)*Math.min(0.11,(aL-0.5)*0.22*(0.6+aggOf(c)*0.8)*wetF);           // Heck kommt beim Herausbeschleunigen
      else if(c.brk&&aL>0.7){tg=-Math.sign(kk)*Math.min(0.05,(aL-0.65)*0.12*wetF);if(aL>0.95&&!c.script)c.lat-=Math.sign(kk)*Math.min(2.5,(aL-0.95)*14)*dt;}}  // Bremsen in der Kurve: schiebt über die Vorderräder
    c.drift=(c.drift||0)+(tg-(c.drift||0))*Math.min(1,dt*6);}
}
/* Platz zum Überholen: auf den nächsten Metern darf keine Bremszone kommen */
function otRoom(pos,dist){const p0=T.prof[sidx(pos)];if(p0<VTOP*0.55)return false;for(let d=30;d<=dist;d+=30)if(T.prof[sidx(mod(pos+d))]<p0*0.8)return false;return true;}
function otCtl(c,ahead,ad,vFree,tl,dt){
  const kq=Math.abs(T.k[sidx(c.pos)]),nt=nextCorner(c.pos,0,false);
  // Spätbremser: Angreifer sticht in der Bremszone innen hinein
  const dive=!!(c.atk&&ahead&&c.atk.o===ahead&&ad-CAR_L<16&&kq<0.02&&nt&&nt.d<150&&T.prof[sidx(mod(c.pos+55))]<T.prof[sidx(c.pos)]*0.86);
  if(!c.ot&&(c.otCool<=0||c.fight>0||dive)&&ahead&&ahead!==S.sc&&ad-CAR_L<(c.atk&&c.atk.o===ahead?48:26)&&(vFree>ahead.v+(c.fight>0?1.2:2.4)||(c.atk&&c.atk.o===ahead)||ahead.crash||ahead.dmg)&&(ahead.v<25||ahead.crash||(ahead.dmg&&ahead.v<vFree*0.8)||(kq<0.011&&ahead.v>vFree*0.87&&otRoom(c.pos,c.fight>0?110:170))||(c.atk&&c.atk.o===ahead&&kq<0.011&&otRoom(c.pos,110))||dive)){
    const nc=nextCorner(c.pos,0,false),ins=nc&&nc.d<220?nc.c.dir:(T.k[sidx(c.pos)]>=0?1:-1);
    const off=ahead.spinT>0||ahead.crash?11:7.4,own=Math.sign(c.lat-ahead.lat)||ins;for(const side of (ahead.v<25||ahead.crash?[own,-own]:dive?[ins]:[ins,-ins])){let tg=ahead.lat+side*off;if(ahead.v<25||ahead.crash){tg=clamp(tg,-12.3,12.3);if(Math.abs(tg-ahead.lat)<7.2)continue;}else if(Math.abs(tg)>12.3)continue;
      if(laneFree(c,tg,ahead)){c.ot={o:ahead,side,t:0,dive};if(dive)c.lockT=0;
        break;}}
  }
  if(c.ot){const o=c.ot.o,d=delta(c,o);c.ot.t+=dt;
    if(o.removed||grp(o)!==grp(c)){c.ot=null;c.otCool=0.5;}
    else if(d<-(CAR_L+9)){c.ot=null;c.otCool=2;c.fight=0;if(o.mode==="race"&&!o.pit)o.fight=7;onPass(c,o);}
    else if(c.ot.t>11||d>45){c.ot=null;c.otCool=4;}
    else tl=clamp(o.lat+c.ot.side*(o.spinT>0?11:7.4),-12.3,12.3);}
  return tl;}
/* ---- Kontrollverlust nur dort, wo das Auto am Limit ist: beim Einlenken unter Bremse oder nach dem Scheitel beim Gasgeben ---- */
function soloReady(c,co,idx){const k=c.soloArm;if(k.co&&k.co!==co){c.soloArm=null;return false;}if(!k.when)k.when=Math.random()<(k.crash?0.5:0.6)?"exit":"entry";
  const load=Math.abs(T.k[idx]||0)>=co.kmax*0.55;
  if(k.when==="entry"){if(idx>co.ia+2){k.when="exit";return false;}return load&&idx>=co.i0&&(c.brk||c.v>(T.prof[idx]||0)*0.98);}
  return idx>=co.ia&&(load||idx>=co.ia+3)&&(!c.brk||idx>=co.i1-2);}
/* ---- Dreher: Impuls in Weltkoordinaten, Drehung gekoppelt an den Rutschweg (kein Drehen im Stand), danach Wenden um die Vorderachse ---- */
const PIVOT_X=4.4,SPIN_ON=0.45,CRASH_ON=0.5;
function wrapA(a){while(a>Math.PI)a-=2*Math.PI;while(a<-Math.PI)a+=2*Math.PI;return a;}
const angAt=c=>posXY(c.s,c.lat).ang;
function spinStep(c,dt){const so=c.spinOut||19.5,far=so>21,sd=c.spinSide||(c.lat>=0?1:-1);let ang=angAt(c);
  if(!c.sk){const v0=Math.max(c.v,1),dec=far?38:50,Ts=v0/dec,tot=c.spinTot||2*Math.PI,rel0=clamp(Math.atan2(SIDE*(c.latV||0),v0),-0.6,0.6);
    const base=(c.spin||0)+SIDE*((c.yaw||0)+(c.drift||0));c.yaw=0;if(c.drift!=null)c.drift=0;
    c.nudge=null;c.sk={ph:0,mv:ang+rel0,rel0,d:0,D:Math.max(5,v0*v0/(2*dec)),rot:(c.spinDir||1)*Math.min(tot,1+3*Ts),a:0,w:0,base,pa:ang,t:0};}
  const k=c.sk;k.t+=dt;c.spinT=Math.max(c.spinT-dt,0.05);c.wob=null;
  const comp=()=>{const an=angAt(c),d=wrapA(an-k.pa);k.pa=an;return d;};
  if(k.ph===0){const on=SPIN_ON>0?clamp(k.t/SPIN_ON,0,1):1,r=on*on*(3-2*on);
    const dec=(far&&Math.abs(c.lat)<so-1?38:Math.abs(c.lat)>=so-0.6?70:50)*(0.2+0.8*r);c.v=Math.max(0,c.v-dec*dt);if(Math.abs(c.lat)>LINE_OUT+2&&c.spinKind==="beach")c.v=Math.max(0,c.v-30*dt);
    const step=c.v*dt;k.d+=step;
    const relS=clamp(wrapA(k.mv-ang),-1,1);k.mv=ang+relS;const rel=k.rel0*(1-r)+relS*r;
    let dl=SIDE*step*Math.sin(rel)*(1-0.2*r);
    const rem=so-c.lat*sd-dl*sd;if(rem>0&&step>0){const R=Math.max(0.5,c.v*c.v/(2*dec));dl+=sd*r*Math.min(rem,far?clamp(rem/R,0,0.75)*step:Math.min(0.22*step,10*dt));}
    c.s+=step*Math.cos(rel);c.lat=clamp(c.lat+dl,-so-0.5,so+0.5);c.pos=mod(c.s);
    k.base-=comp()*r;const x=clamp(k.d/k.D,0,1),tg=k.rot*x*x*(3-2*x);{const wd=clamp((tg-k.a)*6,-7,7)*Math.min(1,c.v/12+0.15),al=16*(0.3+0.7*r)*(c.v<12?3:1)*dt;k.w+=clamp(wd-k.w,-al,al);k.a+=k.w*dt;}c.spin=k.base+k.a;
    if(c.v>15)c.lockT=0.2;if(Math.abs(c.lat)>LINE_OUT&&c.v>15)c.dustT=0.25;
    if(c.spinKind==="tap"&&Math.abs(c.lat)>=26.4&&!c.spinHit){c.spinHit=true;if(c.v>8){c.sparks=0.6;c.dmg=1;c.dmgT=S.t;c.ignoreDmg=false;wallDamage(c,clamp(c.v/120,0.15,0.45),Math.sign(c.lat)||1);c.v*=0.35;addLog(`CAR ${c.drv.num} (${c.drv.code}) – Berührung mit der Barriere, fährt beschädigt weiter`);}}
    if(c.v<0.5||k.t>9){c.v=0;
      if(c.spinKind==="beach"&&Math.abs(c.lat)>21){c.spinKind=null;c.spinT=0;c.sk=null;spinBeached(c);return;}
      k.ph=1;k.sp=c.spin;}}
  else{k.sp-=comp();c.spin=k.sp;const err=wrapA(-c.spin);
    if(k.px==null){const hb=angAt(c)+c.spin,he=hb+err,q=posXY(c.s,c.lat),out=X=>{const dx=X*(Math.cos(hb)-Math.cos(he)),dy=X*(Math.sin(hb)-Math.sin(he));return (-dx*Math.sin(q.ang)+dy*Math.cos(q.ang))*SIDE*sd;};
      k.px=out(PIVOT_X)>=out(-PIVOT_X)?PIVOT_X:-PIVOT_X;}
    if(Math.abs(err)<0.02){c.spin=0;c.spinT=0;c.sk=null;c.wob=null;c.rejoin=7;}
    else{const hb=angAt(c)+c.spin,dth=Math.sign(err)*Math.min(Math.abs(err),(0.6+1.4*Math.min(1,k.t))*dt),hb2=hb+dth;
      pushCar(c,k.px*(Math.cos(hb)-Math.cos(hb2)),k.px*(Math.sin(hb)-Math.sin(hb2)));c.lat=clamp(c.lat,-29,29);k.sp+=dth-comp();c.spin=k.sp;
      c.lockT=0.15;if(Math.abs(c.lat)>LINE_OUT)c.dustT=0.2;}}
  c.latV=0;c.yaw*=0.9;c.brk=true;}
function crashStep(c,dt){const k=c.crash,idx=sidx(c.pos);
  if(k.pa==null&&!k.done&&!k.nuke){k.rel0=clamp(Math.atan2(SIDE*(c.latV||0),Math.max(1,c.v)),-0.6,0.6);c.spin=(c.spin||0)+SIDE*((c.yaw||0)+(c.drift||0));c.yaw=0;if(c.drift!=null)c.drift=0;k.t=0;}
  k.t=(k.t||0)+dt;const on=k.rel0==null||CRASH_ON<=0?1:clamp(k.t/CRASH_ON,0,1),r=on*on*(3-2*on);
  let th=T.ang[idx]-k.h0;while(th>Math.PI)th-=2*Math.PI;while(th<-Math.PI)th+=2*Math.PI;th=clamp(th,-1.2,1.2);if(r<1)th=th*r-(k.rel0||0)*(1-r);
  const atRest=(k.rest-c.lat)*k.dir<=0.3,off=Math.abs(c.lat)>LINE_OUT,imp=(Math.abs(k.rest)>25||k.wall)&&!k.hit;
  {let dec=(k.mech?42:atRest?260:off?k.grav:70)*(atRest?1:0.25+0.75*r);const rem0=(k.rest-c.lat)*k.dir;
    if(!atRest&&rem0>0.3&&!k.nuke){const ve=imp?Math.min(c.v*0.8,Math.max(20,k.v0*0.4)):0;dec=clamp((c.v*c.v-ve*ve)/(2*rem0/0.85),12,dec);c.v=Math.max(Math.min(c.v,8),c.v-dec*dt);}
    else c.v=Math.max(0,c.v-dec*dt);}
  c.s+=c.v*Math.cos(th)*dt;c.pos=mod(c.s);
  if(k.pa==null){k.pa=angAt(c);k.rotAcc=0;if(!k.mech&&!k.nuke&&!k.done&&Math.abs(k.rest)<15.5){k.rest=(Math.sign(k.rest)||k.dir||1)*16;k.dir=Math.sign(k.rest-c.lat)||k.dir;}}
  const ds0=c.v*Math.cos(th)*dt;let dl=0;
  if(!atRest){dl=-SIDE*c.v*Math.sin(th)*dt;
    const rem=(k.rest-c.lat)*k.dir-dl*k.dir,dec=k.mech?42:off?k.grav:70,vend=imp?Math.min(c.v*0.8,Math.max(20,k.v0*0.4)):0;
    if(rem>0&&c.v>0.5){const R=Math.max(0.5,(c.v*c.v-vend*vend)/(2*dec));dl+=k.dir*r*Math.min(rem,clamp(rem/R,0.1,0.9)*c.v*dt);}
    else if(rem>0&&Math.abs(c.lat)>LINE_OUT){k.rest=c.lat;}
    else if(rem>0)dl+=k.dir*3*dt;
    c.lat+=dl;
    if((k.rest-c.lat)*k.dir<=0){c.lat=k.rest;if((Math.abs(k.rest)>25||k.wall)&&c.v>18&&!k.hit){k.hit=true;c.sparks=0.7;const vi=c.v;c.v*=rand(0.05,0.35);k.sv0=(Math.random()<0.5?-1:1)*rand(0.5,4)*Math.min(1.6,vi/90);   // Einschlag: Tempo bricht ein, Rückprall mit eigener Drehung
      if(vi>100&&Math.random()<0.5)c.dmg=1;wallDamage(c,clamp(vi/140,0.2,1),k.dir);}}}
  {const an=angAt(c);c.spin-=wrapA(an-k.pa)*r;k.pa=an;}
  {const w=k.sv0*r*Math.min(1,c.v/Math.max(1,k.v0)+0.08)*(c.v>0.5||c.blast?1:0)*dt;c.spin+=w;k.rotAcc+=w;}
  if(!k.hit&&!k.done&&Math.abs(k.sv0)<2.5&&c.v>3){const m=Math.atan2(SIDE*dl,Math.max(0.001,ds0)),tg=m*0.85+k.rotAcc;c.spin+=wrapA(tg-c.spin)*Math.min(1,2.2*dt)*(1-Math.abs(k.sv0)/2.5);}
  c.yaw*=0.9;c.brk=true;c.latV=0;if(c.v>20){if(off)c.dustT=0.25;else c.lockT=0.2;}
  if(c.v<1){c.v=0;k.done=true;k.sv0=0;}
  if(k.done&&!k.hit&&!k.mech&&!k.soft){k.soft=true;if(Math.random()<0.6)breakPart(c,"floor");if(Math.random()<0.5)breakPart(c,"fw"+(Math.random()<0.5?"L":"R"));}
  if(k.done&&Math.abs(c.lat)<15.5&&!k.mech&&!S.cars.some(o=>o!==c&&!o.removed&&Math.abs(delta(o,c))<CAR_L+2&&Math.abs(o.lat-c.lat)<CAR_W+1.5)){c.lat+=Math.sign(c.lat||k.dir)*2.5*dt;}   // Wrack rollt noch an den Rand, Fahrbahn bleibt frei
}

/* ---- Boxengasse ---- */
function startPit(c){
  c.pit={ph:"in",goal:c.pitGoal||"garage",timer:0,trap:false,waitU:0};c.inPit=true;c.wantPit=false;c.ot=null;c.yieldT=0;
  const g=c.pit.goal;
  if(g==="garage")c.stopAt=absAhead(c,mod(boxPos(c.drv.ti)+(c.drv.slot?8:-8)));
  else if(g==="service"){const mate=mateBusy(c);c.pit.stack=!!mate;
    c.stopAt=absAhead(c,mod(boxPos(c.drv.ti)-(mate?17:0)));}
  else if(g==="queue")c.stopAt=absAhead(c,PIT_OUT_S-6);
  else c.stopAt=null;
  if(c.speedArm){c.speeding=c.speedArm;c.speedArm=0;}
}
function mateBusy(c){return S.cars.find(o=>o!==c&&o.drv.ti===c.drv.ti&&o.pit&&o.pit.goal==="service"&&(o.pit.ph==="in"||o.pit.ph==="svc")&&!o.pit.stack)||null;}
function fastLaneCar(c,lo,hi){for(const o of S.cars){if(o===c||o.removed||!o.pit||o.lat<-35||o.lat>-22||o.v<3)continue;
  const d=delta(c,o);if(d>lo&&d<hi)return o;}return null;}
function pitCtl(c,vT,dt){const p=c.pit;let tl=PLAT;
  const inZone=c.pos>=PIT_IN_S||c.pos<=PIT_OUT_S, lim=PITV*(c.speeding||1);
  if(inZone)vT=Math.min(vT,lim);
  else if(c.pos<PIT_IN_S&&c.pos>PIT_ENTRY_S-60)vT=Math.min(vT,Math.sqrt(lim*lim+2*BRK*0.8*(PIT_IN_S-c.pos)));
  if(p.ph==="in"){
    if(!p.trap&&inZone){p.trap=true;if(c.speeding>1)reportSpeed(c,lim*KMH);}
    if(c.stopAt!=null&&c.stopAt-c.s<18)tl=p.goal==="garage"?GARLAT:p.goal==="service"?BOXLAT:PLAT;
    if(p.goal==="through"&&c.pos>20&&c.pos<L/2)p.ph="exit";
  }else if(p.ph==="hold"){vT=0;tl=BOXLAT;      // Double Stack: wartet hinter der Box, bis der Teamkollege weg ist
    if(!mateBusy(c)){p.ph="in";p.stack=false;c.stopAt=absAhead(c,boxPos(c.drv.ti));}
  }else if(p.ph==="svc"){vT=0;tl=BOXLAT;p.timer-=dt;
    if(p.timer<=0){let go=false;
      if(c.unsafeArm){p.waitU+=dt;const u=fastLaneCar(c,-25,-9);
        if(u){go=true;c.unsafeArm=false;reportUnsafe(c,u,true);}else if(p.waitU>3)c.unsafeArm=false;}
      else if(!fastLaneCar(c,-36,14)){go=true;const u=fastLaneCar(c,-54,-36);if(u&&S.type==="race"&&Math.random()<0.12)reportUnsafe(c,u,false);}
      if(go){p.ph="exit";c.stops++;c.tyreLaps=0;c.relT=1.6;c.stopAt=S.flag.mode==="red"&&S.type==="race"?absAhead(c,PIT_OUT_S-6):null;}}
  }else if(p.ph==="exit"){
    if(c.lat<-35)vT=Math.min(vT,14);
    if(S.type!=="race"&&!p.gate&&c.stopAt==null&&c.pos>PIT_OUT_S-40&&c.pos<=PIT_OUT_S){ // Ampel am Boxenausgang: Abstand halten
      if(p.wait==null)p.wait=rand(2,3);
      if(!S.pitExitOpen||S.t-S.exitT<p.wait||S.cars.some(o=>o!==c&&o.pit&&o.pit.ph==="exit"&&!o.pit.gate&&delta(c,o)>0&&delta(c,o)<90))vT=Math.min(vT,Math.sqrt(2*BRK*0.7*Math.max(0,PIT_OUT_S-6-c.pos)));else{p.gate=true;S.exitT=S.t;}}
    if(c.pos>PIT_OUT_S&&c.pos<L/2){   // Ausfahrtsspur: bis zum Ende der weißen Linie links davon bleiben, erst dann auf die Strecke
      if(p.xk==null){const r=Math.random()/memW("pitline",-1);p.xk=r<0.02?2:r<0.055?1:0;if(p.xk)memAdd("pitline",-1);p.xmax=-99;}
      const u=clamp((c.pos-PIT_OUT_S)/(PIT_EXIT_S-PIT_OUT_S),0,1),end=p.xk===1?-23.4+rand(-0.25,0.35):-24.6;
      tl=c.pos>=PIT_EXIT_S||(p.xk===2&&u>0.5)?-10.5:-34+(end+34)*u;
      if(c.pos<PIT_EXIT_S)p.xmax=Math.max(p.xmax,c.lat+CAR_W/2);
      else if(p.xk&&!p.xrep){p.xrep=true;reportPitLine(c,p.xmax>PITLINE);}
      if((c.pos>=PIT_EXIT_S&&c.lat>-15)||c.pos>PIT_EXIT_S+110){c.pit=null;c.inPit=false;c.speeding=0;c.holdT=0.5;c.cold=14;}}
  }
  c._tl=tl;return vT;}
function arrive(c){const p=c.pit;
  if(c.mode==="form"){if(p||(S.rsChain&&!c.rsGo))return;
    if(S.rsChain&&c.slotK>0){const pr=S.cars.find(o=>o.slotK===c.slotK-1&&(o.mode==="form"||o.mode==="grid")&&!o.retired&&!o.removed);if(pr&&!pr.onGrid&&delta(c,pr)<0){c.stopAt+=L;return;}}c.mode="grid";c.stopAt=null;c.onGrid=true;return;}   // in der Boxengasse wartend ist man nicht auf dem Startplatz
  if(!p)return;
  if(p.goal==="garage"){c.mode="garage";c.pit=null;c.lat=GARLAT;c.stopAt=null;c.speeding=0;onGarage(c);}
  else if(p.goal==="service"&&p.ph==="in"&&p.stack){p.ph="hold";c.stopAt=null;c.lat=BOXLAT;addLog(`${c.drv.code} wartet hinter dem Teamkollegen (Double Stack)`);}
  else if(p.goal==="service"&&p.ph==="in"){p.ph="svc";c.stopAt=null;p.T0=S.t;p.wait=0;p.work=0;p.rep=0;
    if(c.sgServe){c.sgServe=false;c.sgPending=false;p.timer=10;p.wait=10;addLog(`${c.drv.code} tritt 10s Stop-and-Go an`);return;}
    {const ps=pitStopVar(c);p.work=ps.work;if(ps.note==="LOSE"){c.looseWheel={t:rand(4,14)};}else if(ps.note){addLog(`${c.drv.code}: langsamer Stopp – ${ps.note} (${ps.work.toFixed(1)} s)`);if(Math.random()<0.6)radio(c,pick(["Was war da los?! Das hat ewig gedauert.","Langsamer Stopp, verdammt.","Komm schon, komm schon!"]));}}
    p.rep=c.dmg?lognorm(7,0.25)+((c.dp||0)&0xF00?lognorm(35,0.3):0)+((c.dp||0)&0xF0?lognorm(4,0.3):0)+((c.dp||0)&8?lognorm(9,0.3):0):0;p.timer=p.work+p.rep;c.punct=false;
    if(c.penSec>0){const pen=c.penSec;let ext=pen+rand(0.05,0.5);      // Crew darf das Auto erst nach Ablauf der Strafe berühren
      if(S.type==="race"){const r=Math.random();if(r<0.12)ext=pen-rand(0.5,0.9);else if(r<0.4)ext=pen-rand(0.1,0.4);if(Math.random()<0.75)reportServe(c,pen,ext);}   // Fehler sind immer knapp: Zehntel, nicht Sekunden
      p.wait=ext;p.timer+=ext;addLog(`${c.drv.code} sitzt ${pen}s Zeitstrafe an der Box ab`);c.penSec=0;}
    const nt=c.nextTyre||"H";c.tyre=nt;c.wear=0;c.used.add(nt);c.dmg=0;dmgClear(c);if(c.plan.length)c.plan.shift();
    if(nt==="I"||nt==="W")S.wetRace=true;
    addLog(`${c.drv.code} an der Box – ${({S:"Soft",M:"Medium",H:"Hard",I:"Intermediates",W:"Regenreifen"})[nt]}`);
    if(S.type==="race"&&Math.random()<0.06*memW("unsafe",-1)){c.unsafeArm=true;memAdd("unsafe",-1);}
  }
}
function releaseFromGarage(c){c.mode="out";c.pit={ph:"exit",goal:"out",timer:0,trap:true,waitU:0};c.outDist=0;c.runs++;
  c.stopAt=S.pitExitOpen?null:absAhead(c,PIT_OUT_S-6);}

/* ---- Überlappungen verhindern ---- */
function pairFree(a,b){return a.hitT===b||b.hitT===a||(a.sFree&&(a.busy===b||(a.script&&a.script.B===b)))||(b.sFree&&(b.busy===a||(b.script&&b.script.B===a)))||a.wide||b.wide;}
/* Minimaler Trennvektor zweier Autos (exakte Kollisionsbox 14,9 × 5,1, inkl. Drehung) */
const BOX_HX=7.45,BOX_HY=2.55;
function obbMTV(A,B){const a=carBox(A),b=carBox(B),dx=b.x-a.x,dy=b.y-a.y;if(dx*dx+dy*dy>300)return null;let best=1e9,bx=0,by=0;
  for(const [ux,uy] of [[a.c,a.s],[-a.s,a.c],[b.c,b.s],[-b.s,b.c]]){
    const ra=BOX_HX*Math.abs(ux*a.c+uy*a.s)+BOX_HY*Math.abs(-ux*a.s+uy*a.c),rb=BOX_HX*Math.abs(ux*b.c+uy*b.s)+BOX_HY*Math.abs(-ux*b.s+uy*b.c);
    const p=dx*ux+dy*uy,o=ra+rb-Math.abs(p);if(o<=0)return null;if(o<best){best=o;const sg=p>=0?1:-1;bx=ux*sg;by=uy*sg;}}
  return best<50?{x:bx,y:by,d:best}:null;}        // B muss um d in Richtung (x,y) von A weg
function pushCar(c,wx,wy){const q=posXY(c.s,c.lat),ca=Math.cos(q.ang),sa=Math.sin(q.ang);const ds=wx*ca+wy*sa,dl=(-wx*sa+wy*ca)*SIDE;c.s+=ds;c.pos=mod(c.s);c.lat+=dl;return ds;}
function deoverlap(){const cs=S.cars,heavy=c=>c.crash||c.v<1||c.mode==="grid"?0.15:1;
  for(const c of cs){if(!isFinite(c.spin))c.spin=0;if(!isFinite(c.yaw))c.yaw=0;if(c.drift!=null&&!isFinite(c.drift))c.drift=0;}
  for(let pass=0;pass<10;pass++){let any=false;
  for(let x=0;x<cs.length;x++){const A=cs[x];if(A.removed||A.mode==="garage")continue;
    for(let y=x+1;y<cs.length;y++){const B=cs[y];if(B.removed||B.mode==="garage"||grp(A)!==grp(B))continue;
      const m=obbMTV(A,B);if(!m)continue;any=true;if(pass===0){S.ovl++;if(!pairFree(A,B))contactHit(A,B,m);}
      const wa=heavy(A),wb=heavy(B),sum=wa+wb,d=m.d+0.02;
      pushCar(A,-m.x*d*wa/sum,-m.y*d*wa/sum);pushCar(B,m.x*d*wb/sum,m.y*d*wb/sum);
      const dd=delta(A,B);if(Math.abs(dd)>CAR_L*0.5&&Math.abs(dd)<CAR_L+6){const rear=dd>0?A:B,front=dd>0?B:A;if(!rear.crash)rear.v=Math.min(rear.v,front.v);}}}
  if(!any)break;}}
