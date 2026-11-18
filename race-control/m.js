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
const DRIVER_CODE_BY_ID={};
const normDriverName=s=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");
const TEAM_NAME_MAP=[["AUD",/audi|sauber/],["AMR",/aston/],["CAD",/cadillac/],["FER",/ferrari/],["HAA",/haas/],["ALP",/alpine|renault/],["MCL",/mclaren/],["MER",/mercedes/],["RCB",/racingbulls|alphatauri|rb/],["RBR",/redbull/],["WIL",/williams/]];
function dataHomeTeam(row){const a=`${row.academy_current_2026||""} ${row.f1_reserve_test_affiliation_2026||""}`.replace(/[^a-z]/gi,"").toLowerCase();return (TEAM_NAME_MAP.find(([,re])=>re.test(a))||[])[0]||"MER";}
function adaptDatasetSkill(value){const n=Number(value);return Number.isFinite(n)?clamp((100-n)*0.01,0.02,0.72):0.48;}
function integrateDriverPool(){
  if(typeof DRIVER_POOL_V4==="undefined")return;
  const byName=new Map(Object.keys(DB).map(code=>[normDriverName(DB[code].name),code]));
  for(const row of DRIVER_POOL_V4){
    let code=byName.get(normDriverName(row.name));
    if(!code&&row.name==="Andrea Kimi Antonelli")code=byName.get("kimiantonelli");
    if(!code)code=row.driver_id;
    const prior=DB[code], home=prior&&prior.home||dataHomeTeam(row);
    const eligible=row.f1_entry_gate_game==="allow_existing_2026_racer_game_assumption";
    const role=String(row.development_tier_game||row.pool_groups||"Driver");
    DB[code]=Object.assign({},prior,{code,id:row.driver_id,name:prior&&prior.name||row.name,
      num:prior&&prior.num||((parseInt(row.driver_id.replace(/\D/g,""),10)||1)%99+1),home,
      role:prior&&prior.role||role,skill:prior?prior.skill:adaptDatasetSkill(row.f1_skill_game),
      sl:prior?prior.sl:0,held:prior?prior.held:eligible,note:prior&&prior.note||row.super_licence_evidence_status,
      source:"csv_v4",sourceRecord:row,style:prior&&prior.style||0.5,
      physicsBaseSkill:prior?prior.skill:adaptDatasetSkill(row.f1_skill_game),
      initialSkillRating:Number(row.f1_skill_game)||0,skillRatingHundredths:Math.round((Number(row.f1_skill_game)||0)*100),
      potentialHundredths:Math.round((Number(row.potential_game)||0)*100),
      contractEnd:Number(row.contract_end_year_game)||null,salary:Number(row.annual_salary_expectation_usd_game)||0,
      releaseFee:Number(row.release_fee_usd_game)||0,ageGame:Number(row.age_2026_11_18)||Number(row.development_start_age_game)||null,
      nationality:row.nationality_ioc||"",academy:row.academy_current_2026||"",licenseEvidence:row.super_licence_evidence_status||"unknown",
      entryGate:row.f1_entry_gate_game||"manual_review_before_race_entry",developmentElapsed:0});
    DRIVER_CODE_BY_ID[row.driver_id]=code;
    if(AGG[code]==null)AGG[code]=Number(row.aggression_game)/100||0.5;
    if(WETSTYLE[code]==null)WETSTYLE[code]=Number(row.wet_skill_game)/100||0.5;
  }
}
integrateDriverPool();
const BASE_ROSTER={};DRIVERS.forEach(d=>{(BASE_ROSTER[d.team]=BASE_ROSTER[d.team]||[])[d.slot]=d.code;});
const BASE_PACE={};TEAM_KEYS.forEach(t=>BASE_PACE[t]=TEAMS[t].pace);
const AGE={ALO:45,HAM:41,HUL:39,BOT:37,PER:36,SAI:32,OCO:30,GAS:30,VER:29,LEC:29,RUS:28,ALB:30,NOR:27,STR:28,PIA:25,COL:23,LAW:24,HAD:22,BOR:22,BEA:21,ANT:20,LIN:19};
for(const c in DB)if(DB[c].ageGame!=null&&AGE[c]==null)AGE[c]=DB[c].ageGame;
const SISTER={RBR:"RCB",RCB:"RBR"};
const PRIZE=[140,131,122,113,104,95,86,77,68,59,50];

const slOk=code=>{const d=DB[code];if(!d)return false;if(d.held||d.simulatedLicenseApproved)return true;const r=d.sourceRecord;if(!r)return d.sl>=40;
  const minWait=Number(r.f1_min_wait_seasons_game)||0,minSkill=Number(r.f1_min_skill_game)||0;
  return d.sl>=40&&(d.developmentElapsed||0)>=minWait&&(d.skillRatingHundredths||0)>=minSkill*100;};
const slTxt=code=>{const d=DB[code];return d.held?"Superlizenz vorhanden":`${d.sl} Punkte`+(d.sl>=40?" – reicht":" – zu wenig (40 nötig)");};
function seatOf(k,code){for(const t of TEAM_KEYS)if(k.roster[t]&&k.roster[t].includes(code))return t;return null;}
function drvName(code){return DB[code]?DB[code].name:code;}
function initMgmt(k){const fresh=!k.roster;if(fresh){k.roster=JSON.parse(JSON.stringify(BASE_ROSTER));k.pace=Object.assign({},BASE_PACE);k.money={};k.tpoints={};k.pointLedger={schemaVersion:1,legacyDrivers:{},legacyConstructors:{},legacyStatus:"complete",events:[]};
    k.season=k.season||1;k.year=k.year||2026;k.licLog=k.licLog||[];k.drep={};k.revert=[];k.mevents={};k.reqLog=[];
    for(const c in DB)k.drep[c]=clamp(Math.round(78-DB[c].skill*110),20,95);
    k.drep.VER=96;k.drep.NOR=88;k.drep.LEC=88;k.drep.HAM=84;k.drep.ALO=82;k.drep.RUS=86;k.drep.PIA=86;k.drep.ANT=84;}
  k.contracts=k.contracts||{};k.transferHistory=k.transferHistory||[];k.relationships=k.relationships||{};
  for(const t of TEAM_KEYS)for(const c of k.roster[t]||[])if(c&&!k.contracts[c]){const d=DB[c]||{};k.contracts[c]={team:t,startYear:k.year||2026,endYear:d.contractEnd||null,salary:d.salary||0,releaseFee:d.releaseFee||0,basis:d.sourceRecord&&d.sourceRecord.contract_reported_status||"unknown",status:"active"};}
}
/* Kader in DRIVERS übernehmen (DRIVERS wird an Ort und Stelle neu gefüllt) */
function applyRoster(k){if(!k)return;initMgmt(k);const sub=k.temp||{};
  TEAM_KEYS.forEach(t=>TEAMS[t].pace=k.pace[t]);
  const list=[];TEAM_KEYS.forEach((t,ti)=>(k.roster[t]||[]).forEach((code0,slot)=>{if(!code0)return;const code=sub[code0]||code0,d=DB[code];if(!d)return;
    list.push({code,name:d.name,num:d.num,team:t,ti,slot,color:TEAMS[t].color,perf:TEAMS[t].pace+d.skill,style:d.style==null?0.5:d.style});}));
  DRIVERS.length=0;list.forEach(x=>DRIVERS.push(x));}
function curAbs(k){const key=k.cal[Math.min(k.round,k.cal.length-1)];return (k.season-1)*CALENDAR.length+Math.max(0,CALENDAR.indexOf(key));}
function licSum(k,code){const now=curAbs(k);return k.licLog.filter(e=>e.c===code&&!e.void&&now-e.abs<CALENDAR.length).reduce((a,e)=>a+e.n,0);}
function refreshLic(k){k.lic={};for(const e of k.licLog)if(!e.void&&curAbs(k)-e.abs<CALENDAR.length)k.lic[e.c]=(k.lic[e.c]||0)+e.n;for(const c in k.lic)if(k.lic[c]<=0)delete k.lic[c];}
/* Ruf nach jedem Rennen: Ergebnis gegen Erwartung (Auto) und gegen Teamkollegen */
function mgmtRaceDone(cl,k){if(!k||!k.roster)return;const exp=cl.slice().sort((a,b)=>a.drv.perf-b.drv.perf);
  k.relationships=k.relationships||{};
  cl.forEach((c,i)=>{const e=exp.indexOf(c),pos=c.finished&&!c.dsq?i:21,code=c.drv.code,team=c.drv.team;
    k.drep[code]=clamp((k.drep[code]||50)+(e-pos)*0.35+(c.dsq?-3:0),5,99);
    const key=`${code}:${team}`,rel=k.relationships[key]||{teamInterest:DB[code]&&DB[code].home===team?68:50,driverInterest:DB[code]&&DB[code].home===team?65:50};
    const resultDelta=clamp((e-pos)*0.35+(c.dsq?-3:0),-4,4);rel.teamInterest=clamp(rel.teamInterest+resultDelta,0,100);rel.driverInterest=clamp(rel.driverInterest+clamp(resultDelta*0.65,-3,3),0,100);rel.updatedRound=k.round||0;k.relationships[key]=rel;
    k.tpoints[c.drv.team]=k.tpoints[c.drv.team]||0;});
  TEAM_KEYS.forEach(t=>{const ms=cl.filter(c=>c.drv.team===t);if(ms.length===2){const[a,b]=ms,ia=cl.indexOf(a),ib=cl.indexOf(b);const w=ia<ib?a:b,l=ia<ib?b:a;k.drep[w.drv.code]+=0.6;k.drep[l.drv.code]-=0.6;}});
  updateMarketIntel(k,cl);const panel=typeof document!=="undefined"&&document.getElementById("driverMarketPanel");if(panel&&panel.classList.contains("open"))renderDriverMarket();}

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
  return `<h2>📨 Antrag an die Rennleitung</h2><div class="hint" style="margin-bottom:8px">${esc(r.ctx||"")} · Dauer: ${esc(r.duration||"dieses Rennwochenende")} · Session: ${esc(r.session||((S&&S.name)||"Rennwochenende"))}</div>
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
function retiredRecord(k,code){return (k.retired||[]).find(x=>x&&typeof x==="object"&&x.code===code)||null;}
function registerGeneratedDriver(row){const code=row.driver_id;if(DB[code])return code;const skill=Number(row.f1_skill_game)||65,potential=Number(row.potential_game)||82;
  DB[code]={code,id:code,name:row.name,num:((parseInt(code.replace(/\D/g,""),10)||1)%99)+1,home:row.academy_current_2026||"MER",role:row.development_tier_game||"F4",skill:adaptDatasetSkill(skill),sl:0,held:false,note:"Generierter Nachwuchs · Simulationsdaten",style:0.5,source:"simulated_generation",sourceRecord:row,physicsBaseSkill:adaptDatasetSkill(skill),initialSkillRating:skill,skillRatingHundredths:Math.round(skill*100),potentialHundredths:Math.round(potential*100),salary:Number(row.annual_salary_expectation_usd_game)||250000,releaseFee:0,ageGame:Number(row.age_2026_11_18)||16,nationality:row.nationality_ioc||"",academy:row.academy_current_2026||"",licenseEvidence:"simulated_not_real",entryGate:row.f1_entry_gate_game||"manual_review_before_race_entry",developmentElapsed:0,simulatedData:true};
  DRIVER_CODE_BY_ID[code]=code;AGE[code]=DB[code].ageGame;AGG[code]=0.55;WETSTYLE[code]=0.5;return code;}
function generateNextGeneration(k){
  const year=Number(k.year)||2026;k.generationProcessedYears=k.generationProcessedYears||[];if(k.generationProcessedYears.includes(year))return;
  k.generatedDrivers=k.generatedDrivers||[];const free=candidates(k,"MER",[]).filter(slOk).length,youth=Object.keys(DB).filter(c=>{const age=DB[c].ageGame||AGE[c]||25;return age<25&&slOk(c)&&!retiredRecord(k,c);}).length;
  if(free<20||youth<25){const names=["Mika","Luca","Noah","Theo","Enzo","Alex","Rafael","Oliver","Elias","Kai","Leo","Matteo","Finn","Nico","Arvid","Sam","Jules","Robin","Ibrahim","Daniel"],surnames=["Andersson","Moreau","Rossi","Silva","Novak","Weber","Costa","Tanaka","Meyer","Petrov","Dubois","Khan","Walsh","Lind","Garcia","Bianchi","Fischer","Sato","Müller","Olsen"],nations=["SWE","FRA","ITA","BRA","AUT","DEU","PRT","JPN","CHE","CZE","ESP","GBR","DNK","NOR","NLD","USA"],academies=["RBR","FER","MCL","MER","ALP","AMR","WIL","AUD","CAD","HAA","RCB"];
    const existing=new Set(k.generatedDrivers.map(d=>d.driver_id));for(let i=0;i<3;i++){let seq=1;while(existing.has(`GEN${year}${String(seq).padStart(2,"0")}`))seq++;const id=`GEN${year}${String(seq).padStart(2,"0")}`;existing.add(id);
      const skill=56+Math.floor(Math.random()*14),potential=Math.min(94,skill+15+Math.floor(Math.random()*12)),age=16+Math.floor(Math.random()*5),team=academies[Math.floor(Math.random()*academies.length)],idx=Math.floor(Math.random()*names.length);
      const row={driver_id:id,name:`${names[idx]} ${surnames[(idx+seq+year)%surnames.length]} ${year}`,pool_groups:"Generated junior · F4",nationality_ioc:nations[(seq+year)%nations.length],age_2026_11_18:age,academy_current_2026:team,development_tier_game:"F4",f1_skill_game:skill,potential_game:potential,aggression_game:55,wet_skill_game:50,annual_salary_expectation_usd_game:250000,release_fee_usd_game:0,super_licence_evidence_status:"simulated_not_real",f1_entry_gate_game:"manual_review_before_race_entry",f1_min_wait_seasons_game:10,f1_min_skill_game:72,development_gain_per_season_game:1.35,development_decline_start_age_game:36,development_decline_per_season_game:0.8,development_start_age_game:age,development_age_basis_game:"simulated_generated",development_model_basis_game:"procedurally_generated_simulation_candidate"};
      k.generatedDrivers.push(row);registerGeneratedDriver(row);k.drep[id]=clamp(Math.round(78-DB[id].skill*110),20,95);
    }
  }
  k.generationProcessedYears.push(year);
}
function candidates(k,team,excl){const free=Object.keys(DB).filter(c=>{const rr=retiredRecord(k,c),eligibleComeback=rr&&(Number(k.year||2026)-Number(rr.year||2026)>=3)&&(DB[c].ageGame||0)<44;
    return !seatOf(k,c)&&!(excl||[]).includes(c)&&!(k.banNow||[]).includes(c)&&(!(k.retired||[]).includes(c)||eligibleComeback)&&(!rr||eligibleComeback);});
  const w=c=>{const d=DB[c];return (d.home===team?0:d.home===PARTNER[team]?1:2)*100+(slOk(c)?0:50)-k.drep[c]*0.3;};
  return free.sort((a,b)=>w(a)-w(b));}
/* Teams machen manchmal Fehler im Antrag – die Rennleitung muss es merken */
function proposal(k,team,excl){const cs=candidates(k,team,excl).filter(slOk);return cs[0]||null;}

/* Vor jedem Rennen: Sperren, Rückkehr nach Tausch, Entlassungen, Red-Bull-Tausch */
function mgmtBeforeRound(k,go){initMgmt(k);k.temp={};k.banNow=[];
  const reqs=[],notes=[];
  (k.revert||[]).filter(r=>k.round>=r.round).forEach(r=>{const i=k.roster.RBR.indexOf(r.b),j=k.roster.RCB.indexOf(r.a);if(i>=0&&j>=0){k.roster.RBR[i]=r.a;k.roster.RCB[j]=r.b;if(k.contracts&&k.contracts[r.a])k.contracts[r.a].team="RBR";if(k.contracts&&k.contracts[r.b])k.contracts[r.b].team="RCB";notes.push(r.msg);}});k.revert=(k.revert||[]).filter(r=>k.round<r.round);
  refreshLic(k);
  TEAM_KEYS.forEach(t=>(k.roster[t]||[]).forEach(code=>{if(licSum(k,code)>=12){k.banNow.push(code);
    k.licLog.forEach(e=>{if(e.c===code)e.void=true;});notes.push(`${drvName(code)} hat 12 Strafpunkte erreicht – Sperre für dieses Rennen, das Punktekonto wird danach auf null gesetzt.`);
    const tried=[];const mk=()=>{const inn=proposal(k,t,tried);if(!inn)return null;tried.push(inn);
      return {type:"sub",team:t,out:code,inn,ctx:`Sperre: ${drvName(code)} darf beim ${TRACK.name} nicht starten.`,text:`${drvName(inn)} ersetzt ${drvName(code)} für dieses Rennen.`,outWhy:"gesperrt (12 Strafpunkte in 12 Monaten)",
        duration:"dieses Rennwochenende",session:(S&&S.name)||"vor dem Rennwochenende",apply(){k.temp[code]=inn;},undo(){delete k.temp[code];const nx=mk();if(nx)reqs.unshift(nx);},onReject:mk};};
    const r=mk();if(r)reqs.push(r);}}));
  if(k.type==="season"&&k.round>=4){
    /* Entlassung wegen Leistung */
    const pts=c=>k.points[c]||0;
    for(const t of shuffle(TEAM_KEYS)){if(k.mevents["fire"+t]||["MER","FER","MCL"].includes(t))continue;const[a,b]=k.roster[t];
      const lo=pts(a)<pts(b)?a:b,hi=lo===a?b:a;if(k.drep[lo]<42&&pts(hi)-pts(lo)>=Math.max(12,k.round*2)&&Math.random()<0.28){k.mevents["fire"+t]=1;
        const inn=proposal(k,t,[]);if(!inn)break;const i=k.roster[t].indexOf(lo);
        if(i>=0){k.roster[t][i]=inn;notes.push(`${TEAMS[t].name} beendet den Vertrag mit ${drvName(lo)} und verpflichtet ${drvName(inn)}.`);k.contracts=k.contracts||{};if(k.contracts[lo])k.contracts[lo].status="released";const d=DB[inn]||{};k.contracts[inn]={team:t,startYear:k.year||2026,endYear:(k.year||2026)+2,salary:d.salary||0,releaseFee:d.releaseFee||0,basis:"simulated_midseason_agreement",status:"confirmed"};k.transferHistory=k.transferHistory||[];k.transferHistory.push({id:`${k.year||2026}:fire:${k.round||0}:${inn}`,year:k.year||2026,season:k.season||1,round:k.round||0,type:"transfer",driver:inn,from:null,to:t,replaced:lo,status:"completed",reason:"sportliche Leistung"});}
        break;}}
    /* Red Bull ↔ Racing Bulls */
    if(!k.mevents.swap&&Math.random()<0.22){const rb2=k.roster.RBR.slice().sort((a,b)=>pts(a)-pts(b))[0],vc=k.roster.RCB.slice().sort((a,b)=>pts(b)-pts(a))[0],rbMate=k.roster.RBR.find(c=>c!==rb2),rcbMate=k.roster.RCB.find(c=>c!==vc);
      const comparativeForm=(pts(vc)-pts(rcbMate))-(pts(rb2)-pts(rbMate));
      if(pts(vc)>pts(rb2)+4||comparativeForm>Math.max(20,(k.round||0)*3)){k.mevents.swap=1;const temp=Math.random()<0.45,old=JSON.parse(JSON.stringify(k.roster)),n=irand(2,4);
        const i=k.roster.RBR.indexOf(rb2),j=k.roster.RCB.indexOf(vc);
        if(i>=0&&j>=0){k.roster.RBR[i]=vc;k.roster.RCB[j]=rb2;if(k.contracts&&k.contracts[vc])k.contracts[vc].team="RBR";if(k.contracts&&k.contracts[rb2])k.contracts[rb2].team="RCB";if(temp)k.revert.push({round:k.round+n,a:rb2,b:vc,msg:`Tausch beendet: ${drvName(rb2)} kehrt zu Red Bull zurück, ${drvName(vc)} zu Racing Bulls.`});notes.push(`Red Bull und Racing Bulls vereinbaren autonom einen ${temp?"befristeten":"dauerhaften"} Fahrertausch: ${drvName(rb2)} ↔ ${drvName(vc)}.`);k.transferHistory=k.transferHistory||[];k.transferHistory.push({id:`${k.year||2026}:rb-swap:${k.round||0}:${rb2}:${vc}`,year:k.year||2026,season:k.season||1,round:k.round||0,type:"internal_swap",driver:vc,from:"RCB",to:"RBR",status:"completed",temporary:temp,durationRounds:temp?n:null,reason:"sportlicher Formvergleich"});marketEvent(k,"internal_swap",vc,"RBR",`Red Bull und Racing Bulls tauschen ${drvName(rb2)} und ${drvName(vc)}${temp?" vorübergehend":" dauerhaft"}.`,"confirmed");}}
  }
  }
  k.gridPen={};const revs=k.type==="season"?reviewRequests(k,notes):[];
  const finish=()=>{applyRoster(k);refreshLic(k);const pu=puRequests(k,notes);if(pu)runPU(k,pu,go);else go();};
  const start=()=>{const rv=revs.slice();const nx=()=>{const r=rv.shift();if(r)runReview(k,r,nx);else runRequests(k,reqs,finish);};nx();};
  if(notes.length){const m=$("modal");m.className="modal";m.innerHTML=`<h2>🗂 Vor dem Wochenende</h2>${notes.map(n=>`<div class="fbk mid">${esc(n)}</div>`).join("")}<button class="big go" id="ntGo">Weiter</button>`;
    $("overlay").classList.add("show");$("ntGo").onclick=start;}else start();}
function radioNote(t){try{addLog(t,"flag");}catch(e){}}

/* ---- Saisonende: Preisgeld, Upgrades, Fahrermarkt ---- */
function teamOrder(k){rebuildConstructorPoints(k);return TEAM_KEYS.slice().sort((a,b)=>(k.tpoints[b]||0)-(k.tpoints[a]||0));}
function developDriverPoolForSeason(k){
  const year=Number(k.year)||2026;k.developmentProcessedYears=k.developmentProcessedYears||[];
  if(k.developmentProcessedYears.includes(year))return;
  k.simLicenseLog=k.simLicenseLog||{};
  for(const code in DB){const d=DB[code],r=d.sourceRecord;if(!r)continue;
    d.developmentElapsed=(d.developmentElapsed||0)+1;if(d.ageGame!=null)d.ageGame++;
    const declineAt=Number(r.development_decline_start_age_game)||99,age=d.ageGame||0;
    const delta=age>=declineAt?-(Number(r.development_decline_per_season_game)||0):Number(r.development_gain_per_season_game)||0;
    d.skillRatingHundredths=clamp(Math.round(d.skillRatingHundredths+delta*100),0,d.potentialHundredths||10000);
    d.skill=clamp(d.physicsBaseSkill-(d.skillRatingHundredths/100-d.initialSkillRating)*0.008,0.02,0.72);
    if(!d.held){const tier=d.role||r.development_tier_game,skill=d.skillRatingHundredths/100;
      const pts=tier==="F2"?(skill>=90?40:skill>=82?25:skill>=72?12:3):tier==="F3"?(skill>=85?15:skill>=75?8:2):tier==="F4"?(skill>=85?8:skill>=75?4:1):["IndyCar","WEC","IMSA","GT"].includes(tier)?(skill>=90?30:skill>=80?15:3):0;
      const log=k.simLicenseLog[code]||(k.simLicenseLog[code]=[]);log.push({year,points:pts,source:"simulated_series_result"});while(log.length>3)log.shift();
      d.sl=log.reduce((sum,e)=>sum+e.points,0);d.licenseSource="simulated_three_season_results";
      const minWait=Number(r.f1_min_wait_seasons_game)||0,minSkill=Number(r.f1_min_skill_game)||0;
      if(d.sl>=40&&d.developmentElapsed>=minWait&&skill>=minSkill){d.simulatedLicenseApproved=true;d.licenseApprovalYear=year;d.licenseSource="simulated_regulatory_assessment_from_three_year_results";}
      if(d.role.includes("F4")&&d.developmentElapsed>=3&&skill>=55)d.role="F3";
      else if(d.role.includes("F3")&&d.developmentElapsed>=6&&skill>=65)d.role="F2";
    }
  }
  k.developmentProcessedYears.push(year);
}
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
function processCareerRetirements(k,notes){
  const open=[];k.retired=k.retired||[];k.contracts=k.contracts||{};
  TEAM_KEYS.forEach(t=>(k.roster[t]||[]).forEach((c,i)=>{if(!c)return;const age=DB[c]&&DB[c].ageGame||AGE[c]||25,ret=age>=44?0.55:age>=40?0.3:age>=37?0.15:0;
    if(Math.random()<ret){notes.push(`${drvName(c)} beendet seine Karriere (${TEAMS[t].name}).`);k.roster[t][i]=null;open.push(t);k.retired.push({code:c,year:k.year||2026,age,team:t});if(k.contracts[c])k.contracts[c].status="retired";
      k.transferHistory=k.transferHistory||[];k.transferHistory.push({id:`${k.year||2026}:retire:${c}`,year:k.year||2026,season:k.season||1,round:k.round||0,type:"retirement",driver:c,from:t,to:null,status:"completed",reason:"Karriereende"});}
    else if((k.drep[c]||50)<38&&Math.random()<0.6){notes.push(`${TEAMS[t].name} trennt sich von ${drvName(c)} – Ruf ${Math.round(k.drep[c])}.`);k.roster[t][i]=null;open.push(t);if(k.contracts[c])k.contracts[c].status="released";
      k.transferHistory=k.transferHistory||[];k.transferHistory.push({id:`${k.year||2026}:release:${c}`,year:k.year||2026,season:k.season||1,round:k.round||0,type:"release",driver:c,from:t,to:null,status:"completed",reason:"Leistung/Vertrauen"});}}));
  k.retired=k.retired.filter(x=>typeof x==="string").concat(k.retired.filter(x=>typeof x==="object"));
  return open;
}
function market(k,done){const notes=[];
  processCareerRetirements(k,notes);
  const fin=()=>{developDriverPoolForSeason(k);fillVacancies(k);
    for(const c in DB)if(seatOf(k,c)&&!DB[c].held)DB[c].held=true;
    k.dbx={};for(const c in DB)k.dbx[c]={sl:DB[c].sl,held:DB[c].held,role:DB[c].role,skill:DB[c].skill,ageGame:DB[c].ageGame,developmentElapsed:DB[c].developmentElapsed,skillRatingHundredths:DB[c].skillRatingHundredths,licenseSource:DB[c].licenseSource,simulatedLicenseApproved:DB[c].simulatedLicenseApproved,licenseApprovalYear:DB[c].licenseApprovalYear};
    k.year++;k.season++;k.round=0;k.rd=[];k.rdRound=null;k.points={};k.tpoints={};k.pointLedger={schemaVersion:1,legacyDrivers:{},legacyConstructors:{},legacyStatus:"complete",events:[]};k.history=[];k.mevents={};k.revert=[];
    const m=$("modal");m.className="modal wide";
    m.innerHTML=`<h2>🆕 Starterfeld ${k.year}</h2><table class="res">${TEAM_KEYS.map(t=>`<tr><td><span style="color:${TEAMS[t].color}">■</span> ${TEAMS[t].name}</td><td>${k.roster[t].map(drvName).join(" · ")}</td><td>${k.pace[t].toFixed(2)} s</td></tr>`).join("")}</table>
      <button class="big go" id="nsGo">Saison ${k.year} starten</button>`;$("nsGo").onclick=done;};
  autonomousMarket(k,notes,fin);}
/* ================= Fahrermarkt-Dashboard =================
   1) Übersicht: Cockpits je Team (sicher / wackelt / frei), wen die Teams wollen, wohin die Fahrer wollen
   2) Rennleitung gibt jede Verhandlung frei oder lehnt ab (Superlizenz, Sperre, fremder Vertrag ohne Freigabe)
   3) Verhandlungen in Runden: Teams bieten, Fahrer nehmen das beste Angebot; frei gewordene Cockpits ziehen Ketten nach sich */
function mkStatus(k,t,c){if(!c)return {s:"frei",cls:"bad"};const age=DB[c]&&DB[c].ageGame||AGE[c]||25,r=k.drep[c]||50,mate=k.roster[t].find(x=>x&&x!==c),mr=mate?k.drep[mate]||50:r;
  if(r<45||r<mr-14)return {s:"wackelt",cls:"mid"};if(age>=38)return {s:"letzte Saison?",cls:"mid"};return {s:"sicher",cls:"ok"};}
const MARKET_DNA={FER:{rep:97,patience:45,risk:40,youth:75},MER:{rep:95,patience:80,risk:35,youth:90},MCL:{rep:96,patience:80,risk:40,youth:80},RBR:{rep:96,patience:25,risk:90,youth:90},AMR:{rep:82,patience:60,risk:50,youth:60},WIL:{rep:77,patience:75,risk:65,youth:85},AUD:{rep:74,patience:80,risk:55,youth:75},ALP:{rep:72,patience:40,risk:75,youth:80},HAA:{rep:65,patience:65,risk:50,youth:65},RCB:{rep:69,patience:45,risk:85,youth:98},CAD:{rep:71,patience:75,risk:60,youth:65}};
function ensureTeamMarketProfiles(k){k.teamMarketProfiles=k.teamMarketProfiles||{};for(const t of TEAM_KEYS)if(!k.teamMarketProfiles[t])k.teamMarketProfiles[t]=Object.assign({},MARKET_DNA[t]||{rep:65,patience:65,risk:50,youth:60},{updatedYear:null});}
function ensureDriverMarketProfile(k,c){k.driverProfiles=k.driverProfiles||{};if(k.driverProfiles[c])return;let h=2166136261;for(const ch of String(DB[c]?.id||c))h=Math.imul(h^ch.charCodeAt(0),16777619)>>>0;k.driverProfiles[c]={ambition:30+h%71,rolePriority:25+(h>>>7)%76,loyalty:20+(h>>>13)%81,seed:h};}
function ensureMarketPersonalities(k){ensureTeamMarketProfiles(k);k.driverProfiles=k.driverProfiles||{};for(const c of Object.keys(DB))ensureDriverMarketProfile(k,c);}
function updateTeamMarketReputation(k){ensureTeamMarketProfiles(k);const year=Number(k.year)||2026;k.marketReputationYears=k.marketReputationYears||[];if(k.marketReputationYears.includes(year))return;k.marketReputationYears.push(year);const scores=TEAM_KEYS.map(t=>Number(k.tpoints&&k.tpoints[t])||0),mean=scores.reduce((a,b)=>a+b,0)/Math.max(1,scores.length);TEAM_KEYS.forEach((t,i)=>{const p=k.teamMarketProfiles[t],base=(MARKET_DNA[t]||{}).rep||65,target=clamp(base+(scores[i]-mean)*0.055,45,99);p.rep=clamp(Math.round((Number(p.rep)||base)*0.76+target*0.24),35,99);p.updatedYear=year;});}
function mkDrvPref(k,c,t){const ord=teamOrder(k),i=ord.indexOf(t),rel=k.relationships&&k.relationships[`${c}:${t}`];ensureDriverMarketProfile(k,c);const profile=k.driverProfiles[c],amb=(profile?.ambition||55)/100,role=(profile?.rolePriority||50)/100,ranking=(10-i)*1.1*(0.42+0.58*amb),own=k.drep&&k.drep[c]||50,mates=(k.roster&&k.roster[t]||[]).filter(x=>x&&x!==c),mateStrength=mates.reduce((n,x)=>Math.max(n,k.drep&&k.drep[x]||50),0),leadOpportunity=clamp(own-mateStrength,-25,25)*0.32*role,dna=(k.teamMarketProfiles||{})[t]||MARKET_DNA[t]||{rep:65,patience:65,youth:60},cultureFit=-(Math.abs(dna.rep-(55+amb*45))*0.025+Math.abs(dna.youth-(35+role*65))*0.018),home=DB[c]&&DB[c].home===t?1.5+(profile?.loyalty||50)*0.025:0;return ranking+leadOpportunity+cultureFit+home+(rel?(rel.driverInterest-50)*0.07:0)+(Number(k.money&&k.money[t])||0)/90+(c.charCodeAt(0)*7+t.charCodeAt(1)*13)%10/8;}
function annualSalaryMillions(code){const s=Number(DB[code]&&DB[code].salary)||0;return s>1000?s/1e6:s;}
function teamPayroll(k,team,excluding=null){return (k.roster[team]||[]).filter(c=>c&&c!==excluding).reduce((n,c)=>n+annualSalaryMillions(c),0);}
function marketAttribute(d,key,fallback){const n=Number(d.sourceRecord&&d.sourceRecord[key]);return Number.isFinite(n)&&n>0?n:fallback;}
function teamStyleFit(d,t,k){const dna=k.teamMarketProfiles[t]||MARKET_DNA[t]||{rep:65,patience:65,risk:50,youth:60},skill=Number(d.skillRatingHundredths||d.initialSkillRating*100||0)/100,potential=Number(d.potentialHundredths||0)/100,aggression=marketAttribute(d,"aggression_game",50),consistency=marketAttribute(d,"consistency_game",50),qualifying=marketAttribute(d,"qualifying_game",skill);return ((dna.youth-50)/50)*(potential-skill)*0.12+((dna.risk-50)/50)*(aggression-50)*0.10+((dna.patience-50)/50)*(consistency-50)*0.08+((dna.rep-80)/17)*(qualifying-50)*0.08;}
function mkTeamPref(k,t,c){ensureTeamMarketProfiles(k);const d=DB[c]||{},age=d.ageGame||AGE[c]||25,rel=k.relationships&&k.relationships[`${c}:${t}`],budget=Number(k.money&&k.money[t])||160,pay=teamPayroll(k,t),cost=annualSalaryMillions(c),financialFit=Math.max(-22,Math.min(8,(budget*0.8-pay-cost)*0.22)),dna=k.teamMarketProfiles[t]||MARKET_DNA[t]||{rep:65,youth:60},skill=Number(d.skillRatingHundredths||d.initialSkillRating*100||0)/100,potential=Number(d.potentialHundredths||0)/100,teamResult=(k.tpoints&&k.tpoints[t])||0,table=teamOrder(k),rank=table.indexOf(t),ambition=(dna.rep-65)*0.035,prospectWeight=dna.youth/100;return (k.drep[c]||50)+skill*(0.1+ambition)+potential*prospectWeight*0.12+teamStyleFit(d,t,k)+(rel?(rel.teamInterest-50)*0.18:0)+(d.home===t?6:d.home===PARTNER[t]?3:0)-Math.max(0,age-37)*2.5+(k.points[c]||0)*0.04+financialFit+Math.max(0,teamResult)*0.002+(10-Math.max(0,rank))*0.01;}
function marketEvent(k,type,driver,team,text,status="rumor"){
  k.marketNews=k.marketNews||[];const id=`${k.season||1}:${k.round||0}:${type}:${driver||""}:${team||""}`;
  if(k.marketNews.some(e=>e.id===id))return;
  k.marketNews.push({id,year:k.year||2026,season:k.season||1,round:k.round||0,type,driver:driver||null,team:team||null,status,text});
  if(k.marketNews.length>600)k.marketNews.splice(0,k.marketNews.length-600);
}
function updateMarketIntel(k,classification=[]){
  if(!k||!k.roster)return;const key=`${k.season||1}:${k.round||0}`;k.marketIntelProcessed=k.marketIntelProcessed||[];if(k.marketIntelProcessed.includes(key))return;
  k.marketIntelProcessed.push(key);k.relationships=k.relationships||{};k.teamPlans=k.teamPlans||{};k.marketNegotiations=k.marketNegotiations||[];
  TEAM_KEYS.forEach(t=>{
    const lineup=(k.roster[t]||[]).filter(Boolean),weak=lineup.slice().sort((a,b)=>(k.drep[a]||50)-(k.drep[b]||50))[0],mate=lineup.find(c=>c!==weak);
    const contract=weak&&k.contracts&&k.contracts[weak],due=contract&&contract.endYear&&contract.endYear<=(k.year||2026)+1;
    const performance=classification.filter(c=>c.drv.team===t).reduce((a,c)=>a+(c.finished&&!c.dsq?Math.max(0,21-classification.indexOf(c)):0),0);
    const urgency=due?"renew_or_replace":!mate||!weak?"open_seat":(k.drep[weak]||50)<42?"performance_review":"monitor";
    const options=Object.keys(DB).filter(c=>!seatOf(k,c)&&!(k.retired||[]).includes(c)&&!(k.banNow||[]).includes(c)&&slOk(c))
      .map(c=>({driver:c,score:mkTeamPref(k,t,c)+(DB[c].academy===t?7:0),license:true})).sort((a,b)=>b.score-a.score).slice(0,5);
    k.teamPlans[t]={updatedYear:k.year||2026,updatedRound:k.round||0,urgency,targets:options,performanceSignal:performance,
      confidence:clamp(Math.round(48+(due?25:0)+Math.max(0,55-(k.drep[weak]||50))*0.7),10,95)};
    if(due&&weak)marketEvent(k,"contract_watch",weak,t,`${TEAMS[t].name} prüft wegen des auslaufenden Vertrags von ${drvName(weak)} die nächste Saisonaufstellung.`);
    else if(urgency==="performance_review"&&weak&&options[0]&&(k.round%3===0))marketEvent(k,"scouting",options[0].driver,t,`${TEAMS[t].name} beobachtet ${drvName(options[0].driver)} nach einer schwachen Phase von ${drvName(weak)}.`);
    const seasonLen=Math.max(1,(k.cal||[]).length),progress=(k.round||0)/seasonLen;
    const target=options.find(x=>x.driver!==weak);if(target&&(due||urgency==="performance_review"||progress>=0.4)){
      const driver=target.driver,seat=seatOf(k,driver),rel=k.relationships[`${driver}:${t}`]||{teamInterest:target.score,driverInterest:50};
      const other=seat&&k.relationships[`${driver}:${seat}`],driverInterest=clamp(Math.round(50+(mkDrvPref(k,driver,t)-mkDrvPref(k,driver,seat||t))*7+(other?other.driverInterest-50:0)),0,100),teamInterest=clamp(Math.round(target.score),0,100);
      const stage=progress<0.35?"scouting":progress<0.62?"interest":(teamInterest>=64&&driverInterest>=53?"negotiation":"shortlist"),negId=`${k.season||1}:${t}:${driver}`;
      let neg=k.marketNegotiations.find(x=>x.id===negId);if(!neg){neg={id:negId,year:k.year||2026,season:k.season||1,team:t,driver,from:seat||null,stage,openedRound:k.round||0,history:[]};k.marketNegotiations.push(neg);}
      if(neg.stage!==stage){neg.history.push({round:neg.updatedRound||neg.openedRound,stage:neg.stage});neg.stage=stage;}
      neg.updatedRound=k.round||0;neg.teamInterest=teamInterest;neg.driverInterest=driverInterest;neg.confidence=clamp(Math.round((teamInterest+driverInterest)/2),0,100);neg.reason=due?"Vertragsende nähert sich":urgency==="performance_review"?"Leistungsbewertung":"Saisonplanung";
      if(stage==="negotiation")marketEvent(k,"negotiation",driver,t,`${TEAMS[t].name} führt konkrete Gespräche mit ${drvName(driver)} (${neg.confidence}% beiderseitiges Interesse).`);
      else if(stage==="interest")marketEvent(k,"interest",driver,t,`${TEAMS[t].name} hat konkretes Interesse an ${drvName(driver)} angemeldet.`);
    }
    const current=classification.filter(c=>c.drv.team===t);for(const c of current){const rel=k.relationships[`${c.drv.code}:${t}`];if(rel&&rel.driverInterest<34&&k.round%3===0)marketEvent(k,"driver_dissatisfaction",c.drv.code,t,`${drvName(c.drv.code)} ist mit der sportlichen Situation bei ${TEAMS[t].name} unzufrieden.`);}
  });
  for(const e of classification){const c=e.drv.code,t=e.drv.team,rel=k.relationships[`${c}:${t}`]||{teamInterest:65,driverInterest:65,history:[]};
    rel.history=rel.history||[];rel.history.push({year:k.year||2026,round:k.round||0,teamInterest:rel.teamInterest,driverInterest:rel.driverInterest});if(rel.history.length>12)rel.history.shift();k.relationships[`${c}:${t}`]=rel;}
  const forecast=[];for(const t of TEAM_KEYS){const plan=k.teamPlans[t];if(!plan)continue;for(const target of plan.targets.slice(0,3)){const seat=seatOf(k,target.driver),key=`${target.driver}:${t}`,old=k.relationships[key]||{},driverInterest=old.driverInterest??clamp(Math.round(50+(mkDrvPref(k,target.driver,t)-mkDrvPref(k,target.driver,seat||t))*7),0,100);k.relationships[key]=Object.assign(old,{teamInterest:clamp(Math.round(target.score),0,100),driverInterest,updatedRound:k.round||0});forecast.push({team:t,driver:target.driver,interest:clamp(Math.round(target.score),0,100),driverInterest,reason:plan.urgency,kind:"shortlist",from:seat||null});}}
  k.marketPlan={year:(k.year||2026)+1,items:forecast};
}
function mkInterests(k){const ord=teamOrder(k),iv=[],seen=new Set();let id=0;
  const add=(t,c,kind,out,why)=>{const key=t+c;if(seen.has(key)||!c||!slOk(c))return;seen.add(key);const from=seatOf(k,c);
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
function transferFeeMillions(k,code){const ct=k.contracts&&k.contracts[code],end=Number(ct&&ct.endYear||0);if(!end||end<(k.year||2026)+1)return 0;const amount=Number(ct&&ct.releaseFee||DB[code]&&DB[code].releaseFee)||0;return amount>1000?amount/1e6:amount;}
function mkValid(k,iv){const c=iv.drv;
  if(k.banNow&&k.banNow.includes(c))return {ok:false,why:`${drvName(c)} ist gesperrt.`};
  if(!slOk(c))return {ok:false,why:`${drvName(c)} hat keine Superlizenz (${slTxt(c)}).`};
  if(seatOf(k,c)!==null&&iv.team===seatOf(k,c))return {ok:false,why:`${drvName(c)} ist bereits für ${TEAMS[iv.team].name} registriert.`};
  const fee=transferFeeMillions(k,c),budget=Number(k.money&&k.money[iv.team])||160,payroll=teamPayroll(k,iv.team,iv.out||null),salary=annualSalaryMillions(c);
  if(payroll+salary+fee>budget*0.8)return {ok:false,why:`${TEAMS[iv.team].name} kann Vertrag und Gehalt von ${drvName(c)} mit dem verfügbaren Transferbudget nicht finanzieren.`};
  return {ok:true,why:iv.from?`Vertrag wird im Transferfenster durch eine gegenseitige Vereinbarung abgelöst.`:`Vertragsfrei und für den Einsatz zugelassen.`};}
function autonomousDriverExchange(k){
  const windowId=`${k.season||1}:${k.year||2026}`;k.exchangeWindows=k.exchangeWindows||[];if(k.exchangeWindows.includes(windowId))return false;k.exchangeWindows.push(windowId);
  if(Math.random()>0.12)return false;ensureMarketPersonalities(k);const teams=shuffle(TEAM_KEYS.filter(t=>t!=="RBR"&&t!=="RCB"));
  for(let ai=0;ai<teams.length;ai++)for(let bi=ai+1;bi<teams.length;bi++){const a=teams[ai],b=teams[bi];for(const ca of (k.roster[a]||[]))for(const cb of (k.roster[b]||[])){
    if(!ca||!cb||!slOk(ca)||!slOk(cb)||k.banNow?.includes(ca)||k.banNow?.includes(cb))continue;
    const teamA=mkTeamPref(k,a,cb)-mkTeamPref(k,a,ca),teamB=mkTeamPref(k,b,ca)-mkTeamPref(k,b,cb),driverA=mkDrvPref(k,ca,b)-mkDrvPref(k,ca,a),driverB=mkDrvPref(k,cb,a)-mkDrvPref(k,cb,b);
    if(teamA<0.5||teamB<0.5||driverA<0.15||driverB<0.15)continue;
    const feeA=transferFeeMillions(k,cb),feeB=transferFeeMillions(k,ca),payA=teamPayroll(k,a,ca)+annualSalaryMillions(cb)+feeA,payB=teamPayroll(k,b,cb)+annualSalaryMillions(ca)+feeB;
    if(payA>(Number(k.money&&k.money[a])||160)*0.8||payB>(Number(k.money&&k.money[b])||160)*0.8)continue;
    const ia=k.roster[a].indexOf(ca),ib=k.roster[b].indexOf(cb);k.roster[a][ia]=cb;k.roster[b][ib]=ca;k.money[a]=Math.max(0,(Number(k.money&&k.money[a])||160)-feeA);k.money[b]=Math.max(0,(Number(k.money&&k.money[b])||160)-feeB);
    k.contracts=k.contracts||{};for(const [code,team,from] of [[cb,a,b],[ca,b,a]]){const d=DB[code]||{};k.contracts[code]={team,startYear:(k.year||2026)+1,endYear:(k.year||2026)+3,salary:d.salary||0,releaseFee:d.releaseFee||0,basis:"simulated_mutual_driver_exchange",status:"confirmed"};
      k.transferHistory=k.transferHistory||[];const id=`${windowId}:exchange:${code}:${team}`;if(!k.transferHistory.some(e=>e.id===id))k.transferHistory.push({id,year:k.year||2026,season:k.season||1,round:k.round||0,type:"driver_exchange",driver:code,from,to:team,status:"completed",reason:"beiderseitiges Teaminteresse und Fahrerzustimmung"});
      marketEvent(k,"driver_exchange",code,team,`${TEAMS[team].name} und ${TEAMS[from].name} tauschen ${drvName(code)} gegen den anderen Fahrer.`,"confirmed");}
    return true;
  }}
  return false;
}
function autonomousMarket(k,notes,fin){
  generateNextGeneration(k);
  const windowId=`${k.season||1}:${k.year||2026}`;k.processedTransferWindows=k.processedTransferWindows||[];
  if(k.processedTransferWindows.includes(windowId)){fin();return;}
  updateTeamMarketReputation(k);
  autonomousDriverExchange(k);
  const iv=mkInterests(k),dec=Object.fromEntries(iv.map(x=>[x.id,true]));
  k.marketPlan={year:(k.year||2026)+1,items:iv.map(x=>({team:x.team,driver:x.drv,interest:x.int,
    driverInterest:clamp(Math.round((mkDrvPref(k,x.drv,x.team)+6)*6),0,100),reason:x.why,kind:x.kind,from:x.from||null}))};
  k.relationships=k.relationships||{};for(const item of k.marketPlan.items){const key=`${item.driver}:${item.team}`,prior=k.relationships[key]||{};
    k.relationships[key]=Object.assign(prior,{teamInterest:item.interest,driverInterest:item.driverInterest,updatedSeason:k.season||1});}
  marketRun(k,iv,dec,fin);
}
function fillVacancies(k,log=[]){
  k.contracts=k.contracts||{};k.transferHistory=k.transferHistory||[];
  for(const t of TEAM_KEYS){let slot;while((slot=(k.roster[t]||[]).indexOf(null))>=0){const cap=(Number(k.money&&k.money[t])||160)*0.8,candidate=candidates(k,t,[]).find(c=>slOk(c)&&teamPayroll(k,t)+annualSalaryMillions(c)<=cap);if(!candidate){log.push({r:99,t:`${TEAMS[t].name}: Kein lizenzierter und finanzierbarer Fahrer verfügbar; Cockpit bleibt kontrolliert frei.`,c:"mid"});break;}
      const retired=retiredRecord(k,candidate),from=seatOf(k,candidate),d=DB[candidate]||{};k.roster[t][slot]=candidate;
      if(retired){k.retired=k.retired.filter(x=>x!==retired);log.push({r:99,t:`${drvName(candidate)} kehrt nach mindestens drei Jahren Pause zurück und unterschreibt bei ${TEAMS[t].name}.`,c:"ok"});}
      else log.push({r:99,t:`${drvName(candidate)} übernimmt als zulässige Notverpflichtung ein freies Cockpit bei ${TEAMS[t].name}.`,c:"ok"});
      k.contracts[candidate]={team:t,startYear:(k.year||2026)+1,endYear:(k.year||2026)+3,salary:d.salary||0,releaseFee:d.releaseFee||0,basis:retired?"simulated_comeback_agreement":"simulated_emergency_agreement",status:"confirmed"};
      const type=retired?"comeback":from?"transfer":"signing",id=`${k.season||1}:${k.year||2026}:fill:${candidate}:${t}`;
      if(!k.transferHistory.some(e=>e.id===id))k.transferHistory.push({id,season:k.season||1,year:k.year||2026,round:k.round||0,type,driver:candidate,from:from||null,to:t,status:"completed",reason:"freie Stelle mit automatischer Lizenz- und Budgetprüfung"});
      marketEvent(k,type,candidate,t,`${drvName(candidate)} unterschreibt bei ${TEAMS[t].name} für ein freies Cockpit.`,"confirmed");
  }}
  return log;
}
function marketRun(k,iv,dec,fin){const log=[],moves=[],m=$("modal");
  for(const x of iv){const v=mkValid(k,x);x.go=v.ok;if(!v.ok)log.push({r:0,t:`Automatische Zulassungsprüfung blockiert ${TEAMS[x.team].name} → ${drvName(x.drv)}: ${v.why}`,c:"bad"});}
  /* Runden: Teams mit offenem Platz bieten dem besten freigegebenen Kandidaten, Fahrer nehmen das beste Angebot (bleiben ist auch eine Option) */
  const tried={},signed=new Set();for(let r=1;r<=6;r++){const offers={};let any=false;
    for(const t of TEAM_KEYS){const slots=k.roster[t].map((c,i)=>c===null?i:-1).filter(i=>i>=0);
      const upg=iv.filter(x=>x.go&&x.team===t&&x.kind==="wechsel"&&!signed.has(x.drv)&&k.roster[t].includes(x.out)&&!(tried[t]||[]).includes(x.drv));
      const freeC=iv.filter(x=>x.go&&x.team===t&&!signed.has(x.drv)&&!(tried[t]||[]).includes(x.drv)&&seatOf(k,x.drv)!==t&&teamPayroll(k,t,slots.length?null:x.out)+annualSalaryMillions(x.drv)<=((Number(k.money&&k.money[t])||160)*0.8)).sort((a,b)=>mkTeamPref(k,t,b.drv)-mkTeamPref(k,t,a.drv));
      if(slots.length&&freeC.length){const x=freeC[0];(offers[x.drv]=offers[x.drv]||[]).push({t,slot:slots[0],x});(tried[t]=tried[t]||[]).push(x.drv);any=true;}
      else if(!slots.length&&upg.length){const x=upg.sort((a,b)=>mkTeamPref(k,t,b.drv)-mkTeamPref(k,t,a.drv))[0];(offers[x.drv]=offers[x.drv]||[]).push({t,slot:k.roster[t].indexOf(x.out),x});(tried[t]=tried[t]||[]).push(x.drv);any=true;}}
    if(!any)break;
    for(const c in offers){const os=offers[c].sort((a,b)=>mkDrvPref(k,c,b.t)-mkDrvPref(k,c,a.t)),best=os[0],cur=seatOf(k,c),stay=cur?mkDrvPref(k,c,cur)+1.5:-99;
      for(const o of os)log.push({r,t:`${TEAMS[o.t].name} bietet ${drvName(c)} einen Vertrag an.`});
      if(mkDrvPref(k,c,best.t)>stay){const out=k.roster[best.t][best.slot];if(cur){const j=k.roster[cur].indexOf(c);k.roster[cur][j]=null;}
        k.roster[best.t][best.slot]=c;signed.add(c);moves.push({c,from:cur,to:best.t,out});
        const fee=transferFeeMillions(k,c);if(fee>0)k.money[best.t]=Math.max(0,(Number(k.money&&k.money[best.t])||160)-fee);
        k.contracts=k.contracts||{};if(cur&&k.contracts[c])Object.assign(k.contracts[c],{status:"transferred",endedYear:(k.year||2026)+1,to:best.t});
        if(out&&k.contracts[out])Object.assign(k.contracts[out],{status:"released",endedYear:(k.year||2026)+1});
        {const d=DB[c]||{};k.contracts[c]={team:best.t,startYear:(k.year||2026)+1,endYear:(k.year||2026)+3,salary:d.salary||0,releaseFee:d.releaseFee||0,basis:"simulated_transfer_agreement",status:"confirmed"};}
        k.transferHistory=k.transferHistory||[];const eventId=`${k.season||1}:${k.year||2026}:${r}:${c}:${best.t}`;
        if(!k.transferHistory.some(e=>e.id===eventId))k.transferHistory.push({id:eventId,season:k.season||1,year:k.year||2026,round:k.round||0,type:cur?"transfer":"signing",driver:c,from:cur||null,to:best.t,replaced:out||null,status:"completed",reason:best.x.why});marketEvent(k,cur?"transfer":"signing",c,best.t,`${drvName(c)} unterschreibt bei ${TEAMS[best.t].name}${cur?` nach dem Wechsel von ${TEAMS[cur].name}`:""}.`,"confirmed");
        log.push({r,t:`✍ ${drvName(c)} unterschreibt bei ${TEAMS[best.t].name}${cur?` (kommt von ${TEAMS[cur].name})`:""}${out?` – ${drvName(out)} verliert sein Cockpit`:""}.`,c:"ok"});
        for(const o of os.slice(1))log.push({r,t:`${drvName(c)} sagt ${TEAMS[o.t].name} ab.`,c:"mid"});}
      else for(const o of os)log.push({r,t:`${drvName(c)} bleibt bei ${TEAMS[cur].name} und lehnt ${TEAMS[o.t].name} ab.`,c:"mid"});}}
  fillVacancies(k,log);
  for(const t of TEAM_KEYS)for(const c of (k.roster[t]||[]).filter(Boolean)){const ct=k.contracts&&k.contracts[c];if(ct&&ct.endYear&&(Number(ct.endYear)<(k.year||2026)+1)&&!moves.some(x=>x.c===c)){
      const rel=k.relationships&&k.relationships[`${c}:${t}`],confidence=clamp(Math.round((k.drep[c]||50)*0.45+(rel?.driverInterest||50)*0.25+(rel?.teamInterest||50)*0.2+(mkTeamPref(k,t,c))*0.1),0,100);
      if(confidence>=45){ct.endYear=(k.year||2026)+3;ct.status="renewed";ct.renewedYear=(k.year||2026)+1;const id=`${k.season||1}:${k.year||2026}:renew:${c}:${t}`;k.transferHistory=k.transferHistory||[];if(!k.transferHistory.some(e=>e.id===id))k.transferHistory.push({id,year:k.year||2026,season:k.season||1,round:k.round||0,type:"renewal",driver:c,from:t,to:t,status:"completed",reason:`automatische Verlängerung · Vertrauen ${confidence}/100`});marketEvent(k,"renewal",c,t,`${TEAMS[t].name} verlängert den Vertrag von ${drvName(c)} bis ${ct.endYear}.`,"confirmed");}
    }}
  const windowId=`${k.season||1}:${k.year||2026}`;k.processedTransferWindows=k.processedTransferWindows||[];if(!k.processedTransferWindows.includes(windowId))k.processedTransferWindows.push(windowId);
  if(typeof liveSave==="function")liveSave();
  m.className="modal wide";m.innerHTML=`<h2>🤝 Verhandlungen</h2><div id="mkLog" style="max-height:46vh;overflow:auto"></div>
    <h4 style="margin:12px 0 4px">Wechsel</h4>${moves.length?`<table class="res"><tr><th>Fahrer</th><th>von</th><th>zu</th><th>verdrängt</th></tr>${moves.map(v=>`<tr><td><b>${v.c}</b> ${esc(drvName(v.c))}</td><td>${v.from?TEAMS[v.from].name:"vertragsfrei"}</td><td><span style="color:${TEAMS[v.to].color}">■</span> ${TEAMS[v.to].name}</td><td>${v.out?esc(drvName(v.out)):"–"}</td></tr>`).join("")}</table>`:"<p class='hint'>Keine Wechsel.</p>"}
    <div class="fbk ${moves.length?"ok":"mid"}">${moves.length} autonome Wechsel; reguläre Transfers benötigen keine Rennleiterfreigabe.</div>
    <button class="big go" id="mkFin">Weiter zum Starterfeld</button>`;
  const box=$("mkLog");let i=0;const show=()=>{if(i>=log.length)return;const e=log[i++];const d=document.createElement("div");d.className="fbk "+(e.c||"");d.style.cssText="margin:3px 0;padding:4px 8px;opacity:0;transition:opacity .35s";
    d.textContent=(e.r&&e.r<99?`Runde ${e.r}: `:"")+e.t;box.appendChild(d);requestAnimationFrame(()=>d.style.opacity=1);box.scrollTop=box.scrollHeight;setTimeout(show,420);};show();
  $("mkFin").onclick=fin;}
/* Gespeicherte Entwicklung der Nachwuchsfahrer wiederherstellen */
function restoreDB(k){if(k&&Array.isArray(k.generatedDrivers))k.generatedDrivers.forEach(registerGeneratedDriver);if(k&&k.dbx)for(const c in k.dbx)if(DB[c])Object.assign(DB[c],k.dbx[c]);}
function ensurePointLedger(k){
  if(k.pointLedger)return k.pointLedger;
  const oldTeams=k.tpoints&&Object.keys(k.tpoints).length?Object.assign({},k.tpoints):{};
  return k.pointLedger={schemaVersion:1,legacyDrivers:Object.assign({},k.points||{}),legacyConstructors:oldTeams,
    legacyStatus:Object.keys(oldTeams).length?"preserved_unverified":"unavailable",events:[]};
}
function recordChampionshipPoints(k,classification,pointTable,session){
  const ledger=ensurePointLedger(k),eventId=`${k.season||1}:${k.round||0}:${TRACK.key}:${session}`;
  const entries=classification.filter(c=>c.finished&&!c.dsq).slice(0,pointTable.length).map((c,i)=>({driver:c.drv.code,team:c.drv.team,points:pointTable[i]})).filter(e=>e.points>0);
  const event={id:eventId,season:k.season||1,round:k.round||0,track:TRACK.key,session,entries};
  const old=ledger.events.findIndex(e=>e.id===eventId);if(old>=0)ledger.events[old]=event;else ledger.events.push(event);
  k.points=Object.assign({},ledger.legacyDrivers||{});k.tpoints=Object.assign(Object.fromEntries(TEAM_KEYS.map(t=>[t,0])),ledger.legacyConstructors||{});
  for(const e of ledger.events)for(const row of e.entries||[]){k.points[row.driver]=(k.points[row.driver]||0)+row.points;k.tpoints[row.team]=(k.tpoints[row.team]||0)+row.points;}
  return ledger;
}
function rebuildConstructorPoints(k){
  if(!k)return {};
  const ledger=ensurePointLedger(k),totals=Object.assign(Object.fromEntries(TEAM_KEYS.map(t=>[t,0])),ledger.legacyConstructors||{});
  for(const e of ledger.events)for(const row of e.entries||[])totals[row.team]=(totals[row.team]||0)+row.points;
  k.tpoints=totals;return totals;
}
function standingsRows(k){const codes=new Set(Object.keys(k.points));DRIVERS.forEach(d=>codes.add(d.code));
  return [...codes].map(c=>{const cur=DRIVERS.find(d=>d.code===c),t=cur?cur.team:(k.roster&&seatOf(k,c))||(DB[c]&&DB[c].home)||"MER";
    return {d:{code:c,name:drvName(c),color:TEAMS[t].color,team:t},p:k.points[c]||0};}).sort((a,b)=>b.p-a.p);}
const MARKET_TABS=["Overview","Next Season Grid","Team Plans","Relationships","Driver Database","Transfer History"];
let MARKET_TAB="Overview",MARKET_QUERY="",MARKET_TIER="all",MARKET_NATION="all",MARKET_LICENSE="all",MARKET_AVAILABLE="all",MARKET_AGE="",MARKET_SKILL="",MARKET_POTENTIAL="",MARKET_REPUTATION="",MARKET_ACADEMY="all",MARKET_CONTRACT="all",MARKET_PROFILE="";
function marketText(v){return typeof esc==="function"?esc(String(v??"")):String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function marketCareer(){return W&&W.career||CAREER||null;}
function marketRosterRows(k){return TEAM_KEYS.map(t=>`<tr><td><b style="color:${TEAMS[t].color}">${marketText(TEAMS[t].name)}</b></td>${(k.roster[t]||[]).map(code=>{const d=DB[code]||{},ct=k.contracts&&k.contracts[code],end=ct&&ct.endYear||d.contractEnd;return `<td>${code?`${marketText(d.name||code)}<br><small class="hint">${end?`Vertrag bis ${end}`:"Vertrag nicht erfasst"}</small>`:`<span style="color:#ff9b9b">Cockpit frei</span>`}</td>`;}).join("")}</tr>`).join("");}
function renderDriverMarket(){const k=marketCareer(),nav=document.getElementById("driverMarketTabs"),body=document.getElementById("driverMarketContent");if(!nav||!body)return;
  nav.innerHTML=MARKET_TABS.map(t=>`<button class="ghost" data-mktab="${marketText(t)}" aria-pressed="${MARKET_TAB===t}">${marketText(t)}</button>`).join("");
  nav.querySelectorAll("[data-mktab]").forEach(b=>b.onclick=()=>{MARKET_TAB=b.dataset.mktab;renderDriverMarket();});
  if(!k||!k.roster){body.innerHTML='<p class="hint">Kein aktiver Saisonspielstand. Die Datenbank bleibt durchsuchbar.</p>';}
  else if(MARKET_TAB==="Overview"){
    const hist=(k.transferHistory||[]).slice(-12).reverse();
    const news=(k.marketNews||[]).slice(-14).reverse();
    const active=(k.marketNegotiations||[]).filter(n=>n.stage==="negotiation").slice(-10).reverse();
    body.innerHTML=`<p class="hint">Saison ${marketText(k.year||2026)} · autonome Teamentscheidungen · keine Rennleiterfreigabe für reguläre Transfers · ${active.length} aktive Gespräche</p><h4>Aktuelle Aufstellungen</h4><table class="res"><tr><th>Team</th><th>Cockpit 1</th><th>Cockpit 2</th><th>Budget / Payroll</th></tr>${TEAM_KEYS.map(t=>`<tr><td>${marketText(TEAMS[t].name)}</td>${(k.roster[t]||[]).map(c=>`<td>${marketText(DB[c]?.name||c||"Cockpit frei")}</td>`).join("")}<td>$${Number(k.money&&k.money[t]||0).toFixed(1)}m / $${teamPayroll(k,t).toFixed(1)}m</td></tr>`).join("")}</table><h4>Aktive Verhandlungen</h4>${active.map(n=>`<div class="fbk mid">${marketText(TEAMS[n.team]?.name)} spricht mit ${marketText(DB[n.driver]?.name||n.driver)} · Team ${n.teamInterest}/100 · Fahrer ${n.driverInterest}/100</div>`).join("")||'<p class="hint">Zurzeit keine konkreten Gespräche.</p>'}<h4>Transfer-News</h4>${news.length?news.map(e=>`<div class="fbk ${e.status==="confirmed"?"ok":"mid"}">${marketText(e.year)} · R${marketText(e.round)} · ${marketText(e.status)} · ${marketText(e.text)}</div>`).join(""):'<p class="hint">Noch keine gespeicherten Marktmeldungen.</p>'}<h4>Letzte bestätigte Ereignisse</h4>${hist.length?hist.map(e=>`<div class="fbk mid">${marketText(e.year)} · ${marketText(e.type)} · ${marketText(DB[e.driver]?.name||e.driver)}: ${marketText(e.from?TEAMS[e.from]?.name:"frei")} → ${marketText(e.to?TEAMS[e.to]?.name||e.to:"Karriereende")}</div>`).join(""):'<p class="hint">Noch keine Transferereignisse gespeichert.</p>'}`;
  }else if(MARKET_TAB==="Next Season Grid"){
    const plan=k.marketPlan&&k.marketPlan.year===(k.year||2026)+1?k.marketPlan:null;
    const currentRows=TEAM_KEYS.map(t=>(k.roster[t]||[]).map(c=>{const d=DB[c]||{},end=Number(k.contracts&&k.contracts[c]&&k.contracts[c].endYear||d.contractEnd||d.sourceRecord?.contract_end_year_game)||0,status=!c?"Cockpit gefährdet":end>=(k.year||2026)+1?"Vertraglich bestätigt":end?"Läuft aus":"Unbekannt";return `<tr><td>${marketText(TEAMS[t].name)}</td><td>${marketText(d.name||c||"frei")}</td><td>${status}</td><td>–</td></tr>`;}).join("")).join("");
    const candidateRows=(plan?.items||[]).map(x=>`<tr><td>${marketText(TEAMS[x.team].name)}</td><td>${marketText(DB[x.driver]?.name||x.driver)}</td><td>${marketText(x.reason==="renew_or_replace"?"Kandidat in Verhandlung":"Beobachteter Kandidat")}</td><td>Team ${x.interest}/100 · Fahrer ${x.driverInterest}/100</td></tr>`).join("");
    body.innerHTML=`<p class="hint">Vorschau ${marketText((k.year||2026)+1)} · bestätigte Verträge bleiben von beobachteten Kandidaten getrennt.</p><table class="res"><tr><th>Team</th><th>Fahrer</th><th>Status</th><th>Interesse</th></tr>${currentRows}${candidateRows}</table><p class="hint">${plan?plan.items.length:"Noch kein Marktplan"} konkrete Shortlist-Einträge. Prognosen ändern sich mit Ergebnissen und Vertragsereignissen.</p>`;
  }else if(MARKET_TAB==="Team Plans"){
    const plan=k&&k.marketPlan,items=plan&&plan.items||[];
    body.innerHTML=`<p class="hint">KI-Shortlists werden durch Leistung, Verträge, Fahrerinteresse und finanzielle Tragbarkeit gebildet.</p>${TEAM_KEYS.map(t=>{const p=k.teamPlans&&k.teamPlans[t];return `<h4>${marketText(TEAMS[t].name)} · ${marketText(p?.urgency||"keine Analyse")}</h4><div class="hint">Line-up: ${(k.roster[t]||[]).map(c=>marketText(DB[c]?.name||c||"Cockpit frei")).join(" · ")} · Budget $${Number(k.money&&k.money[t]||0).toFixed(1)}m · Gehälter $${teamPayroll(k,t).toFixed(1)}m · Vertrauen ${p?.confidence??"–"}/100</div><div>${(p?.targets||items.filter(x=>x.team===t)).slice(0,5).map(x=>`<span class="chip">${marketText(DB[x.driver]?.name||x.driver)} · ${Math.round(x.score||x.interest)}/100</span>`).join("")||'<span class="hint">Keine zulässigen Kandidaten im Scoutingpool</span>'}</div>`;}).join("")}`;
  }else if(MARKET_TAB==="Relationships"){
    const rel=k&&k.relationships||{};
    body.innerHTML=`<p class="hint">Teaminteresse und Fahrerinteresse werden getrennt gespeichert (0–100). Der Verlauf hält die letzten zwölf bewerteten Rennwochenenden fest.</p><table class="res"><tr><th>Fahrer</th><th>Team</th><th>Teaminteresse</th><th>Fahrerinteresse</th><th>Trend</th></tr>${Object.entries(rel).slice(0,250).map(([key,v])=>{const [c,t]=key.split(":"),h=v.history||[],first=h[0],last=h[h.length-1],trend=first&&last?`${last.driverInterest-first.driverInterest>=0?"+":""}${Math.round(last.driverInterest-first.driverInterest)} Fahrer`+` · ${last.teamInterest-first.teamInterest>=0?"+":""}${Math.round(last.teamInterest-first.teamInterest)} Team`:"–";return `<tr><td>${marketText(DB[c]?.name||c)}</td><td>${marketText(TEAMS[t]?.name||t)}</td><td>${v.teamInterest??"–"}/100</td><td>${v.driverInterest??"–"}/100</td><td>${marketText(trend)}</td></tr>`;}).join("")||'<tr><td colspan="5" class="hint">Beziehungsdaten werden im nächsten Transferzyklus aufgebaut.</td></tr>'}</table>`;
  }else if(MARKET_TAB==="Driver Database"){
    const all=Object.values(DB),selected=all.find(d=>d.code===MARKET_PROFILE)||null,career=k||{},tiers=[...new Set(all.map(d=>d.sourceRecord?.development_tier_game).filter(Boolean))].sort(),nations=[...new Set(all.map(d=>d.nationality||d.sourceRecord?.nationality_ioc).filter(Boolean))].sort(),academies=[...new Set(all.map(d=>d.academy).filter(Boolean))].sort();
    const filterSelect=(id,label,value,options)=>`<label class="market-filter">${label}<select id="${id}"><option value="all">Alle</option>${options.map(x=>`<option value="${marketText(x)}" ${value===x?"selected":""}>${marketText(x)}</option>`).join("")}</select></label>`;
    const rows=all.filter(d=>{const r=d.sourceRecord||{},age=Number(d.ageGame??AGE[d.code]??0),skill=Number(d.skillRatingHundredths??d.initialSkillRating*100??0)/100,potential=Number(d.potentialHundredths||0)/100,rep=Number(r.reputation_game||career.drep&&career.drep[d.code]||0),held=d.held||Number(d.sl||0)>=40,contract=career.contracts&&career.contracts[d.code],seat=seatOf(career,d.code),available=!seat&&!(career.banNow||[]).includes(d.code)&&!(career.retired||[]).some(x=>x===d.code||x&&x.code===d.code);
      const q=normDriverName(MARKET_QUERY),match=!q||normDriverName(`${d.name} ${d.code} ${d.nationality||""} ${d.academy||""}`).includes(q);
      const contracted=!!contract||!!d.contractEnd;return match&&(MARKET_TIER==="all"||r.development_tier_game===MARKET_TIER)&&(MARKET_NATION==="all"||(d.nationality||r.nationality_ioc)===MARKET_NATION)&&(MARKET_LICENSE==="all"||(MARKET_LICENSE==="eligible"?slOk(d.code):!slOk(d.code)))&&(MARKET_AVAILABLE==="all"||(MARKET_AVAILABLE==="available"?available:!available))&&(!MARKET_AGE||age>=Number(MARKET_AGE))&&(!MARKET_SKILL||skill>=Number(MARKET_SKILL))&&(!MARKET_POTENTIAL||potential>=Number(MARKET_POTENTIAL))&&(!MARKET_REPUTATION||rep>=Number(MARKET_REPUTATION))&&(MARKET_ACADEMY==="all"||d.academy===MARKET_ACADEMY)&&(MARKET_CONTRACT==="all"||(MARKET_CONTRACT==="signed"?contracted:!contracted));}).slice(0,240);
    const profile=selected?(()=>{const r=selected.sourceRecord||{},contract=career.contracts&&career.contracts[selected.code],seat=seatOf(career,selected.code),rels=Object.entries(career.relationships||{}).filter(([key])=>key.startsWith(`${selected.code}:`)),hist=(career.transferHistory||[]).filter(e=>e.driver===selected.code).slice(-8).reverse(),interest=(career.marketPlan?.items||[]).filter(x=>x.driver===selected.code);return `<section class="market-profile"><h4>${marketText(selected.name)} · ${marketText(selected.id||selected.code)}</h4><div class="hint">${marketText(r.development_tier_game||selected.role)} · ${marketText(selected.nationality||"Nationalität unbekannt")} · Alter ${marketText(selected.ageGame??"unbekannt")}</div><div class="market-profile-grid"><span>Aktuelles Team: <b>${marketText(seat?TEAMS[seat]?.name:"Kein Cockpit")}</b></span><span>Skill / Potential: <b>${Number(selected.skillRatingHundredths||0)/100} / ${Number(selected.potentialHundredths||0)/100}</b></span><span>Karriere: <b>${marketText(selected.role||"unbekannt")}</b></span><span>Vertrag: <b>${contract?`${marketText(contract.status)} bis ${marketText(contract.endYear||"offen")}`:"kein aktiver Simulationsvertrag"}</b></span><span>Lizenz: <b>${marketText(selected.licenseEvidence||selected.note||"unbekannt")}</b></span><span>Ambition/Verfügbarkeit: <b>${marketText(r.transfer_availability_game||"unbekannt")}</b></span><span>Akademie: <b>${marketText(selected.academy||"keine Zuordnung")}</b></span><span>Frühester F1-Einstieg: <b>${marketText(r.f1_earliest_projected_season_game||"nicht prognostiziert")}</b></span><span>Interessierte Teams: <b>${marketText(interest.map(x=>TEAMS[x.team]?.name||x.team).join(", ")||"keine gespeicherte Shortlist")}</b></span></div><p class="hint">Entwicklung: ${marketText(selected.licenseSource||r.development_model_basis_game||"Quelldaten")}; Datenstatus: ${marketText(r.bio_status||"game estimate")}</p><b>Teambeziehungen</b>${rels.map(([key,v])=>`<div class="hint">${marketText(TEAMS[key.split(":")[1]]?.name||key.split(":")[1])}: Team ${v.teamInterest??"–"}/100 · Fahrer ${v.driverInterest??"–"}/100</div>`).join("")||'<div class="hint">Noch keine individuelle Beziehung gespeichert.</div>'}<b>Transferhistorie</b>${hist.map(e=>`<div class="hint">${marketText(e.year)} · ${marketText(e.type)} · ${marketText(e.from?TEAMS[e.from]?.name:"frei")} → ${marketText(e.to?TEAMS[e.to]?.name:"Karriereende")}</div>`).join("")||'<div class="hint">Keine Einträge.</div>'}</section>`;})():"<p class='hint'>Fahrer auswählen, um das gespeicherte Profil zu öffnen.</p>";
    const nums=[["marketAge","Alter ab",MARKET_AGE],["marketSkill","Skill ab",MARKET_SKILL],["marketPotential","Potential ab",MARKET_POTENTIAL],["marketRep","Reputation ab",MARKET_REPUTATION]].map(([id,l,v])=>`<label class="market-filter">${l}<input id="${id}" type="number" min="0" max="100" value="${marketText(v)}"></label>`).join("");
    body.innerHTML=`<input id="marketSearch" value="${marketText(MARKET_QUERY)}" placeholder="Name, Code, Nationalität, Akademie" style="width:min(360px,90%);padding:7px;background:#1b222b;border:1px solid #3a4452;border-radius:6px"><div class="market-filters">${filterSelect("marketTier","Serie",MARKET_TIER,tiers)}${filterSelect("marketNation","Nationalität",MARKET_NATION,nations)}${filterSelect("marketLicense","Lizenz",MARKET_LICENSE,["eligible","ineligible"])}${filterSelect("marketAvailable","Verfügbarkeit",MARKET_AVAILABLE,["available","unavailable"])}${filterSelect("marketAcademy","Akademie",MARKET_ACADEMY,academies)}${filterSelect("marketContract","Vertrag",MARKET_CONTRACT,["signed","unsigned"])}${nums}</div><p class="hint">${all.length} Profile · ${rows.length} Treffer angezeigt (max. 240)</p>${profile}<table class="res"><tr><th>Fahrer</th><th>Serie</th><th>Alter</th><th>Skill</th><th>Potential</th><th>Nation</th><th>Lizenz</th></tr>${rows.map(d=>`<tr data-driver="${marketText(d.code)}" style="cursor:pointer"><td>${marketText(d.name)} <small>${marketText(d.id||d.code)}</small></td><td>${marketText(d.sourceRecord?.development_tier_game||d.role)}</td><td>${marketText(d.ageGame??"–")}</td><td>${Number(d.skillRatingHundredths||0)/100||"–"}</td><td>${Number(d.potentialHundredths||0)/100||"–"}</td><td>${marketText(d.nationality||"–")}</td><td>${d.held||d.sl>=40?"zulässig":"offen"}</td></tr>`).join("")}</table>`;
    body.querySelector("#marketSearch").oninput=e=>{MARKET_QUERY=e.target.value;renderDriverMarket();const q=body.querySelector("#marketSearch");q.focus();q.setSelectionRange(q.value.length,q.value.length);};
    [["marketTier",v=>MARKET_TIER=v],["marketNation",v=>MARKET_NATION=v],["marketLicense",v=>MARKET_LICENSE=v],["marketAvailable",v=>MARKET_AVAILABLE=v],["marketAcademy",v=>MARKET_ACADEMY=v],["marketContract",v=>MARKET_CONTRACT=v],["marketAge",v=>MARKET_AGE=v],["marketSkill",v=>MARKET_SKILL=v],["marketPotential",v=>MARKET_POTENTIAL=v],["marketRep",v=>MARKET_REPUTATION=v]].forEach(([id,set])=>body.querySelector(`#${id}`).onchange=e=>{set(e.target.value);renderDriverMarket();});
    body.querySelectorAll("[data-driver]").forEach(row=>row.onclick=()=>{MARKET_PROFILE=row.dataset.driver;renderDriverMarket();});
  }else{
    const hist=(k&&k.transferHistory||[]).slice().reverse();body.innerHTML=`<p class="hint">Dauerhaft gespeicherte Transferereignisse: ${hist.length}</p>${hist.map(e=>`<div class="fbk ${e.status==="completed"?"ok":"mid"}">${marketText(e.year)} · ${marketText(e.type)} · ${marketText(DB[e.driver]?.name||e.driver)} · ${marketText(e.from?TEAMS[e.from]?.name:"vertragsfrei")} → ${marketText(TEAMS[e.to]?.name||e.to)} · ${marketText(e.reason||"")}</div>`).join("")||'<p class="hint">Noch keine Ereignisse.</p>'}`;
  }
}
function initDriverMarketDashboard(){const btn=document.getElementById("driverMarketButton"),panel=document.getElementById("driverMarketPanel"),close=document.getElementById("driverMarketClose");if(!btn||!panel)return;
  const setOpen=open=>{panel.classList.toggle("open",open);panel.setAttribute("aria-hidden",String(!open));btn.setAttribute("aria-expanded",String(open));if(open)renderDriverMarket();};
  btn.onclick=()=>setOpen(!panel.classList.contains("open"));if(close)close.onclick=()=>setOpen(false);
}
initDriverMarketDashboard();
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
