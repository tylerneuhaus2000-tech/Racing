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
  if(S&&Math.random()<(neg?0.45:pos?0.25:0.08)){S.radioQ=S.radioQ||[];S.radioQ.push({c,at:S.t+rand(1.5,5),t:(neg?pick(TEAM_REPLY_NEG):pick(TEAM_REPLY_POS)).replace("{p}",()=>{const o=typeof raceOrder==="function"&&S.type==="race"?raceOrder().indexOf(c)+1:0;return o||"?";})});}
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
