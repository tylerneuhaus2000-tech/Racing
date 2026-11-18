import vm from "node:vm";
import { loadGame } from "./race-control-harness.mjs";

const ctx = loadGame();
const result = vm.runInContext(`(()=>{
  const ids=new Set(DRIVER_POOL_V4.map(d=>d.driver_id));
  const allFields=DRIVER_POOL_V4.every(d=>Object.keys(d).length===73);
  const mapped=Object.keys(DRIVER_CODE_BY_ID).length;
  const uniqueMappings=new Set(Object.values(DRIVER_CODE_BY_ID)).size;
  const f4=Object.keys(DB).find(c=>DB[c].sourceRecord&&DB[c].sourceRecord.development_tier_game==="F4");
  const dev={year:2040,developmentProcessedYears:[],simLicenseLog:{}};developDriverPoolForSeason(dev);const devAfter=JSON.stringify({age:DB[f4].ageGame,skill:DB[f4].skill,elapsed:DB[f4].developmentElapsed,sl:DB[f4].sl});developDriverPoolForSeason(dev);const developmentIdempotent=devAfter===JSON.stringify({age:DB[f4].ageGame,skill:DB[f4].skill,elapsed:DB[f4].developmentElapsed,sl:DB[f4].sl});
  const k={season:1,round:0,points:{LEC:7},tpoints:{AUD:3}};
  const classification=[{finished:true,dsq:false,drv:{code:"LEC",team:"FER"}}];
  recordChampionshipPoints(k,classification,[25],"race");
  k.roster={FER:["LEC"]};k.roster.FER=[];k.roster.MER=["LEC"];
  const afterMove=rebuildConstructorPoints(k),before=k.points.LEC;
  recordChampionshipPoints(k,classification,[25],"race");
  return {rows:DRIVER_POOL_V4.length,uniqueIds:ids.size,allFields,mapped,uniqueMappings,developmentIdempotent,
    migratedDriverPoints:before,fer:afterMove.FER,audi:afterMove.AUD,duplicateReplay:k.points.LEC===32&&k.tpoints.FER===25};
})()`,ctx);
const ok=result.rows===463&&result.uniqueIds===463&&result.allFields&&result.mapped===463&&result.uniqueMappings===463&&result.developmentIdempotent&&
  result.migratedDriverPoints===32&&result.fer===25&&result.audi===3&&result.duplicateReplay;
console.log(`${ok?"PASS":"FAIL"} pool=${result.rows}, IDs=${result.uniqueIds}, mappings=${result.mapped}/${result.uniqueMappings}, development idempotent=${result.developmentIdempotent}, ledger preserves historical FER=${result.fer}/AUD=${result.audi}, replay idempotent=${result.duplicateReplay}`);
if(!ok)process.exitCode=1;
