"use strict";
/* ===== Tutorial: geführte Tour mit Spotlight, Erklärungen und Aufgaben ===== */
const TUT={on:false,i:0,steps:[],tm:0,flag:{},t0:0,inc:null};
function tutCss(){if($("tutCss"))return;const s=document.createElement("style");s.id="tutCss";s.textContent=`
#tutHole{position:fixed;z-index:60;pointer-events:none;border-radius:12px;box-shadow:0 0 0 4000px rgba(2,4,8,.72);outline:2px solid #e10600;outline-offset:3px;transition:all .35s cubic-bezier(.2,.8,.2,1)}
#tutHole.none{left:50%!important;top:50%!important;width:0!important;height:0!important;outline:none}
#tutHole.task{animation:tutPulse 1.4s ease-in-out infinite}
@keyframes tutPulse{0%,100%{outline-color:#e10600;outline-offset:3px}50%{outline-color:#f2c94c;outline-offset:7px}}
#tutCard{position:fixed;z-index:61;width:min(420px,92vw);background:linear-gradient(180deg,#151a22,#0e1218);border:1px solid #2b3240;border-left:4px solid #e10600;border-radius:14px;padding:16px 18px 14px;color:#e8ebf0;box-shadow:0 20px 60px rgba(0,0,0,.6);font-size:13.5px;line-height:1.5;transition:left .35s,top .35s}
#tutCard .ch{font-size:10.5px;letter-spacing:.18em;text-transform:uppercase;color:#ff5a4f;font-weight:700}
#tutCard h3{margin:4px 0 8px;font-size:19px;font-style:italic;font-weight:900;letter-spacing:.01em}
#tutCard p{margin:0 0 8px}#tutCard ul{margin:0 0 8px;padding-left:18px}#tutCard li{margin:2px 0}
#tutCard b{color:#fff}#tutCard kbd{background:#252b35;border:1px solid #3a4250;border-bottom-width:2px;border-radius:5px;padding:0 5px;font-size:11.5px;font-family:inherit}
#tutCard .task{background:#2a2410;border:1px solid #6b5a1c;border-radius:9px;padding:8px 10px;margin:8px 0;color:#f6dd8a}
#tutCard .task.done{background:#10291c;border-color:#1f6b45;color:#86efb5}
#tutCard .tip{background:#121a26;border:1px solid #23324a;border-radius:9px;padding:7px 10px;margin:8px 0;color:#a9c3ea;font-size:12.5px}
#tutCard .bar{height:3px;background:#232a35;border-radius:2px;margin:10px 0 10px;overflow:hidden}#tutCard .bar i{display:block;height:100%;background:#e10600;transition:width .3s}
#tutCard .nav{display:flex;gap:8px;align-items:center}#tutCard .nav span{flex:1;color:#7d8696;font-size:11.5px}
#tutCard button{background:#252c37;border:1px solid #363f4d;color:#e8ebf0;border-radius:8px;padding:7px 12px;font-weight:700;cursor:pointer;font-size:12.5px}
#tutCard button.go{background:#e10600;border-color:#e10600}#tutCard button:disabled{opacity:.35;cursor:default}
#tutCard .x{position:absolute;right:10px;top:8px;background:none;border:none;color:#7d8696;font-size:16px;padding:2px 6px}
`;document.head.appendChild(s);}

/* Elemente finden: Selektor, Liste von Selektoren (Vereinigungsrechteck) oder Funktion */
function tutRect(sel){if(!sel)return null;const list=typeof sel==="function"?[].concat(sel()):[].concat(sel);let r=null;
  for(const q of list){const el=typeof q==="string"?document.querySelector(q):q;if(!el||!el.getBoundingClientRect)continue;const b=el.getBoundingClientRect();if(!b.width&&!b.height)continue;
    r=r?{l:Math.min(r.l,b.left),t:Math.min(r.t,b.top),r:Math.max(r.r,b.right),b:Math.max(r.b,b.bottom)}:{l:b.left,t:b.top,r:b.right,b:b.bottom};}
  return r;}
const tutBox=id=>()=>{const e=$(id);return e?e.closest(".box")||e.closest(".mon")||e:null;};
const btnTxt=(sel,txt)=>()=>[...document.querySelectorAll(sel)].find(b=>b.textContent.includes(txt));

function tutSteps(){const decided=()=>TUT.inc&&TUT.inc.status!=="open";return [
 {ch:"Willkommen",t:"Du bist die Rennleitung",x:`<p>In diesem Spiel bist du <b>Race Director</b> und gleichzeitig der Chef der <b>Stewards</b> eines F1-Wochenendes 2026. Du fährst nicht – du entscheidest.</p>
  <ul><li><b>Sicherheit:</b> Flaggen, VSC, Safety Car, Rote Flagge</li><li><b>Fairness:</b> Vorfälle prüfen und bestrafen – oder eben nicht</li><li><b>Ablauf:</b> Sessions freigeben, Startverfahren, Neustarts</li></ul>
  <p>Das Spiel ist pausiert, solange ich etwas erkläre. Bei <b>Aufgaben</b> machst du selbst etwas – dann läuft die Zeit.</p>
  <div class="tip">Das Tutorial läuft auf einem echten Wochenende in Monza (Training). Du kannst es jederzeit mit ✕ beenden und einfach weiterspielen.</div>`},
 {ch:"Oberfläche · Kopfzeile",el:"#chips",t:"Das Wochenende",x:`<p>Oben siehst du die Sessions des Wochenendes: <b>FP</b> (Training), <b>Q1–Q3</b> (Qualifying) und das <b>Rennen</b>. Die aktive Session ist hervorgehoben.</p><p>Im Qualifying scheiden nach Q1 und Q2 jeweils die langsamsten Fahrer aus – genau wie in echt.</p>`},
 {ch:"Oberfläche · Kopfzeile",el:["#status","#clock"],t:"Streckenstatus & Uhr",x:`<p>Links der <b>Status der Strecke</b>: Grün, Gelb, VSC, Safety Car, Rot – oder wie jetzt „Boxenausfahrt zu“.</p><p>Rechts daneben die <b>Session-Uhr</b> bzw. im Rennen die Rundenanzeige.</p>`},
 {ch:"Oberfläche · Kopfzeile",el:()=>[...document.querySelectorAll("header .stat")],t:"Deine Bewertung",x:`<p><b>Score</b> und <b>Quote</b> zeigen, wie gut deine Urteile waren. <b>Ansehen</b> ist dein Ruf bei Teams und FIA.</p>
  <p>Wichtig: Standardmäßig erfährst du <b>erst nach dem Rennen</b>, ob du richtig lagst – wie ein echter Steward. Im Setup kannst du Live-Feedback einschalten.</p>
  <div class="tip">Ansehen sinkt bei klaren Fehlurteilen, bei unnötig harten Strafen und wenn du gefährliche Situationen ignorierst.</div>`},
 {ch:"Oberfläche · Kopfzeile",el:"#speedSeg",t:"Zeitraffer",x:`<p>Mit <b>⏸ 1× 2× 4× 8× 16×</b> steuerst du die Zeit. Im Training kannst du ruhig vorspulen, im Rennen solltest du bei Action auf 1× gehen.</p><p>Tastatur: <kbd>Leertaste</kbd> = Pause / weiter.</p>`},
 {ch:"Oberfläche · Kopfzeile",el:["#sndBtn","#docBtn","#rulesBtn","#menuBtn"],t:"Werkzeuge",x:`<ul><li><b>🔊</b> Ton an/aus</li><li><b>📄 Dokumente</b> – alle offiziellen Stewards-Entscheidungen des Wochenendes</li><li><b>📖 Regelbuch</b> – Flaggen, Strafen, Startverfahren, Safety Car zum Nachschlagen</li><li><b>☰ Menü</b> – Pause, Speichern, Session wiederholen, zurück zum Hauptmenü</li></ul>`},
 {ch:"Oberfläche",el:"#alert",t:"Hinweiszeile",x:`<p>Hier stehen Empfehlungen und Warnungen der Rennleitung: was gerade ansteht, welche Session-Phase läuft, was du tun solltest. Bei Gefahr leuchtet sie auf.</p>`},
 {ch:"Oberfläche · Monitore",el:tutBox("towerBody"),t:"Zeitnahme",x:`<p>Die Live-<b>Zeitnahme</b>: Position, Fahrer, Abstände, Sektoren und Reifen (S/M/H, Intermediate, Regen).</p>
  <p><b>Klick auf einen Fahrer</b> wählt ihn aus: Die Kamera folgt ihm, und rechts unten kannst du direkt Maßnahmen gegen ihn verhängen.</p><div class="tip">Ein Klick auf die Kopfzeile der Tabelle schaltet die Ansicht um (Abstände, Intervalle, Sektoren).</div>`},
 {ch:"Oberfläche · Monitore",el:"#cvAll",t:"Monitor 1 · Streckenübersicht",x:`<p>Die ganze Strecke von oben: alle Autos, Sektorgrenzen, Boxengasse, Overtake-Zonen, Gefahrenstellen und Wrackteile.</p><p>Gelbe/rote Bereiche zeigen aktive Flaggen in den Sektoren.</p>`},
 {ch:"Oberfläche · Monitore",el:()=>$("cvFeed").closest(".mon"),t:"Monitor 2 · Weltregie",x:`<p>Das TV-Bild. Mit <b>AUTO-REGIE</b> wechselt die Kamera selbst zur spannendsten Szene (Duelle, Unfälle).</p>
  <ul><li><b>COCKPIT</b> – Onboard-Perspektive des gewählten Autos</li><li><b>Mausrad</b> – rein- und rauszoomen</li></ul>`},
 {ch:"Oberfläche · Monitore",el:()=>$("cvCctv").closest(".mon"),t:"Monitor 3 · CCTV",x:`<p>Die festen Streckenkameras der Rennleitung. <b>AUTO</b> springt zur Kurve mit dem meisten Geschehen, mit <b>◀ ▶</b> schaltest du selbst durch die Kurven.</p><p>Ideal, um Track Limits oder eine bestimmte Kurve im Blick zu behalten.</p>`},
 {ch:"Session leiten",el:tutBox("actions"),t:"Session · Startverfahren",x:`<p>Hier steuerst du den Ablauf jeder Session: Boxenausfahrt öffnen, Session beenden, im Rennen Einführungsrunde und <b>Startampel</b>.</p><p>Gerade warten alle Autos in der Garage – ohne dich geht nichts los.</p>`,
  task:{tx:"Klicke auf <b>„Boxenausfahrt öffnen“</b>.",done:()=>S.pitExitOpen},after:()=>setSpeed(2)},
 {ch:"Session leiten",el:tutBox("towerBody"),t:"Ein Auto auswählen",x:`<p>Die ersten Autos rollen aus der Box. Wähle einen Fahrer aus – Kamera und Maßnahmen-Panel beziehen sich dann auf ihn.</p>`,
  task:{tx:"Klicke in der <b>Zeitnahme</b> auf einen beliebigen Fahrer.",done:()=>TUT.flag.tower},enter:()=>{TUT.flag.tower=false;setSpeed(2);}},
 {ch:"Strafen",el:()=>$("selInfo").closest(".box"),t:"Fahrzeug · Direkte Maßnahme",x:`<p>Strafen für das gewählte Auto – sortiert von mild bis hart:</p>
  <ul><li><b>Verwarnung</b> – erster, leichter Verstoß</li><li><b>+5 / +10 Sek.</b> – Zeitstrafe, beim Stopp abzusitzen oder auf die Rennzeit</li><li><b>Durchfahrt / Stop &amp; Go</b> – schwere Verstöße, muss binnen 3 Runden angetreten werden</li><li><b>Schwarz-Orange</b> – Auto mit gefährlichem Schaden muss an die Box</li><li><b>−3 Plätze</b> – Startplatzstrafe fürs nächste Rennen</li><li><b>Runde streichen</b> – Qualifying-Zeit ungültig (z. B. Track Limits)</li><li><b>Schwarze Flagge</b> – Disqualifikation, nur bei groben Fällen</li></ul>
  <div class="tip">Zu jeder Strafe gibt es <b>Strafpunkte</b> auf die Superlizenz. 12 Punkte in 12 Monaten = Rennsperre.</div>`,enter:()=>setSpeed(0)},
 {ch:"Flaggen",el:()=>$("sec0").closest(".box"),t:"Sektor-Flaggen",x:`<p>Die Strecke hat drei Sektoren. Ein Klick schaltet weiter: <b>Grün → Gelb → Doppelgelb</b>. Tasten <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd>.</p>
  <ul><li><b>Gelb</b>: Gefahr neben der Strecke – langsamer, nicht überholen</li><li><b>Doppelgelb</b>: Gefahr auf/an der Strecke – deutlich langsamer, bereit anzuhalten</li></ul><p>Fahrer, die unter Gelb überholen oder nicht verlangsamen, landen als Vorfall bei dir.</p>`,
  task:{tx:"Setze <b>Sektor 1 auf Gelb</b> (einmal auf S1 klicken).",done:()=>S.sec[0]>=1},enter:()=>setSpeed(1)},
 {ch:"Flaggen",el:"#allGreen",t:"Wieder freigeben",x:`<p>Ist die Gefahr beseitigt, gibst du die Strecke wieder frei. Gelb nie länger als nötig – sonst verlieren Fahrer unnötig Zeit und beschweren sich am Funk.</p>`,
  task:{tx:"Klicke auf <b>„Alle Sektoren grün“</b>.",done:()=>S.sec.every(x=>x===0)}},
 {ch:"Flaggen",el:()=>[$("blueInfo").closest(".tog"),$("omBtn").closest(".tog")],t:"Blaue Flaggen & Overtake Mode",x:`<p><b>Blaue Flaggen</b> laufen automatisch: Überrundete müssen Platz machen. Wer mehrere ignoriert, wird dir gemeldet.</p>
  <p><b>Overtake Mode</b> ersetzt 2026 das DRS: Wer an der Messlinie unter 1 s hinter dem Vordermann ist, bekommt zusätzliche elektrische Energie. Du kannst ihn abschalten – z. B. bei Regen, gelben Flaggen oder unsicheren Bedingungen.</p>`},
 {ch:"Neutralisierung",el:()=>document.querySelector(".nb").closest(".box"),t:"VSC · Safety Car · Rote Flagge",x:`<ul><li><b>VSC</b> – alle fahren ein Delta-Tempo, Abstände bleiben. Für kurze Bergungen.</li><li><b>Safety Car</b> – Feld wird hinter dem SC zusammengeführt. Für Wracks oder Trümmer auf der Strecke.</li><li><b>SC in this lap</b> – kündigt das Ende der SC-Phase an.</li><li><b>Rote Flagge</b> – Unterbrechung: Alle fahren mit reduziertem Tempo in die Boxengasse. Reifenwechsel und Reparaturen sind erlaubt und zählen nicht als Pflichtstopp.</li><li><b>Neustart</b> – nach Rot: Runde hinter dem SC, dann stehender Start in der richtigen Reihenfolge.</li></ul>
  <div class="tip">Faustregel: so wenig wie möglich, so viel wie nötig. Ein zu spätes Safety Car gefährdet Marshals – ein unnötiges zerstört das Rennen.</div>`,enter:()=>setSpeed(0)},
 {ch:"Vorfälle",el:tutBox("inbox"),t:"Stewards · Vorfälle",x:`<p>Hier landet alles, was die Rennleitung prüfen muss: Track Limits, Kollisionen, Behinderungen, Speeding in der Boxengasse, Unsafe Release, Frühstarts …</p><p>Ich spule jetzt vor, bis der erste Vorfall auftaucht.</p>`,
  task:{tx:"Warte auf den ersten Vorfall mit <b>„Entscheidung offen“</b>.",done:()=>S.incidents.some(i=>i.status==="open"&&i.clip&&i.clip.length)},enter:()=>setSpeed(8),after:()=>setSpeed(0)},
 {ch:"Vorfälle",el:()=>{const b=[...document.querySelectorAll("#inbox .inc.open button")];return b.length?b[0].closest(".inc"):$("inbox");},t:"Vorfall prüfen",x:`<p>Jeder Vorfall hat einen Titel (Art · Fahrer · Kurve). Mit <b>Prüfen</b> öffnest du das Replay. Ein Klick auf den Titel springt mit der CCTV direkt zur Stelle.</p>`,
  task:{tx:"Klicke beim Vorfall auf <b>„Prüfen“</b>.",done:()=>!!R.inc},after:()=>{TUT.inc=R.inc;}},
 {ch:"Replay",el:"#rpCv",t:"Das Replay",x:`<p>Die Szene aus dem Aufzeichnungspuffer – du kannst sie beliebig oft ansehen. Während du prüfst, ist das Rennen pausiert.</p><p>Tastatur: <kbd>Leertaste</kbd> Play/Pause, <kbd>←</kbd> <kbd>→</kbd> Einzelbild, <kbd>Esc</kbd> schließen.</p>`},
 {ch:"Replay",el:()=>document.querySelector(".rpbar"),t:"Kameras & Zoom",x:`<ul><li><b>Kurven-Cam</b> – feste Kamera an der Kurve, perfekt für Track Limits</li><li><b>Heli</b> – von oben, zeigt Linien und Abstände</li><li><b>Onboard-Chase / Cockpit</b> – aus Sicht des Fahrers</li><li><b>Fokus</b> – welches beteiligte Auto die Kamera verfolgt</li><li><b>Zoom</b> – bis ganz nah an die weiße Linie</li></ul>`},
 {ch:"Replay",el:()=>document.querySelectorAll(".rpbar")[1],t:"Wiedergabe",x:`<p>Abspielen, rückwärts, Zeitlupe bis <b>0,1×</b> und Einzelbilder. Mit dem Regler springst du an jede Stelle.</p><div class="tip">Bei Track Limits: auf Einzelbild gehen und prüfen, ob noch ein Teil eines Reifens die weiße Linie berührt.</div>`},
 {ch:"Replay",el:"#rpTel",t:"Telemetrie",x:`<p>Blendet die Telemetrie des fokussierten Autos ein: Gas/Bremse, Gang, Geschwindigkeit, Lenkeinschlag, Delta, ERS-Energie.</p><p>Damit beweist du Speeding, zu frühes Anfahren, Bremstests oder ob jemand unter Gelb wirklich verlangsamt hat.</p>`},
 {ch:"Replay",el:()=>{const d=$("rpDec");return d?d.parentElement:null;},t:"Reglement & Entscheidung",x:`<p>Rechts steht der passende <b>Regeltext</b> und die Einschätzung des Stewards-Panels (drei Stimmen – entscheiden musst du).</p>
  <p>Unten wählst du das Urteil: <b>keine Strafe</b>, Verwarnung, Zeitstrafe usw. oder <b>Untersuchung nach dem Rennen</b> (Anhörung mit den Fahrern).</p><div class="tip">Gleiche Vergehen gleich bestrafen! Inkonsequente Urteile kosten mehr Ansehen als einzelne Fehler.</div>`,
  task:{tx:"Triff eine <b>Entscheidung</b> für diesen Vorfall.",done:decided}},
 {ch:"Replay",el:"#rpClose",t:"Zurück zur Session",x:`<p>Entschieden! Ob das richtig war, erfährst du nach dem Rennen in der Auswertung. Teams können übrigens per <b>Right of Review</b> eine Neubewertung verlangen, wenn sie neue Beweise haben.</p>`,
  task:{tx:"Schließe das Replay (<kbd>Esc</kbd> oder „Schließen“).",done:()=>!R.inc},skipIf:()=>!R.inc},
 {ch:"Kommunikation",el:tutBox("log"),t:"Race Control Messages",x:`<p>Das offizielle Protokoll: jede Flagge, jede Strafe, jede Notiz. So wie die Meldungen, die im TV eingeblendet werden. Manche Einträge sind anklickbar und springen zur Stelle.</p>`,enter:()=>setSpeed(0)},
 {ch:"Kommunikation",el:tutBox("radio"),t:"Teamfunk",x:`<p>Du hörst den Funk mit: Strategie, Beschwerden („He pushed me off!“), Schadensmeldungen. Oft ist der Funk der <b>erste Hinweis</b> auf einen Vorfall oder auf Trümmer auf der Strecke.</p><p>Teams können hier auch <b>Proteste</b> einlegen – die tauchen dann bei den Vorfällen auf.</p>`},
 {ch:"Wetter",el:"#radar",t:"Regenradar",x:`<p>Das Radar zeigt Regenzellen über der Strecke. Regen fällt <b>nicht überall gleich</b> – ein Sektor kann nass sein, der andere trocken.</p><p>Auf Slicks im Regen wird es gefährlich: Aquaplaning, Dreher, Unfälle. Reagiere früh mit Gelb, VSC oder SC.</p>`,
  task:{tx:"Klicke auf das <b>Regenradar</b>, um es groß zu öffnen.",done:()=>!!$("rdT")&&$("overlay").classList.contains("show")}},
 {ch:"Wetter",el:()=>$("rdT")?$("modal"):null,t:"Prognose & Zoom",x:`<ul><li><b>Zeitstrahl / ▶</b> – schau bis 20 Minuten in die Zukunft</li><li><b>Mausrad</b> – in die Strecke zoomen, <b>Ziehen</b> zum Verschieben</li><li>Punkte auf der Strecke zeigen, <b>wie nass</b> jede Stelle ist – und wo sich Pfützen bilden</li></ul>`,
  task:{tx:"Schließe das Radar wieder (<b>„Schließen“</b> unten oder <kbd>Esc</kbd>).",done:()=>!$("overlay").classList.contains("show")},skipIf:()=>!$("rdT")},
 {ch:"Das Rennen",t:"Start & Rennablauf",x:`<ul><li><b>Einführungsrunde</b>: Autos starten mit ca. 80 % Batterie, Energie darf nicht eingesetzt werden.</li><li><b>Startampel</b>: Du startest sie, wenn alle in ihren Startboxen stehen. Wer sich vor dem Erlöschen bewegt → Frühstart-Vorfall.</li><li>Steht ein Auto in der Startaufstellung still: <b>Start abbrechen</b> und eine Extra-Formationsrunde.</li><li>Unter <b>Gelb, VSC und SC</b> ist Energieeinsatz verboten – Verstöße bekommst du gemeldet.</li><li><b>Pflichtstopp</b>: zwei verschiedene Trockenreifen-Mischungen im trockenen Rennen.</li></ul>`},
 {ch:"Nach dem Rennen",t:"Auswertung",x:`<p>Nach der Zielflagge kommt die Stunde der Wahrheit:</p><ul><li>Jede deiner Entscheidungen wird bewertet – richtig, teilweise, falsch, übersehen</li><li><b>Anhörungen</b> für zurückgestellte Fälle</li><li><b>Technische Abnahme</b>: Bodenplatte, Gewicht, Benzinprobe – Verstoß = Disqualifikation</li><li><b>Rennleiter-Rating</b> und Reaktionen der Medien</li></ul>`},
 {ch:"Saisonmodus",t:"Die ganze Saison",x:`<ul><li><b>Strafpunkte</b> verfallen nach 12 Monaten – bei 12 Punkten wird ein Fahrer gesperrt, du genehmigst den Ersatzfahrer</li><li><b>Teamanfragen</b>: Fahrerwechsel, Red Bull ↔ Racing Bulls, Entlassungen – alles braucht deine Freigabe</li><li><b>Antriebs-Kontingente</b>: Wer zu viele Motorteile verbaut, muss in der Startaufstellung zurück</li><li><b>Berufungen</b> beim FIA-Berufungsgericht gegen deine Urteile</li><li>Am Saisonende: <b>Preisgeld</b>, Upgrades, Fahrermarkt mit echten Junioren</li></ul>`},
 {ch:"Geschafft",t:"Bereit für die Rennleitung",x:`<p>Das war's! Kurz die wichtigsten Tasten:</p><ul><li><kbd>Leertaste</kbd> Pause/weiter · <kbd>1</kbd><kbd>2</kbd><kbd>3</kbd> Sektor-Flaggen</li><li>Im Replay: <kbd>Leertaste</kbd> Play, <kbd>←</kbd><kbd>→</kbd> Einzelbild, <kbd>Esc</kbd> schließen</li></ul>
  <p>Du kannst dieses Training jetzt einfach weiterspielen – oder zurück ins Hauptmenü und eine Saison starten.</p>`,end:true}
];}

function tutStart(){tutCss();if(typeof hideTitle==="function")hideTitle();$("overlay").classList.remove("show","ontitle");
  FB_LIVE=false;OPTS={fb:false,wx:"dry",mode:"short",format:"full",lapsSel:"8",sprints:false};
  CAREER={type:"single",cal:["monza"],round:0,points:{},lic:{},history:[],score:0,dec:{ok:0,total:0},rep:60};
  startRound();TUT.on=true;TUT.steps=tutSteps();TUT.i=0;TUT.flag={};TUT.inc=null;
  if(!TUT.bound){TUT.bound=true;$("towerBody").addEventListener("click",()=>{TUT.flag.tower=true;},true);
    window.addEventListener("resize",()=>TUT.on&&tutPlace());}
  let hole=$("tutHole");if(!hole){hole=document.createElement("div");hole.id="tutHole";document.body.appendChild(hole);}
  let card=$("tutCard");if(!card){card=document.createElement("div");card.id="tutCard";document.body.appendChild(card);}
  hole.style.display=card.style.display="block";
  setTimeout(()=>{setSpeed(0);tutShow();},250);
  clearInterval(TUT.tm);TUT.tm=setInterval(tutTick,200);}

function tutShow(){const st=TUT.steps[TUT.i];if(!st)return tutEnd();
  if(st.skipIf&&st.skipIf()){TUT.i++;return tutShow();}
  if(st.enter)st.enter();st._done=false;
  const n=TUT.steps.length,card=$("tutCard");
  card.innerHTML=`<button class="x" id="tutX" title="Tutorial beenden">✕</button><div class="ch">${st.ch}</div><h3>${st.t}</h3>${st.x}
    ${st.task?`<div class="task" id="tutTask">▶ ${st.task.tx}</div>`:""}
    <div class="bar"><i style="width:${Math.round((TUT.i+1)/n*100)}%"></i></div>
    <div class="nav"><span>Schritt ${TUT.i+1} / ${n}</span>${TUT.i?`<button id="tutBack">Zurück</button>`:""}
    ${st.end?`<button id="tutMenu">Hauptmenü</button><button class="go" id="tutNext">Weiterspielen</button>`:st.task?`<button id="tutSkip">Überspringen</button>`:`<button class="go" id="tutNext">${TUT.i?"Weiter":"Los geht's"}</button>`}</div>`;
  $("tutX").onclick=tutEnd;if($("tutBack"))$("tutBack").onclick=()=>{TUT.i=Math.max(0,TUT.i-1);while(TUT.i>0&&TUT.steps[TUT.i].task&&TUT.steps[TUT.i].task.done())TUT.i--;tutShow();};
  if($("tutNext"))$("tutNext").onclick=()=>st.end?tutEnd():tutNext();
  if($("tutSkip"))$("tutSkip").onclick=()=>{if(st.after)st.after();tutNext();};
  if($("tutMenu"))$("tutMenu").onclick=()=>{tutEnd();if(R.inc)closeReplay();if(typeof titleScreen==="function")titleScreen();};
  $("tutHole").classList.toggle("task",!!st.task);tutPlace();}

function tutNext(){TUT.i++;tutShow();}
function tutTick(){if(!TUT.on)return;const st=TUT.steps[TUT.i];if(!st)return;
  if(st.task&&!st._done&&st.task.done()){st._done=true;const t=$("tutTask");if(t){t.classList.add("done");t.innerHTML="✔ Erledigt!";}
    if(st.after)st.after();setTimeout(()=>{if(TUT.steps[TUT.i]===st)tutNext();},700);}
  tutPlace();}

function tutPlace(){const st=TUT.steps[TUT.i],hole=$("tutHole"),card=$("tutCard");if(!st||!hole)return;
  const r=tutRect(st.el),W=innerWidth,H=innerHeight,cw=card.offsetWidth,ch=card.offsetHeight,pad=6,g=18;
  if(!r){hole.classList.add("none");card.style.left=Math.round((W-cw)/2)+"px";card.style.top=Math.round((H-ch)/2)+"px";return;}
  hole.classList.remove("none");
  hole.style.left=(r.l-pad)+"px";hole.style.top=(r.t-pad)+"px";hole.style.width=(r.r-r.l+2*pad)+"px";hole.style.height=(r.b-r.t+2*pad)+"px";
  const fits=[[r.r+g,(r.t+r.b)/2-ch/2,W-r.r-g>=cw+8],[r.l-g-cw,(r.t+r.b)/2-ch/2,r.l-g>=cw+8],[(r.l+r.r)/2-cw/2,r.b+g,H-r.b-g>=ch+8],[(r.l+r.r)/2-cw/2,r.t-g-ch,r.t-g>=ch+8]];
  const f=fits.find(x=>x[2])||[W-cw-16,H-ch-16];
  card.style.left=Math.round(clamp(f[0],8,W-cw-8))+"px";card.style.top=Math.round(clamp(f[1],8,H-ch-8))+"px";}

function tutEnd(){TUT.on=false;clearInterval(TUT.tm);const h=$("tutHole"),c=$("tutCard");if(h)h.style.display="none";if(c)c.style.display="none";
  try{localStorage.setItem("rc_tut","1");}catch(e){}if(S&&!R.inc&&!$("overlay").classList.contains("show"))setSpeed(1);}

/* Esc schließt auch das große Regenradar */
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&$("rdClose")&&$("overlay").classList.contains("show")&&!R.inc)$("rdClose").click();});
