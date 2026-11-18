import vm from "node:vm";
import { loadGame } from "./race-control-harness.mjs";

const ctx = loadGame();
const elements = new Map();
ctx.document = {
  getElementById(id) {
    if (!elements.has(id)) elements.set(id, { style: {}, appendChild() {}, scrollTop: 0 });
    return elements.get(id);
  },
  createElement() { return { style: {} }; },
};
ctx.requestAnimationFrame = () => 0;
ctx.setTimeout = () => 0;

const result = vm.runInContext(`(()=>{
  const roster=JSON.parse(JSON.stringify(BASE_ROSTER)),
    k={roster,drep:{},points:{},money:{MCL:400,RBR:2000},banNow:[]};
  for(const code of Object.keys(DB))k.drep[code]=70;
  k.drep.NOR=99;
  const iv=[
    {id:0,team:"MCL",drv:"ALB",kind:"wechsel",out:"PIA",from:"WIL",release:true},
    {id:1,team:"RBR",drv:"NOR",kind:"wechsel",out:"VER",from:"MCL",release:true},
    {id:2,team:"RBR",drv:"ALB",kind:"wechsel",out:"NOR",from:"WIL",release:true}
  ];
  marketRun(k,iv,{0:true,1:true,2:true},()=>{});
  const seats=Object.fromEntries(TEAM_KEYS.map(t=>[t,roster[t].filter(Boolean)])),
    all=Object.values(seats).flat();
  return {alb:seatOf(k,"ALB"),nor:seatOf(k,"NOR"),duplicates:all.length-new Set(all).size,seats};
})()`,ctx);

const ok=result.alb==="MCL"&&result.nor==="RBR"&&result.duplicates===0;
console.log(`${ok?"PASS":"FAIL"} transfer chain: ALB remains at first signing (${result.alb}), NOR moves to RBR (${result.nor}), duplicate seats ${result.duplicates}`);
if(!ok)process.exitCode=1;
