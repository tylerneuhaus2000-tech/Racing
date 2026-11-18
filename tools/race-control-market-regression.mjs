import vm from "node:vm";
import { loadGame } from "./race-control-harness.mjs";

const ctx=loadGame();
const result=vm.runInContext(`(()=>{
  const k={type:"season",year:2026,season:1,round:5,cal:CALENDAR,roster:JSON.parse(JSON.stringify(BASE_ROSTER)),pace:Object.assign({},BASE_PACE),points:{VER:0,HAD:24},tpoints:{},drep:{},licLog:[],money:{},contracts:{},retired:[],revert:[],mevents:{},transferHistory:[],marketNews:[]};
  initMgmt(k);for(const c in DB)k.drep[c]=70;for(const c of k.roster.RBR)k.points[c]=0;for(const c of k.roster.RCB)k.points[c]=25;reviewRequests=()=>[];puRequests=()=>null;
  const oldRandom=Math.random;Math.random=()=>0.05;
  try{mgmtBeforeRound(k,()=>{});}finally{Math.random=oldRandom;}
  const swapped=seatOf(k,"HAD")==="RBR"&&seatOf(k,"VER")==="RCB",swapEvent=k.transferHistory.find(e=>e.type==="internal_swap");
  k.banNow=["NOR"];const banned=checkReq(k,{type:"sub",team:"RBR",inn:"NOR",out:"VER"});
  const unknown=Object.keys(DB).find(c=>DB[c].sourceRecord&&!slOk(c));const noLicense=unknown?checkReq(k,{type:"sub",team:"RBR",inn:unknown,out:"VER"}):{ok:false};
  const ex={type:"season",year:2026,season:1,round:0,roster:JSON.parse(JSON.stringify(BASE_ROSTER)),pace:Object.assign({},BASE_PACE),points:{},tpoints:{},drep:{},money:Object.fromEntries(TEAM_KEYS.map(t=>[t,160])),contracts:{},transferHistory:[],marketNews:[]};initMgmt(ex);for(const c in DB)ex.drep[c]=70;
  const oldTeamPref=mkTeamPref,oldDriverPref=mkDrvPref,oldRandom2=Math.random;mkTeamPref=(state,t,c)=>seatOf(state,c)===t?20:90;mkDrvPref=(state,c,t)=>seatOf(state,c)===t?20:90;Math.random=()=>0.01;let exchanged;try{exchanged=autonomousDriverExchange(ex);}finally{mkTeamPref=oldTeamPref;mkDrvPref=oldDriverPref;Math.random=oldRandom2;}
  const exchangedDrivers=ex.transferHistory.filter(e=>e.type==="driver_exchange").length,exSeats=TEAM_KEYS.flatMap(t=>ex.roster[t]),exchangeValid=exchanged&&exchangedDrivers===2&&exSeats.length===new Set(exSeats).size&&TEAM_KEYS.every(t=>(ex.roster[t]||[]).every(c=>!c||slOk(c)));
  const legacy={type:"season",year:2028,season:3,round:4,roster:JSON.parse(JSON.stringify(BASE_ROSTER)),pace:Object.assign({},BASE_PACE),points:{LEC:55},tpoints:{AUD:9},drep:Object.fromEntries(Object.keys(DB).map(c=>[c,65])),history:[{track:"spa"}],dbx:{}};initMgmt(legacy);const retained=legacy.year===2028&&legacy.round===4&&legacy.points.LEC===55&&legacy.tpoints.AUD===9&&legacy.history.length===1;
  legacy.generationProcessedYears=[];generateNextGeneration(legacy);const generated=legacy.generatedDrivers.length;generateNextGeneration(legacy);const generationIdempotent=legacy.generatedDrivers.length===generated;
  const serialized=JSON.parse(JSON.stringify(legacy));
  const elements=new Map(),classes=()=>{const set=new Set();return {toggle(n,on){if(on===undefined)on=!set.has(n);if(on)set.add(n);else set.delete(n);},contains:n=>set.has(n)};};
  const el=id=>{if(!elements.has(id))elements.set(id,{id,style:{},dataset:{},classList:classes(),setAttribute(){},querySelectorAll(){return[]},querySelector(){return null},focus(){},setSelectionRange(){}});return elements.get(id);};
  document={getElementById:el};const careerRef=CAREER,speed=UI.speed;UI.speed=4;initDriverMarketDashboard();el("driverMarketButton").onclick();const opened=el("driverMarketPanel").classList.contains("open")&&UI.speed===4;el("driverMarketClose").onclick();const closed=!el("driverMarketPanel").classList.contains("open")&&UI.speed===4&&CAREER===careerRef;
  return {swapped,temporary:!!(swapEvent&&swapEvent.temporary),swapDetails:{rb:k.roster.RBR,rcb:k.roster.RCB,events:k.transferHistory},bannedRejected:!banned.ok,unlicensedRejected:!noLicense.ok,exchangeValid,exchangeEvents:exchangedDrivers,retained,generationIdempotent,generated,generatedRows:serialized.generatedDrivers,opened,closed};
})()`,ctx);
const restoreCtx=loadGame();restoreCtx.__savedGenerated=result.generatedRows;
result.restored=vm.runInContext(`(restoreDB({generatedDrivers:globalThis.__savedGenerated}),globalThis.__savedGenerated.every(d=>DB[d.driver_id]&&DB[d.driver_id].simulatedData))`,restoreCtx);
const checks=[
  ["Red Bull/Racing Bulls internal swap is automatic and temporary",result.swapped&&result.temporary],
  ["bilateral exchanges preserve legal, unique team lineups",result.exchangeValid],
  ["race-weekend substitute remains blocked by a driver ban",result.bannedRejected],
  ["unlicensed substitute remains blocked",result.unlicensedRejected],
  ["old career progress survives migration",result.retained],
  ["new talent generation is idempotent",result.generationIdempotent],
  ["generated profiles restore from a saved career",result.restored],
  ["dashboard open/close preserves simulation speed and career state",result.opened&&result.closed],
];
for(const [label,ok] of checks)console.log(`${ok?"PASS":"FAIL"} ${label}`);
if(checks.some(([,ok])=>!ok))console.log(`Swap detail: ${JSON.stringify(result.swapDetails)}`);
if(checks.some(([,ok])=>!ok))process.exitCode=1;
