/* Soak-Test Schadensmodell: zählt pro Rennen breakPart-/spawnDeb-Aufrufe.
   Aufruf: node tools/race-control-damage-soak.mjs [--track madrid] [--races 3] [--laps 12] [--wx rain|dry]
   Exit-Code 1, wenn auf einer Strecke über alle Rennen kein Teil abbricht oder ein Rennen gar keine Trümmer hat. */
import vm from "node:vm";
import { loadGame, countCalls, autopilot } from "./race-control-harness.mjs";

const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
const races = +arg("races", 3), laps = +arg("laps", 12);
const configs = arg("track", null)
  ? [{ track: arg("track"), wx: arg("wx", "dry") }]
  : [{ track: "madrid", wx: "dry" }, { track: "madrid", wx: "wet" }, { track: "monza", wx: "wet" }];

let fail = false;
for (const cfg of configs) {
  const tot = { breakPart: 0, spawnDeb: 0, hitDamage: 0, wallDamage: 0, collide: 0, contactHit: 0, puncture: 0, recDmg: 0 };
  for (let r = 0; r < races; r++) {
    const ctx = loadGame();
    const cnt = countCalls(ctx, ["breakPart", "spawnDeb", "hitDamage", "wallDamage", "collide", "contactHit", "puncture", "blowout"]);
    const run = (code) => vm.runInContext(code, ctx);
    run(`setTrack(${JSON.stringify(cfg.track)});newWeekend({mode:"quick",format:"race",laps:${laps},wx:${JSON.stringify(cfg.wx)},lapsSel:${laps}},null);`);
    const G = ctx.__G;
    let steps = 0, recDmg = 0;
    const maxSteps = Math.round((laps + 4) * run("LAPT") / run("DT")) + 6000;
    while (steps < maxSteps && !G.S.ended) {
      run("simStep(DT)");if (steps % 15 === 0) autopilot(ctx);
      steps++;
      if (steps % 30 === 0) { const f = G.REC[G.REC.length - 1]; for (let i = 0; i < f.e.length; i += 5) if (f.e[i + 3] | f.e[i + 4]) recDmg++; }
      if (G.S.flag.mode === "red" && G.S.redAuto == null) { G.S.redAuto = 1; }
    }
    const row = { ...cnt, recDmg, steps, ovl: G.S.ovl };
    for (const k in tot) tot[k] += row[k] || 0;
    console.log(`${cfg.track.padEnd(10)} ${cfg.wx.padEnd(5)} Rennen ${r + 1}: breakPart=${row.breakPart} spawnDeb=${row.spawnDeb} hitDamage=${row.hitDamage} wallDamage=${row.wallDamage} collide=${row.collide} kontakte=${G.S.contacts||0} puncture=${row.puncture} Schadensframes(REC)=${recDmg} steps=${steps}`);
    if (!row.spawnDeb) fail = true;
  }
  if (!tot.breakPart) fail = true;
  console.log(`  Σ ${cfg.track}/${cfg.wx}: breakPart=${tot.breakPart} spawnDeb=${tot.spawnDeb} (Ø ${(tot.breakPart / races).toFixed(1)} / ${(tot.spawnDeb / races).toFixed(1)} pro Rennen)\n`);
}
if (fail) { console.error("FEHLER: mindestens ein Rennen ohne abgebrochene Teile/Trümmer"); process.exit(1); }
console.log("OK");
