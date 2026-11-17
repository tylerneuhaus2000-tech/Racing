"use strict";
/* ============ Variations-Engine: Zufallsverteilungen, Fahrerzustand, Fehlerketten, seltene Ereignisse ============ */
/* ---- Verteilungen statt fester Werte ---- */
const gauss=()=>{let u=0,v=0;while(!u)u=Math.random();while(!v)v=Math.random();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);};
const lognorm=(med,sig)=>med*Math.exp(sig*gauss());                 // rechtsschief: meist nahe am Median, selten weit darüber
const tri=(a,m,b)=>{const u=Math.random(),f=(m-a)/(b-a);return u<f?a+Math.sqrt(u*(b-a)*(m-a)):b-Math.sqrt((1-u)*(b-a)*(b-m));};
const heavy=()=>Math.pow(Math.random(),2.6);                         // Schwere: meist klein, selten groß

/* ---- Fahrercharakter: Erfahrung, Konzentration, Fehleranfälligkeit ---- */
const EXP={ALO:1,HAM:1,HUL:0.95,BOT:0.95,PER:0.95,VER:0.95,SAI:0.9,LEC:0.85,NOR:0.85,RUS:0.85,OCO:0.85,GAS:0.85,ALB:0.8,STR:0.8,PIA:0.7,LAW:0.6,COL:0.5,HAD:0.55,BEA:0.55,ANT:0.5,BOR:0.5,LIN:0.4};
const expOf=c=>EXP[c.drv.code]!=null?EXP[c.drv.code]:0.45;
function drvState(c){if(c.conc==null){c.conc=tri(0.82,0.95,1);c.errBias=lognorm(1,0.35);c.reactT=lognorm(0.2,0.18);}}
/* ---- Renn-Charakter: die meisten Rennen ruhig, manche chaotisch ---- */
function raceMood(){if(S.mood)return S.mood;const m=lognorm(0.85,0.55),key=TRACK.key;
  const trk={monaco:1.4,singapore:1.35,baku:1.35,jeddah:1.3,vegas:1.2,madrid:1.6,montreal:1.2,interlagos:1.15,zandvoort:1.1,melbourne:1.1}[key]||1;
  S.mood={chaos:clamp(m*trk,0.25,4),temp:tri(18,32,52),label:null};S.mood.label=S.mood.chaos<0.6?"ruhig":S.mood.chaos<1.3?"normal":S.mood.chaos<2.2?"hektisch":"Chaos";return S.mood;}

/* ---- Fehler pro Kurve: Wahrscheinlichkeit aus Situation, Schwere aus schiefer Verteilung ---- */
function cornerErr(c,co,ci){if(c.errCo===ci)return false;c.errCo=ci;drvState(c);
  if(c.mode!=="race"&&c.mode!=="push")return false;if(c.finished||c.wide||c.ot&&c.ot.dive)return false;
  const md=raceMood(),wl=wetAt(c.pos),tc=tyreClass(c.tyre),race=S.type==="race";
  let p=0.00085*md.chaos*c.errBias;
  p*=1.5-expOf(c)*0.7;                                                    // Erfahrung
  p*=0.7+aggOf(c)*0.6;                                                   // Aggressivität
  p*=1+(1-c.conc)*5;                                                     // Konzentration
  p*=1+c.wear*1.6+(c.cold>0?1.2:0);                                      // Reifen: abgefahren oder kalt
  p*=tc==="dry"?1+wl*9:1+wl*1.6;                                         // Nässe, Slicks im Regen sind brutal
  p*=1+Math.max(0,md.temp-40)*0.03;                                      // heiße Strecke: Reifen überhitzen
  if(c.dmg)p*=1.8;if(c.fightT>0||c.atk)p*=2.4;if(c.mode==="push")p*=1.4; // Schaden, Zweikampf, Quali-Runde
  if(race&&S.laps-Math.floor(c.s/L)<=5)p*=1.3;                           // Druck am Ende
  if(co.kmax>0.02)p*=1.4;if(co.ro==="wall")p*=0.8;                       // enge Kurve; an der Mauer fährt man vorsichtiger
  if(S.flag.mode!=="green")p*=0.1;
  if(Math.random()>p)return false;
  const sev=Math.min(1,heavy()*(co.ro==="wall"?1.15:1)*(1+wl*0.4)*(tc==="dry"?1+wl*1.3:1)),out=-co.dir;(S.errs=S.errs||[]).push(sev);
  if(sev<0.45){                                                          // harmlos: Zehntel verloren
    c.nudge={dv:c.v*(1-tri(0.9,0.96,0.99)),dl:0,T:0.6,t:0};if(Math.random()<0.25)c.lockT=rand(0.15,0.5);
    if(Math.random()<0.12)radio(c,pick(["Kleiner Fehler, Kurvenausgang verpatzt.","Rutscher am Eingang, Zeit verloren.","Heck kam leicht, alles gut."]));return false;}
  if(sev<0.62){c.lockT=rand(0.4,1.1);c.nudge={dv:c.v*(1-tri(0.82,0.88,0.94)),dl:out*rand(0.5,2.5),T:0.7,t:0};   // Verbremser, geht leicht weit
    if(Math.random()<0.4)radio(c,pick(["Vorderrad blockiert, Bremsplatten!","Verbremst, sorry.","Zu spät gebremst."]));chainCheck(c,sev);return false;}
  if(sev<0.76){c.wideArm={viol:Math.random()<0.5,big:Math.random()<0.45};return false;}      // durch die Auslaufzone / Track Limits
  if(sev<0.9){const sk=wpick([{k:null,w:2},{k:"off",w:1},{k:"beach",w:co.ro==="gravel"?1:0.2},{k:"save",w:1.2}].map(o=>(o.w*=memW("spin_"+o.k,-1),o))).k;memAdd("spin_"+sk,-1);c.soloArm={crash:false,kind:sk,err:true,chain:sev,co};return false;}
  if(hazCool()&&Math.random()<0.75){c.soloArm={crash:false,kind:null,err:true,chain:sev,co};return false;}   // kurz nach einer Gefahr: eher Dreher als Abflug
  c.soloArm={crash:true,err:true,chain:sev,co};return false;}
/* ---- Kettenreaktion: wer dahinter fährt, muss reagieren – Reaktionszeit ist variabel ---- */
function chainCheck(src,sev){if(S.type!=="race")return;
  for(const f of S.cars){if(f===src||f.removed||f.pit||f.crash||f.spinT>0||f.mode!=="race")continue;const d=delta(src,f);   // f liegt dahinter
    if(d>=0||d<-60)continue;drvState(f);const gapT=(-d-CAR_L)/Math.max(10,f.v-src.v*0.6),need=f.reactT/f.conc*rand(0.8,1.4);
    if(need<gapT*0.7)continue;
    const r=Math.random();
    if(r<0.45||Math.abs(f.lat-src.lat)>CAR_W*1.2){f.lat+=(f.lat>=src.lat?1:-1)*rand(2,5);f.lockT=rand(0.4,1);f.v*=rand(0.82,0.93);   // Ausweichen in letzter Sekunde
      registerInc({kind:"info",title:`Beinahe-Unfall · ${f.drv.code} weicht ${src.drv.code} aus`,cars:[f,src],pos:f.pos,pre:4,post:3});
      radio(f,pick([`Wow! ${src.drv.code} stand quer, das war knapp!`,"Fast eingeschlagen, Herzschlag auf 200!","Hat jemand gesehen, wie knapp das war?!"]),true);}
    else if(r<0.85){f.chainArm={src,t:1.6,need,gapT,sev};f.lat+=(src.lat-f.lat)*0.5;}   // reagiert zu spät – ob es wirklich kracht, entscheidet die echte Berührung
    else{const co=cornerNear(f.pos);f.soloArm={crash:Math.random()<0.4};soloEvent(f,co);                                             // Sekundärdreher
      registerInc({kind:"info",title:`Folgeunfall · ${f.drv.code} nach Fehler von ${src.drv.code}`,cars:[f,src],pos:f.pos,pre:5,post:4});}
    break;}}
/* ---- Zustand über das Rennen: Konzentration sinkt im Stint, Boxenstopp erholt ---- */
function moodStep(dt){if(S.type!=="race"||S.phase!=="racing")return;
  for(const c of S.cars){if(c.removed)continue;drvState(c);
    if(c.pit)c.conc=Math.min(1,c.conc+0.02*dt);else c.conc=Math.max(0.55,c.conc-(0.00025+(c.fightT>0?0.0012:0))*dt*TSCALE*(1.4-expOf(c)*0.6));}
  for(const c of S.cars){if(!c.looseWheel||c.pit||c.removed||c.crash)continue;c.looseWheel.t-=dt;if(c.looseWheel.t>0)continue;c.looseWheel=null;   // Rad nicht fest – fällt nach dem Stopp ab
    const co=cornerNear(c.pos);c.crash={dir:1,rest:16,h0:T.ang[sidx(c.pos)],v0:Math.max(30,c.v),sv0:rand(-1,1),grav:70,done:false,mech:true};c.retired=true;c.ot=null;
    if(!S.hazard)spawnHazard(Math.random()<0.5?2:3,c.pos,`${c.drv.code} verliert ein Rad – es rollt über die Strecke`,[c],{deb:true,dur:rand(25,45)});
    registerInc({kind:"unsafe",title:`Loses Rad · ${c.drv.code}`,cars:[c],pos:c.pos,truth:"pen",pre:4,post:4,data:"Boxenfunk: Rad hinten links nicht als fixiert gemeldet, Auto trotzdem freigegeben. Rad löst sich zwei Kurven später.",explain:"Ein Auto in unsicherem Zustand loszuschicken ist eine Unsafe Release – Strafe."});
    radio(c,"Rad ist weg! Das Rad ist abgefallen!",true,true);}
  for(const f of S.cars){const a=f.chainArm;if(!a)continue;a.t-=dt;const src=a.src;
    if(!f.removed&&!src.removed&&Math.abs(delta(f,src))<CAR_L+4&&obbHit(f,src,0.08)){f.chainArm=null;f.dmg=1;f.ignoreDmg=true;f.dmgT=S.t;f.v*=rand(0.7,0.85);f.sparks=0.6;src.sparks=0.4;hitDamage(f,src,rand(0.2,0.6));hitDamage(src,f,rand(0.1,0.4));markHit(f,src);
      registerInc({kind:"inc",sub:"racing",title:`Kettenreaktion · ${f.drv.code}/${src.drv.code}`,cars:[f,src],pos:f.pos,pre:5,post:3,truth:{who:f,pen:0},
        data:`Telemetrie ${f.drv.code}: Reaktion ${a.need.toFixed(2)} s, verfügbare Zeit ${a.gapT.toFixed(2)} s. ${src.drv.code} hatte sich zuvor ${a.sev>0.9?"gedreht":"verbremst"}. Kontakt Frontflügel ${f.drv.code} – Heck ${src.drv.code}.`,
        explain:"Unvermeidbar – das Auto davor kam unkontrolliert zurück. Rennunfall, keine Strafe."});
      radio(f,"Ich bin auf ihn drauf, keine Chance! Frontflügel ist beschädigt.");}
    else if(a.t<=0){f.chainArm=null;if(Math.random()<0.5)radio(f,pick([`Puh, gerade so an ${src.drv.code} vorbei!`,"Das war haarscharf!"]));}}
  redService(dt);rareStep(dt);}
/* Unter Rot dürfen die Teams Reifen wechseln und reparieren – zählt nicht als Boxenstopp */
function redService(dt){const red=S.flag.mode==="red";
  for(const c of S.cars){if(!red){c.redDone=false;c.redW=0;continue;}if(c.redDone||!c.pit||c.v>1||c.removed)continue;
    c.redW=(c.redW||0)+dt;if(c.redW<(c.redNeed||(c.redNeed=rand(8,30))))continue;c.redDone=true;
    const cl=wetClass(S.wx.wet),left=S.laps-Math.floor(c.s/L),nt=cl!=="dry"?cl:left>S.laps*0.5?"H":left>S.laps*0.25?pick(["M","H"]):pick(["S","M"]);
    const fix=c.dmg&&!c.punct?((c.dp||0)?"Schäden repariert, ":"Frontflügel getauscht, "):"";const ch=nt!==c.tyre||c.wear>0.25||c.punct;
    if(!ch&&!fix)continue;c.tyre=nt;c.wear=0;c.punct=false;c.dmg=0;dmgClear(c);c.ignoreDmg=false;c.cold=4;
    addLog(`Unter Rot: ${c.drv.code} – ${fix}neue ${{S:"Soft",M:"Medium",H:"Hard",I:"Intermediate",W:"Full Wet"}[nt]} (kein Boxenstopp)`);}}

/* ---- Boxenstopp-Varianz ---- */
const CREW={MCL:2.25,FER:2.3,RBR:2.3,MER:2.4,WIL:2.5,RCB:2.55,AMR:2.6,ALP:2.6,AUD:2.65,HAA:2.7,CAD:2.8};
function pitStopVar(c){let work=lognorm(CREW[c.drv.team]||2.6,0.08),note=null;const r=Math.random();
  if(r<0.035){work+=lognorm(3,0.6);note=pick(["Radmutter klemmt hinten links","Schlagschrauber versagt vorne rechts","Mechaniker verliert die Radmutter"]);}
  else if(r<0.05){work+=rand(1.2,3.5);note=pick(["Wagenheber vorne rutscht ab","Fahrer überfährt die Markierung, Crew muss nachrücken"]);}
  else if(r<0.056){work+=rand(9,25);note=pick(["Falsche Reifen bereitgelegt – Team muss neue Reifen holen","Radmutter verkantet – Rad muss neu aufgesetzt werden"]);}
  else if(r<0.059){note="LOSE";}
  return {work,note};}

/* ---- Seltene und außergewöhnliche Ereignisse (Wahrscheinlichkeit pro Grand Prix) ---- */
const RARE=[
 {id:"blowout",p:1/30,t:"Reifenplatzer auf der Geraden",fn(){const c=rareCar(true);if(!c)return false;blowout(c);}},
 {id:"oil",p:1/90,t:"Ölspur – mehrere Autos rutschen",fn(){const c=rareCar(true);if(!c||S.hazard)return false;c.retired=true;c.crash={dir:1,rest:20,h0:T.ang[sidx(c.pos)],v0:Math.max(30,c.v),sv0:0,grav:60,done:false,mech:true};
   S.oil={pos:c.pos,until:S.t+rand(25,45)};spawnHazard(2,c.pos,`Motorschaden bei ${c.drv.code} – Öl auf der Ideallinie, Posten streuen Bindemittel`,[c],{deb:true,dur:rand(30,50)});
   radio(c,"Motor ist geplatzt, ich verliere Öl!",false,true);registerInc({kind:"info",title:`Ölspur · ${c.drv.code}`,cars:[c],pos:c.pos,pre:3,post:5});}},
 {id:"marshal",p:1/160,t:"Marshal läuft ohne Freigabe über die Strecke",fn(){if(S.hazard)return false;const co=pick(CORNERS);spawnHazard(2,mod(co.s+20),`Ein Marshal läuft in ${cnm(co)} über die Strecke – ohne Freigabe der Rennleitung`,[],{dur:rand(10,18)});
   addLog(`RACE CONTROL: MARSHAL ON TRACK – ${cnm(co).toUpperCase()}`,"flag");}},
 {id:"drain",p:1/170,t:"Kanaldeckel löst sich",street:true,fn(){if(S.hazard)return false;const co=pick(CORNERS);spawnHazard(4,mod(co.s-40),`Kanaldeckel hat sich bei ${cnm(co)} gelöst – ein Auto hat den Unterboden aufgerissen`,[],{dur:rand(90,140)});
   const c=rareCar(false);if(c){c.dmg=1;c.ignoreDmg=true;radio(c,"Da war ein Schlag von unten – irgendwas auf der Strecke!",true,true);}}},
 {id:"invasion",p:1/280,t:"Zuschauer auf der Strecke",fn(){if(S.hazard)return false;const co=pick(CORNERS);spawnHazard(3,co.s,`Zuschauer sind in ${cnm(co)} über den Zaun auf die Strecke gelaufen`,[],{dur:rand(40,70)});}},
 {id:"hydraulics",p:1/35,t:"Hydraulikproblem – Auto hängt im Gang fest",fn(){const c=rareCar(false);if(!c)return false;c.limp=rand(0.55,0.8);c.dmg=1;c.ignoreDmg=true;
   radio(c,pick(["Hydraulik weg, ich stecke im siebten Gang fest!","Ich kann nicht mehr schalten, nur noch ein Gang!"]),true,true);addLog(`CAR ${c.drv.num} (${c.drv.code}) – technisches Problem, deutlich langsamer`,"flag");}},
 {id:"mirror",p:1/25,t:"Teile fliegen ab",fn(){if(S.hazard)return false;const c=rareCar(false);if(!c)return false;const part=pick(["Rückspiegel","Teil der Endplatte","Kamerahalterung","Abrissvisier","Karbonteil der Seitenkastenverkleidung"]);
   spawnHazard(pick([1,1,2]),c.pos,`${part} von ${c.drv.code} liegt auf der Strecke`,[],{deb:true,dur:rand(12,24)});}},
 {id:"pitfire",p:1/140,t:"Feuer in der Boxengasse",fn(){const c=S.cars.find(x=>x.pit&&x.pit.ph==="svc");if(!c)return false;c.fire={t:0,T:rand(10,18)};
   addLog(`FIRE IN THE PIT LANE – CAR ${c.drv.num} (${c.drv.code}) – Crew löscht`,"bad");radio(c,"Feuer hinten! Raus aus dem Auto?!",true,true);}},
 {id:"cloudburst",p:1/70,t:"Wolkenbruch nur über einem Teil der Strecke",dry:true,fn(){if(S.wx.desert)return false;const a=rand(0,6.28);S.wx.cells.push({x:Math.cos(a)*260,y:Math.sin(a)*260,r:rand(150,260),int:rand(0.75,1)});
   addLog("WETTERDIENST: Unwetterzelle direkt über der Strecke – plötzlicher Starkregen","flag");}},
 {id:"timing",p:1/300,t:"Zeitnahme fällt aus",fn(){S.timingOff=S.t+rand(40,90);addLog("RACE CONTROL: TIMING SYSTEM FAILURE – Zeitnahme ausgefallen","bad");}},
 {id:"launch",p:1/350,t:"Auto hebt ab – Halo rettet den Fahrer",fn(){const pr=rarePair();if(!pr)return false;const[a,b]=pr,co=cornerNear(a.pos);
   for(const c of[a,b]){c.soloArm={crash:true};soloEvent(c,co);}a.fire=Math.random()<0.3?{t:0,T:rand(20,35)}:null;
   if(S.hazard){S.hazard.text=`Schwerer Unfall ${a.drv.code}/${b.drv.code} in ${cnm(co)} – ein Auto ist über das andere gestiegen`;}
   registerInc({kind:"inc",sub:"racing",title:`Schwerer Unfall · ${a.drv.code}/${b.drv.code}`,cars:[a,b],pos:a.pos,pre:6,post:5,truth:{who:a,pen:0},data:"Telemetrie: Räder berühren sich bei hoher Geschwindigkeit, Auto A steigt über das Hinterrad von B.",explain:"Rad-an-Rad-Kontakt ohne klares Verschulden – Rennunfall."});
   radio(a,"Ich bin okay! Ich bin okay... der Halo hat mich gerettet.",true,true);}},
 {id:"teammates",p:1/45,t:"Teamkollegen kollidieren",fn(){for(const a of S.cars)for(const b of S.cars){if(a===b||a.drv.team!==b.drv.team||!freeCar(a)||!freeCar(b))continue;const d=delta(a,b);
   if(d>0&&d<40){b.dmg=1;b.ignoreDmg=true;b.sparks=0.6;a.dmg=1;a.ignoreDmg=true;a.v*=0.8;const who=Math.random()<0.6?a:b;
     registerInc({kind:"inc",sub:"lunge",title:`Teamduell eskaliert · ${a.drv.code}/${b.drv.code}`,cars:[a,b],pos:a.pos,pre:5,post:3,truth:{who,pen:who===a?5:0},data:`Teaminterner Zweikampf, Kontakt beim Einlenken. Verursacher laut Telemetrie: ${who.drv.code}.`,explain:who===a?`${a.drv.code} sticht zu spät rein – 5 Sekunden.`:"Beide lassen sich nicht – Rennunfall."});
     radio(b,`Was macht der denn?! Das ist mein Teamkollege!`,true,true);return;}}return false;}},
];
function rareCar(fast){const cs=S.cars.filter(c=>freeCar(c)&&(!fast||c.v>VTOP*0.6));return cs.length?pick(cs):null;}
function rarePair(){for(const a of shuffle(S.cars))for(const b of S.cars){if(a===b||!freeCar(a)||!freeCar(b))continue;const d=delta(a,b);if(d>0&&d<22&&Math.abs(a.lat-b.lat)<7)return [a,b];}return null;}
function planRare(){if(S.type!=="race"||S.rarePlan)return;S.rarePlan=[];const md=raceMood(),street=RUNOFF[TRACK.key]&&RUNOFF[TRACK.key].d==="wall";
  for(const e of RARE){if(e.street&&!street)continue;if(Math.random()<e.p*Math.sqrt(md.chaos))S.rarePlan.push({e,at:rand(0.08,0.92)*S.laps*LAPT});}}
function rareStep(){if(!S.rarePlan)planRare();const t=S.raceT-S.goT;
  for(const r of S.rarePlan){if(r.done||t<r.at)continue;if(S.flag.mode!=="green"&&!r.e.dry){r.at+=10;continue;}
    const res=r.e.fn();r.done=res!==false;if(res===false)r.at+=15;
    if(r.done&&W.career){const k=W.career;k.rare=k.rare||{};if(!k.rare[r.e.id]){k.rare[r.e.id]=1;addLog(`★ Erstmals in deiner Laufbahn: ${r.e.t}`,"flag");}else k.rare[r.e.id]++;}}
  if(S.oil&&S.t<S.oil.until)for(const c of S.cars){if(c.removed||c.pit||c.crash||c.spinT>0||c._oil===S.oil)continue;if(Math.abs(mod(c.pos-S.oil.pos))<20&&Math.random()<0.25){c._oil=S.oil;
    if(Math.random()<0.5){c.soloArm={crash:false,kind:"off"};soloEvent(c,cornerNear(c.pos));}else{c.wob={t:0,T:1.2,amp:rand(0.4,0.8)*(Math.random()<0.5?1:-1)};c.v*=0.85;radio(c,"Öl! Alles rutscht hier!",true);}}}}
/* ---- Gedächtnis gegen Wiederholungen: gleiche Art/gleiche Kurve kurz hintereinander wird unwahrscheinlich ---- */
function memW(kind,ci){const m=S.mem||[];let w=1;for(const e of m){if(S.t-e.t>150)continue;if(e.k===kind){w*=0.35;if(e.ci===ci)w*=0.25;}}return w;}
function memAdd(kind,ci){S.mem=(S.mem||[]).filter(e=>S.t-e.t<200);S.mem.push({k:kind,ci,t:S.t});}
function wpick(opts){let tot=0;for(const o of opts)tot+=Math.max(0,o.w);let r=Math.random()*tot;for(const o of opts){r-=Math.max(0,o.w);if(r<=0)return o;}return opts[opts.length-1];}
/* ---- Off-Track-Generator: Ursache, Ort, Bahn, Tempo, Schaden – jedes Mal neu zusammengesetzt ---- */
function mkOffTrack(c,co,arm){const ci=CORNERS.indexOf(co),ro=co.ro||"gravel",fast=co.kmax<0.012,chic=CORNERS.some(o=>o!==co&&Math.abs(o.s-co.s)<90);
  const opts=[{k:"limit",w:arm.big?0.3:3},{k:"lock",w:arm.big?3:0.8},{k:"exit",w:1.4},{k:"gravel",w:ro==="gravel"?1.4:0},{k:"kerb",w:chic?1.6:0.5},{k:"grass",w:ro!=="wall"?0.7:0}];
  for(const o of opts)o.w*=memW("off_"+o.k,ci);
  const v=wpick(opts).k;memAdd("off_"+v,ci);S.offK=S.offK||{};S.offK[v]=(S.offK[v]||0)+1;const out=-co.dir;
  const w={t:0,base:c.lat,co,max:0,kind:v,a:rand(0.3,0.6),h:rand(0,0.3),slow:1,rep:false,viol:false,lock:false,big:false};
  if(v==="limit"){const r=Math.random();const pk=r<0.55?TL_OFF+rand(-0.9,0.9):arm.viol?TL_OFF+rand(0.9,3.2):TL_OFF-rand(0.6,2.6);
    w.T=rand(2.4,4.4);w.peak=out*pk;w.lock=Math.random()<0.3;w.slow=rand(0.94,1);}
  else if(v==="lock"){w.lock=true;w.big=true;w.rep=true;c.lockT=rand(0.7,1.6);c.wear=Math.min(1,c.wear+rand(0.02,0.07));     // Bremsplatten
    const pk=ro==="wall"?rand(17.5,19.3):ro==="gravel"?rand(19.5,23):rand(22,28.5);w.T=rand(3.8,6.8);w.peak=out*pk;w.a=rand(0.35,0.5);w.h=rand(0.1,0.35);w.slow=ro==="gravel"?rand(0.5,0.7):rand(0.65,0.88);
    if(ro==="wall"&&Math.random()<0.35){c.dmg=1;c.ignoreDmg=true;c.dmgT=S.t;c.sparks=0.5;}
    if(chic&&ro==="asphalt"&&Math.random()<0.5){w.cut=true;w.peak=co.dir*rand(TL_OFF+2,TL_OFF+6);}                               // kürzt durch die Schikane ab
    addLog(`CAR ${c.drv.num} (${c.drv.code}) ${w.cut?"verbremst sich und kürzt durch die Schikane ab":ro==="gravel"?"verbremst sich und rutscht ins Kiesbett":ro==="wall"?"verbremst sich und touchiert die Mauer":"verbremst sich und fährt durch die Auslaufzone"} – ${cnm(co)}`);
    radio(c,pick(["Verbremst! Vorderräder blockiert.","Bremspunkt verpasst, sorry.","Hinten rechts hat blockiert, Bremsplatten!","Ich kam nicht mehr rum, viel zu schnell."]));}
  else if(v==="exit"){w.exitStart=co.ia!=null?co.ia:co.i0;w.T=rand(2.2,3.6);w.a=rand(0.3,0.45);w.peak=out*(TL_OFF+rand(-1.2,3.5));w.slow=rand(0.84,0.95);
    c.wob={t:0,T:rand(0.9,1.6),amp:rand(0.3,0.7)*co.dir*SIDE};if(Math.random()<0.35)radio(c,pick(["Heck kam beim Rausbeschleunigen!","Zu früh aufs Gas, Heck weg.","Wheelspin am Ausgang."]));}
  else if(v==="gravel"){w.T=rand(3,4.8);w.peak=out*rand(19.5,23.5);w.slow=rand(0.55,0.72);w.big=true;w.rep=true;
    c.wob={t:0,T:rand(1.2,2),amp:rand(0.5,0.9)*(Math.random()<0.5?1:-1)};if(Math.random()<0.25){c.dmg=1;c.ignoreDmg=true;c.dmgT=S.t;}
    addLog(`CAR ${c.drv.num} (${c.drv.code}) im Kies in ${cnm(co)} – fängt das Auto gerade noch ab`);radio(c,pick(["Durchs Kies, alles voller Steine, aber ich bin noch dabei!","Puh, das war knapp, Kiesbett!"]),true);}
  else if(v==="kerb"){w.T=rand(1.4,2.4);w.a=rand(0.4,0.55);w.h=rand(0,0.15);const pk=TL_OFF+(Math.random()<0.5?rand(-1,1):arm.viol?rand(1,3):-rand(0.4,2));w.peak=co.dir*pk;w.inside=true;
    c.wob={t:0,T:rand(0.5,0.9),amp:rand(0.15,0.35)*(Math.random()<0.5?1:-1)};}
  else{w.T=rand(2.8,4.2);w.peak=out*rand(18.5,21.5);w.slow=rand(0.7,0.85);w.big=true;w.rep=true;   // mit zwei Rädern ins Gras
    if(Math.random()<0.3)radio(c,"Zwei Räder im Gras, da ist null Grip!");}
  return w;}
/* gewichtete Auswahl für Zweikampf-Szenarien mit Gedächtnis */
function battleType(A){const a=aggOf(A);const opts=[{k:"lunge",w:0.09*(0.5+a)},{k:"rear",w:0.06*(0.6+a*0.6)},{k:"squeeze",w:0.16*(0.6+a*0.6)},{k:"dive",w:0.19},{k:"racing",w:0.28},{k:"offpass",w:0.22}];
  for(const o of opts)o.w*=memW("bt_"+o.k,-1);const k=wpick(opts).k;memAdd("bt_"+k,-1);return k;}
