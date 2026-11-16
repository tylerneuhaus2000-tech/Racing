/* Test Atombombe (Strg+Shift+B): Fall, Explosion, Schäden, Rot, Krater im REC, keine Wertung, Neustart nach Rot.
   Aufruf: node tools/race-control-nuke-test.mjs [--track madrid] [--type race|q] */
import vm from "node:vm";
import { loadGame, countCalls, autopilot } from "./race-control-harness.mjs";

const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
const track = arg("track", "madrid"), type = arg("type", "race");
const ctx = loadGame();
const run = (code) => vm.runInContext(code, ctx);
const cnt = countCalls(ctx, ["breakPart", "spawnDeb", "standingRestart", "score", "repAdd", "addDoc", "review"]);
const G = ctx.__G;
const fails = [];
const ok = (cond, msg) => { console.log((cond ? "  ✔ " : "  ✘ ") + msg); if (!cond) fails.push(msg); };

run(`setTrack(${JSON.stringify(track)});newWeekend({mode:"quick",format:${JSON.stringify(type === "race" ? "race" : "quali")},laps:8,wx:"dry",lapsSel:8},null);`);
const step = (n) => { for (let i = 0; i < n; i++) { run("simStep(DT)"); if (G.S.step % 15 === 0 && !G.S.nuke) autopilot(ctx); } };
/* bis ins Rennen bzw. bis die Quali läuft */
for (let i = 0; i < 9000 && !(type === "race" ? G.S.phase === "racing" && G.S.raceT - G.S.goT > 45 : G.S.started && G.S.t > 150); i++) step(1);
ok(type === "race" ? G.S.phase === "racing" : G.S.started, `Session läuft (${G.S.type}/${G.S.phase})`);

/* Ziel: Auto mitten im Feld (so wie "gewähltes Auto") */
run(`{const live=S.cars.filter(c=>!c.removed&&!c.retired&&c.mode!=="garage"&&!c.inPit);UI.sel=S.cars.indexOf(live[Math.floor(live.length/2)]||S.cars[0]);}`);
const score0 = run("W.score"), dec0 = run("JSON.stringify(W.dec)"), docs0 = run("(W.docs||[]).length");
const ad0 = cnt.addDoc;
/* jeder Score-/Ansehen-/Review-Aufruf, der aus dem Nuke-Pfad (nuke*, hazardStep, setNeutral) kommt, ist ein Fehler */
run(`globalThis.__nkScore=[];for(const n of ["score","repAdd","review"]){const o=globalThis[n];globalThis[n]=function(...a){const st=new Error().stack;if(/nuke/i.test(st))__nkScore.push(n+" "+a[0]);return o.apply(this,a);};}`);
ok(run("nukeTrigger()") === true, "nukeTrigger() startet die Bombe");
ok(run("nukeTrigger()") === false, "zweiter Auslöser wird ignoriert");
ok(run("UI.speed") === 1, "Zeitraffer auf 1×");
const bp0 = cnt.breakPart, deb0 = cnt.spawnDeb;
step(Math.round(run("NUKE_DROP") / run("DT")) - 5);
ok(G.S.nuke.ph === 0 && G.S.flag.mode !== "red", "während des Falls noch keine Explosion");
const fr0 = G.REC[G.REC.length - 1];
ok(Array.isArray(fr0.nk) && fr0.nk.length === 4, "REC-Frame enthält nk=[x,y,tDrop,tBoom] schon in der Fallphase");
step(10);
ok(G.S.nuke.ph >= 1, "Detonation erfolgt");
ok(G.S.flag.mode === "red", "Rote Flagge automatisch gesetzt");
ok(G.S.hazard && G.S.hazard.nuke && G.S.hazard.handled, "Hazard an der Stelle (nuke, handled)");
const hit = run("S.cars.filter(c=>c.crash&&c.crash.nuke).length");
ok(hit > 0, `Autos im Radius getroffen: ${hit}`);
ok(cnt.breakPart - bp0 > 0, `breakPart durch Explosion: ${cnt.breakPart - bp0}`);
ok(cnt.spawnDeb - deb0 > 10, `Trümmer durch Explosion: ${cnt.spawnDeb - deb0}`);
const p0 = run("JSON.stringify(S.cars.filter(c=>c.blast).map(c=>[c.s,c.lat]))");
step(20);
const p1 = run("JSON.stringify(S.cars.filter(c=>c.crash&&c.crash.nuke).map(c=>[c.s,c.lat]))");
ok(p0 !== p1, "getroffene Autos werden weggeschleudert (Position ändert sich)");
const lastDmg = G.REC[G.REC.length - 1];
ok(run(`S.cars.some((c,i)=>c.crash&&c.crash.nuke&&(REC[REC.length-1].e[i*5+3]|REC[REC.length-1].e[i*5+4]<<8)===((c.dp||0)|(c.punct?DP.tyre:0)))`), "Schadensbits im REC (e Bytes 3/4) stimmen mit c.dp überein");
ok(lastDmg.db && lastDmg.db.length > 0, "Trümmer im REC-Frame (db)");
ok(run("REC.some(f=>f.a.some((v,j)=>j%5===4&&(v&(1<<21))))"), "mindestens ein Auto brennt (Fire-Bit)") ;
step(Math.round(run("NUKE_MODAL") / run("DT")));
ok(G.S.nuke.ph === 2, "Modal 'Strecke nicht mehr vorhanden' wurde geöffnet");
ok(run("UI.speed") === 0, "Simulation pausiert hinter dem Modal");
ok(run("__nkScore.length") === 0 && run("W.score") === score0, "kein Score-Eintrag");
ok(run("JSON.stringify(W.dec)") === dec0, "kein Ansehen / keine Entscheidung gezählt");
ok(run("(W.docs||[]).length") === docs0 && cnt.addDoc === ad0, "kein Stewards-Dokument");
step(Math.round(12 / run("DT")));
const inc = G.S.nuke.inc;
ok(inc && inc.status === "info" && inc.clip && inc.clip.some((f) => f.nk), "Replay-Clip (info, ohne Entscheidung) enthält die Explosion");
ok(inc && inc.clip.some((f) => f.t >= G.S.nuke.tBoom) && inc.clip.some((f) => f.t < G.S.nuke.tBoom), "Clip deckt Fall und Detonation ab");

/* Weiterfahren nach Rot */
run("nukeContinue()");
let restarted = false;
for (let i = 0; i < 12000 && !restarted; i++) { step(1); restarted = type === "race" ? cnt.standingRestart > 0 : G.S.flag.mode !== "red"; }
ok(restarted, type === "race" ? "stehender Neustart über standingRestart nach der Bergung" : "Session nach der Bergung fortgesetzt");
step(Math.round(30 / run("DT")));
ok(!G.S.hazard || !G.S.hazard.nuke, "Nuke-Hazard nach Neustart aufgelöst");
ok(G.REC[G.REC.length - 1].nk != null, "Krater bleibt für den Rest der Session im REC");
ok(run("__nkScore.length") === 0, "auch nach dem Neustart kein Score/Ansehen aus dem Ereignis" + (run("W.score") !== score0 ? ` (andere Spielereignisse: ${run("W.score") - score0})` : ""));
/* keine sichtbare Überlappung nach deoverlap */
const ov = run(`(()=>{let n=0;for(let x=0;x<S.cars.length;x++)for(let y=x+1;y<S.cars.length;y++){const A=S.cars[x],B=S.cars[y];if(A.removed||B.removed||A.mode==="garage"||B.mode==="garage"||grp(A)!==grp(B))continue;const m=obbMTV(A,B);if(m&&m.d>0.05)n++;}return n;})()`);
ok(ov === 0, `keine Überlappung nach deoverlap (${ov})`);

if (fails.length) { console.error(`\n${fails.length} Fehler`); process.exit(1); }
console.log("\nOK");
