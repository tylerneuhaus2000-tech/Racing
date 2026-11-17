"use strict";
/* ============ Boxenfunk: Emotion, Abwechslung, Antworten des Teams, echte Zitate (nur wenn es passt) ============ */
const NEG=/Strafe|Witz|rausgedrückt|umgedreht|Tür zu|Ernsthaft|auf (mich|ihn) drauf|Teamkollege|Absicht|gefährlich|Flaggen|Rennleitung|im Weg|Verkehr|keine Chance|Was macht|Platz|abgedrängt|ewig gedauert|Langsamer Stopp/i;
const FRUST=/Verbremst|Fehler|sorry|Sorry|verloren|blockiert|Bremsplatten|Heck weg|gedreht|Ich bin raus|Bremspunkt|Kies|Zu früh aufs Gas|Wheelspin|Rutscher/;
const PRE_FRUST=["Mist!","Verdammt!","Argh!","Nein!","Ach komm!","Oh Mann.","Mist, Mist, Mist!","Was mach ich da?!"];
const POS=/Jaaa|Danke|perfekt|Super|stark|Sieg|gewonnen|vorbei|geschafft|okay|Grün/i;
const PRE_ANGRY=["Ey!","Was zum …","Ernsthaft?!","Leute!","Unfassbar!","Oh nein, nein, nein!","Hallo?!","Das gibt's doch nicht!","Ich fass es nicht!","Was soll das?!"];
const SUF_ANGRY=[" Das ist doch lächerlich!"," Ich bin so sauer."," Schaut euch das an!"," Unglaublich."," Das kostet uns das Rennen!"];
const SUF_BLAME=[" Das war Absicht!"," Ich will, dass das untersucht wird!"," Jedes Mal dasselbe mit dem!"," Wie kann man so fahren?!"," Sagt das der Rennleitung, sofort!"];
const PRE_HAPPY=["Jaaa!","Komm schon!","Let's go!","Wooo!","Ja, Mann!"];
const SUF_HAPPY=[" Weiter so, Jungs!"," Was für ein Auto heute!"," Das hat sich gut angefühlt!"," Genau so!"];
const SUF_CALM=[" Bitte bestätigen."," Ich bleibe dran."," Habt ihr das auf dem Schirm?"," Sagt mir, was ihr seht."];
const TEAM_REPLY_NEG=["Verstanden, wir melden das der Rennleitung.","Copy. Konzentrier dich aufs Fahren, wir kümmern uns.","Wir haben es gesehen. Ruhig bleiben.","Verstanden. Bring das Auto nach Hause, Punkte zählen heute.","Copy, wir schauen auf die Daten.","Bleib ruhig, das Rennen ist noch lang.","Wir haben es der FIA schon geschickt.","Okay, okay. Atmen. Weiter geht's."];
const TEAM_REPLY_POS=["Großartig, weiter so!","Super Arbeit, behalte die Reifen im Blick.","Genau so, P{p} aktuell.","Stark! Lücke nach hinten wächst.","Beste Runde bisher, weiter so."];
/* Echte, kurze Funkzitate – nur in passenden Situationen und nur vom richtigen Fahrer */
const REAL_Q=[
 {d:"VER",ctx:/vorbei|Jaaa|Sieg|gewonnen/i,t:"Simply lovely!"},
 {d:"HAM",ctx:/Jaaa|Sieg|gewonnen|geschafft/i,t:"Get in there!"},
 {d:"HAM",ctx:/Reifen.*(weg|am Ende|nicht mehr)|keine Reifen/i,t:"My tyres are gone!"},
 {d:"ALO",ctx:/Motor|Leistung weg|kein Antrieb|Defekt/i,t:"GP2 engine! GP2!"},
 {d:"ALO",ctx:/vorbei|Jaaa|überholt/i,t:"Karma."},
 {d:"LEC",ctx:/raus|Mauer|Abflug|Unfall|Heck weg|kaputt/i,t:"Nooooo!"},
 {d:"SAI",ctx:/Jaaa|Sieg|gewonnen/i,t:"Smooth operator!"},
 {d:"BOT",ctx:/Jaaa|Sieg|gewonnen|geschafft/i,t:"To whom it may concern …"},
 {d:"NOR",ctx:/Regen|nass|Slicks/i,t:"I'm sorry, boys."},
 {d:"RUS",ctx:/Jaaa|Sieg|gewonnen/i,t:"Get in there, boys!"}
];
const temperOf=c=>clamp((typeof aggOf==="function"?aggOf(c):0.5)+(c.fightT>0?0.2:0)+(c.dmg?0.15:0)+rand(-0.15,0.15),0,1.2);
function spiceRadio(c,t,eng){if(eng||!c||!c.drv)return t;
  const neg=NEG.test(t)&&!POS.test(t),frust=!neg&&FRUST.test(t),pos=POS.test(t)&&!neg&&!frust,tmp=temperOf(c);
  const q=REAL_Q.filter(x=>x.d===c.drv.code&&x.ctx.test(t));
  if(q.length&&Math.random()<0.22){const k=W&&W.career?(W.career.rq=W.career.rq||{}):{};const x=pick(q);if(!k[x.t]||Math.random()<0.15){k[x.t]=(k[x.t]||0)+1;return `„${x.t}“`;}}   // echtes Zitat, selten
  let out=t;
  if(neg){if(tmp>0.55&&Math.random()<0.55)out=pick(PRE_ANGRY)+" "+out;if(tmp>0.45&&Math.random()<0.5)out=out.replace(/[.!?]*$/,"!")+pick(/\b[A-Z]{3}\b/.test(t)?SUF_ANGRY.concat(SUF_BLAME):SUF_ANGRY);
    if(tmp>0.85&&Math.random()<0.35)out=out.toUpperCase();}
  else if(frust){if(Math.random()<0.6)out=pick(PRE_FRUST)+" "+out;}
  else if(pos){if(Math.random()<0.45)out=pick(PRE_HAPPY)+" "+out;if(Math.random()<0.3)out+=pick(SUF_HAPPY);}
  else if(Math.random()<0.15)out+=pick(SUF_CALM);
  if(UI.radios.slice(0,30).some(m=>m.t===out||m.t.endsWith(t))){const pre=neg?pick(PRE_ANGRY):frust?pick(PRE_FRUST):null;if(!pre||UI.radios.slice(0,30).some(m=>m.t===pre+" "+t))return null;out=pre+" "+t;}   // gleicher Spruch kurz hintereinander: umformulieren oder weglassen
  if(S&&Math.random()<(neg?0.45:pos?0.25:0.08)){const rp=neg?pick(TEAM_REPLY_NEG):rTeamPos(c);if(rp){S.radioQ=S.radioQ||[];S.radioQ.push({c,at:S.t+rand(1.5,5),t:rp});}}
  return out;}
function radioQueue(){if(!S||!S.radioQ||!S.radioQ.length)return;const now=S.t;const due=S.radioQ.filter(x=>x.at<=now);S.radioQ=S.radioQ.filter(x=>x.at>now);
  for(const x of due)if(!x.c.removed)radio(x.c,x.t,true,true);}

/* Gefahrenmeldungen aus Bausteinen – passend zum Ort */
function sayHazard(h){const co=h.pos>=0?cnm(cornerNear(h.pos)):null;
  const a=pick(["Da steht ein Auto","Da liegt einer in der Mauer","Wrack auf der Strecke","Ein Auto steht quer","Trümmer überall","Da sind Teile auf der Ideallinie","Ich bin fast in das Wrack gefahren","Marshals laufen da rum"]);
  const l=co?pick([` in ${co}`,` am Ausgang von ${co}`,` kurz vor ${co}`,` direkt nach ${co}`,""]):"";
  const d=pick(["Wo bleiben die Flaggen?","Rennleitung, macht was!","Warum ist da kein Gelb?!","Neutralisieren, sofort!","Das ist lebensgefährlich!","Habt ihr das gesehen?!","Wir brauchen ein Safety Car!","Wie lange wollen die noch warten?!","Das ist komplett verrückt!"]);
  return `${a}${l}! ${d}`;}
function sayCleared(){return pick(["Strecke ist doch frei – worauf warten wir?","Die Reifen werden eiskalt hier.","Können wir endlich wieder fahren?","Da ist nichts mehr, gebt die Strecke frei!","Wir fahren hier seit Ewigkeiten im Kreis.","Bremsen kühlen komplett aus, das wird ein Chaos beim Restart.","Hallo? Die Strecke ist sauber!"]);}

/* ================= Zentrale Funk-Datenbank =================
   Jeder Spruch hat eine Bedingung (ok) auf Basis echter Daten und optional Themen-Merker.
   Alle Funksprüche – auch die Ereignis-Sprüche im übrigen Code – werden beim Senden einem Thema zugeordnet;
   was dem kurz zuvor Gesagten desselben Autos widerspricht, wird verworfen. */
const RTAG=[["tyre_good",/Reifen (fühlen sich gut|sind gut|halten)|Grip ist da|kann noch pushen/i],
  ["tyre_bad",/Reifen.*(am Ende|durch|vorbei|bauen.*ab|weg)|keinen? Grip|Graining|rutsche nur noch|Traktion.*schlechter|Vorne links ist am Ende/i],
  ["car_good",/fühlt sich gut an|Balance ist okay|saubere Runde|Auto ist super/i],
  ["car_bad",/Untersteuern|Übersteuern|Heck (ist|war) (nervös|unruhig)|Vibration|springt über|Front schiebt/i],
  ["plan_stay",/fahren durch|bleiben draußen|reicht bis ins Ziel|Overcut|verlängern den Stint/i],
  ["plan_pit",/Box,? box|Boxenfenster|bis zum Stopp|Box diese Runde|kommen wir rein|Undercut/i],
  ["lap_good",/saubere Runde|Gute Runde|Beste Runde|persönliche Bestzeit|Sektor \d war gut/i],
  ["lap_bad",/Zeit verloren|Verbremser|Zeit liegen lassen|Fehler/i]];
const RCONF={tyre_good:"tyre_bad",tyre_bad:"tyre_good",car_good:"car_bad",car_bad:"car_good",plan_stay:"plan_pit",plan_pit:"plan_stay",lap_good:"lap_bad",lap_bad:"lap_good"};
const rTags=t=>RTAG.filter(x=>x[1].test(t)).map(x=>x[0]);
function rMem(c){S.rMem=S.rMem||{};let m=S.rMem[c.drv.code];if(!m||m.stops!==c.stops){m=S.rMem[c.drv.code]={tags:{},stops:c.stops,chat:-99};}return m;}   /* Boxenstopp = neue Reifen, neue Lage */
function radioConflicts(c,t,force){if(!S||force)return false;const m=rMem(c);return rTags(t).some(g=>{const o=RCONF[g];return o&&m.tags[o]!=null&&S.t-m.tags[o]<120;});}
function radioRemember(c,t){if(!S)return;const m=rMem(c);for(const g of rTags(t))m.tags[g]=S.t;}
/* Fahrgefühl: pro Stint fest, damit Balance-Sprüche zusammenpassen */
function rFeel(c){if(c.feelStint!==c.stops){c.feelStint=c.stops;const r=Math.random();c.feel=r<0.42?"good":r<0.66?"under":r<0.9?"over":"bumpy";}return c.feel;}
const fmt1=x=>x.toFixed(1).replace(".",","),fmt3=x=>x.toFixed(3).replace(".",",");
/* Datenbank: w = Gewicht, eng = Funk vom Team (sonst vom Fahrer), ok = Bedingung, t = Text (oder Liste) */
const RADIO_DB={
 race:[
  {w:1.4,eng:1,ok:x=>x.up&&x.dn,t:x=>`P${x.pos}. ${x.up.drv.code} ${fmt1(x.gu)} Sekunden vor dir, ${x.dn.drv.code} ${fmt1(x.gd)} dahinter.`},
  {w:1.0,ok:x=>x.c.wear<0.3&&!x.c.punct,t:["Die Reifen fühlen sich gut an. Ich kann noch pushen.","Grip ist da, Reifen halten gut."]},
  {w:1.0,ok:x=>x.c.wear>=0.45&&x.c.wear<0.75,t:["Die Hinterreifen bauen langsam ab.","Ich bekomme Graining vorne links.","Traktion aus den langsamen Kurven wird schlechter."]},
  {w:1.2,ok:x=>x.c.wear>=0.75,t:["Vorne links ist am Ende. Ich rutsche nur noch.","Diese Reifen sind durch. Wann kommen wir rein?","Ich habe hinten keinen Grip mehr."]},
  {w:0.8,ok:x=>x.feel==="good"&&!x.c.dmg,t:["Das Auto fühlt sich gut an. Weiter so.","Balance ist okay, keine Beschwerden."]},
  {w:0.8,ok:x=>x.feel==="under",t:x=>[`Untersteuern in ${x.co}. Könnt ihr mir beim Frontflügel helfen?`,"Die Front schiebt in den langsamen Kurven."]},
  {w:0.8,ok:x=>x.feel==="over",t:["Das Heck ist nervös am Kurveneingang.","Übersteuern beim Rausbeschleunigen."]},
  {w:0.6,ok:x=>x.feel==="bumpy",t:x=>[`Das Auto springt über den Kerb in ${x.co}.`]},
  {w:1.0,ok:x=>x.c.dmg||x.c.punct,t:["Ich habe Vibrationen von vorne rechts.","Da stimmt was nicht, das Auto vibriert."]},
  {w:1.0,ok:x=>x.c.blockT>1.2&&x.c.blockBy&&x.c.blockBy.drv,t:x=>[`Ich hänge hinter ${x.c.blockBy.drv.code} fest. In der verwirbelten Luft geht nichts.`,`${x.c.blockBy.drv.code} ist auf den Geraden zu schnell. Ich komme nicht ran.`,`Ich bin viel schneller als ${x.c.blockBy.drv.code}. Können wir etwas über die Strategie machen?`]},
  {w:1.0,eng:1,ok:x=>x.pl&&x.pl.lap-x.lapNo>0&&x.pl.lap-x.lapNo<=3,t:x=>{const n=x.pl.lap-x.lapNo;return [`Boxenfenster öffnet in ${n} Runde${n>1?"n":""}. Plan A.`,`Noch ${n} Runde${n>1?"n":""} bis zum Stopp. Reifen schonen.`];}},
  {w:0.7,eng:1,ok:x=>!x.pl&&x.c.stops>0&&x.c.wear<0.6,t:x=>[`Wir fahren durch bis zum Ende. ${x.lapsLeft} Runden noch.`,`Reifen sind ${x.c.tyreLaps||0} Runden alt. Das reicht bis ins Ziel.`]},
  {w:0.5,eng:1,ok:x=>x.c.stops===0&&x.pl&&x.pl.lap-x.lapNo>3,t:x=>["Wir sind auf Plan A.",`Ziel-Rundenzeit halten. ${x.lapsLeft} Runden noch.`]},
  {w:0.6,eng:1,ok:x=>(x.c.soc||0.85)<0.4,t:x=>[`Energie managen in Sektor ${x.sec}.`,`Lift and Coast vor ${x.co}.`]},
  {w:0.5,eng:1,ok:x=>(x.c.soc||0)>0.85&&S.om&&x.up&&x.gu<1.5,t:["Batterie ist voll. Overtake verfügbar, wenn du in der Sekunde bist."]},
  {w:1.0,eng:1,ok:x=>x.pos===1&&x.dn&&x.gd>3,t:x=>[`Vorsprung ${fmt1(x.gd)} Sekunden. Alles unter Kontrolle.`]},
  {w:0.8,eng:1,ok:x=>x.dn&&x.c.lastLapT&&x.dn.lastLapT&&x.dn.lastLapT-x.c.lastLapT>0.05/TSCALE,t:x=>[`Du warst letzte Runde ${fmt1((x.dn.lastLapT-x.c.lastLapT)*TSCALE*10)} Zehntel schneller als ${x.dn.drv.code}.`]},
  {w:1.0,eng:1,ok:x=>x.pos===1&&x.dn&&x.gd<=3,t:x=>[`${x.dn.drv.code} ist auf ${fmt1(x.gd)} dran. Keine Fehler jetzt.`]},
  {w:1.0,eng:1,ok:x=>x.dn&&x.gd<1.2&&S.om,t:x=>[`${x.dn.drv.code} dahinter in der Sekunde. Er bekommt Overtake.`,`Verteidige gegen ${x.dn.drv.code}, aber verliere keine Zeit.`]},
  {w:0.6,eng:1,ok:x=>x.dn&&x.gd<1.5&&(x.dn.tyreLaps||0)<(x.c.tyreLaps||0)-3,t:x=>[`Auto hinter dir: ${x.dn.drv.code}, frischere Reifen.`]},
  {w:1.0,eng:1,ok:x=>S.wx.eta<150&&S.wx.rain<0.03,t:x=>[`Regen in etwa ${Math.round(S.wx.eta/10)*10} Sekunden erwartet. Sag uns, wie die Strecke ist.`,"Radar zeigt eine Zelle im Anflug. Wir halten die Inters bereit."]},
  {w:1.5,eng:1,ok:x=>x.lapsLeft===0,t:x=>["Letzte Runde. Bring es heim.",`Letzte Runde, P${x.pos}. Keine Risiken.`]},
  {w:1.0,eng:1,ok:x=>x.lapsLeft>=1&&x.lapsLeft<=2,t:x=>[`Noch ${x.lapsLeft+1} Runden. ${x.up?x.up.drv.code+" ist "+fmt1(x.gu)+" vor dir.":"Kopf runter."}`]},
  {w:0.8,eng:1,ok:x=>x.c.strikes>0,t:x=>[`Achte auf die Track Limits in ${x.co}. Du hast ${x.c.strikes} Verwarnung${x.c.strikes>1?"en":""}.`]},
  {w:0.6,ok:()=>true,t:["Wie ist der Abstand nach hinten?","Wer ist das Auto vor mir?","Auf welcher Position bin ich?"],ans:x=>x.up?`P${x.pos}. Vor dir ${x.up.drv.code}, ${fmt1(x.gu)} Sekunden.`:`P${x.pos}. Freie Fahrt vor dir.`},
  {w:0.5,eng:1,ok:x=>x.c.lastLapT&&x.c.bestLapR&&x.c.lastLapT<=x.c.bestLapR+1e-6,t:["Gute Runde. Genau so weiter."]},
  {w:0.4,eng:1,ok:x=>x.lapsLeft>S.laps*0.4,t:["Trinken nicht vergessen.","Kopf runter, das Rennen ist noch lang."]}],
 neutral:[
  {w:1,eng:1,ok:()=>true,t:["Reifen warm halten, Bremsen warm halten.","Delta positiv. Abstand zum Vordermann nicht zu groß werden lassen.","Achte beim Restart auf den Führenden, kein Überholen vor der Linie."]},
  {w:0.6,eng:1,ok:x=>!x.c.wantPit,t:x=>[`Wir bleiben draußen. ${x.lapsLeft} Runden noch nach dem Restart.`]},
  {w:0.7,ok:()=>true,t:["Wie lange bleibt das Safety Car noch draußen?","Die Reifen sind eiskalt. Das wird ein heikler Restart.","Was ist da vorne passiert?"]}],
 timed:[
  {w:1.2,eng:1,ok:x=>x.b&&x.pos===1,t:["P1 im Moment. Die anderen kommen noch."]},
  {w:1.2,eng:1,ok:x=>x.b&&x.pos>1,t:x=>[`P${x.pos}, ${fmt3(x.gap)} auf ${x.ord[0].drv.code}.`]},
  {w:1.2,eng:1,ok:x=>x.q&&S.cut<99&&x.b&&x.pos>S.cut,t:x=>[`P${x.pos}, du bist draußen. Wir brauchen noch eine Runde.`,`Im Moment nicht weiter. Es fehlen ${fmt3((x.b-bestLap(x.ord[S.cut-1]))*TSCALE)}.`]},
  {w:1.0,eng:1,ok:x=>x.q&&S.cut<99&&x.b&&x.pos<=S.cut&&x.pos>S.cut-3,t:[`Das wird eng. Wir gehen noch mal raus.`]},
  {w:0.8,eng:1,ok:x=>x.q&&S.cut<99&&x.b&&x.pos<=S.cut-4&&x.c.mode==="garage",t:["Das sollte reichen. Wir bleiben in der Garage.","Wir sind durch. Reifensatz gespart."]},
  {w:1.0,eng:1,ok:x=>x.justLap&&x.lastT>x.b*1.004,t:x=>[`Zeit verloren in ${x.co}. Da liegt noch was.`]},
  {w:0.8,eng:1,ok:x=>x.c.mode==="push"&&x.sGood!=null,t:x=>[`Sektor ${x.sGood+1} war gut. Die Strecke wird schneller.`]},
  {w:0.5,eng:1,ok:()=>S.t>LAPT*2,t:["Die Strecke entwickelt sich. Die letzte Runde zählt."]},
  {w:0.5,eng:1,ok:()=>S.wx.windKmh>18,t:x=>[`Achte auf den Wind in ${x.co}.`]},
  {w:0.8,eng:1,ok:x=>x.c.mode==="out",t:["Reifentemperatur vorne noch zu niedrig. Eine Aufwärmrunde mehr.","Lass die Autos auf schneller Runde vorbei, nicht auf der Linie bleiben."]},
  {w:1.0,ok:x=>x.justLap&&x.lastT<=x.b+1e-6,t:["Das war eine saubere Runde. Mehr geht nicht."]},
  {w:0.9,ok:x=>x.justLap&&x.lastT>x.b*1.005,t:x=>[`Kleiner Verbremser in ${x.co}.`,"Ich habe am Kerb etwas Zeit liegen lassen."]},
  {w:0.8,ok:x=>x.justLap&&x.feel==="under",t:x=>[`Ich hatte Untersteuern in ${x.co}.`]},
  {w:0.8,ok:x=>x.justLap&&x.feel==="over",t:["Das Heck war im letzten Sektor unruhig."]},
  {w:0.6,ok:x=>x.justLap&&(x.c.wear>0.45||x.c.longRun),t:["Die Reifen waren am Ende der Runde vorbei."]},
  {w:0.8,eng:1,ok:x=>x.c.mode==="push"&&x.c.pushLeft<=1&&!x.c.longRun,t:["Box diese Runde. Wir wechseln auf frische Softs."]},
  {w:0.7,eng:1,ok:x=>x.c.mode==="push"&&x.c.pushLeft>1&&!x.c.longRun,t:["Abkühlrunde, dann noch ein Versuch."]},
  {w:0.8,eng:1,ok:x=>x.c.blockT>0.5&&x.c.blockBy&&x.c.blockBy.drv,t:x=>[`Verkehr voraus: ${x.c.blockBy.drv.code}. Lücke lassen.`]},
  {w:1.0,eng:1,ok:x=>S.clock<LAPT*2.5&&x.c.mode!=="garage",t:["Letzter Versuch. Du schaffst es noch über die Linie.","Die Uhr läuft ab. Diese Runde muss sitzen."]},
  {w:1.0,eng:1,ok:()=>S.wx.eta<120&&S.wx.rain<0.03,t:["Regen ist im Anflug. Jetzt die Zeit setzen."]},
  {w:0.4,eng:1,ok:()=>true,t:["Wie ist die Balance?","Alles in Ordnung mit dem Auto?"]}]};
/* positive Team-Antworten nur, wenn sie stimmen */
function rTeamPos(c){const race=S.type==="race",o=race&&typeof raceOrder==="function"?raceOrder().indexOf(c)+1:0;
  const L_=[["Großartig, weiter so!",1],["Super Arbeit, behalte die Reifen im Blick.",1],[`Genau so, P${o} aktuell.`,race&&o>0],
    ["Stark! Lücke nach hinten wächst.",race&&c.gdTrend>0.15],["Beste Runde bisher, weiter so.",race?c.lastLapT&&c.bestLapR&&c.lastLapT<=c.bestLapR+1e-6:c.qFlash&&S.t-c.qFlash.at<15&&bestLap(c)!=null&&c.qFlash.t<=bestLap(c)+1e-6]];
  const ok=L_.filter(x=>x[1]);return ok.length?pick(ok)[0]:null;}
function rPickFrom(list,x){const cand=list.filter(e=>{try{return e.ok(x);}catch(err){return false;}});let tot=0;for(const e of cand)tot+=e.w;
  let r=Math.random()*tot;for(const e of cand){r-=e.w;if(r<=0)return e;}return cand[0]||null;}
/* Plauderfunk: ein Auto, ein passender Spruch; höchstens ein Plauderspruch pro Auto alle 25 s */
function rChatter(){if(Math.random()>0.2)return;
  const live=S.cars.filter(c=>!c.removed&&!c.crash&&!c.pit&&c.mode!=="garage"&&c.mode!=="grid"&&!c.finished);if(!live.length)return;
  const c=pick(live),m=rMem(c);if(S.t-m.chat<25)return;
  const x={c,co:cnm(pick(CORNERS)),sec:irand(1,3),feel:rFeel(c)};let list;
  if(S.type==="race"&&S.phase==="racing"){
    const ord=raceOrder().filter(o=>!o.removed&&!o.retired&&!o.finished),i=ord.indexOf(c),spd=L/LAPT;
    Object.assign(x,{pos:i+1,up:ord[i-1],dn:ord[i+1],lapNo:Math.floor(c.s/L)+1,pl:c.plan[0],lapsLeft:S.laps-Math.floor(c.s/L)-1});
    x.gu=x.up?(x.up.s-c.s)/spd:0;x.gd=x.dn?(c.s-x.dn.s)/spd:0;c.gdTrend=c.gdPrev!=null?x.gd-c.gdPrev:0;c.gdPrev=x.gd;
    list=S.flag.mode==="sc"||S.flag.mode==="vsc"?RADIO_DB.neutral:S.flag.mode==="green"?RADIO_DB.race:null;}
  else if(S.type!=="race"&&S.started&&!S.chequered){const ord=timedOrder();
    Object.assign(x,{ord,pos:ord.indexOf(c)+1,b:bestLap(c),q:S.type==="q"});x.gap=x.b&&bestLap(ord[0])?(x.b-bestLap(ord[0]))*TSCALE:0;
    x.justLap=!!(c.qFlash&&S.t-c.qFlash.at<20);x.lastT=c.laps.length?c.laps[c.laps.length-1].t:null;
    if(c.secT&&c.secPB&&c.secK)for(let k=c.secK-1;k>=0;k--)if(c.secT[k]!=null&&c.secT[k]<=c.secPB[k]+1e-6){x.sGood=k;break;}
    list=RADIO_DB.timed;}
  if(!list)return;
  for(let tries=0;tries<4;tries++){const e=rPickFrom(list,x);if(!e)return;let t=typeof e.t==="function"?e.t(x):e.t;if(Array.isArray(t))t=pick(t);
    if(radioConflicts(c,t,false))continue;m.chat=S.t;radio(c,t,!!e.eng);if(e.ans)radio(c,e.ans(x),true,true);return;}}
