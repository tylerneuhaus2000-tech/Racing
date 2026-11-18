"use strict";
/* ============ 2026-Reglement: Energie, Strecken-Infrastruktur, Stewards, Abnahme, PU-Kontingente ============ */
/* ---- Energiemanagement (MGU-K 350 kW, Batterie 4 MJ, Ernte ~8,5 MJ/Runde, Overtake +0,5 MJ) ---- */
const ES_CAP=4.0,K_MAX=0.35,HARV_LAP=8.5,OM_EXTRA=0.5;
let OZ=null;                                      // Index → Beschleunigungszone (lange Gerade)
function buildZones(){OZ=new Uint8Array(NU);const run=[];let st=-1;
  for(let i=0;i<=NU;i++){const k=Math.abs(T.k[i%NU]);if(k<0.0032&&i<NU){if(st<0)st=i;}else if(st>=0){if((i-st)*DS>220)run.push([st,i-1]);st=-1;}}
  for(const[a,b]of run)for(let i=a;i<=b;i++)OZ[i]=1;TRACK.zones=run.map(([a,b])=>({a:a*DS,b:b*DS}));}
function ersMul(c,idx,prof,dt,neutral,race){if(c.soc==null){c.soc=0.85;c.harv=0;c.omE=0;}
  if(c.pit||c.mode==="garage"||c.crash)return 1;
  const rdt=dt*TSCALE,full=prof>VTOP*0.55&&!c.decel,zone=OZ&&OZ[idx];let m=1;c.clip=false;
  if(c.decel||c.wantSave){const h=Math.min(K_MAX*rdt,Math.max(0,HARV_LAP-c.harv));c.harv+=h;c.soc=Math.min(1,c.soc+h/ES_CAP);}
  const noDep=neutral||S.phase==="form"||S.phase==="gridwait"||(S.sec&&S.sec[sectorOf(c.pos)]>0);
  if(full&&!noDep){let p=zone?K_MAX:0.25;                          // außerhalb der Beschleunigungszonen nur 250 kW
    if(c.soc>0.03){c.soc=Math.max(0,c.soc-p*rdt/ES_CAP);
      if(c.omE>0&&zone&&omActive()){c.omE-=p*rdt;m*=1.035;c.omOn=true;}          // Overtake: zusätzliche Energie nur im Zonenbereich
      if(race&&(c.atk||c.defT>0)&&c.soc>0.25){c.soc-=0.08*rdt/ES_CAP;m*=1.012;}}   // Boost-Knopf im Zweikampf
    else{c.clip=true;m*=0.94;                                                     // leer: Superclipping, Auto verhungert am Ende der Geraden
      const h=Math.min(0.2*rdt,Math.max(0,HARV_LAP-c.harv));c.harv+=h;c.soc+=h/ES_CAP;}}
  c.wantSave=c.soc<0.18&&prof>VTOP*0.75&&!c.atk;if(c.wantSave&&!c.clip)m*=0.985;  // Lift and Coast
  return m;}
function ersLap(c){c.harv=0;c.omE=0;
  if(S.type==="race"&&omActive())for(const o of S.cars){if(o===c||o.removed||o.pit)continue;const d=delta(c,o);if(d>0&&d<Math.max(26,c.v*0.45)){c.omE=OM_EXTRA;break;}}
  if(S.type==="race"&&S.phase==="racing"&&!c.pit&&Math.random()<0.004*(W.real?1:2.5)&&!S.ersInc){S.ersInc=true;     // FIA-Energieüberwachung
    const bad=Math.random()<0.55,lim=TRACK_ERS(),val=bad?lim+rand(0.04,0.35):lim-rand(0.0,0.25);
    registerInc({kind:"ers",title:`ERS-Daten · ${c.drv.code}`,cars:[c],pos:c.pos,truth:bad?"pen":"ok",pre:3,post:2,
      data:`FIA-Energiemessung Runde ${Math.floor(c.s/L)}: ${val.toFixed(2)} MJ geerntet, Grenze an dieser Strecke ${lim.toFixed(1)} MJ (Messtoleranz 0,00).`,
      explain:bad?"Das Energielimit pro Runde wurde überschritten – ein messbarer Leistungsvorteil, Strafe nötig.":"Der Wert liegt unter der Grenze – kein Verstoß."});}}
const ERS9=new Set(["monza","spa","baku","jeddah","vegas","lusail"]);
const TRACK_ERS=()=>ERS9.has(TRACK.key)?9.0:8.5;

/* ---- Auslaufzonen pro Kurve (grob nach Streckentyp) ---- */
const RUNOFF={monaco:{d:"wall"},singapore:{d:"wall"},baku:{d:"wall"},jeddah:{d:"wall"},vegas:{d:"wall"},
  miami:{d:"asphalt",wall:[11,12,13,14,15,16]},montreal:{d:"asphalt",wall:[2,9,10,13,14]},melbourne:{d:"gravel",wall:[]},madrid:{d:"wall",asphalt:[1,2,3]},
  suzuka:{d:"gravel"},zandvoort:{d:"gravel"},imola:{d:"gravel"},hungaroring:{d:"gravel",asphalt:[1,2,4]},spa:{d:"gravel",asphalt:[1,18,19]},monza:{d:"gravel",asphalt:[1,2,11]},
  rbr:{d:"gravel",asphalt:[1,3,4]},silverstone:{d:"asphalt",gravel:[3,4,6,7,15]},barcelona:{d:"gravel",asphalt:[1,10]},lusail:{d:"gravel"},
  bahrain:{d:"asphalt"},yas:{d:"asphalt"},austin:{d:"asphalt"},mexico:{d:"asphalt"},interlagos:{d:"asphalt",gravel:[3]},shanghai:{d:"asphalt"},nuerburgring:{d:"gravel"},hockenheim:{d:"asphalt"}};
function tagRunoff(){const r=RUNOFF[TRACK.key]||{d:"gravel"};for(const c of CORNERS){let t=r.d;
  if(r.wall&&r.wall.includes(c.num))t="wall";if(r.gravel&&r.gravel.includes(c.num))t="gravel";if(r.asphalt&&r.asphalt.includes(c.num))t="asphalt";c.ro=t;}}
const RO_TXT={wall:"Mauer",gravel:"Kiesbett",asphalt:"Asphalt-Auslauf"};

/* ---- Boxengassen: Einfahrt/Ausfahrt (m vor/nach der Linie, Schätzung nach Streckenplan), Tempolimit ---- */
const PITDATA={melbourne:[260,230],shanghai:[380,330],suzuka:[230,300],bahrain:[280,330],jeddah:[300,260],miami:[270,300],montreal:[330,250],monaco:[180,330,60],
  barcelona:[270,300],rbr:[230,300],silverstone:[300,220],spa:[330,220],hungaroring:[300,260],zandvoort:[260,180],monza:[320,260],madrid:[260,260],
  singapore:[420,360],baku:[260,0,80,"T1"],austin:[260,250],mexico:[320,300],interlagos:[450,380],vegas:[260,260],lusail:[300,300],yas:[360,380],imola:[330,320]};
/* Streckenspezifische Pit-Road-Profile, in Metern: Anfahrt, Einfädeln, Ausfahrtsbogen,
   Auslauf bis zur Safety-Car-Linie 2 sowie der Start-/Endpunkt der jeweiligen Kurve.
   Abstände werden auf die im Spiel skalierte Streckenlänge umgerechnet. */
const PITROUTES={
  ring:{approach:185,entry:145,exit:115,rejoin:105,entryLat:-22.5,exitLat:-23.0},
  melbourne:{approach:175,entry:135,exit:110,rejoin:115,entryLat:-23.5,exitLat:-24.5},
  shanghai:{approach:205,entry:155,exit:145,rejoin:135,entryLat:-22.0,exitLat:-24.3},
  suzuka:{approach:190,entry:150,exit:125,rejoin:125,entryLat:-22.0,exitLat:-24.5},
  bahrain:{approach:175,entry:135,exit:125,rejoin:130,entryLat:-24.0,exitLat:-24.4},
  jeddah:{approach:210,entry:160,exit:120,rejoin:130,entryLat:-21.5,exitLat:-24.1},
  miami:{approach:170,entry:135,exit:120,rejoin:120,entryLat:-23.0,exitLat:-24.6},
  montreal:{approach:180,entry:140,exit:95,rejoin:105,entryLat:-24.5,exitLat:-24.4},
  monaco:{approach:150,entry:125,exit:150,rejoin:145,entryLat:-20.0,exitLat:-24.0},
  barcelona:{approach:185,entry:145,exit:115,rejoin:120,entryLat:-23.0,exitLat:-24.4},
  rbr:{approach:165,entry:130,exit:115,rejoin:110,entryLat:-24.5,exitLat:-24.5},
  silverstone:{approach:190,entry:145,exit:150,rejoin:150,entryLat:-21.5,exitLat:-24.0},
  spa:{approach:205,entry:155,exit:135,rejoin:90,entryLat:-22.5,exitLat:-24.2},
  hungaroring:{approach:185,entry:145,exit:110,rejoin:115,entryLat:-23.0,exitLat:-24.6},
  zandvoort:{approach:175,entry:140,exit:90,rejoin:100,entryLat:-21.5,exitLat:-24.2},
  monza:{approach:185,entry:145,exit:105,rejoin:110,entryLat:-24.5,exitLat:-24.6},
  madrid:{approach:175,entry:140,exit:105,rejoin:115,entryLat:-23.0,exitLat:-24.5},
  baku:{approach:175,entry:140,exit:160,rejoin:155,entryLat:-19.5,exitLat:-23.8},
  singapore:{approach:220,entry:170,exit:145,rejoin:145,entryLat:-19.5,exitLat:-23.8},
  austin:{approach:180,entry:85,exit:110,rejoin:115,entryLat:-23.0,exitLat:-24.5},
  mexico:{approach:190,entry:150,exit:125,rejoin:130,entryLat:-24.5,exitLat:-24.5},
  interlagos:{approach:225,entry:175,exit:130,rejoin:135,entryLat:-21.5,exitLat:-24.2},
  vegas:{approach:170,entry:135,exit:140,rejoin:230,entryLat:-22.5,exitLat:-24.4},
  lusail:{approach:185,entry:145,exit:125,rejoin:130,entryLat:-23.0,exitLat:-24.5},
  yas:{approach:210,entry:165,exit:150,rejoin:150,entryLat:-21.5,exitLat:-24.2},
  imola:{approach:195,entry:150,exit:125,rejoin:130,entryLat:-22.5,exitLat:-24.3},
  nuerburgring:{approach:180,entry:140,exit:110,rejoin:115,entryLat:-23.0,exitLat:-24.5},
  hockenheim:{approach:190,entry:150,exit:120,rejoin:125,entryLat:-23.0,exitLat:-24.4}
};
let PIT_ROUTE=PITROUTES.ring;
const pitEase=u=>{u=clamp(u,0,1);return u*u*(3-2*u);};
const pitRouteLineAt=pos=>T.line[sidx(((pos%L)+L)%L)];
function pitRouteApproachLatAt(pos){const r=PIT_ROUTE,d=(PIT_ENTRY_S-(((pos%L)+L)%L)+L)%L;if(d>r.approach)return null;
  const u=pitEase((r.approach-d)/r.approach),line=pitRouteLineAt(pos);return line+(r.entryLat-line)*u;}
function pitRouteEntryLatAt(pos){const s=((pos%L)+L)%L,along=(s-PIT_ENTRY_S+L)%L,span=Math.max(1,PIT_IN_S-PIT_ENTRY_S);
  if(along>=span)return PLAT;return PIT_ROUTE.entryLat+(PLAT-PIT_ROUTE.entryLat)*pitEase(along/span);}
function pitRouteExitLatAt(pos){const s=((pos%L)+L)%L,r=PIT_ROUTE;if(s>=PIT_ENTRY_S)return PLAT;
  if(s<PIT_OUT_S)return PLAT;if(s<=PIT_EXIT_S)return PLAT+(r.exitLat-PLAT)*pitEase((s-PIT_OUT_S)/Math.max(1,PIT_EXIT_S-PIT_OUT_S));
  if(s<=PIT_EXIT_S+r.rejoin)return r.exitLat+(pitRouteLineAt(s)-r.exitLat)*pitEase((s-PIT_EXIT_S)/Math.max(1,r.rejoin));return pitRouteLineAt(s);}
function pitRouteRoadLatAt(pos){const s=((pos%L)+L)%L;return s>=PIT_ENTRY_S?pitRouteEntryLatAt(s)-4:pitRouteExitLatAt(s)-4;}
function pitRouteEntryBoundaryAt(pos){return pitRouteEntryLatAt(pos)-4+10.5;}
function pitRouteExitBoundaryAt(pos){return pitRouteExitLatAt(pos)-4+10.5;}
function applyPitData(){const d=PITDATA[TRACK.key],base=PITROUTES[TRACK.key]||PITROUTES.ring,r=TRACK.len?L/TRACK.len:1,
    route=PIT_ROUTE=Object.assign({},base,{approach:base.approach*r,entry:base.entry*r,exit:base.exit*r,rejoin:base.rejoin*r});TRACK.pitLim=d&&typeof d[2]==="number"&&d[3]!=="T1"?d[2]:80;
  if(!d||!TRACK.len){PIT_IN_S=PIT_ENTRY_S+route.entry;PIT_OUT_S=Math.max(0,PIT_EXIT_S-route.exit);finalizePitRoute(route);return;}
  const last=CORNERS[CORNERS.length-1],first=CORNERS[0];
  const maxEn=last?Math.max(246,L-last.i1*DS-25):246,maxEx=first?Math.max(250,first.i0*DS-25):250;
  const en=clamp(d[0]*r,200,maxEn),ex=d[3]==="T1"&&first?first.i1*DS+60:clamp(d[1]*r,210,maxEx);   // Baku: Ausfahrtsspur läuft links durch Kurve 1
  PIT_ENTRY_S=L-en;PIT_EXIT_S=ex;PIT_IN_S=PIT_ENTRY_S+route.entry;PIT_OUT_S=Math.max(0,PIT_EXIT_S-route.exit);DEC_S=PIT_ENTRY_S-route.approach;BOX0=-125;
  const X=PITX[TRACK.key];if(!X){finalizePitRoute(route);return;}
  if(X.enC){const c=CORNERS[CORNERS.length-X.enC];if(c)PIT_ENTRY_S=c.i0*DS-X.enPre*r;}
  if(X.en)PIT_ENTRY_S=L-X.en*r;
  if(X.ex==="T1"&&first)PIT_EXIT_S=first.i1*DS+X.exPost*r;
  if(X.box!=null){BOX0=X.box*r;PIT_IN_S=Math.min(PIT_IN_S,L+BOX0-40);}
  PIT_IN_S=Math.min(PIT_IN_S,PIT_ENTRY_S+route.entry);
  PIT_OUT_S=Math.max(0,PIT_EXIT_S-route.exit);finalizePitRoute(route);}
function finalizePitRoute(route){const first=L+BOX0,last=first+24*(TEAM_KEYS.length-1),minPitOut=Math.max(0,last-L+25);PIT_IN_S=Math.min(PIT_IN_S,first-70);
  PIT_ENTRY_S=Math.min(PIT_ENTRY_S,PIT_IN_S-route.entry);route.entry=PIT_IN_S-PIT_ENTRY_S;
  PIT_OUT_S=Math.max(minPitOut,Math.min(PIT_OUT_S,PIT_EXIT_S-30));
  route.exit=PIT_EXIT_S-PIT_OUT_S;DEC_S=PIT_ENTRY_S-route.approach;}
/* Sonderfälle: Monaco – Boxen auf der Geraden vor Ste Dévote; Silverstone – F1-Boxengasse (Wing): Einfahrt vor Vale, Ausfahrt außen an Farm */
const PITX={monaco:{en:330,box:-280},silverstone:{enC:3,enPre:15,ex:"T1",exPost:25},
  // Las Vegas: the FIA plan places Pit Lane Ends at the sweeping exit beside the garages;
  // the separated lane continues through the first-corner exit to the SC2 merge line.
  vegas:{ex:"T1",exPost:35}};

/* ---- Stewards-Panel ---- */
const STEW_POOL=["Hannes Vogt","Claire Moreau","Rafael Ortega","Ingrid Holm","Kenji Sato","Marta Rossi","David Okafor","Lena Brandt"];
const DSTEW_POOL=["Erik Lindqvist (Ex-F1-Fahrer)","Marco Bellini (Ex-F1-Fahrer)","Tom Hayes (Ex-F1-Fahrer)","Yuto Mori (Ex-F1-Fahrer)"];
function stewPanel(){if(!W.panel){const s=shuffle(STEW_POOL);W.panel=[{n:s[0],acc:0.66},{n:s[1],acc:0.62},{n:pick(DSTEW_POOL),acc:0.8,drv:true}];}return W.panel;}
function opinionTxt(inc,v){if(inc.kind==="inc"){if(!v||!v.pen)return "keine Strafe";if(v.pen==="swap")return `${v.who.drv.code}: Platz zurückgeben`;return `${v.pen} Sek. für ${v.who.drv.code}`;}
  if(inc.kind==="yellow")return v>0?`${v} Sek.`:"keine Strafe";return v==="pen"?"Strafe":"kein Verstoß";}
function panelHtml(inc){if(inc.kind==="info"||inc.truth==null||inc.status==="done")return "";
  if(!inc.panel){inc.panel=stewPanel().map(st=>{const right=Math.random()<st.acc;let v=inc.truth;
    if(!right){if(inc.kind==="inc"){const t=inc.truth;v=t.pen?(Math.random()<0.5?{who:t.who,pen:0}:{who:t.who,pen:t.pen===5?10:5}):{who:pick(inc.cars),pen:5};}
      else if(inc.kind==="yellow")v=inc.truth===20?10:20;else v=inc.truth==="pen"?"ok":"pen";}
    return {n:st.n,drv:st.drv,txt:opinionTxt(inc,v),sure:right?irand(60,90):irand(45,75)};});}
  return `<h4>Stewards-Panel</h4><div class="hint" style="line-height:1.6">${inc.panel.map(p=>`<b>${esc(p.n)}</b>: ${esc(p.txt)} <span style="opacity:.6">(${p.sure}% sicher)</span>`).join("<br>")}<br><i>Du hast als Vorsitzender das letzte Wort – die Mehrheit liegt nicht immer richtig.</i></div>`;}

/* ---- Right of Review & Berufung ---- */
function collectReviews(k){if(!k||!k.roster||!S)return;const out=[];
  for(const inc of S.incidents){if(inc.status!=="done"||inc.kind==="info"||inc.missed)continue;
    const team=(inc.cars[1]||inc.cars[0]).drv.team;out.push({title:inc.title,ok:!!inc.ok,team,track:TRACK.name,explain:inc.explain||"",cars:inc.cars.map(c=>c.drv.code).join("/")});}
  k.rorCand=out;}
function reviewRequests(k,reqNotes){const out=[];k.appeals=k.appeals||[];
  k.appeals.filter(a=>k.round>=a.round).forEach(a=>{reqNotes.push(a.ok?`Berufungsgericht (ICA) bestätigt deine Entscheidung zu „${a.title}“ – Ansehen +2.`:`Berufungsgericht (ICA) hebt deine Entscheidung zu „${a.title}“ auf – Ansehen −5.`);k.rep=clamp((k.rep||60)+(a.ok?2:-5),0,100);});
  k.appeals=k.appeals.filter(a=>k.round<a.round);
  const c=(k.rorCand||[]);k.rorCand=[];if(!c.length)return out;
  const wrong=c.filter(x=>!x.ok),cand=wrong.length&&Math.random()<0.55?pick(wrong):Math.random()<0.2?pick(c):null;if(!cand)return out;
  const genuine=cand.ok?Math.random()<0.3:Math.random()<0.7;
  const ev=genuine?pick(["bisher nicht verfügbares Onboard-Video eines dritten Autos","Telemetrie, die zum Zeitpunkt der Entscheidung nicht vorlag","GPS-Daten mit exakter Position beider Autos am Scheitelpunkt"])
    :pick(["dieselbe TV-Aufnahme aus einer anderen Wiedergabe","eine neue Aussage des eigenen Fahrers","Social-Media-Clip, der dieselbe Szene zeigt"]);
  out.push({ror:true,cand,genuine,ev});return out;}
function runReview(k,r,done){const m=$("modal"),T_=TEAMS[r.cand.team].name;m.className="modal wide";
  m.innerHTML=`<h2>⚖️ Right of Review</h2><p><b>${esc(T_)}</b> beantragt die Überprüfung der Entscheidung <b>„${esc(r.cand.title)}“</b> (${esc(r.cand.track)}).</p>
   <p>Vorgelegtes Element: <b>${esc(r.ev)}</b></p><p class="hint">Zulässig nur bei einem <b>wesentlichen, relevanten und neuen</b> Element, das bei der Entscheidung nicht verfügbar war.</p>
   <div id="rvFb"></div><div id="rvB" style="display:flex;gap:10px"><button class="big go" id="rvY">Zulassen</button><button class="big" style="background:#7a1d1d" id="rvN">Ablehnen</button></div>`;
  $("overlay").classList.add("show");
  const fin=(ok,txt,extra)=>{const p=ok?60:-60;k.score=(k.score||0)+p;k.rep=clamp((k.rep||60)+(ok?1:-3),0,100);
    $("rvFb").innerHTML=judged(k,ok,p,txt,"Right of Review: "+r.cand.title)+(extra||"");$("rvB").innerHTML=`<button class="big go" id="rvGo">Weiter</button>`;$("rvGo").onclick=done;};
  const appeal=(keptWrong)=>{if(keptWrong||Math.random()<0.2){k.appeals=k.appeals||[];k.appeals.push({round:k.round+2,title:r.cand.title,ok:!keptWrong});
    return `<div class="fbk mid">${esc(T_)} kündigt Berufung beim Internationalen Berufungsgericht (ICA) an – das Urteil kommt in zwei Rennen.</div>`;}return "";};
  $("rvY").onclick=()=>{if(!r.genuine){fin(false,"Das Element war nicht neu – der Antrag hätte abgewiesen werden müssen.",appeal(!r.cand.ok));return;}
    $("rvFb").innerHTML=`<p>Das Element wird zugelassen und geprüft: <i>${esc(r.cand.explain||"siehe Daten")}</i></p>`;
    $("rvB").innerHTML=`<button class="big go" id="rvK">Entscheidung bestätigen</button><button class="big" style="background:#7a1d1d" id="rvC">Entscheidung korrigieren</button>`;
    $("rvK").onclick=()=>fin(r.cand.ok,r.cand.ok?"Die ursprüngliche Entscheidung war richtig.":"Die Entscheidung war falsch und hätte korrigiert werden müssen.",appeal(!r.cand.ok));
    $("rvC").onclick=()=>{const was=r.cand.ok;fin(!was,was?"Die alte Entscheidung war richtig – die Korrektur ist ein Fehler.":"Korrigiert – die neue Entscheidung entspricht den Fakten.",appeal(was));};};
  $("rvN").onclick=()=>fin(!r.genuine,r.genuine?"Das Element war neu und relevant – der Antrag war zulässig.":"Richtig – kein neues Element, Antrag abgewiesen.",r.genuine?appeal(!r.cand.ok):"");}

/* ---- Technische Abnahme nach dem Rennen ---- */
function scrutiny(done){const fin=W.results||classification(),pool=fin.filter(c=>c.finished&&!c.dsq);if(pool.length<3){done();return;}
  const sel=[...new Set(pool.slice(0,3).concat(shuffle(pool.slice(3)).slice(0,2)))];
  const rows=sel.map(c=>{const r=Math.random(),bad=r<0.09?"plank":r<0.15?"weight":r<0.19?"fuel":null;
    return {c,plank:bad==="plank"?+(rand(8.6,8.95)).toFixed(2):+(rand(9.0,9.6)).toFixed(2),weight:bad==="weight"?+(rand(766.4,767.9)).toFixed(1):+(rand(768.0,771.5)).toFixed(1),fuel:bad==="fuel"?+(rand(0.6,0.95)).toFixed(2):+(rand(1.05,2.4)).toFixed(2),bad};});
  const m=$("modal");m.className="modal wide";
  m.innerHTML=`<h2>🔧 Technische Abnahme</h2><p class="hint">Grenzwerte: Bodenplatte min. 9,0 mm · Mindestgewicht 768,0 kg (mit Fahrer) · Benzinprobe min. 1,0 l. Keine Toleranz.</p>
   <table class="res"><tr><th>Auto</th><th>Plank</th><th>Gewicht</th><th>Benzinprobe</th><th>Urteil</th></tr>${rows.map((x,i)=>`<tr><td>${esc(x.c.drv.name)}</td><td>${x.plank.toFixed(2)} mm</td><td>${x.weight.toFixed(1)} kg</td><td>${x.fuel.toFixed(2)} l</td>
   <td><label><input type="checkbox" id="sq${i}"> disqualifizieren</label></td></tr>`).join("")}</table><div id="sqFb"></div><div id="sqB"><button class="big go" id="sqGo">Bericht abschließen</button></div>`;
  $("overlay").classList.add("show");
  $("sqGo").onclick=()=>{let pts=0,msg=[];rows.forEach((x,i)=>{const d=$("sq"+i).checked,ok=d===!!x.bad;pts+=ok?(x.bad?80:10):-80;W.dec.total++;if(ok)W.dec.ok++;
      if(d){x.c.dsq=true;addLog(`TECHNICAL DELEGATE: CAR ${x.c.drv.num} (${x.c.drv.code}) DISQUALIFIED`,"bad");}
      msg.push(`${x.c.drv.code}: ${x.bad?{plank:"Bodenplatte zu dünn",weight:"untergewichtig",fuel:"Benzinprobe zu klein"}[x.bad]+(d?" – DSQ korrekt":" – übersehen!"):(d?"regelkonform – DSQ falsch!":"regelkonform")}`);});
    score(pts);review("Technische Abnahme",pts>0,pts,msg.join(" · "));W.results=classification();
    $("sqFb").innerHTML=FB_LIVE?`<div class="fbk ${pts>0?"ok":"bad"}">${esc(msg.join(" · "))} (${pts>0?"+":""}${pts})</div>`:`<div class="fbk mid">Bericht an die Stewards übergeben.</div>`;$("sqB").innerHTML=`<button class="big go" id="sqNx">Weiter</button>`;$("sqNx").onclick=done;};}

/* ---- Power-Unit-Kontingente 2026 ---- */
const PU_ALLOC={ICE:4,TC:4,EX:4,"MGU-K":3,ES:3,CE:3};
function puRequests(k,notes){if(k.type!=="season"||k.round<2)return null;k.pu=k.pu||{};const fits=[];
  for(const d of DRIVERS){const u=k.pu[d.code]=k.pu[d.code]||{ICE:1,TC:1,EX:1,"MGU-K":1,ES:1,CE:1};
    const p=0.03+k.round*0.006+(TEAMS[d.team].pace>1.3?0.02:0);if(Math.random()>p)continue;
    const els=shuffle(Object.keys(PU_ALLOC)).slice(0,irand(1,3));const nw=[];
    for(const e of els){u[e]++;nw.push(e);}fits.push({d,nw,u:Object.assign({},u)});}
  if(!fits.length)return null;
  const truth=f=>{let p=0;for(const e of f.nw){const n=f.u[e],a=PU_ALLOC[e];if(n>a)p+=(n===a+1?10:5);}return p>15?99:p;};
  return {fits,truth};}
function runPU(k,req,done){const m=$("modal");m.className="modal wide";const opts=[0,5,10,15,20,99];
  m.innerHTML=`<h2>⚙️ Technischer Delegierter: neue Power-Unit-Elemente</h2>
   <p class="hint">Kontingent 2026 pro Fahrer: ICE 4 · TC 4 · EX 4 · MGU-K 3 · ES 3 · CE 3. Erstes Element über dem Limit pro Typ: 10 Plätze, jedes weitere desselben Typs: 5. Mehr als 15 Plätze insgesamt: Start vom Ende des Feldes.</p>
   <table class="res"><tr><th>Fahrer</th><th>Neu eingebaut (Stand / Limit)</th><th>Startplatzstrafe</th></tr>${req.fits.map((f,i)=>`<tr><td>${esc(f.d.name)}</td><td>${f.nw.map(e=>`${e} ${f.u[e]}/${PU_ALLOC[e]}${f.u[e]>PU_ALLOC[e]?" ⚠":""}`).join(" · ")}</td>
   <td><select id="pu${i}">${opts.map(o=>`<option value="${o}">${o===99?"Ende des Feldes":o?o+" Plätze":"keine"}</option>`).join("")}</select></td></tr>`).join("")}</table>
   <div id="puFb"></div><div id="puB"><button class="big go" id="puGo">Strafen festlegen</button></div>`;
  $("overlay").classList.add("show");
  $("puGo").onclick=()=>{let pts=0;const msg=[];k.gridPen=k.gridPen||{};
    req.fits.forEach((f,i)=>{const v=+$("pu"+i).value,t=req.truth(f),ok=v===t;pts+=ok?(t?60:10):-60;k.dec.total++;if(ok)k.dec.ok++;if(v)k.gridPen[f.d.code]=v;
      if(!ok||t)msg.push(`${f.d.code}: richtig wäre ${t===99?"Ende des Feldes":t?t+" Plätze":"keine Strafe"}${ok?" ✔":" ✘"}`);});
    k.score=(k.score||0)+pts;$("puFb").innerHTML=judged(k,pts>=0,pts,msg.join(" · ")||"Alles im Kontingent – keine Strafe nötig.","Power-Unit-Strafen");
    $("puB").innerHTML=`<button class="big go" id="puNx">Weiter</button>`;$("puNx").onclick=done;};}
