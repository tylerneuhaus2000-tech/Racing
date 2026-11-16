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
function teamOrder(k){return TEAM_KEYS.slice().sort((a,b)=>(k.tpoints[b]||0)-(k.tpoints[a]||0));}
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
  /* Spitzenteams werben starke Fahrer aus dem Mittelfeld ab */
  const ord=teamOrder(k);
  ord.slice(0,5).forEach(t=>{const[a,b]=k.roster[t];if(a&&b){const lo=k.drep[a]<k.drep[b]?a:b;
    const star=TEAM_KEYS.filter(x=>ord.indexOf(x)>ord.indexOf(t)+1).flatMap(x=>k.roster[x].filter(Boolean)).sort((p,q)=>k.drep[q]-k.drep[p])[0];
    if(star&&k.drep[star]>k.drep[lo]+10&&Math.random()<0.5){const from=seatOf(k,star),rel=Math.random()<0.8?from:null;
      reqs.push({type:"transfer",team:t,out:lo,inn:star,release:rel,ctx:`${TEAMS[t].name} will ${drvName(star)} (Ruf ${Math.round(k.drep[star])}) von ${TEAMS[from].name} holen.`+(rel?` ${TEAMS[from].name} hat die Freigabe schriftlich eingereicht.`:` Eine Freigabe von ${TEAMS[from].name} liegt nicht vor.`),
        text:`Wechsel ${drvName(star)}: ${TEAMS[from].name} → ${TEAMS[t].name}, ${drvName(lo)} verliert sein Cockpit.`,outWhy:"muss gehen",
        apply(){const i=k.roster[t].indexOf(lo),j=k.roster[from].indexOf(star);if(i<0||j<0)return;k.roster[t][i]=star;k.roster[from][j]=null;signed[star]=t;reqs.push({gen:fillReq(from),team:from});},
        undo(){const i=k.roster[t].indexOf(star),j=k.roster[from].indexOf(null);if(i>=0&&j>=0){k.roster[t][i]=lo;k.roster[from][j]=star;}delete signed[star];
          const q=reqs.findIndex(x=>x.gen&&x.team===from);if(q>=0)reqs.splice(q,1);}});}}});
  /* Freie Cockpits über Anträge besetzen – jeder Vertrag wird bei der Rennleitung registriert */
  function fillReq(t){const tried=[];const mk=()=>{const i=k.roster[t].indexOf(null);if(i<0)return null;
      let inn=proposal(k,t,tried.concat(Object.keys(signed)),0.25);let dup=null;
      if(Math.random()<0.12&&Object.keys(signed).length){inn=pick(Object.keys(signed));dup=signed[inn];}   // Doppelvertrag
      if(!inn)return null;tried.push(inn);
      return {type:"transfer",team:t,inn,dup,ctx:`Fahrermarkt ${k.year+1}: ${TEAMS[t].name} hat ein freies Cockpit.`,text:`Vertrag mit ${drvName(inn)} für ${k.year+1}.`,
        apply(){if(dup)return;k.roster[t][i]=inn;signed[inn]=t;},undo(){if(k.roster[t][i]===inn)k.roster[t][i]=null;delete signed[inn];const nx=mk();if(nx)reqs.unshift(nx);},onReject:mk};};const g=mk;g.team=t;return g;}
  [...new Set(open)].forEach(t=>k.roster[t].forEach(c=>{if(c===null)reqs.push({gen:fillReq(t),team:t});}));
  /* Junioren aufrücken lassen: Racing Bulls nimmt einen Red-Bull-Junior, wenn einer mit Superlizenz bereit ist */
  const jr=Object.keys(DB).find(c=>DB[c].home==="RBR"&&!seatOf(k,c)&&DB[c].role.includes("Junior")&&slOk(c));
  if(jr&&Math.random()<0.6){const lo=k.roster.RCB.filter(Boolean).sort((a,b)=>k.drep[a]-k.drep[b])[0];if(lo){const i=k.roster.RCB.indexOf(lo),old=JSON.parse(JSON.stringify(k.roster));
    reqs.push({type:"transfer",team:"RCB",out:lo,inn:jr,ctx:"Red Bull befördert einen Junior.",text:`${drvName(jr)} ersetzt ${drvName(lo)} bei Racing Bulls.`,outWhy:"muss für den Junior Platz machen",
      apply(){k.roster.RCB[i]=jr;signed[jr]="RCB";},undo(){k.roster=old;}});}}
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
  const startReq=()=>runRequests(k,reqs,fin);
  const m=$("modal");m.className="modal";m.innerHTML=`<h2>🔁 Fahrermarkt</h2>${notes.map(n=>`<div class="fbk mid">${esc(n)}</div>`).join("")||"<p class='hint'>Keine Rücktritte oder Entlassungen.</p>"}
    <p class="hint">Alle neuen Verträge müssen von dir geprüft und registriert werden.</p><button class="big go" id="mkGo">Anträge prüfen (${reqs.length})</button>`;
  $("overlay").classList.add("show");$("mkGo").onclick=startReq;}
/* Gespeicherte Entwicklung der Nachwuchsfahrer wiederherstellen */
function restoreDB(k){if(k&&k.dbx)for(const c in k.dbx)if(DB[c])Object.assign(DB[c],k.dbx[c]);}
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
