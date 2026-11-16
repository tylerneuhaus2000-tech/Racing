"use strict";
/* ============ Aufzeichnung, Vorfälle, Skripte, Safety Car ============ */
let REC=[],recBase=0;
function recFrame(){const n=S.cars.length,a=new Float32Array(n*5),e=new Uint8Array(n*5);
  for(let i=0;i<n;i++){const c=S.cars[i],o=i*5;a[o]=c.s;a[o+1]=c.lat;a[o+2]=c.spin+SIDE*(c.yaw+(c.drift||0));a[o+3]=c.v;
    let cw=0;if(c.pit&&c.pit.ph==="svc"&&c.pit.T0!=null){const p=c.pit,el=S.t-p.T0;a[o+3]=-(el+0.001);
      if(el<p.wait)cw=2048;else if(el<p.wait+p.work){cw=4096|(Math.round(clamp((el-p.wait)/p.work,0,1)*63)<<14);}else if(el<p.wait+p.work+p.rep){cw=8192|(Math.round(clamp((el-p.wait-p.work)/p.rep,0,1)*63)<<14);}}   // Phase plus Fortschritt 0–63   // Standzeit und Phase der Boxencrew
    {const acc=(c.v-(c._pv==null?c.v:c._pv))/DT;c._pv=c.v;const pf=T.prof[sidx(c.pos)]||1;let th=c.brk?0:c.v>=pf*0.96?1:clamp(0.15+acc/22,0,1);if(c.pit)th=Math.min(th,0.35);
      e[i*5]=Math.round(clamp(c.soc==null?0.85:c.soc,0,1)*255);e[i*5+1]=Math.round(th*255);e[i*5+2]=c.clip?2:c.brk||c.wantSave?1:c.omOn?3:0;{const dpv=(c.dp||0)|(c.punct?DP.tyre:0);e[i*5+3]=dpv&255;e[i*5+4]=(dpv>>8)&255;}}
    a[o+4]=(c.removed?0:1)|(c.omOn?2:0)|(c.brk?4:0)|(c.sparks>0?8:0)|(c.crash?16:0)|(c.blueT>0?32:0)|(c.lockT>0?64:0)|(c.pit&&(c.pit.ph==="svc"||c.pit.ph==="hold")?128:0)|(c.relT>0?256:0)|(c.dustT>0?512:0)|(c.dmg?1024:0)|cw|(c.aquaT>0?1<<20:0)|(c.fire&&c.fire.t<c.fire.T?1<<21:0)|(c.punct?((c.punctW==null?(c.punctW=irand(2,3)):c.punctW)&3)<<22:0);if(c.fire&&c.fire.t<c.fire.T)c.fire.t+=DT;}
  REC.push({a,e,db:debrisRec(),fm:S.flag.mode,sec:S.sec.slice(),li:S.lights,wet:S.wx.wet,rain:S.wx.rain,sc:S.sc&&S.sc.on?[S.sc.s,S.sc.lat]:S.rsSC?[S.rsSC.s,0]:null,px:(S.type!=="race"?!S.pitExitOpen:S.flag.mode==="red")?1:0,
    nk:S.nuke?S.nuke.rec:null,hz:S.hazard&&!S.hazard.cleared&&S.hazard.pos>=0?[S.hazard.pos,S.hazard.deb?1:0,S.hazard.handled?1:0,S.hazard.cars&&S.hazard.cars[0]?S.hazard.cars[0].lat:0]:null,t:S.t});
  if(REC.length>2400){REC.splice(0,300);recBase+=300;}
  S.step++;}
function sessTag(){return S.type==="race"?"R"+clamp(Math.floor((S.leader?S.leader.s:0)/L)+1,1,S.laps):S.name;}
function registerInc(o){
  const inc=Object.assign({id:++W.incId,status:"rec",at:S.step,from:S.step-Math.round((o.pre||5)/DT),to:S.step+Math.round((o.post||3.5)/DT),
    tag:sessTag(),roster:S.cars,sessType:S.type,hold:false},o);
  S.incidents.push(inc);return inc;}
function finalizeIncs(force){
  for(const inc of S.incidents){ if(inc.status!=="rec"||(!force&&(inc.hold||S.step<inc.to)))continue;
    const a=Math.max(inc.from,recBase),b=Math.min(inc.to,recBase+REC.length-1);
    inc.clip=REC.slice(a-recBase,b-recBase+1);inc.atIdx=clamp(inc.at-a,0,Math.max(0,inc.clip.length-1));
    if(inc.kind==="info")inc.status="info";
    else if((inc.kind==="tl"||(inc.kind==="inc"&&!/^Kollision/.test(inc.title)))&&!inc.lapId&&S.type==="race"&&Math.random()<0.22){   // niemand meldet es: du musst es selbst sehen
      inc.status="hidden";inc.hideAt=S.t;const guilty=inc.kind==="tl"?inc.truth==="pen":inc.truth.pen>0,who=inc.cars[inc.cars.length-1],c0=inc.cars[0];
      if(inc.kind==="inc")radio(who===inc.truth.who?c0:who,pick(["Habt ihr das gesehen? Schaut euch das bitte an!","Das war nicht in Ordnung. Meldet das der Rennleitung.","Wieso sagt da keiner was?"]),false,true);
      else if(guilty||Math.random()<0.5){const o=S.cars.find(x=>x!==c0&&x.mode==="race"&&!x.removed&&delta(x,c0)>0&&delta(x,c0)<200);if(o)radio(o,`${c0.drv.code} fährt da neben der Strecke. Schaut ihr euch das an?`,false,true);}}
    else{inc.status="open";if(typeof sndEvent==="function")sndEvent("inc");addLog(`INCIDENT NOTED – ${inc.title} – UNDER INVESTIGATION`,"flag");}
    uiInbox();}}
function hiddenStep(){for(const inc of S.incidents){if(inc.status!=="hidden"||S.t-inc.hideAt<90)continue;
    const guilty=inc.kind==="tl"?inc.truth==="pen":(inc.truth.pen>0);
    if(!guilty){inc.status="info";continue;}
    inc.status="done";inc.ok=false;inc.pts=-40;inc.missed=true;W.dec.total++;score(-40);repAdd(-1);
    addLog(`Übersehen: ${inc.title} – niemand hat den Vorfall gemeldet (−40). Replay in der Liste.`,"bad");review("Übersehen: "+inc.title,false,-40,inc.explain);uiInbox();}}
function investigate(c){const inc=S.incidents.find(i=>i.status==="hidden"&&i.cars.includes(c));
  if(!inc){score(-5);addLog(`Untersuchung ${c.drv.code}: kein unentdeckter Vorfall (−5)`);return;}
  inc.status="open";inc.found=true;score(30);addLog(`Selbst entdeckt (+30): ${inc.title} – UNDER INVESTIGATION`,"good");uiInbox();}
const cn=pos=>cornerNear(pos).n;
function reportTL(c,w){
  registerInc({kind:"tl",title:`Track Limits · ${c.drv.code} · ${cnm(w.co)}`,cars:[c],pos:c.pos,truth:w.viol?"pen":"ok",
    lapId:c.mode==="push"?c.lapId:null,pre:3.5,post:1.5,
    data:w.gain?"Auto kürzt durch die Auslaufzone ab und kommt vor der Schikane-Ausfahrt zurück – Zeitgewinn laut Sektordaten.":w.inside?"Innenseite: Auto fährt über den Randstein am Scheitelpunkt.":null,
    explain:w.gain?"Abkürzung mit dauerhaftem Vorteil – Strafe bzw. Rundenzeit gestrichen.":w.viol?"Alle vier Räder waren hinter der weißen Linie – Verstoß.":"Mindestens ein Rad war noch auf der weißen Linie – legal."});}
function reportPitLine(c,viol){
  registerInc({kind:"pitline",title:`Boxenausfahrt · ${c.drv.code} · weiße Linie`,cars:[c],pos:mod(PIT_EXIT_S-30),truth:viol?"pen":"ok",pre:5,post:2,
    explain:viol?"Das Auto überfährt die weiße Linie an der Boxenausfahrt, bevor sie endet – Verstoß.":"Das Auto bleibt bis zum Ende links der weißen Linie – kein Verstoß."});}
function reportSpeed(c,kmh){
  registerInc({kind:"speed",title:`Boxengasse Speed · ${c.drv.code}`,cars:[c],pos:c.pos,truth:"pen",pre:3,post:3,
    data:`Messung am Speed-Trap: ${kmh.toFixed(1)} km/h (Limit 80,0 km/h)`,explain:`${kmh.toFixed(1)} km/h liegt über dem Limit – Strafe.`});}
function reportUnsafe(c,u,unsafe){
  registerInc({kind:"unsafe",title:`Boxen-Release · ${c.drv.code} / ${u.drv.code}`,cars:[c,u],pos:c.pos,truth:unsafe?"pen":"ok",pre:4,post:3.5,
    explain:unsafe?`${u.drv.code} war direkt dahinter und musste bremsen – Unsafe Release.`:`${u.drv.code} war weit genug weg und musste nicht reagieren – sauber.`});}
function onPass(c,o){
  if(S.type==="race"&&S.phase==="racing"&&S.flag.mode==="green"&&o.v>20&&Math.random()<0.3)radio(o,pick(["Er ist vorbei. Auf der Geraden hatte ich keine Chance.","Hartes Manöver, aber fair.","Ich verliere zu viel Zeit am Kurvenausgang."]));
  if(S.type==="race"&&S.flag.mode==="green"&&S.sec[sectorOf(c.pos)]>0&&o.v>20){c.rogue=false;
    registerInc({kind:"yellow",title:`Überholen unter Gelb · ${c.drv.code} / ${o.drv.code}`,cars:[c,o],pos:c.pos,truth:20,pre:5,post:2.5,
      explain:"Überholen im gelben Sektor ist ein Sicherheitsverstoß – Durchfahrtsstrafe."});}}
function reportServe(c,pen,touch){const bad=touch<pen;
  registerInc({kind:"serve",title:`Strafe absitzen · ${c.drv.code} · ${pen} s`,cars:[c],pos:c.pos,truth:bad?"pen":"ok",pre:2.5,post:touch+5,
    data:`${pen} Sekunden Strafe: Die Crew darf das Auto erst berühren, wenn die Standuhr ${pen}.0 s zeigt. Im Replay Bild für Bild prüfen, bei welcher Zeit der erste Mechaniker ans Auto geht.`,
    explain:bad?`Die Crew geht schon nach ${touch.toFixed(1)} s ans Auto – ${(pen-touch).toFixed(1)} s zu früh. Strafe nicht korrekt abgesessen.`:`Die Crew wartet ${touch.toFixed(1)} s und arbeitet erst dann – korrekt abgesessen.`});}
function armMech(){const cand=S.cars.filter(c=>!c.removed&&(c.mode==="race"||c.mode==="push")&&!c.pit&&!c.script&&!c.busy&&!c.crash&&!c.finished&&c.pos>PIT_EXIT_S+80&&c.pos<PIT_ENTRY_S-120);
  if(!cand.length||S.hazard)return false;const car=pick(cand),race=S.type==="race",side=car.lat>=0?1:-1,edge=Math.random()<0.45;
  car.crash={dir:side,rest:side*(edge?13.5:22),h0:T.ang[sidx(car.pos)],v0:Math.max(30,car.v),sv0:0,grav:60,done:false,mech:true};car.retired=true;car.ot=null;
  const co=cornerNear(car.pos);
  spawnHazard(race?(edge?2:1):4,car.pos,race?(edge?`${car.drv.code} steht mit Defekt am Streckenrand – Marshals müssen auf die Strecke`:`${car.drv.code} rollt mit Defekt aus und parkt in der Auslaufzone`):`${car.drv.code} bleibt mit Defekt bei ${cnm(co)} stehen – Session muss unterbrochen werden`,[car],race?{}:{dur:rand(45,65)});
  registerInc({kind:"info",title:`Defekt · ${car.drv.code} · ${cnm(co)}`,cars:[car],pos:car.pos,pre:3,post:5});
  radio(car,pick(["Kein Antrieb! Der Motor ist weg.","Getriebe hängt fest. Ich muss abstellen.","Leistung weg, Leistung weg!"]),false,true);return true;}
function armPuncture(){const cand=S.cars.filter(c=>!c.removed&&c.mode==="race"&&!c.pit&&!c.crash&&!c.finished&&!c.punct&&!c.wantPit);
  if(!cand.length)return false;const car=pick(cand);puncture(car,null,false);car.ot=null;
  addLog(`CAR ${car.drv.num} (${car.drv.code}) – Reifenschaden, fährt langsam zur Box`);radio(car,"Reifenschaden! Ich habe einen Platten, ich komme rein.",false,true);return true;}
function omActive(){return S.om&&S.type==="race"&&S.phase==="racing"&&S.flag.mode==="green";}

/* ---- Solo-Fehler ---- */
function spinBeached(c){const co=c.spinCo||nextCorner(c.pos).c;c.retired=true;c.v=0;
  c.crash={dir:Math.sign(c.lat)||1,rest:c.lat,h0:T.ang[sidx(c.pos)],v0:1,sv0:0,grav:105,done:true};
  addLog(`CAR ${c.drv.num} (${c.drv.code}) steckt im Kiesbett fest`,"bad");radio(c,pick(["Ich stecke fest. Kommt nicht mehr raus.","Im Kies eingegraben. Das war's."]));
  if(!S.hazard)crashHazard(c,co,S.type==="race"?(Math.random()<0.5?2:1):4);}
function spinCar(c,rot,side,kind){c.spinKind=kind||null;c.spinHit=false;c.spinOut=kind==="off"||kind==="beach"?rand(23.5,25.5):kind==="tap"?27:19.5;const rr=Math.random(),tot=(rr<0.22?rand(1.3,1.9):rr<0.5?rand(2.6,3.6):rr<0.68?rand(4.2,5):rr<0.9?rand(5.8,6.8):rand(7.6,9.6))*(c.v>110?1.15:1);   // 75°…550°, nicht immer 180/360
  const res=((tot+Math.PI)%(2*Math.PI))-Math.PI,half=false,Td=clamp(c.v/85,0.8,1.8)*(0.6+tot/9);c.spinTot=tot;c.spinRes=Math.abs(res)>0.25?res:0;c.spinTurn=0.8+Math.abs(res)*0.55;   // rot: Drehsinn auf dem Bildschirm (+ = Nase zur +lat·SIDE-Seite)
  c.spinTd=Td;c.spinHalf=half;c.spinT=c.spinT0=Td+0.5+(c.spinRes?c.spinTurn:0)+0.3;c.spinDir=rot||1;c.spinSide=side||(c.lat>=0?1:-1);c.spinH0=T.ang[sidx(c.pos)];c.ot=null;c.wide=null;c.lockT=0.6;c.giveBack=null;c.wob=null;}
function soloEvent(c,co){const k=c.soloArm;c.soloArm=null;c.ot=null;
  if(co.ro==="wall"&&!k.crash&&k.kind!=="save"&&Math.random()<0.55)k.crash=true;else if(co.ro==="asphalt"&&k.crash&&Math.random()<0.5){k.crash=false;k.kind=null;}else if(co.ro==="gravel"&&!k.crash&&k.kind!=="save"&&Math.random()<0.4)k.kind="beach";
  if(k.crash){const race=S.type==="race";let sev=4;
    if(race){const r=Math.random();sev=r<0.3?1:r<0.5?2:r<0.88?3:4;}
    const wall=co.ro==="wall",ang=wall?rand(0.18,0.75):rand(0.2,0.55),spinSg=Math.random()<0.7?co.dir*SIDE:-co.dir*SIDE;
    c.crash={dir:-co.dir,rest:-co.dir*(sev===2?19.5:(sev===4&&race)?9:wall?rand(19.5,21.5):27.5),h0:T.ang[sidx(c.pos)]-SIDE*co.dir*ang,v0:Math.max(30,c.v),
      sv0:rand(0.4,5.5)*spinSg,grav:co.ro==="gravel"?rand(70,110):co.ro==="asphalt"?rand(22,40):rand(10,25),done:false,wall};c.retired=true;
    const hard=co.ro==="wall"&&c.crash.v0>(TRACK.key==="madrid"?50:95);
    if(hard&&Math.random()<(TRACK.key==="madrid"?0.06:0.025)){c.fire={t:0,T:rand(35,60)};sev=race?4:sev;
      radio(c,pick(["FEUER! Das Auto brennt, ich steige aus!","Ich rieche Rauch – es brennt hinten!"]),true,true);
      addLog(`FIRE – CAR ${c.drv.num} (${c.drv.code}) brennt nach Einschlag in ${cnm(co)}`,"bad");}
    crashHazard(c,co,sev);if(c.fire&&S.hazard){S.hazard.text=`${c.drv.code} brennt nach heftigem Mauereinschlag in ${cnm(co)} – Feuerwehr und Marshals müssen auf die Strecke`;S.hazard.dur=(S.hazard.dur||30)+40;}
    registerInc({kind:"info",title:`Abflug · ${c.drv.code} · ${cnm(co)}`,cars:[c],pos:c.pos,pre:4,post:4});
    radio(c,pick(["Ich bin raus. Sorry Jungs.","Heck weg, keine Chance.","Bin okay. Auto ist hin."]));
  }else if(k.kind==="save"){c.wob={t:0,T:1.2,amp:0.5*co.dir*SIDE};c.lockT=0.5;c.v*=0.9;radio(c,pick(["Wow, fast verloren! Heck kam plötzlich.","Großer Rutscher. Reifen sind am Ende.","Das war knapp."]));
  }else{c.spinCo=co;spinCar(c,co.dir*SIDE,-co.dir,k.kind);
    registerInc({kind:"info",title:`Dreher · ${c.drv.code} · ${cnm(co)}`,cars:[c],pos:c.pos,pre:4,post:4});
    addLog(`CAR ${c.drv.num} (${c.drv.code}) SPUN AT ${cnm(co).toUpperCase()} – CONTINUED`);}}

/* ---- Zweikampf-Skripte ---- */
const freeCar=c=>!c.removed&&c.mode==="race"&&!c.pit&&!c.script&&!c.busy&&!c.crash&&c.spinT<=0&&!c.wide&&!c.finished&&!c.wantPit;
/* Rivalitäten: bleiben über die Saison bestehen */
function rivMap(){if(W.career)return W.career.riv=W.career.riv||{};return W.riv=W.riv||{};}
const rivKey=(a,b)=>[a.drv.code,b.drv.code].sort().join("-");
function armBattle(rel){const cand=[];
  for(const A of S.cars){if(!freeCar(A))continue;
    for(const B of S.cars){if(B===A||!freeCar(B))continue;const d=delta(A,B);
      if(d>CAR_L+1&&d<CAR_L+(rel?55:26)&&Math.abs(A.lat-B.lat)<(rel?11:6)&&Math.abs(A.s-B.s)<L*0.5&&!(A.blueT>0)&&!(B.blueT>0)){const nc=nextCorner(B.pos,70,true);
        if(nc&&nc.d<280&&nc.c.s>PIT_EXIT_S+80&&nc.c.s<PIT_ENTRY_S-100)cand.push([A,B,nc.c]);}}}
  if(!cand.length)return false;
  const riv=rivMap(),wOf=x=>0.25+aggOf(x[0])*aggOf(x[0])*1.6+(riv[rivKey(x[0],x[1])]?2.5:0);   // aggressive Fahrer und Rivalen geraten öfter aneinander
  let tot=0;for(const x of cand)tot+=wOf(x);let rr=Math.random()*tot,ch=cand[0];for(const x of cand){rr-=wOf(x);if(rr<=0){ch=x;break;}}
  const [A,B,co]=ch,r=clamp(Math.random()+(0.55-aggOf(A))*0.35,0,0.999);
  A.script={type:battleType(A),B,co,ph:0,t:0,pt:0,
    give:Math.random()<0.45,edge:Math.random()<0.55?14.6:12.5,edge2:TL_OFF+(Math.random()<0.6?rand(-0.8,0.9):rand(-2.2,2.6)),inc:null,maxOff:0};
  B.busy=A;A.ot=null;B.ot=null;return true;}
function endScript(A){const sc=A.script;if(!sc)return;
  if(sc.inc&&sc.inc.hold)finishOff(A,delta(A,sc.B)<-3&&sc.maxOff>TL_OFF);
  for(const x of [A,sc.B]){x.sLat=null;x.sFree=false;x.sSpd=1;x.sRate=0;x.ram=false;x.busy=null;}
  A.script=null;A.otCool=3;sc.B.otCool=2;}
function finishOff(A,adv){const sc=A.script,inc=sc.inc,B=sc.B;
  inc.truth=adv?{who:A,pen:5,swap:true}:{who:null,pen:0};inc.sub=adv?"offpass":"offOk";
  inc.explain=adv?`${A.drv.code} hat neben der Strecke überholt und den Platz behalten. Richtig: Anweisung „Platz zurückgeben“ – ist ${B.drv.code} dafür schon zu weit weg, 5 Sekunden.`
    :sc.maxOff<=TL_OFF?`${A.drv.code} bleibt mit mindestens einem Rad auf der weißen Linie – das Manöver war auf der Strecke, keine Strafe.`:`${A.drv.code} hat keinen bleibenden Vorteil (Platz zurückgegeben bzw. nicht vorbei) – keine Strafe.`;
  if(!adv&&sc.maxOff<=TL_OFF)inc.sub="offIn";
  inc.hold=false;inc.to=S.step+Math.round(1.5/DT);}
function collide(A,B,co){
  // Was passiert, ergibt sich aus der Geometrie im Moment der Berührung: Treffer ins Heck oder in die Seite
  const race=S.type==="race",d=delta(A,B),rear=d>CAR_L*0.7,r=Math.random(),sd=rear?-co.dir:(Math.sign(B.lat-A.lat)||(-co.dir));
  const rot=rear?co.dir*SIDE:-sd*SIDE;   // Heck wird weggedrückt: in die Kurve bzw. Nase zum Verursacher
  const canOut=race&&!S.hazard&&S.hazCount<(W.real?4:2),fo=S.dbgOut;
  const out=fo?fo==="out":canOut&&r<0.28,light=fo?fo==="light":!out&&r>0.75,idx=sidx(B.pos);
  const what=out?"der sofort abfliegt, in die Barriere einschlägt und ausfällt":light?"der quer kommt, das Auto abfängt und beschädigt weiterfährt":"der sich sofort dreht";
  registerInc({kind:"inc",title:`Kollision · ${A.drv.code} / ${B.drv.code} · ${cnm(co)}`,cars:[A,B],pos:B.pos,truth:{who:A,pen:10},sub:rear?"rear":"lunge",pre:5,post:out?4:3,
    explain:rear?`${A.drv.code} verpasst den Bremspunkt und fährt ${B.drv.code} ins Heck, ${what} – klar verschuldete Kollision, 10 Sekunden.`
      :`${A.drv.code} sticht mit blockierenden Rädern innen rein und trifft ${B.drv.code} in die Seite, ${what} – klar verschuldete Kollision, 10 Sekunden.`});
  if(typeof sndEvent==="function")sndEvent("crash");
  {const rv=rivMap(),k=rivKey(A,B);if(rv[k])radio(B,pick([`Schon wieder ${A.drv.code}! Der hat es auf mich abgesehen.`,`Wieder ${A.drv.code}. Das muss endlich Konsequenzen haben!`,`Immer derselbe. ${A.drv.code} lernt es nicht.`]),false,true);rv[k]=(rv[k]||0)+1;}
  A.sparks=B.sparks=0.7;A.lockT=0.5;A.v=Math.min(A.v,B.v)*0.78;A.dmg=1;A.dmgT=S.t;A.ignoreDmg=!out&&Math.random()<0.4;
  hitDamage(A,B,rand(0.25,0.9));hitDamage(B,A,out?rand(0.6,1):light?rand(0.3,0.7):rand(0.15,0.55));markHit(A,B);
  A.wob={t:0,T:1.0,amp:(rear?0.22:0.4)*(-sd)};
  if(out){B.crash={dir:sd,rest:sd*27.5,h0:T.ang[idx]+SIDE*sd*0.38,v0:Math.max(30,B.v),sv0:rand(4.5,6.5)*rot,grav:105,done:false};B.retired=true;B.ot=null;B.wob=null;
    if(rear)B.v*=1.05;crashHazard(B,co,Math.random()<0.6?3:2);A.ignoreDmg=false;}
  else if(light){B.wob={t:0,T:1.1,amp:0.5*sd};if(rear)B.v*=1.03;B.dmg=1;B.dmgT=S.t;B.ignoreDmg=false;B.lockT=0.4;
    if(rear&&Math.random()<0.5){puncture(B,irand(2,3),false);addLog(`CAR ${B.drv.num} (${B.drv.code}) – Reifenschaden hinten nach Kontakt`);}}
  else{spinCar(B,rot,sd);if(rear)B.v*=1.04;if(Math.random()<0.3)B.dmg=1;}
  radio(B,rear?pick(["Er ist mir voll ins Heck gefahren!","Ich wurde von hinten getroffen! Prüft das Auto.","Was soll das? Der hat den Bremspunkt komplett verpasst!"])
    :pick(["Habt ihr das gesehen?! Der hat nicht mal gebremst!","Er fährt mir einfach rein!","Was macht der da?!"]),false,true);
  if(Math.random()<0.4)radio(A,pick(["Sorry, Räder blockiert. Mein Fehler.","Er hat einfach zugemacht! Ich konnte nirgends hin.","Frontflügel prüfen, ich hatte Kontakt."]));
  if(!S.hazard&&Math.random()<0.25)spawnHazard(2,B.pos,"Trümmerteile nach Kollision auf der Ideallinie – Marshals müssen auf die Strecke",[],{deb:true});}
function scriptStep(A,dt){const sc=A.script,B=sc.B,co=sc.co,ins=co.dir;sc.t+=dt;sc.pt+=dt;
  if(B.removed||B.crash||B.pit||A.pit||A.crash||B.spinT>0||A.spinT>0||sc.t>16||S.flag.mode!=="green"){endScript(A);return;}
  const d=delta(A,B);let dc=co.s-A.pos;if(dc>L/2)dc-=L;if(dc<-L/2)dc+=L;
  const side=s=>clamp(B.lat+s*7.4,-12.3,12.3),close=g=>1.03+clamp((d-g)/70,0,0.13);
  if((sc.type==="rear"||sc.type==="lunge")&&sc.ph===0&&Math.abs(dc)<90&&A.v>B.v+6&&obbHit(A,B,0.08)){collide(A,B,co);endScript(A);return;}   // Berührung zählt sofort
  if(sc.type==="rear"){
    if(sc.ph===0){A.sLat=B.lat;A.sRate=9;A.sSpd=close(CAR_L+6);if(dc<60){sc.ph=1;sc.pt=0;}}
    else{A.sLat=B.lat;A.sRate=11;A.sFree=true;A.ram=true;A.sSpd=1.16;A.lockT=0.25;
      if(obbHit(A,B,0.08)){collide(A,B,co);endScript(A);return;}
      if(sc.pt>3.5||dc<-60){endScript(A);return;}}
  }else if(sc.type==="lunge"||sc.type==="racing"){
    if(sc.ph===0){let tg=side(ins);if(Math.abs(tg-B.lat)<7)tg=side(-ins);A.sLat=tg;A.sSpd=close(sc.type==="lunge"?CAR_L*0.45:CAR_L*0.2);if(sc.type==="lunge"&&dc<70)A.lockT=0.2;
      if(dc<8){sc.ph=1;sc.pt=0;}}
    else if(sc.ph===1){
      if(sc.type==="lunge"){A.sLat=B.lat;A.sRate=11;A.sFree=true;A.ram=true;A.sSpd=d>CAR_L*0.6?1.15:1.05;A.lockT=0.25;
        if(obbHit(A,B,0.08)){collide(A,B,co);endScript(A);return;}
        if(sc.pt>4.5){endScript(A);return;}}
      else{const sg=Math.sign(A.lat-B.lat)||1;A.sLat=B.lat+sg*(CAR_W-0.7);A.sRate=8;A.sFree=true;B.sLat=B.lat;A.sSpd=close(CAR_L*0.3);
        if(obbHit(A,B,0.08)){A.sparks=B.sparks=0.4;const sg2=Math.sign(A.lat-B.lat)||1;A.wob={t:0,T:0.7,amp:0.13*sg2};B.wob={t:0,T:0.7,amp:-0.13*sg2};
          registerInc({kind:"inc",title:`Zwischenfall · ${A.drv.code} / ${B.drv.code} · ${cnm(co)}`,cars:[A,B],pos:B.pos,truth:{who:null,pen:0},sub:"racing",pre:5,post:2.5,
            explain:"Rad an Rad, leichte Berührung, beide lassen Platz und fahren weiter – Rennunfall, keine Strafe."});
          sc.ph=2;sc.pt=0;}
        else if(sc.pt>3){endScript(A);return;}}}
    else{const sg=Math.sign(A.lat-B.lat)||1;A.sLat=side(sg);A.sFree=false;B.sLat=null;if(sc.pt>0.9){endScript(A);return;}}
  }else if(sc.type==="dive"){      // Verbremser innen: rutscht nach außen und schiebt den Gegner weit
    if(sc.ph===0){const tg=side(ins);if(Math.abs(tg-B.lat)<7){sc.type="racing";return;}A.sLat=tg;A.sSpd=close(CAR_L*0.25);if(dc<80)A.lockT=0.2;
      if(dc<5){if(Math.abs(d)<CAR_L*0.9){sc.ph=1;sc.pt=0;}else if(dc<-50){endScript(A);return;}}}
    else{A.sLat=-ins*(sc.edge2-CAR_W-0.3);A.sRate=6.5;A.sFree=true;B.sFree=true;A.sSpd=1.03;if(sc.pt<1.2)A.lockT=0.2;
      if((B.lat-A.lat)*(-ins)<CAR_W+0.3)B.lat=A.lat-ins*(CAR_W+0.3);
      B.sLat=B.lat;sc.maxOff=Math.max(sc.maxOff,Math.abs(B.lat));B.sSpd=Math.abs(B.lat)>20?0.9:1;if(Math.abs(B.lat)>LINE_OUT+1)B.dustT=0.25;
      if(Math.abs(d)>CAR_L*1.3||sc.pt>2.6||Math.abs(A.lat+ins*(sc.edge2-CAR_W-0.3))<0.3){const off=sc.maxOff>TL_OFF;
        registerInc({kind:"inc",title:`Zwischenfall · ${A.drv.code} / ${B.drv.code} · ${cnm(co)}`,cars:[A,B],pos:B.pos,truth:off?{who:A,pen:5}:{who:null,pen:0},sub:off?"dive":"diveOk",pre:5,post:3,
          explain:off?`${A.drv.code} verbremst sich innen, rutscht nach außen und drängt ${B.drv.code} komplett von der Strecke – 5 Sekunden.`
            :`${A.drv.code} verbremst sich und trägt ${B.drv.code} weit, der bleibt aber mit einem Rad auf der Linie – hartes Racing, keine Strafe.`});
        radio(B,pick(["Er hat mich einfach rausgeschoben!","Der kam ohne Bremse innen rein, ich musste aufmachen!","Kein Platz gelassen!"]),false,true);endScript(A);return;}}
  }else if(sc.type==="squeeze"){
    if(sc.ph===0){const tg=side(-ins);if(Math.abs(tg-B.lat)<7){sc.type="racing";return;}A.sLat=tg;A.sSpd=close(0);
      if(dc<-15){if(Math.abs(d)<CAR_L*0.85){sc.ph=1;sc.pt=0;}else if(dc<-75){endScript(A);return;}}}
    else if(sc.ph===1){B.sLat=-ins*sc.edge;B.sRate=7;B.sFree=true;A.sFree=true;
      if((A.lat-B.lat)*(-ins)<CAR_W+0.3)A.lat=B.lat-ins*(CAR_W+0.3);
      A.sLat=A.lat;sc.maxOff=Math.max(sc.maxOff,Math.abs(A.lat));A.sSpd=Math.abs(A.lat)>20?0.9:1;
      if(Math.abs(B.lat)>=sc.edge-0.2||sc.pt>2.4){const off=sc.maxOff>TL_OFF;
        registerInc({kind:"inc",title:`Zwischenfall · ${A.drv.code} / ${B.drv.code} · ${cnm(co)}`,cars:[A,B],pos:B.pos,truth:off?{who:B,pen:5}:{who:null,pen:0},sub:off?"squeeze":"squeezeOk",pre:5.5,post:3.5,
          explain:off?`${B.drv.code} drängt ${A.drv.code} am Kurvenausgang komplett von der Strecke – 5 Sekunden.`
            :`${B.drv.code} fährt hart nach außen, lässt ${A.drv.code} aber eine Wagenbreite auf der Strecke – hart, aber fair.`});
        if(off)radio(A,pick(["Er hat mich von der Strecke gedrückt!","Der lässt mir keinen Platz!"]));
        sc.ph=2;sc.pt=0;B.sLat=null;B.sFree=false;}}
    else{A.sLat=-ins*11;A.sRate=10;A.sFree=false;A.sSpd=1;if(sc.pt>1.2){endScript(A);return;}}
  }else{ // offpass
    if(sc.ph===0){const tg=side(-ins);if(Math.abs(tg-B.lat)<7){sc.type="racing";return;}A.sLat=tg;A.sSpd=close(CAR_L*0.3);
      if(dc<5){sc.ph=1;sc.pt=0;
        sc.inc=registerInc({kind:"inc",title:`Zwischenfall · ${A.drv.code} / ${B.drv.code} · ${cnm(co)}`,cars:[A,B],pos:A.pos,truth:{who:null,pen:0},pre:5,post:6,hold:true,explain:""});}}
    else if(sc.ph===1){A.sLat=-ins*23.5;A.sRate=17;A.sFree=true;A.sSpd=1.22;A.dustT=Math.abs(A.lat)>LINE_OUT?0.25:A.dustT;sc.maxOff=Math.max(sc.maxOff,Math.abs(A.lat));if((sc.pt>1.2&&d<-5&&sc.maxOff>TL_OFF+0.8)||sc.pt>3.4){sc.ph=2;sc.pt=0;}}
    else if(sc.ph===2){A.sLat=-ins*10.5;A.sRate=14;A.sFree=d<-CAR_L;A.sSpd=1.05;
      if(sc.pt>1.3){const adv=d<-3&&sc.maxOff>TL_OFF;if(adv&&sc.give){sc.ph=3;sc.pt=0;}else{finishOff(A,adv);endScript(A);return;}}}
    else{A.sSpd=0.7;A.sLat=A.lat;if(d>CAR_L+3||sc.pt>7){finishOff(A,d<=0&&sc.maxOff>TL_OFF);endScript(A);return;}}
  }}
function impedeStep(X,dt){
  if(X.impede){const k=X.impede,P=k.P;k.t+=dt;
    if(k.hit&&!k.done&&!P.hitT&&delta(P,X)>0&&delta(P,X)<70&&P.v>X.v+15&&Math.abs(P.lat-X.lat)<3)P.hitT=X;   // sieht das langsame Auto zu spät
    if(P.hitT===X&&(delta(P,X)<0||P.pit||X.pit))P.hitT=null;
    if(k.hit&&!k.done&&P.hitT===X&&obbHit(P,X,0.08)){k.done=true;X.impede=null;P.hitT=null;
      registerInc({kind:"impede",title:`Kollision · ${X.drv.code} / ${P.drv.code}`,cars:[X,P],pos:X.pos,truth:"pen",pre:6,post:4,
        explain:`${X.drv.code} rollt langsam auf der Ideallinie, ${P.drv.code} kommt auf schneller Runde an und kann nicht mehr ausweichen – Impeding mit Kontakt.`});
      P.sparks=X.sparks=0.6;P.lockT=0.6;P.v=X.v*0.8;X.v+=6;P.dmg=1;P.wob={t:0,T:1,amp:0.3};toIn(P);spinCar(X,-SIDE*(Math.sign(X.lat-P.lat)||1),0);
      radio(P,"Kontakt! Der stand mitten auf der Linie! Frontflügel ist beschädigt.",false,true);}
    else if(P.blockT>1.0&&P.blockBy===X){X.impede=null;
      registerInc({kind:"impede",title:`Impeding · ${X.drv.code} / ${P.drv.code}`,cars:[X,P],pos:X.pos,truth:"pen",pre:6,post:3,
        explain:`${X.drv.code} bleibt langsam auf der Ideallinie, ${P.drv.code} muss auf seiner schnellen Runde vom Gas – Impeding.`});
      radio(P,"Der steht mitten auf der Linie! Runde im Eimer!");}
    else if(delta(P,X)<-5||k.t>14||P.mode!=="push"||X.pit){X.impede=null;if(P.hitT===X)P.hitT=null;}}
  if(X.fakeImp){const k=X.fakeImp,P=k.P;k.t+=dt;
    if(delta(X,P)>2){X.fakeImp=null;if(P.mode==="push")
      registerInc({kind:"impede",title:`Impeding · ${X.drv.code} / ${P.drv.code}`,cars:[X,P],pos:X.pos,truth:"ok",pre:6,post:2.5,
        explain:`${X.drv.code} macht rechtzeitig Platz, ${P.drv.code} verliert keine Zeit – kein Impeding.`});}
    else if(k.t>14||X.pit||P.mode!=="push")X.fakeImp=null;}}
function armImpede(){const cand=[];
  for(const X of S.cars){if(X.removed||X.pit||X.impede||X.fakeImp||(X.mode!=="out"&&X.mode!=="in")||X.pos>PIT_ENTRY_S-300)continue;
    for(const P of S.cars){if(P.mode!=="push"||P.pit)continue;const d=delta(P,X);if(d>70&&d<300)cand.push([X,P]);}}
  if(!cand.length)return false;const [X,P]=pick(cand);
  if(Math.random()<0.6)X.impede={P,t:0,hit:Math.random()<0.3};else X.fakeImp={P,t:0};return true;}
const aloneCar=(c,d)=>!S.cars.some(o=>o!==c&&!o.removed&&o.mode!=="garage"&&grp(o)===grp(c)&&Math.abs(delta(c,o))<d);
function armWide(){const want=S.type==="race"?"race":"push";
  const cand=S.cars.filter(c=>!c.removed&&c.mode===want&&!c.pit&&!c.script&&!c.busy&&!c.crash&&!c.wide&&!c.wideArm&&!c.finished&&c.spinT<=0&&aloneCar(c,48));
  if(!cand.length)return false;pick(cand).wideArm={viol:Math.random()<0.5};return true;}
function armSolo(){const want=S.type==="race"?"race":"push";
  const cand=S.cars.filter(c=>!c.removed&&c.mode===want&&!c.pit&&!c.script&&!c.busy&&!c.crash&&!c.finished&&aloneCar(c,48));
  if(!cand.length)return false;
  let crash=S.type==="race"?Math.random()<0.35:(S.crashes<1&&Math.random()<0.08);
  if(S.hazard||(S.type==="race"&&S.hazCount>=(W.real?4:2)))crash=false; if(crash)S.crashes++;
  const r=Math.random(),canHz=!S.hazard&&(S.type==="race"?S.hazCount<(W.real?4:2):S.crashes<1);
  let kind=r<0.22?null:r<0.42?"off":r<0.55?"tap":r<0.68?"beach":r<0.84?"lock":"save";   // normaler Dreher, in die Auslaufzone, Mauerkuss, Kiesbett, Verbremser, abgefangen
  if(kind==="beach"){if(!canHz||(S.type!=="race"&&Math.random()<0.6))kind="off";else if(S.type!=="race")S.crashes++;}
  const c=pick(cand);if(!crash&&kind==="lock"){if(c.wide||c.wideArm)return false;c.wideArm={viol:true,big:true};return true;}
  c.soloArm={crash,kind};return true;}
function director(dt){
  if(S.flag.mode!=="green"||S.hazard||S.chequered)return;
  if(S.type==="race"?S.phase!=="racing"||S.raceT-S.goT<10:!S.started)return;
  const w=S.wx.wet;
  if(w>0.2){for(const c of S.cars){if(c.removed||c.pit||c.crash||c.soloArm||tyreClass(c.tyre)!=="dry"||(c.mode!=="race"&&c.mode!=="push"))continue;
    if(Math.random()<dt*0.002*(w-0.15)*(S.om&&S.type==="race"?2:1)){c.soloArm={crash:Math.random()<0.5};break;}}}
  if(S.wantB>0){S.wantB-=dt;if(armBattle())S.wantB=0;}
  S.nextInc-=dt;if(S.nextInc>0)return;
  S.nextInc=rand(24,40)*(W.real?1.6:1)/(1+0.7*w+0.012*Math.max(0,S.wx.windKmh-15))/(TRACK.key==="madrid"?2.2:1)/Math.sqrt(raceMood().chaos);
  if(S.incidents.filter(i=>i.status==="open"||i.status==="rec").length>=4)return;
  const r=Math.random();
  if(TRACK.key==="madrid"&&r<0.35){armSolo();return;}
  const G=S.type==="race"?[{k:"wide",w:0.1,f:armWide},{k:"battle",w:0.48,f:()=>{if(!armBattle())S.wantB=18;}},{k:"solo",w:0.2,f:armSolo},{k:"mech",w:S.hazCount<(W.real?4:2)?0.05:0,f:armMech},{k:"punct",w:0.04,f:armPuncture},{k:"odd",w:0.05,f:armOddity},{k:"none",w:0.08,f:()=>{}}]
    :[{k:"wide",w:0.3,f:armWide},{k:"imp",w:0.25,f:()=>{if(!armImpede())armSolo();}},{k:"solo",w:0.35,f:armSolo},{k:"mech",w:S.crashes<1?0.06:0,f:()=>{if(armMech())S.crashes++;}},{k:"odd",w:0.04,f:armOddity}];
  for(const g of G)g.w*=memW("gen_"+g.k,-1);const g=wpick(G);memAdd("gen_"+g.k,-1);g.f();}
/* Kleine Störungen ohne beteiligtes Auto – sorgen für Abwechslung */
function armOddity(){if(S.hazard)return;const co=pick(CORNERS),pos=mod(co.s+rand(-40,40));if(pos<PIT_EXIT_S+80||pos>PIT_ENTRY_S-100)return;
  const v=pick([[1,`Ein Hase läuft in ${cnm(co)} über die Strecke`],[1,`Werbebanner hat sich in ${cnm(co)} gelöst und liegt am Streckenrand`],[2,`Karbonteil liegt in ${cnm(co)} auf der Ideallinie – ein Marshal muss auf die Strecke`],[1,`Plastiktüte weht in ${cnm(co)} über die Strecke`],[2,`Flüssigkeit auf der Ideallinie in ${cnm(co)} – Posten streuen Bindemittel`]]);
  spawnHazard(v[0],pos,v[1],[],{deb:v[0]===2,dur:rand(14,22)});}

/* ---- Safety Car ---- */
function scStep(dt){const sc=S.sc;if(!sc)return;
  if(!sc.on){sc.wait+=dt;let best=null,bd=1e9;
    for(const c of S.cars){if(c.removed||c.pit||c.mode==="garage"||c.crash)continue;const d=(PIT_EXIT_S-c.pos+L)%L;if(d<bd){bd=d;best=c;}}
    if(best&&bd>50&&bd<240&&(best===S.leader||sc.wait>LAPT*1.3)){sc.on=true;sc.s=PIT_EXIT_S;sc.pos=PIT_EXIT_S;sc.lat=-9;sc.v=PITV;addLog("SAFETY CAR DEPLOYED","flag");}
    return;}
  // Das Safety Car sammelt den Führenden ein: wer zwischen SC und Führendem fährt, wird vorbeigewunken und reiht sich hinten ein
  sc.chk=(sc.chk||0)+dt;
  if(sc.chk>1&&!sc.inLap&&S.leader&&!S.leader.pit&&S.leader.mode==="race"){sc.chk=0;const dl=(sc.pos-S.leader.pos+L)%L;let n=0;
    if(dl>30&&dl<L*0.95)for(const c of S.cars){if(c===S.leader||c.removed||c.retired||c.finished||c.pit||c.wantPit||c.mode!=="race"||c.unlap||c.crash)continue;
      const db=(sc.pos-c.pos+L)%L;if(db<dl-4&&db<140){c.unlap=true;c.wave=true;c.unlapPh=0;n++;}}
    if(n){S.unlapOn=true;if(!sc.waveLog){sc.waveLog=1;addLog("SAFETY CAR – Autos zwischen Safety Car und Führendem dürfen überholen und reihen sich hinten ein","flag");}}}
  const idx=sidx(sc.pos),vT=T.prof[idx]*0.62;
  sc.v=vT>sc.v?Math.min(vT,sc.v+ACC*dt):Math.max(vT,sc.v-BRK*dt);
  sc.s+=sc.v*dt;sc.pos=mod(sc.s);sc.lat+=clamp((S.unlapOn?6:T.line[idx]*0.5)-sc.lat,-10*dt,10*dt);
  if(sc.inLap&&sc.pos>=PIT_ENTRY_S&&sc.pos<PIT_ENTRY_S+40){S.sc=null;S.restart=true;addLog("SAFETY CAR IN THE PIT LANE – Restart an der Linie","flag");}}
