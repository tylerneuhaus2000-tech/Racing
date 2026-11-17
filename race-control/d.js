"use strict";
/* ============ Sessions, Flaggen, Gefahren, Strategie, Strafen ============ */
const TYN={S:"Soft",M:"Medium",H:"Hard",I:"Intermediates",W:"Regenreifen"};
function mkWeekend(opts,career){if(typeof hideTitle==="function")hideTitle();
  const real=opts.mode==="real";
  let defs=real?[{type:"fp",name:"FP",dur:3600/TSCALE},{type:"q",n:1,name:"Q1",dur:1080/TSCALE,cut:16},{type:"q",n:2,name:"Q2",dur:900/TSCALE,cut:10},
          {type:"q",n:3,name:"Q3",dur:720/TSCALE,cut:99},{type:"race",name:"Rennen"}]
      :[{type:"fp",name:"FP",dur:7*LAPT},{type:"q",n:1,name:"Q1",dur:7.5*LAPT,cut:16},{type:"q",n:2,name:"Q2",dur:6.5*LAPT,cut:10},
          {type:"q",n:3,name:"Q3",dur:6*LAPT,cut:99},{type:"race",name:"Rennen"}];
  if(opts.format==="quali")defs=defs.filter(x=>x.type!=="fp");else if(opts.format==="race")defs=defs.filter(x=>x.type==="race");
  else if(opts.format==="sprint"){const q=real?[720,600,480].map(x=>x/TSCALE):[5.5*LAPT,5*LAPT,4.5*LAPT];
    defs=[defs[0],{type:"q",n:1,name:"SQ1",dur:q[0],cut:16,sprint:true},{type:"q",n:2,name:"SQ2",dur:q[1],cut:10,sprint:true},{type:"q",n:3,name:"SQ3",dur:q[2],cut:99,sprint:true},
      {type:"race",name:"Sprint",sprint:true},defs[1],defs[2],defs[3],defs[4]];}
  W={sgrid:[],opts,idx:-1,score:career?career.score:0,dec:career?{ok:career.dec.ok,total:career.dec.total}:{ok:0,total:0},incId:0,drop:{},gridTail:[],grid:[],q:DRIVERS.slice(),results:null,
    real,cs:real?TSCALE:1,defs,career:career||null,puDrop:career&&career.gridPen?Object.assign({},career.gridPen):{},snap:null,banned:opts.banned||[],review:[]};
  if(opts.format==="race")W.grid=DRIVERS.map(x=>({x,k:x.perf+rand(0,0.6)})).sort((a,b)=>a.k-b.k).map(o=>o.x);}
function newWeekend(opts,career){mkWeekend(opts,career);nextSession();}
const PTS_TAB=[25,18,15,12,10,8,6,4,2,1];
function awardPoints(){const k=W.career;if(!k)return;k.score=W.score;k.dec={ok:W.dec.ok,total:W.dec.total};
  const cl=W.results;const frac=!S.aborted?1:(S.leader?S.leader.s/L:0)/S.laps,fac=frac>=0.75||!S.aborted?1:frac>=0.25?0.5:(S.leader&&S.leader.s/L>=2?0.25:0);W.ptsFac=fac;
  k.tpoints=k.tpoints||{};cl.filter(c=>c.finished&&!c.dsq).slice(0,10).forEach((c,i)=>{k.points[c.drv.code]=(k.points[c.drv.code]||0)+PTS_TAB[i]*fac;k.tpoints[c.drv.team]=(k.tpoints[c.drv.team]||0)+PTS_TAB[i]*fac;});
  mgmtRaceDone(cl,k);collectReviews(k);k.history.push({track:TRACK.key,top:cl.slice(0,3).map(c=>c.drv.code)});k.round++;}
function nextSession(){W.idx++;startSession(W.defs[W.idx]);}
function startSession(d){
  REC=[];recBase=0;
  const ban=W.banned||[],ent=(d.type==="race"?(d.sprint?W.sgrid:W.grid):(d.type==="q"?W.q:DRIVERS)).filter(x=>!ban.includes(x.code));
  S={type:d.type,n:d.n||0,name:d.name,dur:d.dur||0,clock:d.dur||0,cut:d.cut||99,started:false,chequered:false,ended:false,t:0,step:0,
    flag:{mode:"green"},sec:[0,0,0],cars:ent.map(mkCar),hazard:null,hazCount:0,crashes:0,sc:null,restart:false,
    phase:d.type==="race"?"pre":"timed",lights:0,lightT:0,holdEnd:0,raceT:0,om:true,pitExitOpen:false,wx:mkWeather(W.opts.wx,Math.max(1,(d.type==="race"?W.opts.laps*LAPT:d.dur)/260)),
    incidents:[],nextInc:rand(20,35),leader:null,evo:0,ovl:0,sprint:!!d.sprint,laps:d.sprint?Math.max(4,Math.round(W.opts.laps/3)):W.opts.laps,wetRace:false,jump:null,finCount:0,cheqT:0,
    bestT:null,relCool:0,rainWarn:0,goT:0,exitT:-9,unlapOn:false,pitClosed:false,stall:null,pitStart:null,restartGrid:false,aborted:false,vscV:null};
  S.pud=mkPuddles();S.aquaLog=[];
  const wet0=S.wx.wet;
  S.cars.forEach((c,k)=>{
    if(d.type==="race"){const g=gridSlot(k);c.s=g.s;c.lat=g.lat;c.gridLat=g.lat;c.slotK=k;c.pos=mod(c.s);c.mode="grid";c.inPit=false;c.onGrid=true;
      c.tyre=k<10?(Math.random()<0.6?"M":"S"):(Math.random()<0.4?"H":"M");c.used.add(c.tyre);
      const f=c.tyre==="S"?0.3:c.tyre==="M"?0.48:0.62;
      c.plan=[{lap:clamp(Math.round(S.laps*f+rand(-1,1)),2,S.laps-2),comp:c.tyre==="H"?"M":"H"}];
      if(S.sprint)c.plan=[];
      else if(TRACK.key==="monaco"&&S.laps>=6)c.plan=[{lap:clamp(Math.round(S.laps*0.3+rand(-1,1)),2,S.laps-4),comp:c.tyre==="H"?"M":"H"},{lap:clamp(Math.round(S.laps*0.65+rand(-1,1)),4,S.laps-2),comp:"M"}];
    }else{placeGarage(c);c.tyre="S";c.nextOut=S.wx.eta<90?rand(0,12):rand(0,Math.min(70,S.dur*0.22));
      if(d.type==="q"&&(W.qOut||[]).includes(c.drv.code)){c.retired=true;c.noStart=true;c.nextOut=Infinity;}}
  });
  S.leader=S.cars[0];
  if(typeof snapshotSave==="function")snapshotSave();
  recFrame();
  addLog(d.type==="race"?`GRAND PRIX – ${S.laps} RUNDEN – Autos stehen in der Startaufstellung`:`${d.name} – Boxenausfahrt geschlossen, warte auf Freigabe`,"flag");
  {const ns=S.cars.filter(c=>c.noStart).map(c=>c.drv.code);if(ns.length)addLog(`Nimmt nach Ausfall im vorherigen Quali-Teil nicht teil (Auto nicht zurück an der Box): ${ns.join(", ")}`,"bad");}
  if(S.type==="race"){const rv=Object.entries(W.career&&W.career.riv||{}).filter(x=>x[1]>=1).sort((x,y)=>y[1]-x[1]).slice(0,3);if(rv.length)addLog("Rivalitäten aus früheren Rennen: "+rv.map(x=>x[0].replace("-"," / ")+" ("+x[1]+"×)").join(", "));}
  if(ban.length&&W.idx===0)addLog(`Gesperrt für dieses Rennen (12 Strafpunkte): ${ban.join(", ")}`,"bad");
  uiSession();uiInbox();}

/* ---- Hauptschritt ---- */
function simStep(dt){
  S.t+=dt;wxStep(S.wx,dt);
  if(S.type==="race")raceStep(dt);else timedStep(dt);
  director(dt);moodStep(dt);debrisStep(dt);
  for(const c of S.cars){if(c.script)scriptStep(c,dt);if(c.impede||c.fakeImp)impedeStep(c,dt);}
  for(const c of S.cars)carStep(c,dt);
  if(S.type!=="race")for(const c of S.cars)secTick(c);
  scStep(dt);hazardStep(dt);nukeStep(dt);deoverlap();
  redStep();
  if(S.type==="race"){let ld=null;if(S.flag.mode==="red"&&S.redOrder)ld=S.redOrder.find(c=>!c.removed&&!c.retired&&!c.finished);
    if(!ld)for(const c of S.cars)if(!c.removed&&!c.retired&&!c.finished&&c.mode!=="garage"&&(!ld||c.s>ld.s))ld=c;if(ld)S.leader=ld;}
  radioAmbient(dt);protestStep();hiddenStep();recFrame();finalizeIncs(false);}

function radioAmbient(dt){S.radT=(S.radT||0)+dt;if(S.radT<1)return;S.radT=0;radioQueue();radioChatter();
  const run=S.cars.filter(c=>!c.removed&&!c.crash&&!c.pit&&(c.mode==="race"||c.mode==="push"||c.mode==="out"));if(!run.length)return;
  const w=S.wx.wet,any=()=>pick(run),h=S.hazard;
  if(S.wx.rain>0.05&&!S.rRain){S.rRain=true;radio(any(),`Erste Tropfen in Kurve ${irand(1,CORNERS.length)}. Es fängt an zu regnen.`,false,true);}
  if(S.wx.rain<0.02&&w<0.05)S.rRain=false;
  if(w>0.3){const sl=run.filter(c=>tyreClass(c.tyre)==="dry");if(sl.length&&Math.random()<0.25)radio(pick(sl),pick(["Viel zu nass für Slicks! Ich rutsche nur noch.","Kein Grip, gar keiner. Wir brauchen Inters.","Das ist wie auf Eis hier draußen."]));}
  if(w>0.4)S.rWet=true;
  if(S.rWet&&w<0.18&&S.wx.rain<0.03){S.rWet=false;radio(any(),"Trockene Linie bildet sich. Slicks gehen bald.",false,true);}
  if(h&&!h.handled&&h.t>5&&(h.rad=(h.rad||0))<4&&Math.random()<0.22&&++h.rad)radio(any(),h.rain?pick(["Aquaplaning überall, das ist nicht fahrbar!","Ich sehe nichts in der Gischt. Rennleitung muss reagieren."]):sayHazard(h));
  if(h&&h.cleared&&h.clT>10&&Math.random()<0.3)radio(any(),sayCleared());
  if(S.type==="race"&&S.phase==="racing"&&S.flag.mode==="green"&&!S.chequered){
    if(!S.om&&w<0.2&&S.raceT>40&&Math.random()<0.08)radio(any(),"Warum haben wir keinen Overtake Mode? So komme ich nie vorbei.");
    const worn=run.filter(c=>c.wear>0.85&&!c.wantPit);if(worn.length&&Math.random()<0.15)radio(pick(worn),pick(["Die Reifen sind komplett am Ende.","Kein Grip mehr hinten. Wie lange noch?"]));
    const bl=run.filter(c=>c.yieldT>0);if(bl.length&&Math.random()<0.2)radio(pick(bl),"Blaue Flaggen, blaue Flaggen. Lass ihn vorbei.",true);
    const om=run.filter(c=>c.omOn);if(om.length&&Math.random()<0.06)radio(pick(om),pick(["Overtake verfügbar. Greif an.","Du bist in der Sekunde. Overtake, Overtake."]),true);
  }
  if(S.type!=="race"){const b=run.filter(c=>c.mode==="push"&&c.blockT>0.7);if(b.length&&Math.random()<0.5)radio(pick(b),pick(["Verkehr! Verkehr!","Der steht mir mitten im Weg!"]));
    const o=run.filter(c=>c.mode==="out");if(o.length&&Math.random()<0.05)radio(pick(o),pick(["Bereite die Reifen vor. Freie Strecke hinter dir.","Push-Runde jetzt. Alles was geht."]),true);}
}
function radioChatter(){
  if(Math.random()>0.2)return;
  const live=S.cars.filter(c=>!c.removed&&!c.crash&&!c.pit&&c.mode!=="garage"&&c.mode!=="grid"&&!c.finished);if(!live.length)return;
  const c=pick(live),P=a=>pick(a),co=cnm(pick(CORNERS)),sec=irand(1,3),ft=x=>x.toFixed(1).replace(".",",");
  if(S.type==="race"&&S.phase==="racing"){
    const ord=S.cars.filter(x=>!x.removed&&!x.retired&&!x.finished).sort((a,b)=>b.s-a.s),i=ord.indexOf(c),pos=i+1,up=ord[i-1],dn=ord[i+1],spd=L/LAPT;
    const gu=up?(up.s-c.s)/spd:0,gd=dn?(c.s-dn.s)/spd:0,lapsLeft=S.laps-Math.floor(c.s/L)-1,m=S.flag.mode,age=Math.round(c.wear*(S.laps*0.6));
    if(m==="sc"||m==="vsc"){radio(c,P(["Reifen warm halten, Bremsen warm halten.","Delta positiv. Abstand zum Vordermann nicht zu groß werden lassen.",`Wir bleiben draußen. ${lapsLeft} Runden noch nach dem Restart.`,"Achte beim Restart auf den Führenden, kein Überholen vor der Linie."]),true);
      if(Math.random()<0.4)radio(c,P(["Wie lange bleibt das Safety Car noch draußen?","Die Reifen sind eiskalt. Das wird ein heikler Restart.","Was ist da vorne passiert?"]));return;}
    const r=Math.random();
    if(r<0.14&&up&&dn)radio(c,`P${pos}. ${up.drv.code} ${ft(gu)} Sekunden vor dir, ${dn.drv.code} ${ft(gd)} dahinter.`,true);
    else if(r<0.24)radio(c,c.wear<0.3?P(["Die Reifen fühlen sich gut an. Ich kann noch pushen.","Balance ist okay, Grip ist da."]):c.wear<0.7?P(["Die Hinterreifen bauen langsam ab.","Ich bekomme Graining vorne links.","Traktion aus den langsamen Kurven wird schlechter."]):P(["Vorne links ist am Ende. Ich rutsche nur noch.","Diese Reifen sind durch. Wann kommen wir rein?","Ich habe hinten keinen Grip mehr."]));
    else if(r<0.32)radio(c,P([`Untersteuern in ${co}. Könnt ihr mir beim Frontflügel helfen?`,"Das Heck ist nervös am Kurveneingang.",`Das Auto springt über den Kerb in ${co}.`,"Bremsbalance einen Klick nach hinten.","Das Auto fühlt sich gut an. Weiter so.","Ich habe Vibrationen von vorne rechts."]));
    else if(r<0.42&&c.blockT>1.2&&c.blockBy&&c.blockBy.drv)radio(c,P([`Ich hänge hinter ${c.blockBy.drv.code} fest. In der verwirbelten Luft geht nichts.`,`${c.blockBy.drv.code} ist auf den Geraden zu schnell. Ich komme nicht ran.`,`Ich bin viel schneller als ${c.blockBy.drv.code}. Können wir etwas über die Strategie machen?`]));
    else if(r<0.52){const pl=c.plan[0],lapNo=Math.floor(c.s/L)+1;
      radio(c,pl&&pl.lap-lapNo>0&&pl.lap-lapNo<=3?P([`Boxenfenster öffnet in ${pl.lap-lapNo} Runde${pl.lap-lapNo>1?"n":""}. Plan A.`,`Noch ${pl.lap-lapNo} Runde${pl.lap-lapNo>1?"n":""} bis zum Stopp. Reifen schonen.`,`Wir verlängern den Stint, wenn die Zeiten halten. Ziel: Runde ${pl.lap}.`])
        :c.stops>0?P([`Wir fahren durch bis zum Ende. ${lapsLeft} Runden noch.`,`Reifen sind ${age} Runden alt. Das reicht bis ins Ziel.`,"Plan A läuft. Kopf runter."])
        :P(["Wir sind auf Plan A.","Wir schauen uns Plan B an. Sag uns, wie die Reifen sind.",`Ziel-Rundenzeit halten. ${lapsLeft} Runden noch.`]),true);}
    else if(r<0.6)radio(c,P([`Energie managen in Sektor ${sec}.`,`Lift and Coast vor ${co}.`,"Batterie ist voll. Overtake verfügbar, wenn du in der Sekunde bist.","Bremstemperaturen vorne hoch. Etwas früher vom Gas.","Motor-Modus 6. Wir brauchen die Kühlung."]),true);
    else if(r<0.68&&pos===1&&dn)radio(c,gd>3?P([`Vorsprung ${ft(gd)} Sekunden. Alles unter Kontrolle.`,`Du bist drei Zehntel schneller als ${dn.drv.code}. Reifen einteilen.`]):P([`${dn.drv.code} ist auf ${ft(gd)} dran. Keine Fehler jetzt.`,`Abstand ${ft(gd)}. Er hat Overtake, verteidige innen.`]),true);
    else if(r<0.76&&dn&&gd<1.2)radio(c,P([`${dn.drv.code} dahinter in der Sekunde. Er bekommt Overtake.`,`Auto hinter dir: ${dn.drv.code}, frischere Reifen.`,`Verteidige gegen ${dn.drv.code}, aber verliere keine Zeit.`]),true);
    else if(r<0.82&&S.wx.eta<150&&S.wx.rain<0.03)radio(c,P([`Regen in etwa ${Math.round(S.wx.eta/10)*10} Sekunden erwartet. Sag uns, wie die Strecke ist.`,"Radar zeigt eine Zelle im Anflug. Wir halten die Inters bereit.","Es kommt Regen. Bleib erst mal draußen."]),true);
    else if(r<0.88&&lapsLeft<=2&&lapsLeft>=0)radio(c,lapsLeft===0?P(["Letzte Runde. Bring es heim.",`Letzte Runde, P${pos}. Keine Risiken.`]):P(["Zwei Runden noch. Alles geben.",`Noch ${lapsLeft+1} Runden. ${up?up.drv.code+" ist "+ft(gu)+" vor dir.":"Kopf runter."}`]),true);
    else if(r<0.93&&c.strikes>0)radio(c,`Achte auf die Track Limits in ${co}. Du hast ${c.strikes} Verwarnung${c.strikes>1?"en":""}.`,true);
    else if(r<0.97){radio(c,P(["Wie ist der Abstand nach hinten?","Wer ist das Auto vor mir?","Auf welcher Position bin ich?"]));
      radio(c,up?`P${pos}. Vor dir ${up.drv.code}, ${ft(gu)} Sekunden.`:`P${pos}. Freie Fahrt vor dir.`,true,true);}
    else radio(c,P(["Trinken nicht vergessen.","Gute Runde. Genau so weiter.",`Sektor ${sec} war persönliche Bestzeit.`,"Kopf runter, das Rennen ist noch lang."]),true);
  }else if(S.type!=="race"&&S.started&&!S.chequered){
    const ord=timedOrder(),pos=ord.indexOf(c)+1,b=bestLap(c),b0=bestLap(ord[0]),gap=b&&b0?(b-b0)*TSCALE:0,r=Math.random(),q=S.type==="q";
    if(r<0.2&&b)radio(c,pos===1?P(["P1 im Moment. Die anderen kommen noch.","Du bist vorne. Reifen sparen, wenn es reicht."]):`P${pos}, ${gap.toFixed(3).replace(".",",")} auf ${ord[0].drv.code}.`,true);
    else if(r<0.35&&q&&S.cut<99&&b)radio(c,pos>S.cut?P([`P${pos}, du bist draußen. Wir brauchen noch eine Runde.`,`Im Moment nicht weiter. Es fehlen ${((b-bestLap(ord[S.cut-1]))*TSCALE).toFixed(3).replace(".",",")}.`]):pos>S.cut-3?P([`P${pos}, du bist auf der Kippe.`,"Das wird eng. Wir gehen noch mal raus."]):P(["Das sollte reichen. Wir bleiben in der Garage.","Wir sind durch. Reifensatz gespart."]),true);
    else if(r<0.5)radio(c,P([`Zeit verloren in ${co}. Da liegt noch was.`,`Sektor ${sec} war gut. Die Strecke wird schneller.`,"Die Strecke entwickelt sich. Die letzte Runde zählt.",`Achte auf den Wind in ${co}.`,"Reifentemperatur vorne noch zu niedrig. Eine Aufwärmrunde mehr."]),true);
    else if(r<0.65)radio(c,P([`Ich hatte Untersteuern in ${co}.`,"Das Heck war im letzten Sektor unruhig.","Die Reifen waren am Ende der Runde vorbei.","Das war eine saubere Runde. Mehr geht nicht.","Ich habe am Kerb etwas Zeit liegen lassen.",`Kleiner Verbremser in ${co}.`]));
    else if(r<0.78)radio(c,P(["Box diese Runde. Wir wechseln auf frische Softs.","Abkühlrunde, dann noch ein Versuch.","Lass die Autos auf schneller Runde vorbei, nicht auf der Linie bleiben.",`Verkehr voraus in ${co}. Lücke lassen.`,"Wir gehen mit dem Feld raus. Platz suchen."]),true);
    else if(r<0.88&&S.clock<LAPT*2.5)radio(c,P(["Letzter Versuch. Du schaffst es noch über die Linie.","Die Uhr läuft ab. Diese Runde muss sitzen.","Zielflagge kommt gleich. Runde zu Ende fahren."]),true);
    else if(S.wx.eta<120&&S.wx.rain<0.03)radio(c,P(["Regen ist im Anflug. Jetzt die Zeit setzen.","Radar zeigt Regen in zwei Minuten. Wir gehen sofort raus."]),true);
    else radio(c,P(["Wie ist die Balance?","Alles in Ordnung mit dem Auto?",`Wir haben den Frontflügel um einen Klick angepasst.`]),true);
  }}
/* ---- Zeit-Sessions (FP / Quali) ---- */
function timedOrder(){return S.cars.slice().sort((a,b)=>{const x=bestLap(a),y=bestLap(b);
  if(a.dsq!==b.dsq)return a.dsq?1:-1; if(x==null&&y==null)return a.i-b.i; if(x==null)return 1; if(y==null)return -1; return x-y;});}
function toIn(c){c.mode="in";c.wantPit=true;c.pitGoal="garage";}
function openPitExit(){S.started=true;S.pitExitOpen=true;
  for(const c of S.cars)if(c.pit&&c.pit.ph==="exit")c.stopAt=null;
  addLog(`${S.name} – GREEN LIGHT – PIT EXIT OPEN`,"good");uiSession();}
function abortSession(){ // bei Rot: Session nicht wieder aufnehmen
  if(S.type!=="race"){S.clock=0;chequer();addLog("SESSION WILL NOT BE RESUMED","flag");return;}
  if(S.phase!=="racing"||S.ended)return;
  const run=S.cars.filter(c=>!c.finished&&!c.retired&&!c.removed).sort((a,b)=>b.s-a.s);
  S.chequered=true;S.cheqT=S.t;for(const c of run){c.finished=true;c.finT=S.raceT+(run[0].s-c.s)/(L/LAPT);c.finLaps=Math.max(0,Math.floor(run[0].s/L));c.finOrd=S.finCount++;}
  S.aborted=true;S.ended=true;S.hazard=null;addLog("RACE WILL NOT BE RESUMED – Ergebnis nach aktuellem Stand","flag");finalizeIncs(true);uiSession();}
function chequer(){S.chequered=true;addLog("CHEQUERED FLAG – Session beendet. Angefangene Runden dürfen zu Ende gefahren werden.","flag");
  for(const c of S.cars)if(c.mode==="out")toIn(c);uiSession();}
function timedStep(dt){
  if(S.started&&!S.chequered&&(S.flag.mode!=="red"||S.redRun)){S.clock-=dt;S.evo=1-S.clock/S.dur;if(S.clock<=0){S.clock=0;chequer();}}
  if(S.relCool>0)S.relCool-=dt;
  for(const c of S.cars){timedAI(c);if(c.mode==="in"&&!c.pit&&!c.wantPit)toIn(c);}
  if(S.chequered&&!S.ended&&S.cars.every(c=>c.mode==="garage"||c.removed||c.crash)){S.ended=true;finalizeIncs(true);uiSession();}}
function planNext(c){const el=S.dur-S.clock;c.safe=false;
  if(S.clock<LAPT*1.35||c.retired){c.nextOut=Infinity;return;}
  if(S.type==="fp"){c.nextOut=el+rand(12,W.real?70:30);return;}
  const pos=timedOrder().indexOf(c);
  if(S.cut<99&&bestLap(c)!=null&&pos<S.cut-5&&Math.random()<0.55){c.nextOut=Infinity;c.safe=true;return;}
  const fin=S.dur-(LAPT*2.35+rand(0,18)),cand=el+rand(35,80);
  c.nextOut=cand+LAPT*3.2>fin?Math.max(el+12,fin):cand;
  if(S.wx.eta<S.clock-LAPT&&S.wx.wet<0.1)c.nextOut=el+rand(10,16);}
function timedAI(c){
  if(c.mode!=="garage"||c.retired||c.dsq||S.chequered||S.flag.mode==="red"||S.relCool>0)return;
  const el=S.dur-S.clock;
  if(!S.started&&(c.nextOut>18||c.runs>0))return;   // vor der Freigabe stellen sich die Eiligen schon am Boxenausgang an
  if(c.safe&&S.clock>LAPT*1.7&&timedOrder().indexOf(c)>=S.cut-2){c.nextOut=el;c.safe=false;}
  if((S.started&&el<c.nextOut)||S.clock<LAPT*1.3||fastLaneCar(c,-45,16))return;
  const cl=wetClass(clamp(S.wx.wet-(c.drv.style-0.5)*0.07,0,1));c.tyre=cl==="dry"?"S":cl;c.wear=0;c.pushLeft=1;c.noise=rand(-0.003,0.002);c.longRun=false;
  if(S.type==="fp"){const can=Math.floor(S.clock/LAPT-1.6),want=irand(W.real?6:3,W.real?12:5);   // Training: Quali-Simulation oder Long Run mit viel Sprit
    if(cl==="dry"&&can>=3&&Math.random()<(c.runs>0?0.6:0.35)){c.longRun=true;c.pushLeft=Math.min(want,can);c.tyre=Math.random()<0.6?"M":"H";c.noise=-rand(0.011,0.019);
      radio(c,`Long Run, ${c.pushLeft} Runden auf ${c.tyre==="M"?"Medium":"Hard"}. Volle Tanks, Reifen managen.`,true);}
    else c.pushLeft=W.real?irand(2,3):2;}
  if(S.type==="q"&&S.cut<99&&!c.towBy&&cl==="dry"&&S.clock>LAPT*2.1){const ord=timedOrder(),pos=ord.indexOf(c);   // Teamkollege hilft mit Windschatten
    if(bestLap(c)!=null&&pos>=S.cut-2){const m=S.cars.find(o=>o!==c&&o.drv.ti===c.drv.ti&&o.mode==="garage"&&!o.retired&&!o.dsq&&bestLap(o)!=null&&ord.indexOf(o)<S.cut-3);
      if(m&&Math.random()<0.65){c.towBy=m;m.towFor=c;m.tyre="S";m.wear=0;m.pushLeft=1;m.noise=-0.006;m.longRun=false;S.relCool=rand(1.2,2);releaseFromGarage(m);
        addLog(`${TEAMS[c.drv.team].name}: ${m.drv.code} fährt raus und gibt ${c.drv.code} Windschatten`);radio(m,`Wir helfen ${c.drv.code}. Zieh ihn auf den Geraden, danach machst du Platz.`,true,true);
        radio(c,`${m.drv.code} fährt vor dir raus und gibt dir den Tow. Bleib in seinem Windschatten.`,true,true);return;}}}
  S.relCool=rand(1.2,3.5);releaseFromGarage(c);}
function onGarage(c){if(S.type!=="race")planNext(c);}
/* Sektorzeiten für die farbige Zeitnahme */
function setSec(c,k,t){if(!(t>0))return;c.secT[k]=t;if(c.secPB[k]==null||t<c.secPB[k])c.secPB[k]=t;S.secBest=S.secBest||[null,null,null];if(S.secBest[k]==null||t<S.secBest[k])S.secBest[k]=t;}
function secTick(c){if(c.mode!=="push"||c.pit||c.secK==null)return;const k=sectorOf(c.pos);
  if(k===c.secK+1){const tc=S.t-(c.pos-SECB[k])/Math.max(c.v,5);setSec(c,c.secK,tc-c.secT0);c.secT0=tc;c.secK=k;c.secDoneAt=S.t;}}
function onLine(c){
  if(c.towFor&&S.type!=="race"&&c.mode==="push"&&(delta(c,c.towFor)>0||c.towFor.pit||c.towFor.mode!=="push"&&c.towFor.mode!=="out")){c.towFor=null;}
  if(S.type==="race"){raceLine(c);return;}
  if(c.pit)return;
  const tc=S.t-mod(c.s)/Math.max(c.v,5);
  if(c.mode==="out"){ if(c.outDist>0.4*L){ if(S.chequered||S.flag.mode==="red")toIn(c); else{c.mode="push";c.lapT0=tc;c.lapId++;c.noise=rand(-0.004,0.001);c.secT=[null,null,null];c.secPB=c.secPB||[null,null,null];c.secK=0;c.secT0=tc;} } }
  else if(c.mode==="push"){const t=tc-c.lapT0;if(c.lapBad){c.lapBad=false;addLog(`${c.drv.code} – Runde zählt nicht (Strecke in der Auslaufzone verlassen)`);}else{c.laps.push({t,id:c.lapId});c.qFlash={t,at:S.t};}c.pushLeft--;if(c.secK===2)setSec(c,2,tc-c.secT0);c.secK=0;c.secT0=tc;
    if(S.bestT==null||t<S.bestT){S.bestT=t;S.bestBy=c;S.bestSplits=c.secT[0]!=null&&c.secT[1]!=null?[c.secT[0],c.secT[0]+c.secT[1],t]:null;addLog(`${c.drv.code} ${fmtLap(t*TSCALE)} – Bestzeit`);radio(c,pick(["P1, P1. Starke Runde.","Das ist Bestzeit. Gut gemacht."]),true);}
    if(S.chequered||c.pushLeft<=0)toIn(c);else{c.lapT0=tc;c.lapId++;if(c.longRun){c.noise-=0.0007;if(c.pushLeft===2&&Math.random()<0.5)radio(c,pick(["Reifen bauen hinten ab. Balance geht Richtung Übersteuern.","Pace ist konstant. Noch zwei Runden, dann Box.","Vorne links körnt. Ich manage."]));}}}}

/* ---- Rennen ---- */
function startFormation(){S.phase="form";let pv=null;
  for(const c of S.cars.filter(x=>x.mode==="grid").sort((a,b)=>a.slotK-b.slotK)){c.soc=0.8;c.harv=0;c.mode="form";c.onGrid=false;c.stopAt=c.s+L;c.pred=pv;pv=c;}
  addLog("FORMATION LAP","flag");uiSession();}
function gridChecks(){const act=S.cars.filter(c=>c.mode==="grid");if(S.restartGrid||S.gridChecked||act.length<8)return;S.gridChecked=true;
  if(Math.random()<0.14){S.stall=pick(act.slice(2));addLog(`CAR ${S.stall.drv.num} (${S.stall.drv.code}) – Fahrer signalisiert Problem in der Startaufstellung`,"flag");radio(S.stall,"Motor ist aus! Ich komme nicht weg!",false,true);}
  const cand=act.filter(c=>c!==S.stall),r=Math.random();
  if(r<0.2){const c=pick(cand);c.s+=4.5;c.pos=mod(c.s);
    registerInc({kind:"gridpos",title:`Startposition · ${c.drv.code} · Platz ${c.slotK+1}`,cars:[c],pos:c.pos,truth:"pen",pre:3,post:2,explain:"Das Auto steht mit den Vorderrädern klar vor der Markierung seiner Startbox – 5 Sekunden."});}
  else if(r<0.35){const c=pick(cand);
    registerInc({kind:"gridpos",title:`Startposition · ${c.drv.code} · Platz ${c.slotK+1}`,cars:[c],pos:c.pos,truth:"ok",pre:3,post:2,explain:"Das Auto steht innerhalb seiner Startbox – alles korrekt."});}}
function abortStart(){if(S.phase!=="gridwait"&&S.phase!=="lights")return;
  if(S.phase==="lights"){S.lights=0;S.phase="gridwait";if(S.jump&&S.jumped){S.jump.s=(S.restartGrid?(S.jump.redLaps+1)*L:0)+gridSlot(S.jump.slotK).s;S.jump.pos=mod(S.jump.s);S.jump.v=0;}}
  if(S.stall){const c=S.stall;score(100);addLog(`START ABORTED – ${c.drv.code} wird in die Boxengasse geschoben. Korrekte Entscheidung (+100)`,"good");
    placeGarage(c);if(c.s>L/2)c.s-=L;c.pos=mod(c.s);c.onGrid=false;S.pitStart=c;S.stall=null;}
  else{score(-30);addLog("START ABORTED ohne Grund – Teams verärgert (−30)","bad");}
  S.laps=Math.max(3,S.laps-1);addLog(`EXTRA FORMATION LAP – Renndistanz verkürzt auf ${S.laps} Runden`,"flag");startFormation();}
function startLights(){S.phase="lights";S.lightT=0;S.holdReady=false;S.jumped=false;S.holdWarn=false;S.holdEnd=4.5+rand(0.6,3.2);const g=S.cars.filter(c=>c.mode==="grid"&&c!==S.stall);
  S.jump=Math.random()<0.4&&g.length>4?g[irand(2,g.length-1)]:null;addLog("START PROCEDURE – LIGHTS SEQUENCE","flag");uiSession();}
function goRace(first){S.lights=0;S.phase="racing";S.goT=S.raceT;S.started=true;
  for(const c of S.cars){if(c.mode!=="grid")continue;c.mode="race";drvState(c);c.react=Math.max(0.12,c.reactT+lognorm(0.08,0.7)*(c.drv.code===S.stall?1:1));c.launch=clamp(1+gauss()*0.08,0.72,1.18);if(Math.random()<0.03){c.launch=rand(0.45,0.7);c.react+=rand(0.3,1.2);}c.holdT=4;c.cold=6;
    if(!S.restartGrid){c.wear=0;c.form=rand(-0.0025,0.0025);c.tyreLaps=0;c.lapStart=S.raceT;}}
  S.t1=!S.restartGrid&&Math.random()<0.32*Math.sqrt(raceMood().chaos)?{n:Math.random()<0.4?1+irand(1,2):1,done:0}:null;}   // manchmal kracht es in der ersten Kurve
function lightsOut(){goRace();
  if(S.stall){const c=S.stall;c.react=9;score(-100);addLog(`Start trotz stehendem Auto ${c.drv.code} freigegeben – gefährlich! (−100)`,"bad");S.stall=null;}
  if(S.jump&&S.jumped){const c=S.jump;c.react=0;
    registerInc({kind:"jump",title:`Start · ${c.drv.code} · Startplatz ${c.slotK+1}`,cars:[c],pos:c.pos,truth:"pen",pre:3.5,post:3,
      data:`Transponder: Bewegung ${((S.lightT-S.jumpAt)*TSCALE).toFixed(3).replace(".",",")} s VOR dem Erlöschen der Lichter${S.jumpStop<99?", Auto hält kurz wieder an":""}. Rollweg ca. ${(Math.min(S.lightT-S.jumpAt,S.jumpStop)*S.jumpV/2).toFixed(1).replace(".",",")} m.`,explain:"Jede Bewegung vor dem Erlöschen der Lichter ist ein Frühstart – auch wenn das Auto wieder anhält."});}
  else if(Math.random()<0.6){const g=S.cars.filter(x=>x.mode==="race"&&x.react<5),c=g[irand(1,Math.min(17,g.length-1))],rt=lognorm(0.09,0.6);c.react=rt;
    registerInc({kind:"jump",title:`Start · ${c.drv.code} · Startplatz ${c.slotK+1}`,cars:[c],pos:c.pos,truth:"ok",pre:3.5,post:3,
      data:`Transponder: Bewegung +${rt.toFixed(3).replace(".",",")} s NACH dem Signal.`,explain:"Bewegung erst nach dem Erlöschen der Lichter – extrem schnell, aber legal."});}
  addLog("LIGHTS OUT – RACE START","good");uiSession();}
function startBehindSC(){if(S.phase!=="pre"&&S.phase!=="gridwait")return;
  const wet=S.wx.wet>0.3;score(wet?50:-30);addLog(wet?"RACE START BEHIND SAFETY CAR – richtige Entscheidung bei Nässe (+50)":"Start hinter dem Safety Car auf trockener Strecke – unnötig (−30)",wet?"good":"bad");
  if(S.stall){placeGarage(S.stall);if(S.stall.s>L/2)S.stall.s-=L;S.stall.pos=mod(S.stall.s);S.pitStart=S.stall;S.stall=null;}
  goRace();for(const c of S.cars)if(c.mode==="race"){c.react=rand(0.3,1.6);c.launch=0.8;c.holdT=1;}
  S.flag.mode="sc";S.sc={on:true,wait:0,inLap:false,s:45,pos:45,lat:0,v:0};uiSession();uiFlags();}
function slotAhead(c,k){let t=absAhead(c,mod(gridSlot(k).s));if(t-c.s<260)t+=L;return t;}
function standingRestart(){
  const run=S.cars.filter(c=>!c.removed&&!c.retired&&!c.finished&&!c.crash&&c.mode!=="garage");
  const out=run.filter(c=>!c.pit||c.v>2);if(out.length){if(!S.rsPending){S.rsPending=true;addLog(`NEUSTART VORGEMERKT – startet automatisch, sobald alle aufgereiht sind (noch unterwegs: ${out.map(c=>c.drv.code).join(", ")})`,"flag");}
    setAlert("",`Neustart vorgemerkt – wartet noch auf ${out.map(c=>c.drv.code).join(", ")}.`);return false;}
  S.rsPending=false;
  const ord=(S.redOrder||[]).filter(c=>run.includes(c));for(const c of run.slice().sort((a,b)=>b.s-a.s))if(!ord.includes(c))ord.push(c);
  const q=ord.filter(c=>c.pit&&c.v<2),fr=p=>mod(PIT_OUT_S-6-p),qs=q.map(c=>({pos:c.pos,lat:c.lat})).sort((a,b)=>fr(a.pos)-fr(b.pos));
  rsSortQueue(ord);
  S.flag.mode="green";S.phase="form";S.restartGrid=true;S.rsChain=true;S.sc=null;S.restart=false;S.unlapOn=false;S.nextSlot=ord.length;S.rsT=S.t;
  const ld=ord[0];S.rsSC={s:(ld?ld.s:0)+70,v:0};
  ord.forEach((c,i)=>{c.pred=i?ord[i-1]:null;c.redLaps=Math.floor(c.s/L);c.slotK=i;c.gridLat=gridSlot(i).lat;c.mode="form";c.onGrid=false;c.wantPit=false;c.ot=null;c.unlap=false;if(c.script)endScript(c);
    c.rsRel=S.t+i*1.1;c.rsGo=false;c.stopAt=c.pit?c.s:null;if(c.pit){c.pit.ph="exit";c.pit.goal="out";}});
  addLog("RESTART-PROZEDUR – Safety Car führt das Feld eine Runde zur Startaufstellung","flag");uiSession();uiFlags();}
/* Boxengassen-Schlange in die gewünschte Reihenfolge bringen (nur stehende Autos; Rundenzähler bleibt) */
function rsSortQueue(ord,onlyQueue){const q=ord.filter(c=>c.pit&&c.v<2&&(!onlyQueue||c.pit.goal==="queue")),fr=p=>mod(PIT_OUT_S-6-p),qs=q.map(c=>({pos:c.pos,lat:c.lat})).sort((a,b)=>fr(a.pos)-fr(b.pos));
  q.forEach((c,i)=>{let d=mod(qs[i].pos-c.pos);if(d>L/2)d-=L;c.s+=d;c.pos=mod(c.s);c.lat=qs[i].lat;});return q.length;}
/* unter Rot: jedes Auto auf der Strecke reiht sich in der Boxengasse ein; vorgemerkter Neustart startet, sobald alle stehen */
function redStep(){if(S.type!=="race"||S.flag.mode!=="red"||S.phase!=="racing")return;
  for(const c of S.cars){if(c.removed||c.retired||c.finished||c.crash||c.pit||c.mode!=="race")continue;if(!c.wantPit||c.pitGoal!=="queue"){c.wantPit=true;c.pitGoal="queue";}}
  if(S.rsPending){const run=S.cars.filter(c=>!c.removed&&!c.retired&&!c.finished&&!c.crash&&c.mode!=="garage");if(run.every(c=>c.pit&&c.v<=2))standingRestart();}}
function rsStep(){if(!S.rsChain||S.phase!=="form")return;const ord=S.cars.filter(c=>c.mode==="form"&&c.slotK>=0).sort((a,b)=>a.slotK-b.slotK);
  for(const c of ord)if(c.rsRel!=null&&S.t>=c.rsRel){c.rsRel=null;c.rsGo=true;const t0=absAhead(c,mod(PIT_EXIT_S+20));c.stopAt=t0+mod(gridSlot(c.slotK).s-PIT_EXIT_S-20);}   // erst raus aus der Boxengasse, eine Runde fahren, dann auf den Startplatz
  const n=S.cars.filter(c=>c.onGrid).length;if(n!==S.rsN){S.rsN=n;S.rsLast=S.t;}
  if(n>0&&S.t-S.rsLast>30){for(const c of ord)if(!c.onGrid&&!c.retired&&!c.removed){c.pit=null;c.inPit=false;c.s=(c.redLaps+1)*L+gridSlot(c.slotK).s;c.pos=mod(c.s);c.lat=c.gridLat;c.v=0;c.mode="grid";c.onGrid=true;c.stopAt=null;}
    addLog("Marshals weisen die restlichen Autos in die Startaufstellung ein","flag");}
  const ld=ord[0];if(S.rsSC&&ld){const sc=S.rsSC,tg=ld.s+60;sc.s=Math.max(sc.s,Math.min(sc.s+ld.v*DT*1.1+0.2,tg+20));
    if(ld.stopAt!=null&&ld.stopAt-ld.s<L*0.25&&mod(sc.s)>PIT_ENTRY_S-30){S.rsSC=null;addLog("SAFETY CAR IN THE PIT LANE – Feld stellt sich in der Startaufstellung auf","flag");}}}
function startUnlap(){if(S.flag.mode!=="sc"||!S.sc||!S.sc.on)return;const ld=S.leader;let n=0;
  for(const c of S.cars){if(c.removed||c.retired||c.finished||c.pit||c.mode!=="race")continue;if(ld.s-c.s>L*0.5){c.unlap=true;c.unlapPh=0;n++;}}
  if(n){S.unlapOn=true;score(30);addLog(`LAPPED CARS MAY NOW OVERTAKE – ${n} Auto${n>1?"s":""} rundet sich zurück (+30)`,"flag");}else addLog("Keine überrundeten Autos im Feld");uiFlags();}
function lappedCount(){const ld=S.leader;if(!ld||S.unlapOn)return 0;
  if(S.sc&&S.sc.on){const dl=(S.sc.pos-ld.pos+L)%L;if(dl>200)return 0;}   // erst wenn der Führende hinter dem Safety Car ist
  return S.cars.filter(c=>!c.removed&&!c.retired&&!c.finished&&c.mode==="race"&&ld.s-c.s>L*0.5).length;}
function t1Step(){const k=S.t1;if(!k||S.phase!=="racing")return;const dtt=S.raceT-S.goT;if(dtt>=10||S.hazard){S.t1=null;return;}
  if(dtt>1.2&&k.done<k.n&&armBattle(true)){const A=S.cars.find(c=>c.script&&!c.script.t1);if(A){A.script.t1=true;A.script.type=Math.random()<0.55?"rear":"lunge";k.done++;}}}
/* Kleine Fahrfehler unter Druck und teaminterne Absprachen – einmal pro Sekunde */
function paceStep(dt){S.pAcc=(S.pAcc||0)+dt;if(S.pAcc<1)return;S.pAcc=0;if(S.phase!=="racing"||S.flag.mode!=="green"||S.chequered)return;
  const run=S.cars.filter(c=>c.mode==="race"&&!c.pit&&!c.removed&&!c.finished&&!c.crash&&!(c.spinT>0)).sort((a,b)=>b.s-a.s);
  for(let i=0;i<run.length-1;i++){const B=run[i],A=run[i+1],gap=(B.s-A.s)/Math.max(30,A.v);   // B vorn, A direkt dahinter
    if(gap<0.9&&!B.script&&!B.busy&&!B.slipT&&Math.random()<0.012*(0.6+aggOf(A))){B.slipT=0.8;B.lockT=0.25;      // unter Druck: Bremspunkt verpasst, Tür geht auf
      if(Math.random()<0.25)radio(B,pick(["Kleiner Verbremser. Er ist dran.","Ich habe Zeit verloren, Hinterachse war unruhig.","Mist, zu früh am Gas."]));}
    if(gap<1.3&&!A.atk&&!A.script&&!B.script&&!A.busy&&!B.busy&&!A.giveBack&&!B.giveBack&&Math.abs(A.s-B.s)<L*0.5&&S.raceT-S.goT>20
       &&Math.random()<0.009*(0.5+aggOf(A))*(tyreGrip(A.tyre,A.wear,0)>tyreGrip(B.tyre,B.wear,0)?1.8:1)&&run.filter(x=>x.atk).length<3){A.atk={o:B,t:0};   // Angriff: holt sich auf der nächsten Geraden den Platz
      if(Math.random()<0.2)radio(A,pick([`Ich bin dran an ${B.drv.code}. Gebt mir alles, was wir haben.`,"Overtake-Modus bereit. Ich greife auf der Geraden an.",`${B.drv.code} macht Fehler. Den hole ich mir.`]));}
    if(A.drv.ti!==B.drv.ti||A.script||B.script||A.giveBack||B.giveBack||A.wantPit||B.wantPit){A.tmT=0;continue;}
    if(gap<1.0)A.tmT=(A.tmT||0)+1;else{A.tmT=Math.max(0,(A.tmT||0)-2);continue;}
    const team=TEAMS[A.drv.team],last=S["to"+A.drv.ti]||-999;
    if(A.tmT<20||S.t-last<170||S.laps-Math.floor(A.s/L)<2)continue;
    S["to"+A.drv.ti]=S.t;A.tmT=0;const faster=A.wear<B.wear-0.06||tyreGrip(A.tyre,A.wear,0)>tyreGrip(B.tyre,B.wear,0)+0.004,back=A.gaveTeam===B;
    radio(A,back?`Ich habe ihn vorbeigelassen und er zieht nicht weg. Gebt mir den Platz zurück!`:pick([`Ich bin deutlich schneller als ${B.drv.code}. Lasst mich vorbei!`,`${B.drv.code} hält mich auf. Wir verlieren beide Zeit.`,`Warum hänge ich hinter ihm fest? Ich habe viel mehr Pace.`]),false,true);
    if(Math.random()<(back?0.6:faster?0.6:0.3)){B.giveBack={to:A,t:0,team:true};
      radio(B,`${A.drv.code} ist schneller als du. Lass ihn bitte vorbei, nicht kämpfen.`,true,true);addLog(`Teamorder bei ${team.name}: ${B.drv.code} soll ${A.drv.code} vorbeilassen`);
      if(Math.random()<0.5)radio(B,pick(["Verstanden. Das besprechen wir nach dem Rennen.","Im Ernst? Okay… ich lasse ihn durch.","Copy. Aber ich will den Platz zurück, wenn er nicht wegkommt."]),false,true);}
    else{radio(A,pick(["Negativ. Ihr dürft frei fahren, aber sauber.","Position halten. Wir tauschen nicht."]),true,true);
      if(Math.random()<0.5)radio(A,pick(["Das verstehe ich nicht. Ich fühle mich hier benachteiligt.","Okay. Dann muss ich es eben selbst machen.","Schon wieder zu seinen Gunsten. Na gut."]),false,true);}}}
function raceStep(dt){t1Step();paceStep(dt);
  if(S.phase==="form"){const act=S.cars.filter(c=>(c.mode==="form"||c.mode==="grid")&&!c.retired&&!c.removed&&!c.crash);
    rsStep();if(S.restartGrid)for(const c of act)if(c.mode==="form"&&c.slotK<0&&!c.pit&&c.pos>=PIT_EXIT_S-10&&c.pos<L/2){c.slotK=S.nextSlot++;c.gridLat=gridSlot(c.slotK).lat;c.stopAt=slotAhead(c,c.slotK);}
    if(act.length&&act.every(c=>c.onGrid)){for(const c of act){c.s=S.restartGrid?(c.redLaps+1)*L+gridSlot(c.slotK).s:c.s-L;c.pos=mod(c.s);c.v=0;}
      S.phase="gridwait";S.rsChain=false;S.rsSC=null;addLog("ALL CARS ON THE GRID","flag");gridChecks();uiSession();} }
  else if(S.phase==="lights"){S.lightT+=dt;S.lights=Math.min(5,Math.floor(S.lightT/0.9)+1);
    if(S.lightT>=4.5&&!S.holdReady){S.holdReady=true;uiSession();}
    if(S.jump&&S.lightT>S.holdEnd){if(!S.jumped){S.jumpAt=S.lightT;S.jumpV=lognorm(5,0.45);S.jumpStop=Math.random()<0.35?rand(0.15,0.6):99;}const mv=S.lightT-S.jumpAt<S.jumpStop;S.jump.s+=(mv?S.jumpV:0)*dt;S.jump.pos=mod(S.jump.s);S.jump.v=mv?S.jumpV:0;S.jumped=true;}   // rollt los, während die Lichter noch brennen
    if(S.lightT>13&&!S.holdWarn){S.holdWarn=true;score(-20);addLog("Startverzögerung – Motoren überhitzen (−20)","bad");}}
  else if(S.phase==="racing"){S.raceT+=dt;S.evo=Math.min(1,S.raceT/200);
    if(S.pitStart&&S.raceT-S.goT>5){const c=S.pitStart;S.pitStart=null;c.mode="race";c.pit={ph:"exit",goal:"out",timer:0,trap:true,waitU:0};if(c.lat<BOXLAT-2)c.garOut={ph:0};c.stopAt=null;c.react=0;c.holdT=0;addLog(`${c.drv.code} startet aus der Boxengasse`);}
    if(S.unlapOn&&!S.cars.some(c=>c.unlap&&!c.removed&&!c.retired)){S.unlapOn=false;addLog("Alle Überrundeten haben sich zurückgerundet","good");}
    if(S.flag.mode!=="sc"&&S.unlapOn){S.unlapOn=false;for(const c of S.cars)c.unlap=false;}
    const v=S.vscV;
    if(v){ if(S.flag.mode!=="vsc"||v.c.pit||v.c.removed){v.c.vscFast=false;S.vscV=null;}
      else{v.t+=dt;v.c.vscFast=v.bad&&v.t<6;
        if(v.t>=6.5){S.vscV=null;const dl=v.bad?-rand(1.2,2.6):rand(0.1,0.5);
          registerInc({kind:"delta",title:`VSC-Delta · ${v.c.drv.code}`,cars:[v.c],pos:v.c.pos,truth:v.bad?"pen":"ok",pre:7,post:2,
            data:`Delta zur VSC-Referenzzeit: ${dl>0?"+":""}${dl.toFixed(1)} s (${v.bad?"zu schnell":"eingehalten"}).`,
            explain:v.bad?"Negatives Delta – das Auto war unter VSC zu schnell und hat aufgeholt: 5 Sekunden.":"Positives Delta – die Mindestzeit wurde eingehalten."});}}}
    for(const c of S.cars){ if(c.mode==="race"&&!c.pit&&!c.wantPit&&c.pos>=DEC_S&&c.pos<DEC_S+40){const lp=Math.floor(c.s/L);if(c.decLap!==lp){c.decLap=lp;raceStrategy(c);}}
      if(c.dmg&&c.ignoreDmg&&!c.pit&&c.mode==="race"&&S.t-c.dmgT>55){c.ignoreDmg=false;score(-50);addLog(`Frontflügel von ${c.drv.code} löst sich – keine schwarz-orange Flagge gezeigt (−50)`,"bad");
        if(!S.hazard)spawnHazard(2,c.pos,`Frontflügel von ${c.drv.code} liegt auf der Strecke – Marshals müssen auf die Strecke`,[],{deb:true});} }
    if(!S.hazard&&S.flag.mode==="green"&&S.wx.rain>0.8&&S.wx.wet>0.7&&!S.chequered&&!(S.rainHazT!=null&&S.t-S.rainHazT<LAPT*2.5)&&(S.rainHazT=S.t))
      spawnHazard(S.wx.rain>0.97?4:S.wx.rain>0.86?3:2,-1,S.wx.rain>0.97?"Sintflut – Sicht gleich null, die Strecke steht unter Wasser":S.wx.rain>0.86?"Starkregen – Aquaplaning, Fahrer fordern ein Safety Car":"Heftiger Schauer – Gischt und Aquaplaning, Fahrer fordern Neutralisierung",[],{rain:true,dur:10});
    else if(!S.hazard&&S.flag.mode==="green"&&!S.chequered&&S.aquaLog&&S.aquaLog.filter(t=>S.t-t<60).length>=3)
      spawnHazard(Math.random()<0.6?2:3,-1,"Drei Aquaplaning-Fälle in einer Minute – stehendes Wasser, Fahrer fordern eine Neutralisierung",[],{rain:true,dur:10});
    if(S.chequered&&!S.ended){
      if(S.t>S.cheqT+LAPT*1.8)for(const c of S.cars)if(!c.finished&&!c.retired&&!c.removed){c.finished=true;c.finT=S.raceT;c.finLaps=Math.max(0,Math.floor(c.s/L));c.finOrd=S.finCount++;}
      if(S.cars.every(c=>c.finished||c.retired||c.removed)){S.ended=true;finalizeIncs(true);uiSession();}}}}
function raceLine(c){
  if(S.phase!=="racing"||c.finished)return;
  const lap=Math.floor(c.s/L);c.noise=rand(-0.006,0.006);
  if(c.lapStart!=null)c.lastLapT=S.raceT-c.lapStart;c.lapStart=S.raceT;c.lineLap=lap;c.lineT=S.raceT;c.tyreLaps=(c.tyreLaps||0)+1;
  if(S.restart&&c===S.leader){S.restart=false;S.flag.mode="green";addLog("GREEN FLAG – RESTART","good");radio(c,"Grün, Grün, Grün! Volle Attacke.",true,true);}
  if(S.chequered||lap>=S.laps){
    if(!S.chequered){S.chequered=true;S.cheqT=S.t;addLog(`CHEQUERED FLAG – ${c.drv.code} überquert als Erster die Linie`,"flag");uiSession();radio(c,"Jaaa! Was für ein Rennen! Danke, Jungs!",false,true);}
    c.finished=true;c.finT=S.raceT;c.finLaps=Math.min(lap,S.laps);c.finOrd=S.finCount++;c.mode="cool";c.ot=null;
    if(!c.pit){c.wantPit=true;c.pitGoal="garage";}else c.pit.goal=c.pit.ph==="in"?"garage":c.pit.goal;
    if(c.dtPending){c.penSec+=20;c.dtPending=false;}return;}
  c.omT=0;ersLap(c);
  if(!c.pit&&lap>=1)for(const o of S.cars){if(o===c||o.removed||o.pit)continue;const d=delta(c,o);if(d>0&&d<Math.max(26,c.v*0.45)){c.omT=6;break;}}
  if(c===S.leader&&S.flag.mode==="green"&&lap>=2){
    if(!S.om&&S.wx.wet<0.25){score(-10);addLog("Teams fragen nach: Warum ist der Overtake Mode deaktiviert? (−10)","bad");}
    else if(S.om&&S.wx.wet>0.4){score(-15);addLog("Overtake Mode bei nasser Strecke aktiv – gefährlich! (−15)","bad");}}}
function raceStrategy(c){
  if(c.finished||S.chequered||S.flag.mode==="red"||S.pitClosed)return;
  const lapsLeft=S.laps-(Math.floor(c.s/L)+1),w=S.wx.wet,need=wetClass(w),cur=tyreClass(c.tyre),lapNo=Math.floor(c.s/L)+1;
  if(c.dsq)return;
  if(c.dtPending){c.dtPending=false;c.wantPit=true;c.pitGoal="through";addLog(`${c.drv.code} tritt Durchfahrtsstrafe an`);return;}
  if(c.sgPending){c.wantPit=true;c.pitGoal="service";c.sgServe=true;return;}
  if(c.punct){c.nextTyre=c.tyre==="I"||c.tyre==="W"?c.tyre:(lapsLeft>S.laps*0.4?"H":"M");c.wantPit=true;c.pitGoal="service";return;}
  let pit=false;const weather=need!==cur;
  if(weather){const gNow=tyreGrip(c.tyre,c.wear,w),gNew=tyreGrip(need==="dry"?"M":need,0,w),gain=gNew-gNow,st=c.drv.style;
    const fresh=lapNo-(c.lastStop||-9)<3;let thr,ok=true;
    if(cur==="dry")thr=0.02+st*0.11;                       // Zocker bleiben länger auf Slicks draußen
    else if(need==="dry"){thr=0.105-st*0.09;ok=S.wx.rain<(st>=0.7?0.18:0.05);}   // Zocker gehen früher zurück auf Slicks
    else thr=0.06;
    if(gain>thr&&ok&&!(fresh&&gain<thr+0.05)){pit=true;
      if(cur==="dry"&&st>=0.7)radio(c,"Okay, jetzt geht es nicht mehr. Ich komme rein.");
      else if(need==="dry"&&st>=0.7)radio(c,"Gebt mir Slicks, die Linie ist trocken genug. Ich riskiere es.");}
    else if(cur==="dry"&&gain>0.03&&st>=0.7&&Math.random()<0.3)radio(c,"Ich bleibe draußen. Das geht noch auf Slicks.");}
  else if(c.dmg&&lapsLeft>=2&&!c.ignoreDmg)pit=true;
  else if(lapsLeft>=1){const pl=c.plan[0],neu=S.flag.mode==="sc"||S.flag.mode==="vsc";
    if(c.wear>0.9)pit=true;
    else if(pl&&lapNo>=pl.lap)pit=true;
    else if(pl&&neu&&lapNo>=pl.lap-4)pit=true;
    else if(pl&&lapNo>=pl.lap-2&&Math.random()<0.35){for(const o of S.cars){if(o===c||o.pit||o.removed)continue;const d=delta(c,o);if(d>0&&d<c.v*1.2){pit=true;break;}}}
    else if(!pl&&c.used.size<2&&cur==="dry"&&!S.wetRace&&!S.sprint&&lapsLeft<=2)pit=true;
    else if(!pl&&TRACK.key==="monaco"&&!S.sprint&&S.laps>=6&&c.stops<2&&lapsLeft<=2)pit=true;}
  if(!pit&&!weather&&lapsLeft>=4&&S.flag.mode==="green"&&cur==="dry"){const pl=c.plan[0];
    if(pl&&lapNo>=pl.lap-5&&lapNo<pl.lap&&(c.tyreLaps||0)>=3){   // Undercut: hängt seit Runden hinter einem Gegner fest und kommt früher
      let ah=null,bd=1e9;for(const o of S.cars){if(o===c||o.pit||o.removed||o.mode!=="race"||o.drv.ti===c.drv.ti)continue;const dd=delta(c,o);if(dd>0&&dd<bd){bd=dd;ah=o;}}
      if(ah&&bd/Math.max(30,c.v)<1.3&&Math.abs(ah.s-c.s)<L*0.5){c.stuck=(c.stuck||0)+1;
        if(c.stuck>=2&&Math.random()<0.55){pit=true;c.stuck=0;ah.cover=lapNo+1;ah.coverBy=c;radio(c,`Box, box. Wir versuchen den Undercut gegen ${ah.drv.code}.`,true,true);
          addLog(`${TEAMS[c.drv.team].name} versucht den Undercut: ${c.drv.code} kommt früh, Ziel ist ${ah.drv.code}`);}}
      else c.stuck=0;}
    if(!pit&&c.cover===lapNo&&pl){c.cover=null;      // Antwort des Gegners: covern oder Overcut
      if(c.wear<0.5&&Math.random()<0.45){c.form=(c.form||0)+0.0025;radio(c,"Wir bleiben draußen und fahren den Overcut. Freie Fahrt, push jetzt!",true,true);addLog(`${TEAMS[c.drv.team].name} bleibt mit ${c.drv.code} draußen – Overcut`);}
      else{pit=true;radio(c,`Box, box. Wir covern ${c.coverBy?c.coverBy.drv.code:"den Undercut"}.`,true,true);addLog(`${TEAMS[c.drv.team].name} reagiert: ${c.drv.code} kommt sofort rein`);}}}
  if(pit){const mate=S.cars.find(o=>o!==c&&o.drv.ti===c.drv.ti&&!o.removed&&((o.wantPit&&o.pitGoal==="service")||(o.pit&&o.pit.goal==="service"&&o.pit.ph!=="exit")));
    if(mate){const gap=((mate.pos-c.pos+L)%L)/Math.max(30,c.v),urgent=weather||c.wear>0.95||lapsLeft<2;   // Box ist nur einmal da: Double Stack nur, wenn die Lücke reicht
      if(gap<2.4&&!urgent){pit=false;if(S.t-(c.stackMsg||-99)>60){c.stackMsg=S.t;radio(c,`Bleib draußen, bleib draußen. ${mate.drv.code} ist an der Box, wir holen dich nächste Runde.`,true);}}
      else addLog(`${TEAMS[c.drv.team].name}: Double Stack – ${c.drv.code} kommt direkt hinter ${mate.drv.code}`+(gap<2.4?" und muss warten":""));}}
  if(!pit)return;
  let nt;
  if(need!=="dry")nt=(need==="I"&&S.wx.rain>0.75&&w>0.6)?"W":need;
  else{const opts=["S","M","H"].filter(x=>!c.used.has(x)||c.used.size>=2||S.wetRace);
    const ideal=lapsLeft<=S.laps*0.36?"S":lapsLeft<=S.laps*0.6?"M":"H";
    nt=opts.includes(ideal)?ideal:(c.plan[0]&&opts.includes(c.plan[0].comp)?c.plan[0].comp:opts[opts.length-1]);}
  c.lastStop=lapNo;c.nextTyre=nt;c.wantPit=true;c.pitGoal="service";radio(c,`Box, box. Wir gehen auf ${TYN[nt]}.`,true);
  if(Math.random()<0.05*memW("speed",-1)){memAdd("speed",-1);c.speedArm=1+Math.min(0.09,lognorm(0.009,0.75));}}

/* ---- Flaggen (frei setzbar) ---- */
function cycleSector(i){S.sec[i]=(S.sec[i]+1)%3;
  addLog(S.sec[i]===0?`GREEN FLAG – SEKTOR ${i+1}`:S.sec[i]===1?`YELLOW FLAG – SEKTOR ${i+1}`:`DOUBLE YELLOW – SEKTOR ${i+1}`,S.sec[i]?"flag":"good");uiFlags();}
function allGreen(){S.sec=[0,0,0];addLog("ALLE SEKTOREN GRÜN","good");uiFlags();}
function redRace(){for(const c of S.cars){if(c.removed||c.crash||c.finished||c.mode==="garage"||c.mode==="grid")continue;
  if(c.pit){if(c.pit.ph==="exit"&&c.pos<PIT_OUT_S-10)c.stopAt=absAhead(c,PIT_OUT_S-6);}else{c.wantPit=true;c.pitGoal="queue";}}}
function setNeutral(act){const m=S.flag.mode,race=S.type==="race";
  if(act==="vsc"&&m==="green"){S.flag.mode="vsc";addLog("VIRTUAL SAFETY CAR DEPLOYED","flag");if(S.leader)radio(S.leader,"VSC, VSC. Delta positiv halten.",true,true);
    if(race&&S.phase==="racing"&&Math.random()<0.6){const cs=S.cars.filter(c=>c.mode==="race"&&!c.pit&&!c.removed&&!c.finished);if(cs.length)S.vscV={c:pick(cs),t:0,bad:Math.random()<0.55};}}
  else if(act==="vscEnd"&&m==="vsc"){S.flag.mode="green";addLog("VSC ENDING – GREEN FLAG","good");}
  else if(act==="sc"&&race&&S.phase==="racing"&&(m==="green"||m==="vsc")){S.flag.mode="sc";S.sc={on:false,wait:0,inLap:false,s:0,pos:0,lat:0,v:0};S.restart=false;addLog("SAFETY CAR – wird auf die Strecke geschickt","flag");if(S.leader)radio(S.leader,"Safety Car, Safety Car. Delta halten, nicht überholen.",true,true);}
  else if(act==="scIn"&&m==="sc"&&!S.restart){ if(S.sc&&S.sc.on){S.sc.inLap=true;addLog("SAFETY CAR IN THIS LAP","flag");} else{S.sc=null;S.flag.mode="green";addLog("SAFETY CAR abbestellt – GREEN FLAG","good");} }
  else if(act==="red"&&m!=="red"&&(S.started||race)){S.flag.mode="red";if(race&&S.phase==="racing"){S.redOrder=S.cars.filter(c=>!c.removed&&!c.retired&&!c.crash&&!c.finished).sort((a,b)=>b.s-a.s);
      S.redSnap={atRed:S.redOrder.slice(),lastLap:S.redOrder.slice().sort((a,b)=>((b.lineLap||0)-(a.lineLap||0))||((a.lineT||0)-(b.lineT||0)))};S.redOrderSet=false;S.rsPending=false;}S.sc=null;S.restart=false;addLog("RED FLAG – Session unterbrochen","bad");if(S.leader)radio(S.leader,"Rote Flagge, rote Flagge. Langsam zurück in die Box.",true,true);
    if(race){if(S.phase==="racing")redRace();}
    else{S.pitExitOpen=false;for(const c of S.cars)if(c.mode==="out"||c.mode==="push"){if(c.pit)c.mode="in";else toIn(c);}}}
  else if(act==="restart"&&m==="red"){
    if(race&&S.phase==="racing"){S.flag.mode="sc";S.sc={on:true,wait:0,inLap:true,s:PIT_EXIT_S,pos:PIT_EXIT_S,lat:-9,v:PITV};
      for(const c of S.cars){if(c.wantPit&&c.pitGoal==="queue")c.wantPit=false;
        if(c.pit&&(c.pit.goal==="queue"||c.pit.ph==="exit")){c.pit.ph="exit";c.pit.goal="out";c.stopAt=null;}}
      addLog("RESTART – Feld folgt dem Safety Car aus der Box","good");}
    else{S.flag.mode="green";if(!race){S.pitExitOpen=true;for(const c of S.cars){if(c.pit&&c.pit.ph==="exit")c.stopAt=null;if(c.mode==="garage"&&c.nextOut!==Infinity)c.nextOut=Math.min(c.nextOut,S.dur-S.clock+rand(0,8));}}
      addLog("SESSION WIRD FORTGESETZT – PIT EXIT OPEN","good");}}
  uiFlags();}

/* ---- Gefahren ---- */
const HTXT={1:c=>`${c} steht in der Auslaufzone, Fahrer ausgestiegen. Bergung hinter der Barriere möglich`,
  2:c=>`${c} steht am Streckenrand – Marshals müssen kurz auf die Strecke`,
  3:c=>`${c} steckt im Reifenstapel – Bergungsfahrzeug muss auf die Strecke`,
  4:c=>`${c}: Barriere beschädigt, Auto blockiert die Strecke – Reparatur nötig`};
/* Bergungszeit: SC-Einsätze dauern rund eine Runde; mehrere Zwischenfälle kurz hintereinander verlängern deutlich */
function hazDur(sev,extra){const base=extra&&extra.dur!=null?extra.dur:sev===4?rand(95,130):sev===3?Math.max(rand(40,52),LAPT*rand(0.75,1)):[0,rand(20,26),rand(26,34)][sev];
  S.hazLog=(S.hazLog||[]).filter(t=>S.t-t<LAPT*1.5);const mult=1+0.6*Math.min(3,S.hazLog.length);S.hazLog.push(S.t);return base*mult;}
function spawnHazard(sev,pos,text,cars,extra){const h0=S.hazard,dur=hazDur(sev,extra);S.lastHazT=S.t;
  if(h0&&h0.nuke&&!(extra&&extra.nuke)){for(const c of cars||[])if(!h0.cars.includes(c))h0.cars.push(c);return;}
  if(h0&&!(extra&&extra.nuke)&&!(extra&&extra.rain)&&!h0.rain){mergeHazard(h0,sev,text,cars,extra,dur);return;}
  S.hazard=Object.assign({sev,pos,sector:pos>=0?sectorOf(pos):-1,text,t:0,handled:false,cleared:false,clearAt:0,clT:0,cars:cars||[],
    deadline:14,counted:false,rep:sev===4},extra||{},{dur});
  S.hazCount++;addLog("INCIDENT – "+text,"flag");if(UI.speed>1)setSpeed(1);}
/* weiterer Zwischenfall während einer laufenden Bergung: zusammenlegen statt überschreiben */
function mergeHazard(h,sev,text,cars,extra,dur){for(const c of cars||[])if(!h.cars.includes(c))h.cars.push(c);
  h.count=(h.count||1)+1;h.text=`${text} – zusätzlich zum laufenden Einsatz (${h.count} Zwischenfälle)`;
  if(extra&&extra.deb)h.deb=true;if(extra&&extra.rep)h.rep=true;
  if(sev>h.sev)h.sev=sev;
  if(h.cleared){h.cleared=false;h.clT=0;h.handled=false;}
  if(h.handled&&respLevel(h)>=h.sev)h.clearAt=Math.max(h.clearAt||0,S.t+dur)+0.35*dur;
  else{if(h.handled){h.handled=false;h.counted=false;h.late=false;h.t=0;h.deadline=14;}h.dur=Math.max(h.dur||0,dur)+0.35*dur;}
  S.hazCount++;addLog("INCIDENT – "+h.text,"flag");if(UI.speed>1)setSpeed(1);}
function crashHazard(c,co,sev){
  const race=S.type==="race",rp=race||Math.random()<0.4;
  const txt=race?HTXT[sev](c.drv.code):`${c.drv.code} steht nach Abflug in ${cnm(co)} – Session muss unterbrochen werden`+(rp?". Barriere beschädigt, Reparatur nötig":"");
  spawnHazard(sev,c.pos,txt,[c],race?{}:{rep:rp,dur:rp?rand(95,130):rand(55,80)});}
function respLevel(h){const m=S.flag.mode;return m==="red"?4:m==="sc"?3:m==="vsc"?2:(h.sector>=0&&S.sec[h.sector]>0?1:0);}
const NEEDTXT={1:"Gelb im betroffenen Sektor",2:"VSC",3:"Safety Car",4:"Rote Flagge"};
function recText(h){return h.sev===1?`Doppelgelb in Sektor ${h.sector+1}`:h.sev===2?"Virtual Safety Car":h.sev===3?"Safety Car":"Rote Flagge";}
function endText(h){const m=S.flag.mode;return m==="red"?"Neustart freigeben":m==="sc"?"„SC in this lap“":m==="vsc"?"VSC beenden":"Sektoren grün schalten";}
function hazardStep(dt){const h=S.hazard;
  if(!h){const w=S.cars.find(c=>!c.removed&&c.retired&&c.crash&&c.crash.done&&!c.pit&&!c.crash.nuke);   // Wrack ohne laufende Bergung: Einsatz auslösen
    if(w){w.orphT=(w.orphT||0)+dt;if(w.orphT>3)spawnHazard(S.type==="race"?2:4,w.pos,`${w.drv.code} steht noch an der Strecke – Marshals müssen das Auto bergen`,[w],{});}return;}if(h.nuke){nukeHazStep(h,dt);return;}const r=respLevel(h),where=h.sector>=0?` in Sektor ${h.sector+1}`:"";
  if(!h.handled){h.t+=dt;
    if(r>=h.sev){h.handled=true;h.clearAt=S.t+(S.flag.mode==="red"?Math.max(h.dur,rand(180,240)):h.dur);if(!h.counted){h.counted=true;W.dec.total++;
        if(r===h.sev||h.rain){const b=Math.round(50*clamp(1-h.t/h.deadline,0,1));W.dec.ok++;score(100+b);addLog(`Korrekte Reaktion der Rennleitung (+${100+b})`,"good");repAdd(1);review("Flagge: "+h.text,true,100+b,"");}
        else if(r===h.sev+1){score(20);addLog("Sicher, aber etwas übertrieben reagiert (+20)","flag");review("Flagge: "+h.text,false,20,NEEDTXT[h.sev]+" hätte gereicht.");}
        else{score(-50);addLog(`Deutliche Überreaktion – ${NEEDTXT[h.sev]} hätte gereicht (−50)`,"bad");repAdd(-2);review("Flagge: "+h.text,false,-50,NEEDTXT[h.sev]+" hätte gereicht.");}}}
    else{const left=Math.ceil(h.deadline-h.t);
      setAlert("danger",`⚠ ${h.text}. EMPFEHLUNG DER STRECKENPOSTEN: ${recText(h)} – du entscheidest. ${left>0?"("+left+"s)":"ÜBERFÄLLIG!"}`);
      if(h.t>=h.deadline&&!h.late){h.late=true;if(!h.counted){h.counted=true;W.dec.total++;}score(-150);addLog("Keine Reaktion der Rennleitung – Fahrer in Gefahr (−150). Die Entscheidung liegt weiter bei dir.","bad");repAdd(-6);review("Flagge: "+h.text,false,-150,"Zu spät reagiert – nötig war: "+NEEDTXT[h.sev]+".");}}
  }else if(!h.cleared){
    if(r<h.sev&&!(S.flag.mode==="sc")){score(-100);addLog("Zu früh freigegeben – Marshals sind noch auf der Strecke! (−100)","bad");h.handled=false;h.late=true;}
    else if(h.rain?(S.wx.rain<0.5&&S.t>=h.clearAt):S.t>=h.clearAt){
      const left=S.cars.filter(c=>!c.removed&&c.retired&&c.crash&&!c.pit&&!h.cars.includes(c));   // „Strecke frei“ nur, wenn wirklich kein Wrack mehr dasteht
      if(left.length){h.cars.push(...left);h.clearAt=S.t+rand(18,28)*left.length;addLog(`Bergung läuft weiter – auch ${left.map(c=>c.drv.code).join(", ")} muss noch weggeräumt werden`,"flag");}
      else{h.cleared=true;h.clT=0;h.cars.forEach(c=>c.removed=true);addLog("TRACK CLEAR","good");}}
    else setAlert("",`${h.rep?"Bergung und Reparatur der Barriere":"Bergung läuft"}${where} – ${h.rain?"warten bis der Regen nachlässt":"noch ca. "+Math.max(0,Math.ceil(h.clearAt-S.t))+"s"}. Empfehlung: aktuelle Maßnahme beibehalten.`);
  }else{h.clT+=dt;
    const back=r===0||(S.flag.mode==="sc"&&(S.restart||(S.sc&&S.sc.inLap)));
    if(back){score(50);S.hazard=null;addLog("Strecke wieder freigegeben","good");setAlert("","Strecke frei.");}
    else{setAlert("clear",`✅ Strecke frei. EMPFEHLUNG: ${endText(h)} – du entscheidest.`);
}}}

/* ---- Strafen & Entscheidungen ---- */
function licPts(c,n){c.lic=(c.lic||0)+n;if(W.career){const k=W.career;k.lic=k.lic||{};k.lic[c.drv.code]=(k.lic[c.drv.code]||0)+n;if(k.roster){k.licLog=k.licLog||[];k.licLog.push({c:c.drv.code,n,abs:curAbs(k)});}}}
function givePen(c,p,why){const n=`CAR ${c.drv.num} (${c.drv.code})`;
  if(p===5)licPts(c,1);else if(p===10)licPts(c,2);else if(p===20||p==="dt"||p==="sg"||p==="dsq")licPts(c,3);else if(p==="grid3")licPts(c,1);
  if(p==="sg"){c.penTot+=30;if(S.type==="race"&&!c.finished&&!S.chequered&&S.laps-Math.floor(c.s/L)>2)c.sgPending=true;else c.penSec+=30;addLog(`STEWARDS: 10 SECOND STOP AND GO PENALTY FOR ${n} – ${why}`,"bad");radio(c,"Stop-and-Go? Das ruiniert unser ganzes Rennen!");return;}
  if(p==="bo"){if(c.dmg){if(c.ignoreDmg){score(50);addLog(`BLACK AND ORANGE FLAG FOR ${n} – beschädigtes Auto muss an die Box (+50)`,"good");}else addLog(`BLACK AND ORANGE FLAG FOR ${n}`,"flag");c.ignoreDmg=false;radio(c,"Verstanden, wir kommen rein und wechseln den Flügel.",true,true);}
    else{score(-30);addLog(`Schwarz-orange Flagge für ${n} ohne Schaden – unbegründet (−30)`,"bad");}return;}
  if(p===5||p===10){c.penSec+=p;c.penTot+=p;addLog(`STEWARDS: ${p} SECOND TIME PENALTY FOR ${n} – ${why}`,"bad");radio(c,pick(["Das ist ein Witz! Was schauen die sich da an?","Copy. Wir nehmen das so hin.","Ernsthaft? Dafür?"]));}
  else if(p===20||p==="dt"){c.penTot+=20;if(S.type==="race"&&!c.finished&&!S.chequered&&S.laps-Math.floor(c.s/L)>2)c.dtPending=true;else c.penSec+=20;
    addLog(`STEWARDS: DRIVE THROUGH PENALTY FOR ${n} – ${why}`,"bad");radio(c,"Durchfahrtsstrafe?! Das kann nicht deren Ernst sein.");}
  else if(p==="warn"){c.warn++;addLog(`BLACK AND WHITE FLAG FOR ${n} – ${why}`,"flag");}
  else if(p==="grid3"){W.drop[c.drv.code]=(W.drop[c.drv.code]||0)+3;c.penTot+=0;c.gridPen=(c.gridPen||0)+3;addLog(`STEWARDS: 3 PLACE GRID PENALTY FOR ${n} – ${why}`,"bad");}
  else if(p==="del"){let b=null;for(const l of c.laps)if(!c.del.has(l.id)&&(!b||l.t<b.t))b=l;if(b){c.del.add(b.id);addLog(`LAP TIME ${fmtLap(b.t*TSCALE)} DELETED – ${n} – ${why}`,"bad");}}
  else if(p==="dsq"){c.dsq=true;addLog(`BLACK FLAG – ${n} DISQUALIFIED – ${why}`,"bad");if(!c.pit&&c.mode!=="garage"&&c.mode!=="grid"){c.mode="in";c.wantPit=true;c.pitGoal="garage";c.finished=S.type==="race";c.finT=1e9;}}
  else if(p==="clear"){c.penSec=0;c.penTot=0;c.dtPending=false;c.strikes=0;c.warn=0;c.dsq=false;c.gridPen=0;delete W.drop[c.drv.code];addLog(`Strafen für ${n} aufgehoben`);}
}
function repAdd(n){const k=W.career;if(!k)return;k.rep=clamp((k.rep==null?60:k.rep)+n,0,100);}
function review(title,ok,pts,explain){W.review=W.review||[];W.review.push({title,ok,pts,explain:explain||"",sess:S.name});}
function undoPen(inc){const a=inc.applied;if(!a)return;const c=a.car;
  if(a.sec){c.penSec=Math.max(0,c.penSec-a.sec);c.penTot=Math.max(0,c.penTot-a.sec);}
  if(a.dt){c.dtPending=false;c.penTot=Math.max(0,c.penTot-20);}
  if(a.strike)c.strikes=Math.max(0,c.strikes-1);
  if(a.lap!=null)c.del.delete(a.lap);
  if(a.grid){W.drop[c.drv.code]=Math.max(0,(W.drop[c.drv.code]||0)-3);c.gridPen=Math.max(0,(c.gridPen||0)-3);}
  if(a.dsq){c.dsq=false;if(c.finT===1e9&&S.type==="race"){c.finished=false;c.retired=true;}}
  if(a.lic)licPts(c,-a.lic);
  inc.applied=null;addLog(`Entscheidung zu „${inc.title}“ aufgehoben`,"flag");}
function fileProtest(inc){if(inc.protested||!["inc","tl","unsafe","jump","yellow","pitline"].includes(inc.kind))return;
  // Einspruch legt nur das Team ein, das durch die Fehlentscheidung benachteiligt wurde – nie das, das davon profitiert
  const gave=inc.applied,c0=inc.cars[0];let car=null;
  if(gave)car=gave.car;                                            // zu Unrecht bestraft
  else if(inc.kind==="inc"){const g=inc.truth.who;if(g)car=inc.cars.find(x=>x!==g)||null;}   // Schuldiger kam davon: das Opfer protestiert
  else if(inc.cars.length>1)car=inc.cars[1];                        // behindertes bzw. unter Gelb überholtes Auto
  else{let bd=1e9;for(const o of S.cars){if(o===c0||o.removed||o.retired||o.drv.team===c0.drv.team)continue;   // direkter Konkurrent dahinter
      const dd=S.type==="race"?c0.s-o.s:Math.abs(o.i-c0.i)+1;if(dd>0&&dd<bd){bd=dd;car=o;}}}
  if(!car)return;inc.protested=true;
  S.protests=S.protests||[];S.protests.push({inc,at:S.t+rand(18,35),team:TEAMS[car.drv.team].name});}
function protestStep(){const P=S.protests;if(!P||!P.length)return;
  for(let i=P.length-1;i>=0;i--){const p=P[i];if(S.t<p.at)continue;P.splice(i,1);const inc=p.inc;
    inc.status="open";inc.protest=p.team;inc.heard=false;
    addLog(`PROTEST von ${p.team} gegen die Entscheidung „${inc.title}“ – neue Prüfung mit Telemetrie`,"bad");uiInbox();uiSession();}}
function decide(inc,val){
  if(inc.status!=="open")return;
  const wasProtest=!!inc.protest;if(wasProtest)undoPen(inc);
  const pen0={sec:inc.cars.map(x=>x.penSec),tot:inc.cars.map(x=>x.penTot),dt:inc.cars.map(x=>x.dtPending),st:inc.cars.map(x=>x.strikes),lic:inc.cars.map(x=>x.lic||0)};
  const c=inc.cars[0];let ok=false,pts=-50,dsqCar=null;
  const isDsq=val==="dsq"||(val&&val.pen==="dsq");
  if(inc.kind==="inc"&&val.pen==="swap"){const A=val.who,B=inc.cars.find(x=>x!==A);
    if(swapOk(A,B)){A.giveBack={to:B,t:0};inc.swapDone=true;
      addLog(`RACE CONTROL: CAR ${A.drv.num} (${A.drv.code}) MUST GIVE THE POSITION BACK TO CAR ${B.drv.num} (${B.drv.code})`,"flag");
      radio(A,`Anweisung der Rennleitung: Gib den Platz an ${B.drv.code} zurück. Lass ihn vorbei, dann greifen wir wieder an.`,true,true);
      if(Math.random()<0.5)radio(A,pick(["Im Ernst? Er hat mich rausgedrückt! … Okay, ich lasse ihn vorbei.","Verstanden. Ich gebe ihn zurück.","Copy. Platz zurück, dann hole ich ihn mir wieder."]));}
    else{addLog(`Platz zurückgeben nicht mehr möglich (${B?B.drv.code:"Gegner"} zu weit weg oder nicht mehr auf der Strecke) – stattdessen Zeitstrafe`,"flag");val={who:A,pen:5};}}
  if(isDsq){dsqCar=val==="dsq"?c:val.who;const t=inc.truth;
    const guilty=inc.kind==="inc"?(t.pen>0&&t.who===dsqCar):inc.kind==="yellow"?true:t==="pen";
    givePen(dsqCar,"dsq",inc.title);pts=guilty?40:-50;ok=false;
    if(guilty)inc.explain=(inc.explain||"")+" Eine Disqualifikation ist dafür deutlich zu hart.";}
  else if(inc.kind==="inc"){const t=inc.truth;
    if(val.pen==="swap"){ok=!!t.swap&&val.who===t.who;pts=ok?100:-50;}
    else if(t.pen===0){ok=val.pen===0;pts=ok?100:-50;}
    else if(val.pen>0&&val.who===t.who){ok=val.pen===t.pen;pts=ok?100:40;
      if(ok&&t.swap&&swapOk(t.who,inc.cars.find(x=>x!==t.who))){pts=60;inc.explain=(inc.explain||"")+" Der Gegner war noch in Reichweite – die Anweisung „Platz zurückgeben“ wäre das mildere Mittel gewesen.";}}
    if(val.pen>0&&val.who)givePen(val.who,val.pen,"Zwischenfall "+inc.cars.map(x=>x.drv.code).join("/"));
    else if(val.pen!=="swap")addLog(`${inc.title.toUpperCase()} – NO FURTHER ACTION`);}
  else if(inc.kind==="yellow"){ok=val===20;pts=ok?100:(val>0?40:-50);if(val>0)givePen(c,val,"Überholen unter Gelb");else addLog(`${inc.title} – NO FURTHER ACTION`);}
  else{ok=val===inc.truth;pts=ok?100:-50;
    if(val==="pen"){
      if(inc.kind==="tl"){ if(inc.sessType!=="race"){if(inc.lapId!=null)c.del.add(inc.lapId);addLog(`CAR ${c.drv.num} (${c.drv.code}) LAP TIME DELETED – TRACK LIMITS`,"bad");}
        else{c.strikes++;if(c.strikes===3)givePen(c,"warn","Track Limits (3. Verstoß)");else if(c.strikes>=4){c.strikes=0;givePen(c,5,"Track Limits");}else{addLog(`TRACK LIMITS NOTED – ${c.drv.code} (${c.strikes})`);radio(c,`Track Limits, das war Nummer ${c.strikes}. Bleib sauber, sonst gibt es eine Strafe.`,true,true);}}}
      else if(inc.kind==="impede")givePen(c,"grid3","Impeding");
      else if(inc.kind==="unsafe")givePen(c,5,"Unsafe Release");
      else if(inc.kind==="pitline")givePen(c,inc.sessType==="race"?5:"warn","Weiße Linie an der Boxenausfahrt überfahren");
      else if(inc.kind==="jump")givePen(c,5,"Frühstart");
      else if(inc.kind==="speed")givePen(c,5,"Speeding in der Boxengasse");
      else if(inc.kind==="delta")givePen(c,5,"VSC-Delta nicht eingehalten");
      else if(inc.kind==="gridpos")givePen(c,5,"Falsche Startposition");
      else if(inc.kind==="serve")givePen(c,10,"Zeitstrafe nicht korrekt abgesessen");
      else if(inc.kind==="ers")givePen(c,"dt","Energielimit pro Runde überschritten");
    }else addLog(`${inc.title} – NO FURTHER ACTION`);}
  // was wurde tatsächlich verhängt (für Protest / Rücknahme)
  {const k=inc.cars.findIndex((x,i)=>x.penSec!==pen0.sec[i]||x.dtPending!==pen0.dt[i]||x.strikes!==pen0.st[i]||x.penTot!==pen0.tot[i]);
    const pv=inc.kind==="inc"?val.pen>0:inc.kind==="yellow"?val>0:val==="pen";
    if(pv){const car=k>=0?inc.cars[k]:c,i2=inc.cars.indexOf(car);
      inc.applied={car,sec:Math.max(0,car.penSec-pen0.sec[i2]),dt:car.dtPending&&!pen0.dt[i2],strike:car.strikes>pen0.st[i2],lap:inc.kind==="tl"&&inc.sessType!=="race"?inc.lapId:null,grid:inc.kind==="impede",lic:(car.lic||0)-pen0.lic[i2]};}
    else inc.applied=null;
    if(dsqCar)inc.applied={car:dsqCar,dsq:true,sec:0,lic:3};}
  if(wasProtest){pts=ok?60:-40;inc.protest=null;addLog(ok?"Protest geprüft – Entscheidung jetzt korrekt (+60)":"Protest geprüft – Entscheidung weiterhin falsch (−40)",ok?"good":"bad");repAdd(ok?2:-4);}
  else{W.dec.total++;if(ok)W.dec.ok++;repAdd(ok?1:pts>0?0:-3);
    if(!ok&&pts<=0&&Math.random()<0.65)fileProtest(inc);}
  consTrack(inc,val);score(pts);review(inc.title,ok,pts,inc.explain);
  inc.status="done";inc.ok=ok;inc.pts=pts;addDoc(inc,val);uiInbox();uiSession();}
function swapOk(A,B){return !!(A&&B&&S.type==="race"&&S.phase==="racing"&&!S.chequered&&S.flag.mode==="green"&&[A,B].every(x=>x.mode==="race"&&!x.pit&&!x.wantPit&&!x.removed&&!x.retired&&!x.finished&&!x.crash&&!x.dsq)&&delta(A,B)<0&&delta(A,B)>-450);}
function decText(inc,val){const n=x=>x&&x.drv?x.drv.code:"";
  if(val==="dsq"||(val&&val.pen==="dsq"))return "Disqualifikation "+n(val==="dsq"?inc.cars[0]:val.who);
  if(val&&typeof val==="object"){if(val.pen==="swap")return `Anweisung: ${n(val.who)} gibt den Platz zurück`;if(!val.pen)return "No further action";return `${val.pen===20?"Durchfahrtsstrafe":val.pen+" Sekunden"} für ${n(val.who)}`;}
  if(val==="ok"||val===0)return "No further action";if(val==="pen")return "Strafe laut Reglement für "+n(inc.cars[0]);if(val==="warn")return "Verwarnung für "+n(inc.cars[0]);
  return (typeof val==="number"?(val===20?"Durchfahrtsstrafe":val+" Sekunden"):String(val))+" für "+n(inc.cars[0]);}
function addDoc(inc,val){W.docs=W.docs||[];W.docs.push({no:W.docs.length+1,sess:S.name,lap:S.type==="race"?clamp(Math.floor((S.leader?S.leader.s:0)/L)+1,1,S.laps):null,title:inc.title,cars:inc.cars.map(c=>c.drv.num+" "+c.drv.name).join(", "),dec:decText(inc,val),why:inc.explain||"",ok:inc.ok,pts:inc.pts});}
function classification(){
  const fin=S.cars.filter(c=>c.finished&&!c.dsq).sort((a,b)=>(b.finLaps-a.finLaps)||((a.finT+a.penSec)-(b.finT+b.penSec)));
  const out=S.cars.filter(c=>!c.finished&&!c.dsq).sort((a,b)=>b.s-a.s);
  return fin.concat(out,S.cars.filter(c=>c.dsq));}
const SPR_TAB=[8,7,6,5,4,3,2,1];
function finishRace(){W.results=classification();
  if(S.sprint){const k=W.career;if(k){k.tpoints=k.tpoints||{};W.results.filter(c=>c.finished&&!c.dsq).slice(0,8).forEach((c,i)=>{k.points[c.drv.code]=(k.points[c.drv.code]||0)+SPR_TAB[i];k.tpoints[c.drv.team]=(k.tpoints[c.drv.team]||0)+SPR_TAB[i];});k.score=W.score;k.dec={ok:W.dec.ok,total:W.dec.total};}
    uiSprintResults();return;}
  scrutiny(()=>{awardPoints();uiResults();});}
function hearingInfo(inc){const A=inc.cars[0],B=inc.cars[1],a=A.drv.code,b=B?B.drv.code:"";let s=[],tel="";
  const S_={lunge:[[a,"Ich war innen daneben, er hat mir einfach die Tür zugemacht."],[b,"Er kam von viel zu weit hinten und hat mich umgedreht. Ich konnte nichts machen."],`Telemetrie ${a}: Bremspunkt 18 m später als in den drei Runden zuvor, Vorderrad blockiert. ${b} lenkt wie gewohnt ein.`],
    racing:[[a,"Hartes Racing. Wir haben uns kaum berührt."],[b,"Er hat mir genug Platz gelassen. Aus meiner Sicht in Ordnung."],"Telemetrie: Beide Autos bleiben auf der Strecke, Zeitverlust unter 0,2 s, Lenkwinkel unauffällig."],
    squeeze:[[a,"Er hat mich am Ausgang einfach rausgedrückt. Ich war komplett daneben!"],[b,"Das ist meine Linie. Er muss zurückstecken."],`Telemetrie: ${b} öffnet die Lenkung am Kurvenausgang nicht. ${a} war am Scheitel mit der Vorderachse neben ${b} und landet mit allen vier Rädern neben der Strecke.`],
    dive:[[a,"Vorderräder haben blockiert, ich konnte nicht enger fahren."],[b,"Er rutscht geradeaus und schiebt mich von der Strecke."],`Telemetrie: ${a} bremst 18 m später, Vorderräder blockieren. ${b} muss mit allen vier Rädern über die Linie ausweichen.`],
    diveOk:[[a,"Ich habe mich verbremst, aber er hatte noch Platz."],[b,"Er hat mich rausgetragen!"],`Telemetrie/Onboard: ${b} bleibt mit mindestens einem Rad auf der weißen Linie.`],
    squeezeOk:[[a,"Er hat mich rausgedrückt!"],[b,"Ich habe ihm eine Wagenbreite gelassen."],`Telemetrie: ${a} bleibt mit mindestens zwei Rädern auf der Strecke, etwa 0,4 m Abstand zur weißen Linie.`],
    offpass:[[a,"Ich hatte keinen Platz mehr und musste raus. Ich war sowieso schon vorbei."],[b,"Er hat neben der Strecke überholt und ist einfach vorne geblieben."],`Telemetrie: ${a} verlässt die Strecke mit allen vier Rädern, Gaspedal bleibt bei 100 %. Die Position wird danach nicht zurückgegeben.`],
    rear:[[a,"Er hat viel früher gebremst als sonst. Ich konnte nicht mehr reagieren."],[b,"Ich bremse ganz normal und bekomme einen Schlag ins Heck."],`Telemetrie ${a}: Bremspunkt 22 m später als ${b}, Vorderräder blockieren, Aufprallgeschwindigkeit deutlich höher. ${b} bremst am gewohnten Punkt.`],
    offIn:[[a,"Ich war noch auf dem Kerb, nicht neben der Strecke."],[b,"Für mich sah das nach außerhalb aus."],`Telemetrie/Onboard: ${a} bleibt mit mindestens einem Rad auf der weißen Linie – die Strecke wurde nicht verlassen.`],
    offOk:[[a,"Ich bin weit gegangen, habe aber sofort wieder Platz gemacht."],[b,"Er hat mich wieder vorbeigelassen."],`Telemetrie: ${a} verlässt die Strecke, lupft danach und lässt ${b} wieder vorbei – kein bleibender Vorteil.`]};
  if(inc.kind==="inc"&&S_[inc.sub]){const x=S_[inc.sub];s=[x[0],x[1]];tel=x[2];}
  else if(inc.kind==="tl"){s=[[a,"Ich war noch auf dem Kerb, das war drin."]];tel=inc.truth==="pen"?"Onboard-Auswertung: Kein Rad berührt mehr die weiße Linie.":"Onboard-Auswertung: Das innere Hinterrad steht noch auf der weißen Linie.";}
  else if(inc.kind==="unsafe"){s=[[a,"Die Ampel war grün, ich fahre los, wenn das Team es sagt."],[b,"Ich musste voll in die Eisen."]];tel=inc.truth==="pen"?`Telemetrie ${b}: Bremsdruck 100 %, Verzögerung um über 30 km/h in der Fast Lane.`:`Telemetrie ${b}: keine Bremsung, Geschwindigkeit konstant am Limiter.`;}
  else if(inc.kind==="yellow"){s=[[a,"Ich habe die Flaggen nicht gesehen."]];tel="Marshal-System: Gelbes Lichtsignal war im Cockpit aktiv, Überholvorgang im markierten Sektor.";}
  else{s=[[a,"Ich habe nichts falsch gemacht."]];tel="";}
  return {s,tel};}
function liveState(){
  if(!S||S.ended||S.hazard||S.flag.mode!=="green")return null;
  const wx=S.wx,wxs={cells:wx.cells.map(c=>({x:c.x,y:c.y,r:c.r,int:c.int})),wind:wx.wind,spd:wx.spd,wet:wx.wet,amp:wx.amp,ph:wx.ph};
  if(S.type!=="race"){if(!S.started||S.chequered)return null;
    return {kind:"timed",clock:S.clock,bestT:S.bestT,wx:wxs,cars:S.cars.map(c=>({code:c.drv.code,laps:c.laps,del:[...c.del],lapId:c.lapId,runs:c.runs,gridPen:c.gridPen||0,dsq:c.dsq,retired:c.retired,lic:c.lic||0}))};}
  if(S.phase!=="racing"||S.chequered||S.raceT-S.goT<20||S.cars.some(c=>c.script||c.crash&&!c.removed&&!c.crash.done))return null;
  return {kind:"race",raceT:S.raceT,laps:S.laps,om:S.om,wetRace:S.wetRace,wx:wxs,cars:S.cars.map(c=>({code:c.drv.code,s:c.s,tyre:c.tyre,wear:c.wear,stops:c.stops+(c.pit&&c.pit.ph==="svc"?1:0),used:[...c.used],plan:c.plan,
    penSec:c.penSec,penTot:c.penTot,strikes:c.strikes,warn:c.warn,dt:c.dtPending,sg:!!c.sgPending,dmg:c.dmg,ret:c.retired||c.removed,dsq:c.dsq,lic:c.lic||0,form:c.form||0,lastStop:c.lastStop||0}))};}
function applyLive(L_){if(!L_)return;const by=code=>S.cars.find(c=>c.drv.code===code);
  Object.assign(S.wx,L_.wx);S.wx.rain=0;S.wx.eta=Infinity;
  if(L_.kind==="timed"){S.clock=L_.clock;S.bestT=L_.bestT;S.started=true;S.pitExitOpen=true;
    for(const o of L_.cars){const c=by(o.code);if(!c)continue;c.laps=o.laps;c.del=new Set(o.del);c.lapId=o.lapId;c.runs=o.runs;c.gridPen=o.gridPen;c.dsq=o.dsq;c.lic=o.lic;
      if(o.retired){c.retired=true;c.nextOut=Infinity;}else c.nextOut=S.dur-S.clock+rand(2,25);}
    addLog("Spielstand geladen – Session läuft weiter, alle Autos starten aus der Garage","flag");}
  else{S.phase="racing";S.started=true;S.raceT=L_.raceT;S.goT=L_.raceT-90;S.laps=L_.laps;S.om=L_.om;S.wetRace=L_.wetRace;S.lights=0;
    for(const o of L_.cars){const c=by(o.code);if(!c)continue;c.s=o.s;c.pos=mod(c.s);c.lat=0;c.v=T.prof[sidx(c.pos)]*0.8;c.mode="race";c.inPit=false;c.pit=null;c.onGrid=false;c.stopAt=null;
      c.tyre=o.tyre;c.wear=o.wear;c.stops=o.stops;c.used=new Set(o.used);c.plan=o.plan||[];c.penSec=o.penSec;c.penTot=o.penTot;c.strikes=o.strikes;c.warn=o.warn;c.dtPending=o.dt;c.sgPending=o.sg;
      c.dmg=o.dmg;c.dsq=o.dsq;c.lic=o.lic;c.form=o.form;c.lastStop=o.lastStop;c.react=0;c.holdT=0;c.decLap=Math.floor(c.s/L);
      if(o.ret){c.retired=true;c.removed=true;}}
    addLog("Spielstand geladen – Rennen läuft weiter","flag");}
  uiSession();uiFlags();}
function closeSession(){
  if(S.type==="q"){const ord=timedOrder().map(c=>c.drv);
    W.qOut=S.n<3?S.cars.filter(c=>c.retired&&!c.noStart).map(c=>c.drv.code):[];
    if(S.n<3){W.q=ord.slice(0,S.cut);W.gridTail=ord.slice(S.cut).concat(W.gridTail);}
    else{let g=ord.concat(W.gridTail);
      g=g.map((d,i)=>{const pd=W.defs[W.idx].sprint?0:((W.puDrop||{})[d.code]||0);return {d,k:i+(W.drop[d.code]||0)+pd+(W.drop[d.code]||pd?0.5:0)};}).sort((a,b)=>a.k-b.k).map(x=>x.d);
      if(W.defs[W.idx].sprint){W.sgrid=g;W.q=DRIVERS.slice();W.gridTail=[];W.drop={};}else W.grid=g;}}
  if(S.type==="race"){
    for(const i of S.incidents)if(i.status==="open"){i.status="deferred";}
    if(S.incidents.some(i=>i.status==="deferred")){uiHearing();return;}
    finishRace();return;}
  nextSession();}
