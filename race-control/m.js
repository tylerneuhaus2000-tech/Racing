"use strict";
/* ============ Fahrermarkt, Sperren, Ersatzfahrer, Upgrades, Saisonwechsel ============ */
/* Reserve-, Entwicklungs- und Nachwuchsfahrer (Stand Nov. 2026). SL = Superlizenz-Punkte der letzten 3 Jahre (Schätzung),
   held = besitzt bereits eine Superlizenz (Ex-F1, IndyCar usw.). skill wie beim Stammfeld: Abstand zum Teamtempo (kleiner = besser). */
const POOL=[
 ["TSU","Yuki Tsunoda",22,"RBR","Reserve Red Bull & Racing Bulls",0.16,0,true,.65,.55,"Ex-Stammfahrer Red Bull"],
 ["IWA","Ayumu Iwasa",34,"RCB","Reserve Racing Bulls",0.30,0,true,.55,.5,"Super Formula, Superlizenz vorhanden"],
 ["FOR","Leonardo Fornaroli",37,"MCL","Reserve McLaren",0.30,40,false,.45,.5,"F2-Meister 2025 (40)"],
 ["OWA","Pato O'Ward",39,"MCL","Reserve McLaren",0.32,0,true,.7,.6,"IndyCar-Spitzenfahrer"],
 ["VES","Frederik Vesti",36,"MER","Reserve Mercedes",0.36,0,true,.5,.5,"F2-Vizemeister 2023"],
 ["POU","Théo Pourchaire",62,"MER","Entwicklung Mercedes",0.40,40,false,.5,.5,"F2-Meister 2023 (40)"],
 ["DUR","Joshua Dürksen",54,"MER","Entwicklung Mercedes / F2",0.48,14,false,.6,.5,"F2: nur Einzelsiege, zu wenig Punkte"],
 ["GIO","Antonio Giovinazzi",99,"FER","Reserve Ferrari",0.34,0,true,.5,.55,"Ex-F1-Stammfahrer"],
 ["BRO","Luke Browning",38,"WIL","Reserve Williams",0.36,42,false,.5,.5,"F2 2025 P4 (30) + F3/FP1-Punkte"],
 ["MRT","Victor Martins",61,"WIL","Entwicklung Williams",0.44,24,false,.55,.5,"F2-Ergebnisse reichen nicht"],
 ["CRA","Jak Crawford",35,"AMR","Reserve Aston Martin",0.34,40,false,.55,.5,"F2-Vizemeister 2025 (40)"],
 ["VAN","Stoffel Vandoorne",2,"AMR","Reserve Aston Martin",0.38,0,true,.4,.6,"Ex-F1-Stammfahrer"],
 ["BOY","Mari Boya",56,"AMR","Nachwuchs Aston Martin / F2",0.55,6,false,.55,.5,"F2-Hinterfeld"],
 ["DOO","Jack Doohan",7,"HAA","Reserve Haas",0.30,0,true,.6,.45,"Ex-Stammfahrer Alpine"],
 ["HIR","Ryo Hirakawa",45,"HAA","Reserve Haas",0.38,0,true,.45,.55,"WEC/Super Formula"],
 ["ARO","Paul Aron",97,"ALP","Reserve Alpine",0.34,40,false,.55,.5,"F2 2024 P3 (40)"],
 ["MAI","Kush Maini",46,"ALP","Reserve Alpine / F2",0.46,22,false,.6,.5,"F2-Mittelfeld – zu wenig Punkte"],
 ["ZHO","Zhou Guanyu",24,"CAD","Reserve Cadillac",0.30,0,true,.4,.5,"Ex-F1-Stammfahrer"],
 ["HER","Colton Herta",26,"CAD","Testfahrer Cadillac / F2",0.32,0,true,.7,.5,"IndyCar-Vizemeister 2024"],
 ["FIT","Pietro Fittipaldi",51,"CAD","Entwicklung Cadillac",0.44,0,true,.45,.5,"Ex-F1-Ersatzfahrer"],
 ["BOS","Ralph Boschung",47,"AUD","Entwicklung Audi",0.52,8,false,.45,.5,"keine Superlizenz"],
 ["TSO","Nikola Tsolov",48,"RBR","Red-Bull-Junior · F2",0.30,65,false,.7,.55,"F3 2025 P2 (25) + F2 2026 Spitze (40)"],
 ["CGH","Mattia Colnaghi",59,"RBR","Red-Bull-Junior · F3",0.62,4,false,.6,.5,"F3 – max. 30 Punkte möglich"],
 ["RIV","Ernesto Rivera",60,"RBR","Red-Bull-Junior · F3",0.66,0,false,.6,.5,"F3-Neuling"],
 ["CAM","Rafael Câmara",49,"FER","Ferrari-Junior · F2",0.30,70,false,.6,.55,"F3-Meister 2025 (30) + F2 2026 Spitze (40)"],
 ["BEG","Dino Beganovic",53,"FER","Ferrari-Junior · F2",0.44,26,false,.55,.5,"F2-Mittelfeld"],
 ["TAP","Tuukka Taponen",58,"FER","Ferrari-Junior · F3",0.60,9,false,.65,.5,"F3"],
 ["MIN","Gabriele Minì",50,"ALP","Alpine-Junior · F2",0.32,65,false,.6,.5,"F3 2024 P2 (25) + F2 2026 Spitze (40)"],
 ["DUN","Alex Dunne",52,"ALP","Alpine-Junior · F2",0.33,50,false,.7,.5,"F2 2025 P5 (20) + F2 2026 P4 (30)"],
 ["UGO","Ugo Ugochukwu",57,"MCL","McLaren-Junior · F3",0.58,12,false,.55,.5,"F3-Spitze – max. 30 Punkte"]
];
const DB={};
DRIVERS.forEach(d=>{DB[d.code]={code:d.code,name:d.name,num:d.num,home:d.team,role:"Stammfahrer",skill:+(d.perf-TEAMS[d.team].pace).toFixed(3),sl:0,held:true,note:"F1-Stammfahrer",style:d.style}});
POOL.forEach(p=>{DB[p[0]]={code:p[0],name:p[1],num:p[2],home:p[3],role:p[4],skill:p[5],sl:p[6],held:p[7],note:p[10],style:p[9]};if(AGG[p[0]]==null)AGG[p[0]]=p[8];WETSTYLE[p[0]]=p[9];});
const BASE_ROSTER={};DRIVERS.forEach(d=>{(BASE_ROSTER[d.team]=BASE_ROSTER[d.team]||[])[d.slot]=d.code;});
const BASE_PACE={};TEAM_KEYS.forEach(t=>BASE_PACE[t]=TEAMS[t].pace);
const AGE={ALO:45,HAM:41,HUL:39,BOT:37,PER:36,SAI:32,OCO:30,GAS:30,VER:29,LEC:29,RUS:28,ALB:30,NOR:27,STR:28,PIA:25,COL:23,LAW:24,HAD:22,BOR:22,BEA:21,ANT:20,LIN:19};
const SISTER={RBR:"RCB",RCB:"RBR"};
const PRIZE=[140,131,122,113,104,95,86,77,68,59,50];

const slOk=code=>{const d=DB[code];return !!d&&(d.held||d.sl>=40);};
const slTxt=code=>{const d=DB[code];return d.held?"Superlizenz vorhanden":`${d.sl} Punkte`+(d.sl>=40?" – reicht":" – zu wenig (40 nötig)");};
function seatOf(k,code){for(const t of TEAM_KEYS)if(k.roster[t]&&k.roster[t].includes(code))return t;return null;}
function drvName(code){return DB[code]?DB[code].name:code;}
function initMgmt(k){if(k.roster)return;k.roster=JSON.parse(JSON.stringify(BASE_ROSTER));k.pace=Object.assign({},BASE_PACE);k.money={};k.tpoints={};
  k.season=k.season||1;k.year=k.year||2026;k.licLog=k.licLog||[];k.drep={};k.revert=[];k.mevents={};k.reqLog=[];
  for(const c in DB)k.drep[c]=clamp(Math.round(78-DB[c].skill*110),20,95);
  k.drep.VER=96;k.drep.NOR=88;k.drep.LEC=88;k.drep.HAM=84;k.drep.ALO=82;k.drep.RUS=86;k.drep.PIA=86;k.drep.ANT=84;}
/* Kader in DRIVERS übernehmen (DRIVERS wird an Ort und Stelle neu gefüllt) */
function applyRoster(k){if(!k)return;initMgmt(k);const sub=k.temp||{};
  TEAM_KEYS.forEach(t=>TEAMS[t].pace=k.pace[t]);
  const list=[];TEAM_KEYS.forEach((t,ti)=>(k.roster[t]||[]).forEach((code0,slot)=>{const code=sub[code0]||code0,d=DB[code];
    list.push({code,name:d.name,num:d.num,team:t,ti,slot,color:TEAMS[t].color,perf:TEAMS[t].pace+d.skill,style:d.style==null?0.5:d.style});}));
  DRIVERS.length=0;list.forEach(x=>DRIVERS.push(x));}
function curAbs(k){const key=k.cal[Math.min(k.round,k.cal.length-1)];return (k.season-1)*CALENDAR.length+Math.max(0,CALENDAR.indexOf(key));}
function licSum(k,code){const now=curAbs(k);return k.licLog.filter(e=>e.c===code&&!e.void&&now-e.abs<CALENDAR.length).reduce((a,e)=>a+e.n,0);}
function refreshLic(k){k.lic={};for(const e of k.licLog)if(!e.void&&curAbs(k)-e.abs<CALENDAR.length)k.lic[e.c]=(k.lic[e.c]||0)+e.n;for(const c in k.lic)if(k.lic[c]<=0)delete k.lic[c];}
/* Ruf nach jedem Rennen: Ergebnis gegen Erwartung (Auto) und gegen Teamkollegen */
function mgmtRaceDone(cl,k){if(!k||!k.roster)return;const exp=cl.slice().sort((a,b)=>a.drv.perf-b.drv.perf);
  cl.forEach((c,i)=>{const e=exp.indexOf(c),pos=c.finished&&!c.dsq?i:21;k.drep[c.drv.code]=clamp((k.drep[c.drv.code]||50)+(e-pos)*0.35+(c.dsq?-3:0),5,99);
    k.tpoints[c.drv.team]=k.tpoints[c.drv.team]||0;});
  TEAM_KEYS.forEach(t=>{const ms=cl.filter(c=>c.drv.team===t);if(ms.length===2){const[a,b]=ms,ia=cl.indexOf(a),ib=cl.indexOf(b);const w=ia<ib?a:b,l=ia<ib?b:a;k.drep[w.drv.code]+=0.6;k.drep[l.drv.code]-=0.6;}});}

/* ---- Anträge an die Rennleitung ---- */
function checkReq(k,r){const inn=r.inn;
  if(k.banNow&&k.banNow.includes(inn))return {ok:false,why:`${drvName(inn)} ist für dieses Rennen gesperrt (12 Strafpunkte) – er darf auch nicht als Ersatz fahren.`};
  if(!slOk(inn))return {ok:false,why:`${drvName(inn)} hat keine Superlizenz: ${slTxt(inn)}. Ohne 40 Punkte in drei Jahren darf er kein Rennen fahren.`};
  const s=seatOf(k,inn);
  if(s&&s!==r.team&&r.release===s)return {ok:true,why:`${drvName(inn)} ist bei ${TEAMS[s].name} unter Vertrag, die Freigabe liegt vor – Wechsel zulässig (Superlizenz: ${slTxt(inn)}).`};
  if(s&&s!==r.team&&!(r.type==="swap"&&SISTER[r.team]===s))return {ok:false,why:`${drvName(inn)} hat einen laufenden Stammvertrag bei ${TEAMS[s].name}. Ein Wechsel ist nur mit Freigabe beider Teams und als Tausch möglich.`};
  if(r.dup)return {ok:false,why:`${drvName(inn)} ist für die kommende Saison bereits bei ${TEAMS[r.dup].name} registriert – Doppelvertrag, der Contract Recognition Board würde ablehnen.`};
  return {ok:true,why:r.type==="swap"?"Beide Teams gehören zur selben Gruppe und haben zugestimmt, beide Fahrer haben eine Superlizenz.":`${drvName(inn)}: ${slTxt(inn)}, kein anderer Stammvertrag – zulässig.`};}
function reqHtml(k,r){const d=DB[r.inn],o=r.out?DB[r.out]:null,lp=licSum(k,r.inn);
  return `<h2>📨 Antrag an die Rennleitung</h2><div class="hint" style="margin-bottom:8px">${esc(r.ctx||"")}</div>
  <div style="font-size:15px;line-height:1.5"><b style="color:${TEAMS[r.team].color}">${TEAMS[r.team].name}</b> beantragt: ${esc(r.text)}</div>
  <table class="res" style="margin-top:10px"><tr><th>Fahrer</th><th>Rolle</th><th>Superlizenz</th><th>Strafpunkte</th><th>Vertrag</th></tr>
  <tr><td><b>${esc(d.name)}</b> #${d.num}</td><td>${esc(d.role)}</td><td>${d.held?"vorhanden":d.sl+" / 40"}<br><small class="hint">${esc(d.note)}</small></td><td>${lp||0}${k.banNow&&k.banNow.includes(r.inn)?" · <b style='color:#e10600'>gesperrt</b>":""}</td><td>${seatOf(k,r.inn)?TEAMS[seatOf(k,r.inn)].name+(seatOf(k,r.inn)!==r.team&&r.type!=="swap"?(r.release?" · Freigabe ✓":" · keine Freigabe"):""):r.dup?"registriert: "+TEAMS[r.dup].name:"frei"}</td></tr>
  ${o?`<tr><td>${esc(o.name)} (raus)</td><td colspan="4" class="hint">${esc(r.outWhy||"")}</td></tr>`:""}</table>
  <p class="hint">Prüfe: Superlizenz (40 Punkte in drei Jahren oder bereits gehalten) · nicht gesperrt · kein fremder Stammvertrag · keine Doppelregistrierung. Red Bull und Racing Bulls dürfen untereinander tauschen.</p>
  <div id="reqFb"></div><div id="reqBtns" style="display:flex;gap:10px"><button class="big go" id="rqYes">Genehmigen</button><button class="big" style="background:#7a1d1d" id="rqNo">Ablehnen</button></div>`;}
let RQ_LAST=null;
/* Bewertung erst nach dem Rennen: Ergebnis merken, neutral anzeigen */
function judged(k,ok,pts,why,title,cls){if(FB_LIVE)return `<div class="fbk ${cls||(ok?"ok":"bad")}">${ok?"✔ Richtig":"✘ Falsch"} (${pts>0?"+":""}${pts}). ${esc(why)}</div>`;
  k.lateRev=k.lateRev||[];k.lateRev.push({title,ok,pts,explain:why,sess:"Rennleitung"});return `<div class="fbk mid">Entscheidung registriert. Die Bewertung folgt nach dem Rennen.</div>`;}
function runRequests(k,list,done){
  const step=()=>{const r=list.shift();if(!r){done();return;}
    if(r.gen){const g=r.gen();if(!g){step();return;}Object.assign(r,g);}
    RQ_LAST=r;const m=$("modal");m.className="modal wide";m.innerHTML=reqHtml(k,r);$("overlay").classList.add("show");
    const decide=yes=>{const c=checkReq(k,r),ok=yes===c.ok,pts=ok?60:-60;k.score=(k.score||0)+pts;k.dec=k.dec||{ok:0,total:0};k.dec.total++;if(ok)k.dec.ok++;
      k.rep=clamp((k.rep==null?60:k.rep)+(ok?1:-3),0,100);k.reqLog.push({t:r.text,team:r.team,ok,yes});
      if(yes)r.apply();else if(r.onReject){const nx=r.onReject();if(nx)list.unshift(nx);}
      $("reqBtns").innerHTML=`<button class="big go" id="rqNext">Weiter</button>`;
      $("reqFb").innerHTML=judged(k,ok,pts,c.why+(yes&&!c.ok?" Die FIA hat die Genehmigung nachträglich kassiert.":""),"Antrag: "+r.text);
      if(yes&&!c.ok&&r.undo)r.undo();
      $("rqNext").onclick=step;};
    $("rqYes").onclick=()=>decide(true);$("rqNo").onclick=()=>decide(false);};
  step();}
/* Kandidaten eines Teams: eigene Reserve/Junioren, dann die des Motorenpartners, dann freie Fahrer */
const PARTNER={HAA:"FER",CAD:"FER",WIL:"MER",ALP:"MER",RCB:"RBR",RBR:"RCB",MCL:"MCL",MER:"MER",FER:"FER",AMR:"AMR",AUD:"AUD"};
function candidates(k,team,excl){const free=Object.keys(DB).filter(c=>!seatOf(k,c)&&!(excl||[]).includes(c)&&!(k.banNow||[]).includes(c)&&!(k.retired||[]).includes(c));
  const w=c=>{const d=DB[c];return (d.home===team?0:d.home===PARTNER[team]?1:2)*100+(slOk(c)?0:50)-k.drep[c]*0.3;};
  return free.sort((a,b)=>w(a)-w(b));}
/* Teams machen manchmal Fehler im Antrag – die Rennleitung muss es merken */
function proposal(k,team,excl,errRate){const cs=candidates(k,team,excl);if(!cs.length)return null;
  if(Math.random()<errRate){const bad=cs.find(c=>!slOk(c)&&(DB[c].home===team||DB[c].home===PARTNER[team]))||cs.find(c=>!slOk(c));if(bad)return bad;}
  return cs.find(slOk)||cs[0];}

/* Vor jedem Rennen: Sperren, Rückkehr nach Tausch, Entlassungen, Red-Bull-Tausch */
function mgmtBeforeRound(k,go){initMgmt(k);k.temp={};k.banNow=[];
  const reqs=[],notes=[];
  (k.revert||[]).filter(r=>k.round>=r.round).forEach(r=>{const i=k.roster.RBR.indexOf(r.b),j=k.roster.RCB.indexOf(r.a);if(i>=0&&j>=0){k.roster.RBR[i]=r.a;k.roster.RCB[j]=r.b;notes.push(r.msg);}});k.revert=(k.revert||[]).filter(r=>k.round<r.round);
  refreshLic(k);
  TEAM_KEYS.forEach(t=>(k.roster[t]||[]).forEach(code=>{if(licSum(k,code)>=12){k.banNow.push(code);
    k.licLog.forEach(e=>{if(e.c===code)e.void=true;});notes.push(`${drvName(code)} hat 12 Strafpunkte erreicht – Sperre für dieses Rennen, das Punktekonto wird danach auf null gesetzt.`);
    const tried=[];const mk=()=>{const inn=proposal(k,t,tried,0.35);if(!inn)return null;tried.push(inn);
      return {type:"sub",team:t,out:code,inn,ctx:`Sperre: ${drvName(code)} darf beim ${TRACK.name} nicht starten.`,text:`${drvName(inn)} ersetzt ${drvName(code)} für dieses Rennen.`,outWhy:"gesperrt (12 Strafpunkte in 12 Monaten)",
        apply(){k.temp[code]=inn;},undo(){delete k.temp[code];const nx=mk();if(nx)reqs.unshift(nx);},onReject:mk};};
    const r=mk();if(r)reqs.push(r);}}));
  if(k.type==="season"&&k.round>=4){
    /* Entlassung wegen Leistung */
    const pts=c=>k.points[c]||0;
    for(const t of shuffle(TEAM_KEYS)){if(k.mevents["fire"+t]||["MER","FER","MCL"].includes(t))continue;const[a,b]=k.roster[t];
      const lo=pts(a)<pts(b)?a:b,hi=lo===a?b:a;if(k.drep[lo]<42&&pts(hi)-pts(lo)>=Math.max(12,k.round*2)&&Math.random()<0.28){k.mevents["fire"+t]=1;
        const inn=proposal(k,t,[],0.3);if(!inn)break;const old=JSON.parse(JSON.stringify(k.roster));
        reqs.push({type:"fire",team:t,out:lo,inn,ctx:`${TEAMS[t].name} ist mit ${drvName(lo)} unzufrieden (${pts(lo)} zu ${pts(hi)} Punkte gegen den Teamkollegen).`,
          text:`Entlassung von ${drvName(lo)} – ${drvName(inn)} übernimmt das Cockpit ab sofort.`,outWhy:"Leistung erfüllt die Erwartungen nicht",
          apply(){const i=k.roster[t].indexOf(lo);k.roster[t][i]=inn;radioNote(`${TEAMS[t].name}: ${drvName(lo)} entlassen, ${drvName(inn)} rückt nach.`);},undo(){k.roster=old;}});break;}}
    /* Red Bull ↔ Racing Bulls */
    if(!k.mevents.swap&&Math.random()<0.22){const rb2=k.roster.RBR.slice().sort((a,b)=>pts(a)-pts(b))[0],vc=k.roster.RCB.slice().sort((a,b)=>pts(b)-pts(a))[0];
      if(pts(vc)>pts(rb2)+4){k.mevents.swap=1;const temp=Math.random()<0.45,old=JSON.parse(JSON.stringify(k.roster)),n=irand(2,4);
        reqs.push({type:"swap",team:"RBR",out:rb2,inn:vc,ctx:`Red Bull will reagieren: ${drvName(rb2)} hat ${pts(rb2)} Punkte, ${drvName(vc)} bei Racing Bulls ${pts(vc)}.`,
          text:`Tausch ${drvName(rb2)} ↔ ${drvName(vc)} zwischen Red Bull und Racing Bulls${temp?` – vorübergehend für ${n} Rennen`:" – dauerhaft"}.`,outWhy:"wechselt zu Racing Bulls",
          apply(){const i=k.roster.RBR.indexOf(rb2),j=k.roster.RCB.indexOf(vc);k.roster.RBR[i]=vc;k.roster.RCB[j]=rb2;if(temp)k.revert.push({round:k.round+n,a:rb2,b:vc,msg:`Tausch beendet: ${drvName(rb2)} kehrt zu Red Bull zurück, ${drvName(vc)} zu Racing Bulls.`});},undo(){k.roster=old;}});}}
  }
  k.gridPen={};const revs=k.type==="season"?reviewRequests(k,notes):[];
  const finish=()=>{applyRoster(k);refreshLic(k);const pu=puRequests(k,notes);if(pu)runPU(k,pu,go);else go();};
  const start=()=>{const rv=revs.slice();const nx=()=>{const r=rv.shift();if(r)runReview(k,r,nx);else runRequests(k,reqs,finish);};nx();};
  if(notes.length){const m=$("modal");m.className="modal";m.innerHTML=`<h2>🗂 Vor dem Wochenende</h2>${notes.map(n=>`<div class="fbk mid">${esc(n)}</div>`).join("")}<button class="big go" id="ntGo">Weiter</button>`;
    $("overlay").classList.add("show");$("ntGo").onclick=start;}else start();}
function radioNote(t){try{addLog(t,"flag");}catch(e){}}

/* ---- Saisonende: Preisgeld, Upgrades, Fahrermarkt ---- */
function teamOrder(k){rebuildConstructorPoints(k);return TEAM_KEYS.slice().sort((a,b)=>(k.tpoints[b]||0)-(k.tpoints[a]||0));}
function offseason(k,done){initMgmt(k);const ord=teamOrder(k),rows=[];
  const eff={MER:1.1,FER:1.05,MCL:1.1,RBR:1.05,AMR:1.0,AUD:1.05,CAD:0.95,ALP:0.95,WIL:1.0,HAA:0.9,RCB:0.95};
  ord.forEach((t,i)=>{const money=PRIZE[i]+30,old=k.pace[t];k.money[t]=money;
    const dev=(money/170)*rand(0.25,0.6)*(eff[t]||1)*(1+i*0.03);                   // Budgetobergrenze: hinten etwas mehr Windkanalzeit
    const reg=(1.0-old)*0.18,noise=rand(-0.18,0.12);k.pace[t]=old-dev*0.55-reg*-1+noise;rows.push({t,i,money,old,dev});});
  const best=Math.min(...TEAM_KEYS.map(t=>k.pace[t]));TEAM_KEYS.forEach(t=>k.pace[t]=+(k.pace[t]-best).toFixed(2));
  const m=$("modal");m.className="modal wide";
  const av=k.rd&&k.rd.length?Math.round(k.rd.reduce((a,b)=>a+b,0)/k.rd.length):70;
  m.innerHTML=`<h2>🏁 Saisonende ${k.year} – Preisgeld & Upgrades</h2><div class="fbk ${av>=80?"ok":av>=60?"mid":"bad"}">Deine Saisonbilanz als Rennleiter: ${av}/100 – ${av>=80?"die FIA verlängert deinen Vertrag vorzeitig.":av>=60?"die FIA verlängert, erwartet aber mehr Konstanz.":"die FIA verlängert nur auf Bewährung."}</div>
  <table class="res"><tr><th>P</th><th>Team</th><th>Punkte</th><th>Preisgeld</th><th>Abstand ${k.year}</th><th>Abstand ${k.year+1}</th><th></th></tr>
  ${rows.map(r=>{const nw=k.pace[r.t],dl=nw-r.old;return `<tr><td>${r.i+1}</td><td><span style="color:${TEAMS[r.t].color}">■</span> ${TEAMS[r.t].name}</td><td>${k.tpoints[r.t]||0}</td><td>${r.money} Mio. $</td><td>${r.old.toFixed(2)} s</td><td><b>${nw.toFixed(2)} s</b></td><td style="color:${dl<-0.05?"#2fd16b":dl>0.05?"#e10600":"#9aa"}">${dl<-0.05?"▲ Upgrade zündet":dl>0.05?"▼ Entwicklung verfehlt":"≈"}</td></tr>`;}).join("")}</table>
  <p class="hint">Abstand = Rückstand des Autos auf das schnellste Team pro Runde. Mehr Preisgeld bringt mehr Entwicklung, die Budgetobergrenze hält das Feld zusammen.</p>
  <button class="big go" id="osNext">Weiter zum Fahrermarkt</button>`;
  $("overlay").classList.add("show");$("osNext").onclick=()=>market(k,done);}
function market(k,done){const reqs=[],notes=[],signed={};const pts=c=>k.points[c]||0;
  const open=[];                                                        // freie Cockpits
  TEAM_KEYS.forEach(t=>k.roster[t].forEach((c,i)=>{const age=AGE[c]||25,ret=age>=44?0.55:age>=40?0.3:age>=37?0.15:0;
    if(Math.random()<ret){notes.push(`${drvName(c)} beendet seine Karriere (${TEAMS[t].name}).`);k.roster[t][i]=null;open.push(t);k.retired=k.retired||[];k.retired.push(c);}
    else if(k.drep[c]<38&&Math.random()<0.6){notes.push(`${TEAMS[t].name} trennt sich von ${drvName(c)} – Ruf ${Math.round(k.drep[c])}.`);k.roster[t][i]=null;open.push(t);}}));
  const fin=()=>{TEAM_KEYS.forEach(t=>k.roster[t]=k.roster[t].map(c=>c||candidates(k,t,[]).find(slOk)));   // Notfall: Reserve mit Lizenz
    /* Nachwuchs entwickelt sich: F3 → F2, Punkte wandern */
    for(const c in DB){const d=DB[c];if(d.held||seatOf(k,c))continue;if(d.role.includes("F3")){d.sl=Math.min(60,d.sl+irand(5,28));d.role=d.role.replace("F3","F2");d.skill=Math.max(0.3,d.skill-0.12);}
      else if(d.role.includes("F2")){d.sl=Math.min(90,d.sl+irand(0,40));d.skill=Math.max(0.26,d.skill-0.05);}}
    for(const c in DB)if(seatOf(k,c)&&!DB[c].held)DB[c].held=true;
    k.dbx={};for(const c in DB)k.dbx[c]={sl:DB[c].sl,held:DB[c].held,role:DB[c].role,skill:DB[c].skill};
    k.year++;k.season++;k.round=0;k.rd=[];k.rdRound=null;k.points={};k.tpoints={};k.history=[];k.mevents={};k.revert=[];
    const m=$("modal");m.className="modal wide";
    m.innerHTML=`<h2>🆕 Starterfeld ${k.year}</h2><table class="res">${TEAM_KEYS.map(t=>`<tr><td><span style="color:${TEAMS[t].color}">■</span> ${TEAMS[t].name}</td><td>${k.roster[t].map(drvName).join(" · ")}</td><td>${k.pace[t].toFixed(2)} s</td></tr>`).join("")}</table>
      <button class="big go" id="nsGo">Saison ${k.year} starten</button>`;$("nsGo").onclick=done;};
  marketBoard(k,notes,fin);}
/* ================= Fahrermarkt-Dashboard =================
   1) Übersicht: Cockpits je Team (sicher / wackelt / frei), wen die Teams wollen, wohin die Fahrer wollen
   2) Rennleitung gibt jede Verhandlung frei oder lehnt ab (Superlizenz, Sperre, fremder Vertrag ohne Freigabe)
   3) Verhandlungen in Runden: Teams bieten, Fahrer nehmen das beste Angebot; frei gewordene Cockpits ziehen Ketten nach sich */
function mkStatus(k,t,c){if(!c)return {s:"frei",cls:"bad"};const age=AGE[c]||25,r=k.drep[c]||50,mate=k.roster[t].find(x=>x&&x!==c),mr=mate?k.drep[mate]||50:r;
  if(r<45||r<mr-14)return {s:"wackelt",cls:"mid"};if(age>=38)return {s:"letzte Saison?",cls:"mid"};return {s:"sicher",cls:"ok"};}
function mkDrvPref(k,c,t){const ord=teamOrder(k),i=ord.indexOf(t);return (10-i)*1.1+(DB[c]&&DB[c].home===t?2.5:0)+(k.money[t]||0)/90+(c.charCodeAt(0)*7+t.charCodeAt(1)*13)%10/8;}
function mkTeamPref(k,t,c){const age=AGE[c]||25;return (k.drep[c]||50)+(DB[c]&&DB[c].home===t?6:DB[c]&&DB[c].home===PARTNER[t]?3:0)-Math.max(0,age-37)*2.5+(k.points[c]||0)*0.04;}
function mkInterests(k){const ord=teamOrder(k),iv=[],seen=new Set();let id=0;
  const add=(t,c,kind,out,why)=>{const key=t+c;if(seen.has(key)||!c)return;seen.add(key);const from=seatOf(k,c);
    const release=from&&from!==t?(Math.random()<0.6||SISTER[t]===from):true;
    iv.push({id:id++,team:t,drv:c,kind,out:out||null,from:from&&from!==t?from:null,release,why,int:clamp(Math.round(mkTeamPref(k,t,c)),5,99)});};
  TEAM_KEYS.forEach(t=>{const open=k.roster[t].filter(c=>c===null).length;
    if(open){const cs=candidates(k,t,[]).slice(0,3);cs.forEach(c=>add(t,c,"frei",null,"freies Cockpit"));
      if(Math.random()<0.25){const bad=Object.keys(DB).find(c=>!seatOf(k,c)&&!slOk(c)&&(DB[c].home===t||DB[c].home===PARTNER[t]));if(bad)add(t,bad,"frei",null,"freies Cockpit (Junior)");}}
    const i=ord.indexOf(t),[a,b]=k.roster[t];
    if(a&&b){const lo=(k.drep[a]||50)<(k.drep[b]||50)?a:b;
      const stars=TEAM_KEYS.filter(x=>ord.indexOf(x)>i).flatMap(x=>k.roster[x].filter(Boolean)).filter(c=>(k.drep[c]||50)>(k.drep[lo]||50)+8).sort((p,q)=>(k.drep[q]||50)-(k.drep[p]||50)).slice(0,i<5?2:1);
      for(const st of stars)if(Math.random()<(i<5?0.5:0.22))add(t,st,"wechsel",lo,`Upgrade statt ${drvName(lo)}`);}});
  return iv;}
function mkValid(k,iv){const c=iv.drv;
  if(k.banNow&&k.banNow.includes(c))return {ok:false,why:`${drvName(c)} ist gesperrt.`};
  if(!slOk(c))return {ok:false,why:`${drvName(c)} hat keine Superlizenz (${slTxt(c)}).`};
  if(iv.from&&!iv.release)return {ok:false,why:`${drvName(c)} steht bei ${TEAMS[iv.from].name} unter Vertrag – ohne Freigabe darf ${TEAMS[iv.team].name} nicht verhandeln.`};
  return {ok:true,why:iv.from?`Freigabe von ${TEAMS[iv.from].name} liegt vor, Superlizenz ok.`:`Vertragsfrei, Superlizenz ok.`};}
function marketBoard(k,notes,fin){const iv=mkInterests(k),dec={},m=$("modal");m.className="modal wide";$("overlay").classList.add("show");
  const chip=(c,extra)=>`<span class="chip" style="display:inline-block;margin:1px 2px">${c}${extra?` <small style="opacity:.7">${extra}</small>`:""}</span>`;
  const draw=()=>{const nDec=Object.keys(dec).length;
    const teams=TEAM_KEYS.map(t=>{const want=iv.filter(x=>x.team===t).sort((a,b)=>b.int-a.int);
      return `<tr><td><span style="color:${TEAMS[t].color}">■</span> <b>${TEAMS[t].name}</b></td>${k.roster[t].map(c=>{const st=mkStatus(k,t,c);return `<td>${c?`<b>${c}</b> `:""}<span class="fbk ${st.cls}" style="display:inline;padding:1px 6px;margin:0">${st.s}</span></td>`;}).join("")}
        <td>${want.map(x=>chip(x.drv,x.int+"%")).join("")||'<span class="hint">–</span>'}</td></tr>`;}).join("");
    const drivers=[...new Set(iv.map(x=>x.drv))].map(c=>{const ts=iv.filter(x=>x.drv===c).map(x=>x.team).sort((a,b)=>mkDrvPref(k,c,b)-mkDrvPref(k,c,a));const f=seatOf(k,c);
      return `<tr><td><b>${c}</b> <small>${esc(drvName(c))}</small></td><td>${f?TEAMS[f].name:"vertragsfrei"}</td><td>${Math.round(k.drep[c]||50)}</td><td>${slOk(c)?"✓":"<b style='color:#e10600'>fehlt</b>"}</td><td>${ts.map((t,i)=>chip(t,i===0?"Favorit":"")).join("")}</td></tr>`;}).join("");
    const reqs=iv.map(x=>{const d=dec[x.id];return `<tr><td><span style="color:${TEAMS[x.team].color}">■</span> ${TEAMS[x.team].name} → <b>${x.drv}</b></td><td>${esc(x.why)}</td><td>${slOk(x.drv)?"✓":(DB[x.drv]?DB[x.drv].sl+"/40":"–")}</td>
      <td>${x.from?`${TEAMS[x.from].name} · ${x.release?"Freigabe ✓":"<b style='color:#e10600'>keine Freigabe</b>"}`:"frei"}</td><td>${k.banNow&&k.banNow.includes(x.drv)?"<b style='color:#e10600'>gesperrt</b>":"–"}</td>
      <td style="white-space:nowrap"><button class="ghost" data-y="${x.id}" style="${d===true?"background:#173d29;border-color:#2fd16b":""}">✔ Freigeben</button> <button class="ghost" data-n="${x.id}" style="${d===false?"background:#3a1212;border-color:#e10600":""}">✘ Ablehnen</button></td></tr>`;}).join("");
    m.innerHTML=`<h2>🔁 Fahrermarkt ${k.year+1}</h2>${notes.map(n=>`<div class="fbk mid">${esc(n)}</div>`).join("")}
      <div style="display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1fr);gap:14px;margin-top:8px">
        <div><h4 style="margin:4px 0">Teams & Cockpits</h4><table class="res"><tr><th>Team</th><th>Cockpit 1</th><th>Cockpit 2</th><th>will haben (Interesse)</th></tr>${teams}</table></div>
        <div><h4 style="margin:4px 0">Fahrer am Markt</h4><table class="res"><tr><th>Fahrer</th><th>Vertrag</th><th>Ruf</th><th>Lizenz</th><th>Wunsch-Teams</th></tr>${drivers||"<tr><td colspan=5 class='hint'>Keine Bewegung am Markt.</td></tr>"}</table></div></div>
      <h4 style="margin:12px 0 4px">Verhandlungen – Freigabe durch die Rennleitung <span class="hint">(${nDec}/${iv.length} entschieden)</span></h4>
      <p class="hint" style="margin:0 0 6px">Prüfe: Superlizenz (40 Punkte oder bereits gehalten) · nicht gesperrt · Fahrer unter Vertrag nur mit Freigabe seines Teams. Nicht entschiedene Anfragen gelten als abgelehnt.</p>
      <table class="res"><tr><th>Anfrage</th><th>Anlass</th><th>Superlizenz</th><th>Vertrag</th><th>Sperre</th><th></th></tr>${reqs||"<tr><td colspan=6 class='hint'>Keine Anfragen.</td></tr>"}</table>
      <button class="big go" id="mkRun">Verhandlungen starten</button>`;
    m.querySelectorAll("[data-y]").forEach(b=>b.onclick=()=>{dec[b.dataset.y]=true;draw();});
    m.querySelectorAll("[data-n]").forEach(b=>b.onclick=()=>{dec[b.dataset.n]=false;draw();});
    $("mkRun").onclick=()=>marketRun(k,iv,dec,fin);};
  draw();}
function marketRun(k,iv,dec,fin){const log=[],moves=[],m=$("modal");let pts=0,okN=0;
  for(const x of iv){const v=mkValid(k,x),yes=dec[x.id]===true,ok=yes===v.ok,p=ok?40:-40;pts+=p;if(ok)okN++;k.dec=k.dec||{ok:0,total:0};k.dec.total++;if(ok)k.dec.ok++;k.rep=clamp((k.rep==null?60:k.rep)+(ok?0.5:-2),0,100);
    if(!FB_LIVE){k.lateRev=k.lateRev||[];k.lateRev.push({title:`Fahrermarkt: ${TEAMS[x.team].name} → ${drvName(x.drv)}`,ok,pts:p,explain:v.why,sess:"Rennleitung"});}
    x.go=yes&&v.ok;if(yes&&!v.ok)log.push({r:0,t:`FIA kassiert die Freigabe ${TEAMS[x.team].name} → ${x.drv}: ${v.why}`,c:"bad"});}
  k.score=(k.score||0)+pts;
  /* Runden: Teams mit offenem Platz bieten dem besten freigegebenen Kandidaten, Fahrer nehmen das beste Angebot (bleiben ist auch eine Option) */
  const tried={};for(let r=1;r<=6;r++){const offers={};let any=false;
    for(const t of TEAM_KEYS){const slots=k.roster[t].map((c,i)=>c===null?i:-1).filter(i=>i>=0);
      const upg=iv.filter(x=>x.go&&x.team===t&&x.kind==="wechsel"&&k.roster[t].includes(x.out)&&!(tried[t]||[]).includes(x.drv));
      const freeC=iv.filter(x=>x.go&&x.team===t&&!(tried[t]||[]).includes(x.drv)&&seatOf(k,x.drv)!==t).sort((a,b)=>mkTeamPref(k,t,b.drv)-mkTeamPref(k,t,a.drv));
      if(slots.length&&freeC.length){const x=freeC[0];(offers[x.drv]=offers[x.drv]||[]).push({t,slot:slots[0],x});(tried[t]=tried[t]||[]).push(x.drv);any=true;}
      else if(!slots.length&&upg.length){const x=upg.sort((a,b)=>mkTeamPref(k,t,b.drv)-mkTeamPref(k,t,a.drv))[0];(offers[x.drv]=offers[x.drv]||[]).push({t,slot:k.roster[t].indexOf(x.out),x});(tried[t]=tried[t]||[]).push(x.drv);any=true;}}
    if(!any)break;
    for(const c in offers){const os=offers[c].sort((a,b)=>mkDrvPref(k,c,b.t)-mkDrvPref(k,c,a.t)),best=os[0],cur=seatOf(k,c),stay=cur?mkDrvPref(k,c,cur)+1.5:-99;
      for(const o of os)log.push({r,t:`${TEAMS[o.t].name} bietet ${drvName(c)} einen Vertrag an.`});
      if(mkDrvPref(k,c,best.t)>stay){const out=k.roster[best.t][best.slot];if(cur){const j=k.roster[cur].indexOf(c);k.roster[cur][j]=null;}
        k.roster[best.t][best.slot]=c;moves.push({c,from:cur,to:best.t,out});
        log.push({r,t:`✍ ${drvName(c)} unterschreibt bei ${TEAMS[best.t].name}${cur?` (kommt von ${TEAMS[cur].name})`:""}${out?` – ${drvName(out)} verliert sein Cockpit`:""}.`,c:"ok"});
        for(const o of os.slice(1))log.push({r,t:`${drvName(c)} sagt ${TEAMS[o.t].name} ab.`,c:"mid"});}
      else for(const o of os)log.push({r,t:`${drvName(c)} bleibt bei ${TEAMS[cur].name} und lehnt ${TEAMS[o.t].name} ab.`,c:"mid"});}}
  const holes=TEAM_KEYS.filter(t=>k.roster[t].includes(null));
  if(holes.length)log.push({r:99,t:`Ohne freigegebenen Kandidaten: ${holes.map(t=>TEAMS[t].name).join(", ")} – Notbesetzung mit eigener Reserve.`,c:"mid"});
  m.className="modal wide";m.innerHTML=`<h2>🤝 Verhandlungen</h2><div id="mkLog" style="max-height:46vh;overflow:auto"></div>
    <h4 style="margin:12px 0 4px">Wechsel</h4>${moves.length?`<table class="res"><tr><th>Fahrer</th><th>von</th><th>zu</th><th>verdrängt</th></tr>${moves.map(v=>`<tr><td><b>${v.c}</b> ${esc(drvName(v.c))}</td><td>${v.from?TEAMS[v.from].name:"vertragsfrei"}</td><td><span style="color:${TEAMS[v.to].color}">■</span> ${TEAMS[v.to].name}</td><td>${v.out?esc(drvName(v.out)):"–"}</td></tr>`).join("")}</table>`:"<p class='hint'>Keine Wechsel.</p>"}
    ${FB_LIVE?`<div class="fbk ${pts>=0?"ok":"bad"}">Freigaben: ${okN}/${iv.length} richtig (${pts>0?"+":""}${pts})</div>`:`<div class="fbk mid">Entscheidungen registriert. Die Bewertung folgt mit dem nächsten Rennen.</div>`}
    <button class="big go" id="mkFin">Weiter zum Starterfeld</button>`;
  const box=$("mkLog");let i=0;const show=()=>{if(i>=log.length)return;const e=log[i++];const d=document.createElement("div");d.className="fbk "+(e.c||"");d.style.cssText="margin:3px 0;padding:4px 8px;opacity:0;transition:opacity .35s";
    d.textContent=(e.r&&e.r<99?`Runde ${e.r}: `:"")+e.t;box.appendChild(d);requestAnimationFrame(()=>d.style.opacity=1);box.scrollTop=box.scrollHeight;setTimeout(show,420);};show();
  $("mkFin").onclick=fin;}
/* Gespeicherte Entwicklung der Nachwuchsfahrer wiederherstellen */
function restoreDB(k){if(k&&k.dbx)for(const c in k.dbx)if(DB[c])Object.assign(DB[c],k.dbx[c]);}
function rebuildConstructorPoints(k){
  if(!k)return {};
  const totals=Object.fromEntries(TEAM_KEYS.map(t=>[t,0]));
  const rosterTeam={};
  if(k.roster)TEAM_KEYS.forEach(t=>(k.roster[t]||[]).forEach(code=>{if(code)rosterTeam[k.temp&&k.temp[code]||code]=t;}));
  DRIVERS.forEach(d=>{const t=rosterTeam[d.code]||d.team;if(totals[t]!=null)totals[t]+=Number(k.points&&k.points[d.code])||0;});
  k.tpoints=totals;
  return totals;
}
function standingsRows(k){const codes=new Set(Object.keys(k.points));DRIVERS.forEach(d=>codes.add(d.code));
  return [...codes].map(c=>{const cur=DRIVERS.find(d=>d.code===c),t=cur?cur.team:(k.roster&&seatOf(k,c))||(DB[c]&&DB[c].home)||"MER";
    return {d:{code:c,name:drvName(c),color:TEAMS[t].color,team:t},p:k.points[c]||0};}).sort((a,b)=>b.p-a.p);}
/* ---- Bewertung der Rennleitung & Medienecho ---- */
function consTrack(inc,val){if(inc.kind!=="inc"||!inc.truth)return;
  const sv=p=>p==="dsq"?5:p==="swap"?0.8:p==="sg"?4:p===20||p==="dt"?3:p===10?2:p===5?1:0,v=val==="dsq"?"dsq":val&&val.pen;
  W.cons=W.cons||[];W.cons.push(sv(v)-sv(inc.truth.pen));}
function rdRating(){const r=W.review||[],fl=r.filter(x=>x.title.startsWith("Flagge:")),inc=r.filter(x=>!x.title.startsWith("Flagge:"));
  const fair=inc.length?Math.round(100*inc.filter(x=>x.ok).length/inc.length):100,safe=fl.length?Math.round(100*fl.filter(x=>x.ok||x.pts>0).length/fl.length):100;
  const cs=W.cons||[];let cons=100;if(cs.length>=2){const m=cs.reduce((a,b)=>a+b,0)/cs.length,sd=Math.sqrt(cs.reduce((a,b)=>a+(b-m)*(b-m),0)/cs.length);cons=Math.round(clamp(100-28*sd,0,100));}
  return {fair,cons,safe,total:Math.round(0.45*fair+0.25*cons+0.3*safe)};}
function mediaHtml(k,rt){const r=(W.review||[]).slice(),tr=TRACK.name.split(" · ")[0],hl=[],q=[];
  const worst=r.filter(x=>!x.ok).sort((a,b)=>a.pts-b.pts)[0],best=r.filter(x=>x.ok).sort((a,b)=>b.pts-a.pts)[0];
  const prot=(S&&S.incidents||[]).filter(i=>i.protested);
  if(rt.total>=85)hl.push(`Souveräne Rennleitung in ${tr} – kaum Diskussionen im Fahrerlager`);
  else if(rt.total<55)hl.push(`Chaos-Wochenende in ${tr}: Die Rennleitung steht massiv in der Kritik`);
  if(worst)hl.push(`Ärger um „${worst.title}“ – Teams verstehen die Entscheidung nicht`);
  if(prot.length)hl.push(`${prot.length} Protest${prot.length>1?"e":""} gegen Entscheidungen der Rennleitung`);
  if(rt.safe<70)hl.push("Fahrervereinigung GPDA fordert schnellere Reaktionen bei Gefahr");
  if(rt.cons<60)hl.push("Experten: „Gleiche Vergehen, unterschiedliche Strafen – das ist nicht konsequent“");
  if(S&&S.aquaLog&&S.aquaLog.length>=2)hl.push(`Aquaplaning-Drama in ${tr}: Stehendes Wasser bringt Fahrer an die Grenze`);
  if(k&&k.temp)for(const o in k.temp)hl.push(`${drvName(o)} gesperrt – ${drvName(k.temp[o])} springt ein`);
  const dsq=(S&&S.cars||[]).filter(c=>c.dsq);if(dsq.length)hl.push(`Disqualifikation von ${dsq.map(c=>c.drv.name).join(", ")} sorgt für Schlagzeilen`);
  if(best&&hl.length<4)hl.push(`Lob für die Stewards: „${best.title}“ richtig bewertet`);
  const pen=(S&&S.cars||[]).filter(c=>c.penTot>0).sort((a,b)=>b.penTot-a.penTot)[0];
  if(pen)q.push(`<b>${esc(pen.drv.name)}:</b> „${pick(["Die Strafe war viel zu hart. Wir reden mit der FIA.","Ich habe nichts falsch gemacht – das sehen alle anders als die Stewards.","Okay, das war mein Fehler. Ich akzeptiere das."])}“`);
  if(worst)q.push(`<b>Teamchef ${pick(TEAM_KEYS.map(t=>TEAMS[t].name))}:</b> „${pick(["Wir brauchen mehr Konstanz bei den Entscheidungen.","So kann man kein Rennen leiten.","Das werden wir im nächsten Meeting ansprechen."])}“`);
  else q.push(`<b>FIA:</b> „Die Rennleitung hat an diesem Wochenende einen ausgezeichneten Job gemacht.“`);
  const bar=(l,v)=>`<div style="display:flex;align-items:center;gap:8px;margin:3px 0"><span style="width:92px">${l}</span><div style="flex:1;height:8px;background:#222a33;border-radius:4px"><div style="width:${v}%;height:8px;border-radius:4px;background:${v>=80?"#2fd16b":v>=60?"#f2c94c":"#e10600"}"></div></div><b style="width:34px;text-align:right">${v}</b></div>`;
  const ss=k&&k.rd&&k.rd.length?Math.round(k.rd.reduce((a,b)=>a+b,0)/k.rd.length):null;
  return `<div style="display:grid;grid-template-columns:1fr 1.3fr;gap:16px;margin-top:10px"><div><h4>FIA-Bewertung der Rennleitung</h4>${bar("Fairness",rt.fair)}${bar("Konsequenz",rt.cons)}${bar("Sicherheit",rt.safe)}${bar("Gesamt",rt.total)}${ss!=null?`<div class="hint">Saisonschnitt: <b>${ss}</b> nach ${k.rd.length} Rennen</div>`:""}</div>
    <div><h4>📰 Medienecho</h4>${hl.slice(0,4).map(h=>`<div style="padding:4px 0;border-bottom:1px solid #222a33;font-weight:600">${esc(h)}</div>`).join("")}<div class="hint" style="margin-top:6px;line-height:1.6">${q.join("<br>")}</div></div></div>`;}
