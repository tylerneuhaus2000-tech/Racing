"use strict";
/* ============ Oberfläche & Hauptschleife ============ */
const UI={feedAuto:true,feedCar:0,feedT:0,saveT:0,cctvMan:null,cctvZ:1,feedZ:1,speed:1,sel:0,acc:0,towerT:0,slowT:0,cctvT:0,cctvCo:0,logs:[],radios:[]};
function tvBanner(t,cls){if(!S)return;let s=t.replace(/^STEWARDS: /,"").replace(/^RACE CONTROL: /,"");if(s.length>64)s=s.slice(0,62)+"…";UI.tv={t:s,col:cls==="bad"?"#e10600":cls==="good"?"#2fd16b":"#f2c94c",left:4.5};}
function addLog(t,cls){t=neutralLog(t);if(t==null)return;const tag=S?sessTag():"–";
  if(cls==="flag"||/^STEWARDS|Bestzeit|CHEQUERED|GREEN FLAG/.test(t)){tvBanner(t,cls);if(cls==="flag")sndEvent(/SAFETY CAR|RED FLAG|ROTE|VSC/.test(t)?"alert":"flag");}UI.logs.unshift({t,cls:cls||"",tag});if(UI.logs.length>70)UI.logs.pop();
  $("log").innerHTML=UI.logs.map(m=>`<div class="msg cl ${m.cls}"><small>${m.tag}</small>${esc(m.t)}</div>`).join("");}
function focusCar(c){if(!c)return;UI.sel=c.i;UI.feedAuto=false;$("feedAuto").classList.remove("on");uiTower();}
function carInText(t){if(!S)return null;let best=null,bi=1e9;for(const c of S.cars){const k=t.indexOf(c.drv.code);if(k>=0&&k<bi&&/[^A-Za-zÄÖÜäöü]/.test((t[k-1]||" ")+(t[k+3]||" "))){bi=k;best=c;}}return best;}
$("log").addEventListener("click",e=>{const m=e.target.closest(".msg");if(m&&S)focusCar(carInText(m.textContent));});
$("radio").addEventListener("click",e=>{const m=e.target.closest(".msg");if(m&&S)focusCar(carInText(m.textContent));});
function radio(c,t,eng,force){const now=S?S.t:0;t=spiceRadio(c,t,eng);if(t==null)return;
  if(!force&&UI.radios.slice(0,12).some(m=>m.t.slice(0,15)===t.slice(0,15)))return;   // keine Wiederholungen kurz hintereinanderif(!force&&UI.lastRadio!=null&&now-UI.lastRadio<2.5&&now>=UI.lastRadio)return;UI.lastRadio=now;
  sndEvent("radio");UI.radios.unshift({c:c.drv,t,eng:!!eng});if(UI.radios.length>40)UI.radios.pop();
  $("radio").innerHTML=UI.radios.map(m=>`<div class="msg">${m.eng?'<small>BOX →</small>':''}<b style="color:${m.c.color}">${m.c.code}</b>${m.eng?"":' <small>📻</small>'} ${esc(m.t)}</div>`).join("");}
function setAlert(cls,t){const a=$("alert");a.className="alert "+cls;a.textContent=t;}
function score(p){W.score+=Math.round(p);const hide=!FB_LIVE&&S&&!S.ended;$("score").textContent=hide?"—":W.score;$("rep").textContent=hide?"—":W.career&&W.career.rep!=null?Math.round(W.career.rep):"–";$("acc").textContent=hide?"—":W.dec.total?Math.round(100*W.dec.ok/W.dec.total)+"%":"–";}
function setSpeed(s){UI.speed=s;document.querySelectorAll("#speedSeg button").forEach(b=>b.classList.toggle("on",+b.dataset.s===s));}
const openIncs=()=>S.type==="race"?0:S.incidents.filter(i=>i.status==="open"||i.status==="rec").length;
const hearN=()=>S.incidents.filter(i=>i.status==="open"||i.status==="deferred").length;
function uiSession(){
  $("chips").innerHTML=W.defs.map((d,i)=>`<span class="chip ${i===W.idx?"cur":i<W.idx?"done":""}">${d.name}</span>`).join("");
  const a=$("actions");let h="",info="";const n=openIncs();
  if(S.type!=="race"){
    if(!S.started){info="Autos warten in der Garage. Du gibst die Session frei.";h=`<button class="big go" data-a="open">Boxenausfahrt öffnen</button>`+(S.type==="fp"?`<button class="big" style="background:#3a3f48" data-a="skip">Training überspringen</button>`:"");}
    else if(!S.chequered){info="Session läuft. Bei 0:00 fällt die Zielflagge automatisch – angefangene Runden zählen noch.";h=`<button class="big" style="background:#3a3f48" data-a="cheq">Vorzeitig abwinken</button>`;}
    else if(!S.ended){info="Zielflagge. Autos beenden ihre Runde und fahren in die Box.";}
    else{info=n?`Erst ${n} offene Vorfälle entscheiden.`:"Alle Autos in der Box.";h=`<button class="big go" data-a="close" ${n?"disabled":""}>${S.name} abschließen</button>`;}
  }else{
    const alt=`<button class="big" style="background:#3a3f48" data-a="abort">Start abbrechen</button>`,scb=`<button class="big" style="background:#5a3500;color:#ffb060" data-a="scstart">Start hinter Safety Car</button>`;
    if(S.phase==="pre"){info="Alle Autos in der Startaufstellung.";h=`<button class="big go" data-a="form">Formationsrunde starten</button>`+scb;}
    else if(S.phase==="form")info=S.restartGrid?"Feld fährt zur Startaufstellung…":"Formationsrunde läuft…";
    else if(S.phase==="gridwait"){info=S.stall?`⚠ ${S.stall.drv.code} meldet ein Problem!`:"Feld steht. Du löst die Lichter aus und löschst sie selbst.";h=`<button class="big" data-a="lights">Startsequenz auslösen</button>`+alt+(S.restartGrid?"":scb);}
    else if(S.phase==="lights"){info=S.holdReady?"Alle fünf Lichter an – jetzt starten!":"Lichter gehen an…";h=`<button class="big go" data-a="go" ${S.holdReady?"":"disabled"}>LICHTER AUS – START</button>`+alt;}
    else if(!S.ended)info=S.chequered?"Zielflagge – Feld fährt die Runde zu Ende.":"Rennen läuft.";
    else{const hn=hearN();info=hn?`${hn} Vorfall${hn>1?"e":""} geht in die Anhörung nach dem Rennen.`:(S.sprint?"Sprint beendet.":"Rennen beendet.");h=`<button class="big go" data-a="close">${hn?"Zur Anhörung":(S.sprint?"Sprint abschließen":"Rennen abschließen")}</button>`;}
  }
  $("sessInfo").textContent=info;a.innerHTML=h;
  a.querySelectorAll("[data-a]").forEach(b=>b.onclick=()=>{const k=b.dataset.a;
    if(k==="open")openPitExit();else if(k==="skip"||k==="close")closeSession();else if(k==="cheq"){S.clock=0;chequer();}
    else if(k==="form")startFormation();else if(k==="lights")startLights();else if(k==="go"){if(S.holdReady)lightsOut();}else if(k==="abort")abortStart();else if(k==="scstart")startBehindSC();uiSession();});
  $("towerTitle").textContent=S.type==="race"?"Zeitnahme · Rennen":`Zeitnahme · ${S.name}`;
  uiFlags();}
/* Blinken nur bei „Strecke frei“: welcher Knopf beendet die Neutralisierung? (die Reaktion auf eine neue Gefahr entscheidet der Spieler selbst) */
function nbNeed(race){const h=S.hazard,m=S.flag.mode,n={vsc:0,sc:0,red:0,sec:[0,0,0]};if(!h)return n;
  if(h.handled&&h.cleared){if(m==="red")n.red=1;else if(m==="sc"){if(!S.restart&&!(S.sc&&S.sc.inLap))n.sc=1;}else if(m==="vsc")n.vsc=1;else for(let i=0;i<3;i++)if(S.sec[i])n.sec[i]=1;}
  return n;}
function uiFlags(){
  const m=S.flag.mode,race=S.type==="race"&&S.phase==="racing",need=nbNeed(race);
  for(let i=0;i<3;i++){const b=$("sec"+i),v=S.sec[i];b.className="sb"+(v===1?" y1":v===2?" y2":"")+(need.sec[i]?" need":"");b.innerHTML=`S${i+1}<small>${v===0?"GRÜN":v===1?"GELB":"DOPPELGELB"}</small>`;}
  /* ein Knopf pro Kategorie: Beschriftung und Aktion wechseln mit dem Zustand */
  const st={vsc:m==="vsc"?{act:"vscEnd",t:"VSC BEENDEN",on:1}:{act:"vsc",t:"VSC",en:m==="green"},
    sc:m==="sc"?(S.restart||(S.sc&&S.sc.inLap)?{act:"",t:"SC KOMMT REIN",on:1,sub:"RESTART FOLGT"}:{act:"scIn",t:S.sc&&S.sc.on?"SC IN THIS LAP":"SC ABBESTELLEN",on:1})
      :{act:"sc",t:"SAFETY CAR",en:race&&(m==="green"||m==="vsc")},
    red:m==="red"?{act:"restart",t:race?"NEUSTART FLIEGEND":"NEUSTART",on:1,sub:"ROTE FLAGGE AKTIV"}:{act:"red",t:"ROTE FLAGGE",en:S.started||race}};
  document.querySelectorAll(".nb button").forEach(b=>{const g=b.dataset.g,x=st[g];if(!x)return;const nd=!!need[g]&&!!x.act;
    const sub=nd?"EMPFOHLEN":x.sub||(x.on?"AKTIV":"");const h=`<span>${x.t}</span><small>${sub}</small>`;if(b._h!==h){b._h=h;b.innerHTML=h;}
    b.dataset.act=x.act;b.disabled=!x.act||(!x.en&&!x.on);b.classList.toggle("on",!!x.on);b.classList.toggle("need",nd&&!b.disabled);});
  const o=$("omBtn");o.className=S.om?"on":"";o.textContent=S.om?"AN":"AUS";
  let rh="";const timed=S.type!=="race",racing=!timed&&S.phase==="racing"&&!S.ended;
  if(timed)rh+=`<button data-r="clock"><span>Uhr bei Rot</span><b class="${S.redRun?"warn":""}">${S.redRun?"LÄUFT WEITER":"HÄLT AN"}</b></button>`;
  if(racing)rh+=`<button data-r="pit"><span>Boxeneinfahrt</span><b class="${S.pitClosed?"warn":"ok"}">${S.pitClosed?"GESCHLOSSEN":"OFFEN"}</b></button>`;
  if(racing&&m==="sc"&&S.sc&&S.sc.on&&!S.unlapOn&&lappedCount()>0)rh+=`<button class="act" data-r="unlap">Überrundete zurückrunden lassen (${lappedCount()})</button>`;
  if(racing&&m==="red")rh+=`<button class="act" data-r="stand">Stehender Neustart (Startaufstellung)</button>`;
  if(m==="red"&&!S.ended&&(timed?!S.chequered:S.phase==="racing"))rh+=`<button class="danger" data-r="abort">${timed?"Session nicht fortsetzen – beenden":"Rennen nicht fortsetzen – werten"}</button>`;
  const ro=$("redOpts");if(ro.dataset.h!==rh){ro.dataset.h=rh;ro.innerHTML=rh;
    ro.querySelectorAll("[data-r]").forEach(b=>b.onclick=()=>{const k=b.dataset.r;
      if(k==="clock"){S.redRun=!S.redRun;addLog(S.redRun?"Uhr läuft bei roter Flagge weiter":"Uhr wird bei roter Flagge angehalten","flag");}
      else if(k==="pit"){S.pitClosed=!S.pitClosed;addLog(S.pitClosed?"PIT ENTRY CLOSED":"PIT ENTRY OPEN","flag");}
      else if(k==="unlap")startUnlap();
      else if(k==="stand")standingRestart();
      else{abortSession();if(S.flag.mode==="red"){S.flag.mode="green";S.hazard&&S.hazard.cars.forEach(c=>c.removed=true);S.hazard=null;}}uiFlags();uiSession();});}}
/* Filter: standardmäßig nur, was noch eine Entscheidung braucht */
const INBOX_F={open:{t:"Offen",f:i=>i.status==="open"||i.status==="deferred"},done:{t:"Erledigt",f:i=>i.status!=="open"&&i.status!=="deferred"&&i.status!=="info"},
  info:{t:"Replays",f:i=>i.status==="info"},all:{t:"Alle",f:()=>true}};
const INBOX_EMPTY={open:"Nichts offen – alles entschieden.",done:"Noch nichts entschieden.",info:"Noch keine Replays.",all:"Noch keine Vorfälle."};
function uiInbox(){const vis=S.incidents.filter(i=>i.status!=="rec"&&i.status!=="hidden"),fk=INBOX_F[UI.inboxF]?UI.inboxF:"open";
  const fb=$("inboxF");if(fb){const h=Object.entries(INBOX_F).map(([k,o])=>{const n=vis.filter(o.f).length;return `<button data-f="${k}" class="${k===fk?"on":""}${k==="open"&&n?" hot":""}">${o.t}${k==="all"?"":`<i>${n}</i>`}</button>`;}).join("");
    if(fb._h!==h){fb._h=h;fb.innerHTML=h;fb.querySelectorAll("[data-f]").forEach(b=>b.onclick=()=>{UI.inboxF=b.dataset.f;uiInbox();});}}
  const list=vis.filter(INBOX_F[fk].f).reverse();
  $("inbox").innerHTML=list.length?list.map(i=>`<div class="inc ${i.status==="open"?"open":""}"><div class="t" data-j="${i.id}" title="Zur Stelle springen"><b>${esc(i.title)}</b>
    <small>${i.tag} · ${i.protest?"⚠ Protest von "+esc(i.protest)+" – neu prüfen":i.status==="open"?"Entscheidung offen":i.status==="deferred"?"Anhörung nach dem Rennen":i.status==="info"?"Replay":!FB_LIVE?(i.missed?"nachträglich gemeldet":"entschieden"):i.missed?"✘ übersehen":i.ok?"✔ korrekt":i.pts>0?"≈ teilweise":"✘ falsch"}</small></div>
    <button data-i="${i.id}">${i.status==="open"?"Prüfen":"Replay"}</button></div>`).join(""):`<div class="pad hint">${INBOX_EMPTY[fk]}</div>`;
  $("inbox").querySelectorAll("[data-j]").forEach(b=>b.onclick=()=>{const inc=S.incidents.find(x=>x.id===+b.dataset.j);if(!inc)return;
    if(inc.pos!=null&&inc.pos>=0){const co=cornerNear(inc.pos);ccSet(CORNERS.indexOf(co));}if(inc.cars[0]&&S.cars.includes(inc.cars[0]))focusCar(inc.cars[0]);});
  $("inbox").querySelectorAll("[data-i]").forEach(b=>b.onclick=()=>{const inc=S.incidents.find(x=>x.id===+b.dataset.i);if(inc&&inc.clip&&inc.clip.length)openReplay(inc);});}
function raceOrder(){
  if(S.phase!=="racing")return S.cars.slice();
  const fin=S.cars.filter(c=>c.finished&&!c.dsq).sort((a,b)=>(b.finLaps-a.finLaps)||(a.finOrd-b.finOrd)),run=S.cars.filter(c=>!c.finished&&!c.retired&&!c.dsq).sort((a,b)=>b.s-a.s);
  return fin.concat(run,S.cars.filter(c=>(c.retired||c.dsq)&&!c.finished),S.cars.filter(c=>c.dsq&&c.finished));}
function uiTower(){let h="";if(S.timingOff&&S.t<S.timingOff){$("towerBody").innerHTML=`<div class="pad hint">⚠ ZEITNAHME AUSGEFALLEN – Daten werden wiederhergestellt …</div>`;return;}
  if(S.type!=="race"){const o=timedOrder(),b0=bestLap(o[0]);
    const sb=S.secBest||[];h+=`<div class="row hd"><span class="p">P</span><span></span><span>Name</span><span class="g">${UI.twMode===2?"Letzte ▾":"Zeit ▾"}</span><span class="x">S1 S2 S3 · Reifen</span></div>`;
    o.forEach((c,i)=>{const t=bestLap(c);let x="";
      for(let k=0;k<3;k++){const st=c.secT?c.secT[k]:null;x+=`<i class="sq ${st==null?"":st<=sb[k]+1e-6?"p":st<=c.secPB[k]+1e-6?"g":"y"}"></i>`;}
      x+=`<span class="ty ${c.tyre}" style="margin-left:3px">${c.tyre}</span>`;
      if(c.mode==="push")x+=c.longRun?`<span class="tag" style="background:#2b6cb0">LONG</span>`:`<span class="tag push">PUSH</span>`;else if(c.mode==="out")x+=`<span class="tag">OUT</span>`;else if(c.mode==="in")x+=`<span class="tag">IN</span>`;
      if(c.gridPen)x+=`<span class="tag pen">−${c.gridPen}P</span>`;if(c.retired)x+=`<span class="tag pen">OUT</span>`;
      h+=`<div class="row ${S.cut<99&&i>=S.cut&&t?"elim":""} ${c.i===UI.sel?"sel":""}" data-c="${c.i}"><span class="p">${i+1}</span><span class="bar" style="background:${c.drv.color}"></span>
        <span class="c">${c.drv.code}</span><span class="g">${UI.twMode===2?(c.laps.length?fmtLap(c.laps[c.laps.length-1].t*TSCALE):"—"):t?(i===0?fmtLap(t*TSCALE):"+"+((t-b0)*TSCALE).toFixed(3)):"—"}</span><span class="x">${x}</span></div>`;});
  }else{const o=raceOrder(),ld=o[0];h+=`<div class="row hd"><span class="p">P</span><span></span><span>Name</span><span class="g">${["Abstand ▾","Intervall ▾","Letzte ▾"][UI.twMode||0]}</span><span class="x">Stopps · Reifen/Alter</span></div>`;
    o.forEach((c,i)=>{let g="";const out=c.retired||c.dsq;
      if(c.dsq)g="DSQ";else if(c.retired)g="DNF";else if(S.phase!=="racing")g=TEAMS[c.drv.team].name;
      else if(i===0)g=c.finished?"ZIEL":`Runde ${clamp(Math.floor(c.s/L)+1,1,S.laps)}`;
      else if(c.finished&&ld.finished)g=c.finLaps<ld.finLaps?`+${ld.finLaps-c.finLaps} Rd.`:"+"+(c.finT-ld.finT).toFixed(1);
      else if(UI.twMode===2)g=c.lastLapT?fmtLap(c.lastLapT*TSCALE):"—";
      else{const ref=UI.twMode===1?o[i-1]:ld,d=ref.s-c.s;g=d>=L?`+${Math.floor(d/L)} Rd.`:"+"+(Math.max(0,d)/(L/LAPT)).toFixed(1);}
      let x="";if(c.blueT>0)x+=`<span class="tag blue">BLAU</span>`;if(c.fightT>0)x+=`<span class="tag" style="background:#7a2020">⚔</span>`;if(c.omOn)x+=`<span class="tag om">OM</span>`;if(c.pit)x+=`<span class="tag pit">PIT</span>`;if(c.strikes)x+=`<span class="tag">TL${c.strikes}</span>`;
      if(c.dtPending)x+=`<span class="tag pen">DT</span>`;if(c.sgPending)x+=`<span class="tag pen">S&G</span>`;if(c.dmg)x+=`<span class="tag" style="background:#b8651b">DMG</span>`;if(c.unlap)x+=`<span class="tag">UNLAP</span>`;if(c.penSec)x+=`<span class="tag pen">+${c.penSec}s</span>`;if(c.finished&&!out)x+=`<span class="tag fin">FIN</span>`;
      {const b=Math.round((c.soc==null?0.85:c.soc)*100);x+=`<i class="bat" title="Batterie ${b}%${c.clip?" · Superclipping":""}"><b style="width:${b}%;background:${c.clip?"#e10600":b<20?"#f2c94c":"#2fd16b"}"></b></i>`;}
      x+=`<span class="tag stp" title="Boxenstopps">${c.stops}</span><span class="ty ${c.tyre}">${c.tyre}</span><small style="min-width:11px;text-align:right" title="Reifenalter in Runden">${c.tyreLaps||0}</small>`;
      h+=`<div class="row ${out?"out":""} ${c.i===UI.sel?"sel":""}" data-c="${c.i}"><span class="p">${out?"–":i+1}</span><span class="bar" style="background:${c.drv.color}"></span>
        <span class="c">${c.drv.code}</span><span class="g">${g}</span><span class="x">${x}</span></div>`;});}
  $("towerBody").innerHTML=h;
  const c=S.cars[UI.sel]||S.cars[0];
  if(c){const b=bestLap(c);$("selInfo").innerHTML=`<b style="color:${c.drv.color}">■</b> <b>${c.drv.num} ${esc(c.drv.name)}</b> · ${TEAMS[c.drv.team].name}<br>
    ${TYN[c.tyre]}${S.type==="race"?" ("+(c.tyreLaps||0)+" Rd.)":""} · Stil: ${aggName(aggOf(c))} · Regen-Typ: ${styleName(c.drv.style)} · Stopps ${c.stops} · Strafen ${c.penTot}s${c.dtPending?" + DT":""} · TL ${c.strikes} · Verw. ${c.warn} · Strafpunkte ${(W.career&&W.career.lic&&W.career.lic[c.drv.code])||c.lic||0}${b?" · Beste "+fmtLap(b*TSCALE):""}`;}}
$("towerBody").addEventListener("click",e=>{if(e.target.closest(".row.hd")){UI.twMode=((UI.twMode||0)+1)%3;if(S&&S.type!=="race"&&UI.twMode===1)UI.twMode=2;uiTower();return;}const r=e.target.closest("[data-c]");if(r){UI.sel=+r.dataset.c;UI.feedAuto=false;$("feedAuto").classList.remove("on");uiTower();}});
$("feedPov").onclick=()=>{UI.pov=!UI.pov;$("feedPov").classList.toggle("on",UI.pov);};
$("feedAuto").onclick=()=>{UI.feedAuto=!UI.feedAuto;$("feedAuto").classList.toggle("on",UI.feedAuto);UI.feedT=0;};
function autoDirector(rdt){UI.feedT-=rdt;if(UI.feedT>0&&S.cars[UI.feedCar]&&!S.cars[UI.feedCar].removed)return;UI.feedT=5;
  const live=c=>!c.removed&&c.mode!=="garage";let t=null;
  const h=S.hazard;if(h&&h.cars&&h.cars[0]&&!h.cars[0].removed)t=h.cars[0];
  if(!t){const sp=S.cars.filter(c=>live(c)&&(c.spinT>0||(c.crash&&!c.crash.done)||c.script||c.wide));if(sp.length)t=sp[0];}
  if(!t&&S.type==="race"&&S.phase==="racing"){const f=S.cars.filter(c=>live(c)&&c.fightT>0&&!c.finished).sort((a,b)=>b.s-a.s);if(f.length)t=f[0];
    if(!t){const p=S.cars.filter(c=>c.pit&&c.pit.ph==="svc");if(p.length&&Math.random()<0.5)t=p[0];}
    if(!t){const o=S.cars.filter(c=>live(c)&&c.omOn);if(o.length)t=pick(o);}
    if(!t)t=Math.random()<0.6?S.leader:pick(S.cars.filter(c=>live(c)&&c.mode==="race")||[S.leader]);}
  if(!t&&S.type!=="race"){const p=S.cars.filter(c=>c.mode==="push"&&!c.pit);if(p.length)t=pick(p);else{const o=S.cars.filter(c=>c.mode==="out"||c.mode==="in");if(o.length)t=pick(o);}}
  if(!t)t=S.cars.find(live)||S.cars[0];if(t)UI.feedCar=t.i;}
function fairness(){const r=(W.review||[]).filter(x=>!x.title.startsWith("Flagge"));if(!r.length)return "–";return Math.round(100*r.filter(x=>x.ok).length/r.length)+"%";}
function reviewHtml(){const r=W.review||[];if(!r.length)return "";const bad=r.filter(x=>!x.ok),good=r.filter(x=>x.ok).sort((a,b)=>b.pts-a.pts)[0];
  return `<h4>Deine Entscheidungen an diesem Wochenende</h4><div class="rv">${good?`<div><b class="g">Beste: ${esc(good.title)}</b> (+${good.pts}) · ${good.sess}</div>`:""}
    ${bad.length?bad.sort((a,b)=>a.pts-b.pts).slice(0,10).map(x=>`<div><b class="r">✘ ${esc(x.title)}</b> (${x.pts>0?"+":""}${x.pts}) · ${x.sess}<br><span class="hint">${esc(x.explain)}</span></div>`).join(""):`<div class="hint">Keine Fehlentscheidung – stark.</div>`}</div>`;}
function standingsHtml(k){
  const dr=standingsRows(k);
  const tm={};if(k.tpoints)TEAM_KEYS.forEach(t=>tm[t]=k.tpoints[t]||0);else dr.forEach(x=>{tm[x.d.team]=(tm[x.d.team]||0)+x.p;});const ts=Object.keys(tm).sort((a,b)=>tm[b]-tm[a]);
  return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px"><div><h4>Fahrer-WM</h4><table class="res"><tr><th></th><th>Fahrer</th><th>Pkt.</th><th title="Strafpunkte – ab 12 ein Rennen Sperre">SP</th></tr>${dr.map((x,i)=>`<tr><td>${i+1}</td><td><span style="color:${x.d.color}">■</span> ${esc(x.d.name)}</td><td><b>${x.p}</b></td><td>${(k.lic&&k.lic[x.d.code])||""}</td></tr>`).join("")}</table></div>
    <div><h4>Konstrukteurs-WM</h4><table class="res">${ts.map((t,i)=>`<tr><td>${i+1}</td><td><span style="color:${TEAMS[t].color}">■</span> ${TEAMS[t].name}</td><td><b>${tm[t]}</b></td></tr>`).join("")}</table>
    <h4>Bisherige Rennen</h4><div class="hint">${(Array.isArray(k.history)?k.history:[]).map((r,i)=>`${i+1}. ${esc(TRACKS[r.track]?TRACKS[r.track].name:r.track)}: ${esc((r.top||[]).join(" · "))}`).join("<br>")||"Noch keine Rennresultate."}</div></div></div>`;}
function uiResults(){const cl=W.results,win=cl[0],acc=W.dec.total?Math.round(100*W.dec.ok/W.dec.total):0,wt=win.finT+win.penSec,k=W.career,season=k&&k.type==="season";
  let title="Zurück auf die Kartbahn 🛞";if(acc>=90&&W.score>0)title="FIA-Rennleiter-Niveau 🏆";else if(acc>=75)title="Solider Steward 👍";else if(acc>=55)title="Praktikant in der Race Control 📋";
  const rows=cl.map((c,i)=>{let g=c.dsq?"DSQ":"DNF";if(c.finished&&!c.dsq)g=i===0?"Sieger":c.finLaps<win.finLaps?`+${win.finLaps-c.finLaps} Rd.`:"+"+(c.finT+c.penSec-wt).toFixed(1)+"s";
    return `<tr><td>${c.finished&&!c.dsq?i+1:"–"}</td><td><span style="color:${c.drv.color}">■</span> ${esc(c.drv.name)}</td><td>${TEAMS[c.drv.team].name}</td><td>${g}</td><td>${c.stops}</td><td>${c.penTot?"+"+c.penTot+"s":""}</td><td>${c.finished&&!c.dsq&&i<10?PTS_TAB[i]*(W.ptsFac==null?1:W.ptsFac):""}</td></tr>`;}).join("");
  if(k&&k.lateRev&&k.lateRev.length){W.review=(W.review||[]).concat(k.lateRev);k.lateRev=[];}
  const rt=rdRating();if(k&&k.roster&&k.rdRound!==k.round){k.rdRound=k.round;k.rd=k.rd||[];k.rd.push(rt.total);k.rep=clamp((k.rep==null?60:k.rep)+(rt.total-70)/12,0,100);}
  const fired=season&&k.rep!=null&&k.rep<25;
  const more=season&&k.round<k.cal.length,champ=season&&!more?standingsRows(k)[0].d:null;
  const m=$("modal");m.className="modal wide";
  m.innerHTML=`<h2>${esc(TRACK.name)} – Rennen beendet${season?` · Lauf ${k.round}/${k.cal.length}`:""}</h2><div style="font-size:20px;font-weight:800">${champ?`🏆 Weltmeister: ${esc(champ.name)}`:title}</div>
    <div class="kpis"><div class="kpi"><b>${W.score}</b><span>Score${season?" (Saison)":""}</span></div><div class="kpi"><b>${acc}%</b><span>Trefferquote</span></div><div class="kpi"><b>${W.dec.ok}/${W.dec.total}</b><span>Richtige Calls</span></div><div class="kpi"><b>${k&&k.rep!=null?Math.round(k.rep):"–"}</b><span>Ansehen</span></div><div class="kpi"><b>${fairness()}</b><span>Fairness</span></div></div>
    <div style="display:grid;grid-template-columns:${season?"1fr 1.2fr":"1fr"};gap:16px"><div><h4>Ergebnis</h4><table class="res"><tr><th>P</th><th>Fahrer</th><th>Team</th><th>Abstand</th><th>Stopps</th><th>Strafen</th><th>Pkt.</th></tr>${rows}</table></div>
    ${season?`<div>${standingsHtml(k)}</div>`:""}</div>
    ${mediaHtml(k,rt)}${reviewHtml()}
    ${fired?`<div class="fbk bad">Die FIA hat dich als Rennleiter abgelöst – dein Ansehen ist auf ${Math.round(k.rep)} gefallen. Die Saison endet hier.</div>`:""}
    ${champ&&!fired?`<button class="big go" id="seasonBtn">Saisonende: Preisgeld, Upgrades & Fahrermarkt →</button>`:""}
    ${more&&!fired?`<button class="big go" id="nextBtn">Nächstes Rennen: ${esc(TRACKS[k.cal[k.round]].name)}</button>`:""}<button class="big" style="background:#3a3f48" id="againBtn">Hauptmenü</button>`;
  $("overlay").classList.add("show");$("againBtn").onclick=()=>{S=null;menuMain();};
  if(champ&&!fired)$("seasonBtn").onclick=()=>offseason(k,()=>{$("overlay").classList.remove("show");startRound();});
  if(more&&!fired){saveRoundPending();$("nextBtn").onclick=()=>{$("overlay").classList.remove("show");startRound();};}}

function uiHearing(){const list=S.incidents.filter(i=>i.status==="deferred"),done=S.incidents.filter(i=>i.status==="done"&&i.heard);
  if(!list.length){$("overlay").classList.remove("show");finishRace();return;}
  const m=$("modal");m.className="modal";
  m.innerHTML=`<h2>⚖️ Anhörungen nach dem Rennen</h2><p class="hint">Die Fahrer wurden zu den Stewards zitiert. Du bekommst ihre Aussagen und die Telemetrie – Strafen werden als Zeit auf das Ergebnis aufgerechnet.</p>
    ${list.map(i=>`<div class="slot"><div><b>${esc(i.title)}</b><br><small>${i.tag}</small></div><button class="ghost" data-h="${i.id}">Anhören</button></div>`).join("")}
    ${done.length?`<p class="hint">Bereits entschieden: ${done.length}</p>`:""}`;
  $("overlay").classList.add("show");
  m.querySelectorAll("[data-h]").forEach(b=>b.onclick=()=>{const inc=S.incidents.find(x=>x.id===+b.dataset.h);inc.heard=true;openReplay(inc,true);});}
function uiSprintResults(){const cl=W.results,win=cl[0],wt=win.finT+win.penSec;
  const rows=cl.map((c,i)=>{let g=c.dsq?"DSQ":"DNF";if(c.finished&&!c.dsq)g=i===0?"Sieger":c.finLaps<win.finLaps?`+${win.finLaps-c.finLaps} Rd.`:"+"+(c.finT+c.penSec-wt).toFixed(1)+"s";
    return `<tr><td>${c.finished&&!c.dsq?i+1:"–"}</td><td><span style="color:${c.drv.color}">■</span> ${esc(c.drv.name)}</td><td>${TEAMS[c.drv.team].name}</td><td>${g}</td><td>${c.penTot?"+"+c.penTot+"s":""}</td><td>${c.finished&&!c.dsq&&i<8?SPR_TAB[i]:""}</td></tr>`;}).join("");
  const m=$("modal");m.className="modal";
  m.innerHTML=`<h2>${esc(TRACK.name)} – Sprint beendet</h2><table class="res"><tr><th>P</th><th>Fahrer</th><th>Team</th><th>Abstand</th><th>Strafen</th><th>Pkt.</th></tr>${rows}</table>
    <button class="big go" id="spNext">Weiter zum Qualifying</button>`;
  $("overlay").classList.add("show");$("spNext").onclick=()=>{$("overlay").classList.remove("show");nextSession();};}

/* ---- Spielstände ---- */
const SAVEKEY="rc_saves_v1";
function loadSaves(){try{return JSON.parse(localStorage.getItem(SAVEKEY))||{};}catch(e){return {};}}
function writeSave(slot,data,name){try{const s=loadSaves(),entry={name,date:new Date().toLocaleString("de-DE"),updatedAtMs:Date.now(),data};s[slot]=entry;localStorage.setItem(SAVEKEY,JSON.stringify(s));if(window.RCCloud)window.RCCloud.save(slot,entry);return true;}catch(e){return false;}}
function delSave(slot){try{const s=loadSaves();delete s[slot];localStorage.setItem(SAVEKEY,JSON.stringify(s));if(window.RCCloud)window.RCCloud.remove(slot);}catch(e){}}
function saveName(){const k=W.career;return (k&&k.type==="season"?`Saison · Lauf ${k.round+1}/${k.cal.length}`:"Einzelrennen")+` · ${TRACK.name} · ${W.defs[W.idx]?W.defs[W.idx].name:""}`;}
function snapshotSave(){const codes=a=>a.map(d=>d.code);
  W.snap=JSON.parse(JSON.stringify({v:1,opts:W.opts,track:TRACK.key,idx:W.idx,grid:codes(W.grid),sgrid:codes(W.sgrid||[]),q:codes(W.q),gridTail:codes(W.gridTail),drop:W.drop,score:W.score,dec:W.dec,career:W.career,review:W.review||[],qOut:W.qOut||[],docs:W.docs||[]}));
  if(!W.wk)W.wk=JSON.parse(JSON.stringify(W.snap));W.snap.wk=W.wk;
  W.snapName=saveName();writeSave("auto",W.snap,W.snapName);}
function liveSave(){if(!W||!W.snap)return;const lv=liveState();if(!lv)return;W.liveSnap=JSON.parse(JSON.stringify(Object.assign({},W.snap,{live:lv,score:W.score,dec:W.dec,career:W.career,review:W.review||[]})));
  W.liveName=saveName()+(S.type==="race"?` · Runde ${clamp(Math.floor((S.leader?S.leader.s:0)/L)+1,1,S.laps)}`:` · ${fmtClock(S.clock*W.cs)} Rest`);writeSave("auto",W.liveSnap,W.liveName);}
function saveRoundPending(){const k=W.career;const data=JSON.parse(JSON.stringify({v:1,opts:W.opts,pending:true,career:k}));
  writeSave("auto",data,`Saison · vor Lauf ${k.round+1}/${k.cal.length} · ${TRACKS[k.cal[k.round]].name}`);}
function loadGame(data){const byCode=a=>a.map(c=>DRIVERS.find(d=>d.code===c)).filter(Boolean);
  UI.logs=[];UI.radios=[];$("radio").innerHTML="";$("log").innerHTML="";$("overlay").classList.remove("show");
  if(data.pending){CAREER=data.career;OPTS=data.opts;FB_LIVE=!!(OPTS&&OPTS.fb);startRound();return;}
  CAREER=data.career;OPTS=data.opts;FB_LIVE=!!(OPTS&&OPTS.fb);restoreDB(CAREER);applyRoster(CAREER);setTrack(data.track);mkWeekend(data.opts,data.career);
  W.score=data.score;W.dec=data.dec;W.grid=byCode(data.grid);W.sgrid=byCode(data.sgrid||[]);W.q=byCode(data.q);W.gridTail=byCode(data.gridTail);W.drop=data.drop||{};W.review=data.review||[];W.qOut=data.qOut||[];W.docs=data.docs||[];W.wk=data.wk||null;W.idx=data.idx-1;
  nextSession();if(data.live){W.score=data.score;W.dec=data.dec;applyLive(data.live);}score(0);setSpeed(1);}
let CAREER=null,OPTS=null;const SPRINTS=["shanghai","miami","montreal","silverstone","zandvoort","singapore"];
function setTrack(key){buildTrack(key);refreshCOI();P=buildPaths();UI.cctvMan=null;UI.cctvCo=0;UI.sel=0;}
function startRound(){const k=CAREER,key=k.cal[Math.min(k.round,k.cal.length-1)];setTrack(key);
  UI.logs=[];UI.radios=[];$("radio").innerHTML="";$("log").innerHTML="";
  restoreDB(k);
  mgmtBeforeRound(k,()=>{$("overlay").classList.remove("show");
    const o=Object.assign({},OPTS,{laps:OPTS.lapsSel==="full"?TRACK.laps:+OPTS.lapsSel,banned:[]});
    const configured=Array.isArray(k.formats)?k.formats[k.round]:null;
    if(Object.prototype.hasOwnProperty.call(SEASON_WEEKEND_FORMATS,configured))o.format=configured;
    else if(k.type==="season"&&(Array.isArray(k.sprints)?!!k.sprints[k.round]:!!OPTS.sprints&&SPRINTS.includes(key)))o.format="sprint";
    newWeekend(o,k);score(0);setSpeed(1);});}

const RULES=`<h4>Ablauf</h4><ul><li>Du gibst jede Session selbst frei (Boxenausfahrt öffnen). Bei 0:00 fällt die Zielflagge – wer vorher über Start/Ziel war, darf die Runde beenden, danach fahren alle in die Box.</li>
  <li>Rennen: Formationsrunde → Startsequenz → Rennen. Zeitnahme anklicken wählt ein Auto (Weltregie folgt ihm, direkte Maßnahmen gelten für dieses Auto).</li></ul>
  <h4>Selbst entdecken</h4><ul><li>Nicht jeder Verstoß wird gemeldet. Achte auf Funksprüche wie „Habt ihr das gesehen?“, wähle das Auto aus und drücke <b>UNTERSUCHEN</b>: gefunden +30, grundlos −5, übersehen −40.</li><li>📄 oben zeigt alle Entscheidungen als Stewards-Dokumente.</li></ul><h4>Zeitnahme</h4><ul><li>Klick auf die Kopfzeile der Zeitnahme schaltet um: Abstand zum Führenden, Intervall zum Vordermann, letzte Runde. Die Zahl hinter dem Reifen ist sein Alter in Runden.</li><li>Im Training fahren die Teams neben schnellen Runden auch Long Runs: mehrere Runden am Stück auf Medium oder Hard mit vollen Tanks, deutlich langsamer.</li><li>Training und Quali: Sektoren lila = Sessionbestzeit, grün = persönliche Bestzeit, gelb = langsamer.</li></ul><h4>Proteste</h4><ul><li>Einspruch legt nur das benachteiligte Team ein: wer zu Unrecht bestraft wurde, oder der Gegner, wenn der Schuldige ohne Strafe davonkommt.</li></ul><h4>Flaggen (jederzeit frei setzbar)</h4><ul><li>Bergungen dauern, Reparaturen an der Barriere noch länger: Bei Rot kann es 1–2 Minuten dauern, bis du wieder freigeben kannst. Wer in einem Quali-Teil liegen bleibt und es nicht zurück an die Box schafft, fährt im nächsten Teil nicht mit.</li><li><b>Gelb/Doppelgelb im Sektor</b> – Auto steht sicher in der Auslaufzone.</li><li><b>VSC</b> – Marshals müssen kurz auf die Strecke / Trümmer.</li>
  <li><b>Safety Car</b> – Bergungsfahrzeug nötig oder Starkregen.</li><li><b>Rot</b> – Strecke blockiert, Barriere kaputt, oder gestrandetes Auto in Training/Quali.</li>
  <li>Nach „Track Clear“: Sektor grün, VSC beenden, „SC in this lap“ oder Neustart.</li></ul>
  <h4>Vorfälle</h4><ul><li>Jeder Vorfall landet rechts bei den Stewards. „Prüfen“ öffnet das Replay: Zeitlupe, rückwärts, Einzelbild, Zoom, vier Kameras.</li>
  <li>${RULES_K.tl}</li><li>${RULES_K.inc}</li><li>${RULES_K.impede}</li><li>${RULES_K.unsafe}</li><li>${RULES_K.jump} ${RULES_K.yellow}</li>
  <li>${RULES_K.delta} ${RULES_K.gridpos} ${RULES_K.serve}</li></ul>
  <h4>Start &amp; Safety Car</h4><ul><li>Du löst die Lichter aus und löschst sie selbst. Bleibt ein Auto stehen: Start abbrechen (Extra-Formationsrunde, das Auto startet aus der Box). Bei Nässe: Start hinter dem Safety Car.</li>
  <li>Unter Safety Car kannst du Überrundete zurückrunden lassen und die Boxeneinfahrt schließen. Nach Rot wählst du fliegenden oder stehenden Neustart – oder wertest das Rennen (unter 75 % Distanz halbe Punkte).</li>
  <li>Vorfälle im Rennen kannst du auf „Nach dem Rennen untersuchen“ legen: In der Anhörung bekommst du Fahreraussagen und Telemetrie, die Strafe wird als Zeit aufgerechnet. Sprint: ein Drittel der Distanz, kein Pflichtstopp, Punkte 8 bis 1.</li>
  <li>Fehlurteile kosten Ansehen. Teams können Protest einlegen – dann prüfst du den Fall mit Telemetrie erneut und kannst die Entscheidung korrigieren. Fällt dein Ansehen in der Saison unter 25, wirst du abgelöst.</li>
  <li>Fährt ein Auto mit Schaden weiter: schwarz-orange Flagge. Strafpunkte: 5 s = 1, 10 s = 2, Durchfahrt/Stop-and-Go = 3; ab 12 ist der Fahrer in der Saison ein Rennen gesperrt.</li></ul>
  <h4>Overtake Mode &amp; Wetter</h4><ul><li>Overtake Mode im Trockenen ab Runde 2 anlassen, bei nasser Strecke abschalten.</li><li>Das Regenradar zeigt Zellen und Windrichtung. Die Teams wechseln selbst auf Intermediates/Regenreifen.</li></ul>
  <h4>Punkte</h4><ul><li>Richtiger Call +100 (Flaggen mit Tempo-Bonus), falsch −50, Gefahr ignoriert −150, zu früh freigegeben −100.</li></ul>`;
function trackOptions(){let h=CALENDAR.map((k,i)=>`<option value="${k}">${i+1}. ${TRACKS[k].name}</option>`).join("");
  h+=Object.keys(TRACKS).filter(k=>!CALENDAR.includes(k)).map(k=>`<option value="${k}">${TRACKS[k].name}</option>`).join("");return h;}
function seasonTrackOptions(selected){const keys=CALENDAR.concat(Object.keys(TRACKS).filter(k=>!CALENDAR.includes(k)));return keys.map(k=>`<option value="${k}"${k===selected?" selected":""}>${esc(TRACKS[k].name)}</option>`).join("");}
const SEASON_WEEKEND_FORMATS={full:"Standard",sprint:"Sprint",quali:"Quali + Rennen",race:"Nur Rennen"};
const SEASON_TEMPLATE_KEY="rc_season_templates_v1";
function seasonFormatName(format){return Object.prototype.hasOwnProperty.call(SEASON_WEEKEND_FORMATS,format)?SEASON_WEEKEND_FORMATS[format]:SEASON_WEEKEND_FORMATS.full;}
function seasonWeekendFormat(career,index,opts){
  const configured=career&&Array.isArray(career.formats)?career.formats[index]:null;
  if(Object.prototype.hasOwnProperty.call(SEASON_WEEKEND_FORMATS,configured))return configured;
  if(career&&Array.isArray(career.sprints))return career.sprints[index]?"sprint":Object.prototype.hasOwnProperty.call(SEASON_WEEKEND_FORMATS,opts&&opts.format)?opts.format:"full";
  return opts&&opts.sprints&&SPRINTS.includes(career&&career.cal&&career.cal[index])?"sprint":Object.prototype.hasOwnProperty.call(SEASON_WEEKEND_FORMATS,opts&&opts.format)?opts.format:"full";
}
function readSeasonTemplateState(){try{const raw=JSON.parse(localStorage.getItem(SEASON_TEMPLATE_KEY)||"null");if(Array.isArray(raw))return {items:raw,deleted:[]};return raw&&Array.isArray(raw.items)?{items:raw.items,deleted:Array.isArray(raw.deleted)?raw.deleted:[]}:{items:[],deleted:[]};}catch(e){return {items:[],deleted:[]};}}
function visibleSeasonTemplates(state){const deleted=new Map((state.deleted||[]).map(x=>[x.id,Number(x.updatedAtMs)||0]));return (state.items||[]).filter(x=>x&&x.id&&(!deleted.has(x.id)||(Number(x.updatedAtMs)||0)>deleted.get(x.id)));}
function writeSeasonTemplateState(state){try{localStorage.setItem(SEASON_TEMPLATE_KEY,JSON.stringify(state));return true;}catch(e){return false;}}
function makeSeasonTemplateId(){return self.crypto&&crypto.randomUUID?crypto.randomUUID():"sc_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,9);}
async function listSeasonTemplates(){if(window.RCCloud&&typeof RCCloud.listSeasonTemplates==="function")return RCCloud.listSeasonTemplates();return visibleSeasonTemplates(readSeasonTemplateState());}
async function saveSeasonTemplate(template){
  if(window.RCCloud&&typeof RCCloud.saveSeasonTemplate==="function")return RCCloud.saveSeasonTemplate(template);
  const state=readSeasonTemplateState(),items=visibleSeasonTemplates(state),existing=items.find(x=>x.name.toLowerCase()===template.name.toLowerCase());
  if(!existing&&items.length>=12)throw new Error("Du kannst höchstens 12 Saisonvorlagen speichern.");
  const item={id:template.id||(existing&&existing.id)||makeSeasonTemplateId(),name:template.name,cal:template.cal.slice(),formats:template.formats.slice(),updatedAtMs:Date.now()};
  state.items=items.filter(x=>x.id!==item.id).concat(item);state.deleted=state.deleted.filter(x=>x.id!==item.id);writeSeasonTemplateState(state);return {item,cloud:false};
}
async function deleteSeasonTemplate(id){
  if(window.RCCloud&&typeof RCCloud.deleteSeasonTemplate==="function")return RCCloud.deleteSeasonTemplate(id);
  const state=readSeasonTemplateState(),updatedAtMs=Date.now();state.items=state.items.filter(x=>x.id!==id);state.deleted=state.deleted.filter(x=>x.id!==id).concat({id,updatedAtMs});writeSeasonTemplateState(state);return {cloud:false};
}
const heroTop=(sub)=>`<div class="hero-top"><div class="tagl">F1 2026<br>22 FAHRER · 11 TEAMS<br>${Object.keys(TRACKS).length} SPIELSTRECKEN</div><div class="wm">Race <b>Control</b></div><div class="sub">${sub}</div></div>`;
function menuMain(){if(typeof titleScreen==="function")return titleScreen();const m=$("modal"),sv=loadSaves(),auto=sv.auto,n=Object.keys(sv).length;m.className="modal hero";
  m.innerHTML=heroTop("Du bist die Rennleitung der Formel 1: Sessions freigeben, Flaggen setzen, Vorfälle im Replay prüfen und Strafen verteilen.")+`<div class="hero-body"><div class="cards">
      ${auto?`<button class="cardb wide" id="mCont"><span class="ic">▶</span><b>Fortsetzen</b><small>${esc(auto.name)} · ${auto.date}</small></button>`:""}
      <button class="cardb" id="mSingle"><span class="ic">🏁</span><b>Einzelrennen</b><small>Ein Rennwochenende auf einer von ${Object.keys(TRACKS).length} Strecken</small></button>
      <button class="cardb" id="mSeason"><span class="ic">🏆</span><b>Saison</b><small>Fahrer- und Konstrukteurs-WM mit frei anpassbarem Rennkalender</small></button>
      <button class="cardb" id="mLoad" ${n?"":"disabled"}><span class="ic">💾</span><b>Spielstand laden</b><small>${n?n+" Spielstand"+(n>1?"e":"")+" vorhanden":"Noch nichts gespeichert"}</small></button>
      <button class="cardb" id="mRules"><span class="ic">📖</span><b>Regelbuch</b><small>Flaggen, Strafen, Startverfahren, Safety Car</small></button></div>
    <p class="hint" style="margin:14px 0 0">Ohne Anmeldung bleiben Spielstände auf diesem Gerät. Mit Google-Anmeldung werden sie über dein Konto auf anderen Geräten verfügbar. Gespeichert wird automatisch zu Beginn jeder Session.</p></div>`;
  $("overlay").classList.add("show");
  document.body.classList.remove("booting");
  if(auto)$("mCont").onclick=()=>loadGame(auto.data);
  $("mSingle").onclick=()=>menuSetup("single");$("mSeason").onclick=()=>menuSetup("season");
  $("mLoad").onclick=menuLoad;$("mRules").onclick=()=>{m.className="modal";m.innerHTML=`<h2>📖 Regelbuch</h2>${RULES}<p style="opacity:.35;font-size:10px;text-align:right;margin:2px 0">Regelwerk Rev. ${funCode()}</p><button class="big go" id="clBtn">Zurück</button>`;$("clBtn").onclick=menuMain;};}
function drawPreview(cv,key){buildTrack(key);const c=cv.getContext("2d"),W=cv.width,H=cv.height;c.clearRect(0,0,W,H);
  const z=Math.min(W/(TB.x1-TB.x0+120),H/(TB.y1-TB.y0+120));c.save();c.translate(W/2,H/2);c.scale(z,z);c.translate(-(TB.x0+TB.x1)/2,-(TB.y0+TB.y1)/2);
  c.lineJoin="round";c.beginPath();for(let i=0;i<NU;i++){if(i)c.lineTo(T.x[i],T.y[i]);else c.moveTo(T.x[i],T.y[i]);}c.closePath();
  c.lineWidth=20/Math.max(z,0.12)*0.42;c.strokeStyle="#39414d";c.stroke();c.lineWidth=20/Math.max(z,0.12)*0.2;c.strokeStyle="#f2f4f6";c.stroke();
  for(let k=0;k<3;k++){const i=Math.floor(k*NU/3),p={x:T.x[i],y:T.y[i]};c.fillStyle=k?"#ffd400":"#e10600";c.beginPath();c.arc(p.x,p.y,(k?5:8)/z,0,7);c.fill();}
  c.restore();}
function menuSetup(type){
  const m=$("modal"),season=type==="season";m.className="modal hero";
  let seasonRaces=season?CALENDAR.map(key=>({track:key,format:SPRINTS.includes(key)?"sprint":"full"})):[];
  let previewRound=0;
  m.innerHTML=heroTop(season?"Stelle deine Saison zusammen: Wähle Strecken, Reihenfolge und Wochenendformat für jedes Rennen.":"Einzelrennen: ein Wochenende auf der Strecke deiner Wahl.")+`<div class="hero-body">
    <div class="setup"><div>
      ${season?`<label class="field"><span>Saisonlänge</span><div class="season-length"><input id="oCal" type="range" min="1" max="${CALENDAR.length}" value="${CALENDAR.length}" step="1" aria-label="Anzahl der Saisonrennen"><output id="oCalCount">${CALENDAR.length} Rennen</output></div><small class="field-note">Danach legst du Strecke, Reihenfolge und Format pro Rennen fest.</small></label>`
        :`<label class="field"><span>Strecke</span><select id="oTrack">${trackOptions()}</select></label>`}
      ${season?"":`<label class="field"><span>Wochenende</span><select id="oFmt"><option value="full">Training + Qualifying + Rennen</option><option value="sprint">Sprint-Wochenende (FP · Sprint-Quali · Sprint · Quali · Rennen)</option><option value="quali">Qualifying + Rennen</option><option value="race">Nur Rennen</option></select></label>`}
      <label class="field"><span>Session-Längen</span><select id="oMode"><option value="short">Kurz</option><option value="real">Realistisch (FP 60 · Q 18/15/12 Min.)</option></select></label>
      <label class="field"><span>Renndistanz</span><select id="oLaps"><option value="8">8 Runden</option><option value="12" selected>12 Runden</option><option value="18">18 Runden</option><option value="30">30 Runden</option><option value="full">Volle Distanz</option></select></label>
      <label class="field"><span>Feedback</span><select id="oFb"><option value="0">Erst nach dem Rennen (realistisch)</option><option value="1">Sofort nach jeder Entscheidung</option></select></label>
      <label class="field"><span>Wetter</span><select id="oWx"><option value="rand">Zufall</option><option value="dry">Trocken</option><option value="wet">Regen kommt</option></select></label>
    </div><div>
      ${season?`<div class="prev"><canvas id="pvCv" width="760" height="300"></canvas><div id="pvInfo"></div>
        <section class="calendar-editor" aria-label="Saisonkalender"><div class="schedule-head"><b>Dein Rennkalender</b><span id="seasonSummary" aria-live="polite"></span></div>
          <p class="hint">Die Zeilenreihenfolge ist deine Rennreihenfolge. Wähle pro Rennen Strecke und Format. Standard umfasst Training, Qualifying und Rennen.</p>
          <div class="template-toolbar"><button type="button" class="ghost" id="templatesToggle">Vorlagen <span id="templateCount">0</span></button><button type="button" class="ghost" id="templateSaveOpen">Als Vorlage speichern</button></div>
          <div id="templatePanel" class="template-panel" hidden><div class="template-save-row"><input id="templateName" maxlength="32" aria-label="Name der Saisonvorlage" placeholder="Name der Vorlage"><button type="button" class="ghost" id="templateSave">Speichern</button></div><div id="templateList" class="template-list"></div><div id="templateStatus" class="hint" aria-live="polite"></div></div>
          <div id="seasonList" class="season-list"></div>
        </section></div>`:`<div class="prev"><canvas id="pvCv" width="760" height="430"></canvas><div id="pvInfo"></div></div>`}
    </div></div>
    <div class="btnrow"><button class="big" style="background:#3a3f48;flex:0 0 130px" id="backBtn">Zurück</button><button class="big go" id="goBtn">${season?"Saison starten":"Wochenende starten"}</button></div>
  </div>`;

  const upd=()=>{
    const key=season?seasonRaces[Math.min(previewRound,seasonRaces.length-1)].track:$("oTrack").value;
    drawPreview($("pvCv"),key);const t=TRACKS[key];
    if(season){const race=seasonRaces[previewRound];
      $("pvInfo").innerHTML=`<div class="pstats"><div><b>Rennen ${previewRound+1}</b><span>${esc(t.name)}</span></div><div><b>${esc(seasonFormatName(race.format))}</b><span>Wochenendformat</span></div></div>`;
    }else $("pvInfo").innerHTML=`<div class="pstats"><div><b>${esc(t.name)}</b><span>Strecke</span></div><div><b>${t.len?(t.len/1000).toFixed(3)+" km":"–"}</b><span>Länge</span></div><div><b>${t.laps}</b><span>Runden (voll)</span></div><div><b>${fmtLap(t.lapS).slice(0,-2)}</b><span>Rundenzeit ca.</span></div></div>`;
  };
  const renderSeasonCalendar=()=>{
    const list=$("seasonList");if(!season||!list)return;
    list.innerHTML=seasonRaces.map((race,i)=>`<div class="season-row"><span class="round-num">${String(i+1).padStart(2,"0")}</span><select data-season-track="${i}" aria-label="Strecke für Rennen ${i+1}">${seasonTrackOptions(race.track)}</select><select data-season-format="${i}" aria-label="Wochenendformat für Rennen ${i+1}">${Object.entries(SEASON_WEEKEND_FORMATS).map(([value,label])=>`<option value="${value}"${value===race.format?" selected":""}>${esc(label)}</option>`).join("")}</select></div>`).join("");
    list.querySelectorAll("[data-season-track]").forEach(select=>{
      select.onfocus=()=>{previewRound=+select.dataset.seasonTrack;upd();};
      select.onchange=()=>{const i=+select.dataset.seasonTrack;seasonRaces[i].track=select.value;previewRound=i;upd();};
    });
    list.querySelectorAll("[data-season-format]").forEach(select=>select.onchange=()=>{
      const i=+select.dataset.seasonFormat;seasonRaces[i].format=select.value;
      if(previewRound===i)upd();
      updateSeasonSummary();
    });
    updateSeasonSummary();
  };
  const updateSeasonSummary=()=>{
    if(!season)return;
    const counts={};seasonRaces.forEach(race=>{counts[race.format]=(counts[race.format]||0)+1;});
    const formatCounts=Object.entries(SEASON_WEEKEND_FORMATS).filter(([format])=>counts[format]).map(([format,label])=>`${counts[format]} ${label}`);
    $("seasonSummary").textContent=`${seasonRaces.length} Rennen · ${formatCounts.join(" · ")}`;
    $("oCalCount").textContent=`${seasonRaces.length} Rennen`;
  };
  if(season){
    $("oCal").oninput=()=>{
      const wanted=+$("oCal").value;
      while(seasonRaces.length>wanted)seasonRaces.pop();
      while(seasonRaces.length<wanted){const track=CALENDAR[seasonRaces.length%CALENDAR.length];seasonRaces.push({track,format:SPRINTS.includes(track)?"sprint":"full"});}
      previewRound=Math.min(previewRound,seasonRaces.length-1);renderSeasonCalendar();upd();
    };
    renderSeasonCalendar();upd();
    const templatePanel=$("templatePanel"),templateList=$("templateList"),templateStatus=$("templateStatus");
    const templateMessage=(message,state)=>{templateStatus.textContent=message;templateStatus.dataset.state=state||"local";};
    const renderTemplates=async()=>{
      templateList.innerHTML='<p class="hint">Vorlagen werden geladen …</p>';
      try{
        const templates=await listSeasonTemplates();
        $("templateCount").textContent=templates.length;
        templateList.innerHTML=templates.length?templates.map(item=>`<div class="template-item"><div><b>${esc(item.name)}</b><small>${item.cal.length} Rennen · ${item.formats.filter(f=>f==="sprint").length} Sprint</small></div><button type="button" class="ghost" data-template-load="${esc(item.id)}">Laden</button><button type="button" class="ghost" data-template-delete="${esc(item.id)}" aria-label="Vorlage ${esc(item.name)} löschen">Löschen</button></div>`).join(""):'<p class="hint">Noch keine Saisonvorlagen gespeichert.</p>';
        templateList.querySelectorAll("[data-template-load]").forEach(button=>button.onclick=()=>{
          const item=templates.find(x=>x.id===button.dataset.templateLoad);if(!item)return;
          if(!Array.isArray(item.cal)||!item.cal.length||item.cal.length>CALENDAR.length)return templateMessage("Diese Vorlage hat einen ungültigen Rennkalender.","error");
          seasonRaces=item.cal.map((track,i)=>({track:TRACKS[track]?track:CALENDAR[i%CALENDAR.length],format:Object.prototype.hasOwnProperty.call(SEASON_WEEKEND_FORMATS,item.formats&&item.formats[i])?item.formats[i]:"full"}));
          $("oCal").value=seasonRaces.length;previewRound=0;renderSeasonCalendar();upd();templateMessage(`„${item.name}“ geladen.`,"ready");
        });
        templateList.querySelectorAll("[data-template-delete]").forEach(button=>button.onclick=async()=>{
          const item=templates.find(x=>x.id===button.dataset.templateDelete);if(!item||!confirm(`Saisonvorlage „${item.name}“ löschen?`))return;
          button.disabled=true;
          try{const result=await deleteSeasonTemplate(item.id);templateMessage(result.cloud?"Vorlage gelöscht und synchronisiert.":"Vorlage lokal gelöscht.",result.cloud?"ready":"local");await renderTemplates();}
          catch(error){button.disabled=false;templateMessage(error.message||"Vorlage konnte nicht gelöscht werden.","error");}
        });
      }catch(error){templateList.innerHTML='<p class="hint">Vorlagen sind lokal verfügbar; die Cloud ist gerade nicht erreichbar.</p>';$("templateCount").textContent=visibleSeasonTemplates(readSeasonTemplateState()).length;templateMessage("Cloud nicht erreichbar · lokale Vorlagen bleiben erhalten.","error");}
    };
    $("templatesToggle").onclick=()=>{templatePanel.hidden=!templatePanel.hidden;if(!templatePanel.hidden)renderTemplates();};
    $("templateSaveOpen").onclick=()=>{templatePanel.hidden=false;$("templateName").focus();renderTemplates();};
    $("templateSave").onclick=async()=>{
      const name=$("templateName").value.trim();if(!name)return templateMessage("Gib einen Namen für die Vorlage ein.","error");
      if(name.length>32)return templateMessage("Der Name darf höchstens 32 Zeichen lang sein.","error");
      const button=$("templateSave");button.disabled=true;
      try{
        const result=await saveSeasonTemplate({name,cal:seasonRaces.map(r=>r.track),formats:seasonRaces.map(r=>r.format)});
        $("templateName").value="";templateMessage(result.cloud?`„${name}“ gespeichert und synchronisiert.`:`„${name}“ lokal gespeichert.`,result.cloud?"ready":"local");await renderTemplates();
      }catch(error){templateMessage(error.message||"Vorlage konnte nicht gespeichert werden.","error");}
      finally{button.disabled=false;}
    };
    renderTemplates();
  }else{$("oTrack").onchange=upd;upd();}
  $("oMode").onchange=e=>{$("oLaps").value=e.target.value==="real"?"full":"12";};
  $("backBtn").onclick=menuMain;
  $("goBtn").onclick=()=>{
    FB_LIVE=$("oFb").value==="1";OPTS={fb:FB_LIVE,wx:$("oWx").value,mode:$("oMode").value,format:season?"full":$("oFmt").value,lapsSel:$("oLaps").value};
    CAREER={type,cal:season?seasonRaces.map(r=>r.track):[$("oTrack").value],formats:season?seasonRaces.map(r=>r.format):[],sprints:season?seasonRaces.map(r=>r.format==="sprint"):[],round:0,points:{},lic:{},history:[],score:0,dec:{ok:0,total:0},rep:60};
    $("overlay").classList.remove("show");startRound();
  };
}
function menuSeasonOverview(source,fromTitle){
  const career=source&&source.career?source.career:source,opts=source&&source.opts?source.opts:OPTS||{};
  if(!career||career.type!=="season")return fromTitle?titleScreen():menuPause();
  const calendar=Array.isArray(career.cal)?career.cal:[],completed=clamp(career.round||0,0,calendar.length),total=calendar.length;
  const rounds=calendar.map((key,index)=>{
    const history=(career.history||[])[index],status=index<completed?"Abgeschlossen":index===completed&&completed<total?"Als Nächstes":"Ausstehend";
    const top=history&&Array.isArray(history.top)?history.top.map(code=>{const d=DRIVERS.find(x=>x.code===code);return d?d.name:code;}).join(" · "):"Noch kein Ergebnis";
    return `<div class="season-overview-round"><span class="round-num">${String(index+1).padStart(2,"0")}</span><div><b>${esc(TRACKS[key]?TRACKS[key].name:key)}</b><small>${esc(seasonFormatName(seasonWeekendFormat(career,index,opts)))} · ${esc(status)}</small>${history?`<small>Top 3: ${esc(top)}</small>`:""}</div></div>`;
  }).join("");
  const m=$("modal");m.className="modal wide";
  m.innerHTML=`<h2>🏆 Saisonübersicht</h2><p class="hint">${career.year||2026} · ${completed} von ${total} Rennen abgeschlossen · Ansehen ${Math.round(career.rep==null?60:career.rep)}</p><div class="season-overview"><section class="season-overview-calendar"><h3>Rennkalender</h3>${rounds}</section><section class="season-overview-standings"><h3>Meisterschaft</h3>${standingsHtml(career)}</section></div><button class="big go" id="seasonOverviewBack">${fromTitle?"Zurück zum Hauptmenü":"Zurück zur Pause"}</button>`;
  $("overlay").classList.add("show");
  $("seasonOverviewBack").onclick=()=>fromTitle?titleScreen():menuPause();
}
function menuLoad(){const m=$("modal"),sv=loadSaves(),names={auto:"Automatisch",s1:"Slot 1",s2:"Slot 2",s3:"Slot 3"};m.className="modal";
  m.innerHTML=`<h2>Spielstand laden</h2>${Object.keys(sv).map(k=>`<div class="slot"><div><b>${names[k]||k}</b><br><small>${esc(sv[k].name)} · ${sv[k].date}</small></div>
    <button class="ghost" data-l="${k}">Laden</button><button class="ghost" data-x="${k}">Löschen</button></div>`).join("")||"<p>Keine Spielstände.</p>"}
    <div style="display:flex;gap:8px;margin:12px 0 4px"><button class="ghost" id="expBtn" ${Object.keys(sv).length?"":"disabled"}>⬇ Exportieren</button><button class="ghost" id="impBtn">⬆ Importieren</button></div>
    <button class="big" style="background:#3a3f48" id="backBtn">Zurück</button>`;
  $("expBtn").onclick=rcExport;$("impBtn").onclick=rcImportPick;
  m.querySelectorAll("[data-l]").forEach(b=>b.onclick=()=>loadGame(sv[b.dataset.l].data));
  m.querySelectorAll("[data-x]").forEach(b=>b.onclick=()=>{delSave(b.dataset.x);menuLoad();});
  $("backBtn").onclick=S?menuPause:menuMain;}
/* ---- Spielstände exportieren / importieren (Datei oder eingefügter Text) ---- */
const SLOT_NAMES={auto:"Automatisch",s1:"Slot 1",s2:"Slot 2",s3:"Slot 3"},SLOT_KEYS=Object.keys(SLOT_NAMES);
function rcExport(){const sv=loadSaves(),out={app:"race-control",fmt:1,exported:new Date().toISOString(),saves:{}};
  for(const k of Object.keys(sv)){const e=sv[k];out.saves[k]={name:e.name,date:e.date,data:e.data};}
  const blob=new Blob([JSON.stringify(out)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);
  a.download=`race-control-spielstaende-${new Date().toISOString().slice(0,10)}.json`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),2000);}
function rcValidData(d){return !!d&&typeof d==="object"&&(d.pending?!!d.career:d.v===1&&!!d.opts&&!!TRACKS[d.track]);}
/* akzeptiert den Export ({app,saves}), einen einzelnen Eintrag ({name,date,data}) oder nur die Spieldaten */
function rcParseImport(text){let j;try{j=JSON.parse(String(text).trim());}catch(e){return {err:"Das ist kein gültiges JSON."};}
  let list=[];
  if(j&&j.saves&&typeof j.saves==="object"){if(j.app&&j.app!=="race-control")return {err:`Die Datei stammt nicht von Race Control („${esc(String(j.app))}“).`};
    for(const k of Object.keys(j.saves)){const e=j.saves[k]||{};list.push({from:k,name:e.name||k,date:e.date||"",data:e.data});}}
  else if(j&&j.data)list.push({from:"s1",name:j.name||"Importiert",date:j.date||"",data:j.data});
  else if(j&&(j.v||j.pending))list.push({from:"s1",name:"Importiert",date:"",data:j});
  else return {err:"Keine Spielstände in den Daten gefunden."};
  for(const e of list)e.ok=rcValidData(e.data);
  if(!list.some(e=>e.ok))return {err:"Keine der enthaltenen Spielstände ist lesbar."};
  return {list};}
function rcImportPick(){const m=$("modal");m.className="modal";
  m.innerHTML=`<h2>Spielstände importieren</h2><p class="hint">Eine exportierte .json-Datei wählen oder den Inhalt einfügen.</p>
    <input type="file" id="impFile" accept=".json,application/json" style="margin:6px 0 10px">
    <textarea id="impTxt" placeholder='{"app":"race-control", … }' style="width:100%;box-sizing:border-box;min-height:110px;background:#0d1117;color:inherit;border:1px solid var(--line);border-radius:6px;padding:6px;font:11px ui-monospace,monospace"></textarea>
    <p id="impErr" style="color:#ff6b6b;min-height:1em;margin:6px 0"></p>
    <button class="big go" id="impNext">Weiter</button><button class="big" style="background:#3a3f48" id="impBack">Zurück</button>`;
  const go=t=>{const r=rcParseImport(t);if(r.err){$("impErr").innerHTML=r.err;return;}rcImportPreview(r.list);};
  $("impFile").onchange=e=>{const f=e.target.files&&e.target.files[0];if(!f)return;const fr=new FileReader();fr.onload=()=>go(fr.result);fr.onerror=()=>{$("impErr").textContent="Datei konnte nicht gelesen werden.";};fr.readAsText(f);};
  $("impNext").onclick=()=>go($("impTxt").value);$("impBack").onclick=menuLoad;}
function rcImportPreview(list){const m=$("modal"),sv=loadSaves();m.className="modal";
  const used=new Set(),def=e=>{let k=SLOT_KEYS.includes(e.from)&&!used.has(e.from)?e.from:SLOT_KEYS.find(x=>!used.has(x)&&!sv[x])||SLOT_KEYS.find(x=>!used.has(x))||"";if(k)used.add(k);return k;};
  const rows=list.map((e,i)=>{const d=e.ok?def(e):"";return `<div class="slot"><div><b>${esc(e.name)}</b><br><small>${esc(e.date)}${e.ok?"":" · <span style='color:#ff6b6b'>unlesbar, wird übersprungen</span>"}</small></div>
    ${e.ok?`<select data-i="${i}"><option value="">nicht importieren</option>${SLOT_KEYS.map(k=>`<option value="${k}" ${k===d?"selected":""}>${SLOT_NAMES[k]}</option>`).join("")}</select>`:""}</div><small class="ow" data-o="${i}" style="display:block;color:#f2c94c;margin:-4px 0 6px"></small>`;}).join("");
  m.innerHTML=`<h2>Spielstände importieren</h2><p class="hint">Ziel-Slot wählen. Belegte Slots werden überschrieben.</p>${rows}
    <p id="impErr" style="color:#ff6b6b;min-height:1em;margin:6px 0"></p><button class="big go" id="impDo">Importieren</button><button class="big" style="background:#3a3f48" id="impBack">Zurück</button>`;
  const sel=()=>[...m.querySelectorAll("select[data-i]")];
  const upd=()=>{const cnt={};for(const s of sel())if(s.value)cnt[s.value]=(cnt[s.value]||0)+1;
    for(const s of sel()){const o=m.querySelector(`[data-o="${s.dataset.i}"]`);o.textContent=s.value&&cnt[s.value]>1?"⚠ Slot doppelt gewählt":s.value&&sv[s.value]?`überschreibt: ${sv[s.value].name}`:"";}
    $("impDo").disabled=Object.values(cnt).some(n=>n>1)||!Object.keys(cnt).length;};
  sel().forEach(s=>s.onchange=upd);upd();
  $("impBack").onclick=rcImportPick;
  $("impDo").onclick=()=>{try{const s=loadSaves();let n=0;
      for(const x of sel()){if(!x.value)continue;const e=list[+x.dataset.i],entry={name:e.name,date:e.date||new Date().toLocaleString("de-DE"),updatedAtMs:Date.now(),data:e.data};
        s[x.value]=entry;if(window.RCCloud)window.RCCloud.save(x.value,entry);n++;}
      localStorage.setItem(SAVEKEY,JSON.stringify(s));menuLoad();}
    catch(err){$("impErr").textContent="Speichern fehlgeschlagen (Speicher voll?): "+(err&&err.message||err);}};}
function menuPause(){if(R.inc||!S)return;const m=$("modal"),sv=loadSaves();m.className="modal";if(UI.speed)UI.prevSpeed=UI.speed;setSpeed(0);
  m.innerHTML=`<h2>☰ Pause</h2><p class="hint">Gespeichert wird der laufende Stand (Zeit bzw. Runde, Positionen, Reifen, Strafen). Offene Vorfälle, Flaggen und Autos in der Box werden beim Laden zurückgesetzt. Während einer Gefahrenlage wird der letzte ruhige Stand genommen.</p><div class="menu">
    <button id="pCont">Weiter</button>
    <button id="pRs">Session wiederholen<small>${W.defs[W.idx]?esc(W.defs[W.idx].name):""} startet neu – Punkte und Entscheidungen dieser Session werden verworfen</small></button>
    <button id="pRw">Ganzes Wochenende wiederholen<small>zurück zur ersten Session auf ${esc(TRACK.name)}</small></button>
    ${["s1","s2","s3"].map((k,i)=>`<button data-s="${k}">In Slot ${i+1} speichern<small>${sv[k]?esc(sv[k].name)+" · "+sv[k].date:"leer"}</small></button>`).join("")}
    ${W.career&&W.career.type==="season"?'<button id="pOverview">Saisonübersicht<small>Rennkalender und aktueller WM-Stand</small></button>':""}
    <button id="pLoad">Spielstand laden</button><button id="pMain">Zum Hauptmenü<small>Der automatische Spielstand bleibt erhalten</small></button></div><div id="pMsg"></div>`;
  $("overlay").classList.add("show");
  $("pCont").onclick=()=>{$("overlay").classList.remove("show");setSpeed(UI.prevSpeed||1);};
  m.querySelectorAll("[data-s]").forEach(b=>b.onclick=()=>{liveSave();const lv=W.liveSnap&&W.liveSnap.idx===W.snap.idx&&W.liveSnap.track===W.snap.track;const ok=W.snap&&writeSave(b.dataset.s,lv?W.liveSnap:W.snap,lv?W.liveName:W.snapName);$("pMsg").innerHTML=`<div class="fbk ${ok?"ok":"bad"}">${ok?"Gespeichert.":"Speichern nicht möglich (Browser-Speicher gesperrt)."}</div>`;if(ok)setTimeout(menuPause,600);});
  const again=(data,txt)=>{if(!data)return;if(!$("pMsg").dataset.ask||$("pMsg").dataset.ask!==txt){$("pMsg").dataset.ask=txt;$("pMsg").innerHTML=`<div class="fbk mid">${txt} wirklich neu starten? Zum Bestätigen noch einmal klicken.</div>`;return;}loadGame(JSON.parse(JSON.stringify(data)));};
  $("pRs").onclick=()=>again(W.snap,"Session");$("pRw").onclick=()=>again(W.wk||W.snap,"Wochenende");
  if($("pOverview"))$("pOverview").onclick=()=>menuSeasonOverview({career:W.career,opts:W.opts},false);
  $("pLoad").onclick=menuLoad;$("pMain").onclick=()=>{S=null;menuMain();};}
const showMenu=menuMain;
function showDocs(){if(R.inc||!S)return;const prev=UI.speed;setSpeed(0);const m=$("modal");m.className="modal";const ds=(W.docs||[]).slice().reverse();
  m.innerHTML=`<h2>📄 Dokumente der Stewards</h2>`+(ds.length?ds.map(x=>`<div style="border:1px solid #2a303a;border-radius:8px;padding:8px 10px;margin:6px 0;text-align:left">
    <div style="display:flex;justify-content:space-between;color:#f2c94c;font-size:11px;font-weight:700;letter-spacing:.06em"><span>DOKUMENT ${x.no} · ${esc(x.sess)}${x.lap?" · RUNDE "+x.lap:""}</span>${FB_LIVE?`<span style="color:${x.ok?"#2fd16b":x.pts>0?"#f2c94c":"#e10600"}">${x.ok?"bestätigt":x.pts>0?"vertretbar":"angreifbar"}</span>`:""}</div>
    <div style="font-weight:700;margin:3px 0">${esc(x.title)}</div><div style="font-size:12px;color:#aab">Beteiligt: ${esc(x.cars)}</div>
    <div style="font-size:13px;margin-top:3px"><b>Entscheidung:</b> ${esc(x.dec)}</div>${FB_LIVE?`<div style="font-size:12px;color:#aab;margin-top:2px"><b>Begründung:</b> ${esc(x.why)}</div>`:""}</div>`).join(""):`<p class="hint">Noch keine Entscheidungen an diesem Wochenende.</p>`)+`<button class="big go" id="clBtn">Zurück</button>`;
  $("overlay").classList.add("show");$("clBtn").onclick=()=>{$("overlay").classList.remove("show");setSpeed(prev||1);};}
function showRules(){if(R.inc||!S)return;const prev=UI.speed;setSpeed(0);const m=$("modal");m.className="modal";
  m.innerHTML=`<h2>📖 Regelbuch</h2>${RULES}<button class="big go" id="clBtn">Zurück</button>`;$("overlay").classList.add("show");
  $("clBtn").onclick=()=>{$("overlay").classList.remove("show");setSpeed(prev||1);};}

/* ---- Bedienung ---- */
document.querySelectorAll("#speedSeg button").forEach(b=>b.onclick=()=>setSpeed(+b.dataset.s));
$("rulesBtn").onclick=showRules;$("docBtn").onclick=showDocs;$("sndBtn").onclick=sndToggle;$("menuBtn").onclick=menuPause;
for(let i=0;i<3;i++)$("sec"+i).onclick=()=>S&&cycleSector(i);
$("allGreen").onclick=()=>S&&allGreen();
document.querySelectorAll(".nb button").forEach(b=>b.onclick=()=>{if(S&&b.dataset.act)setNeutral(b.dataset.act);});
$("omBtn").onclick=()=>{if(!S)return;S.om=!S.om;addLog(S.om?"OVERTAKE MODE ENABLED":"OVERTAKE MODE DISABLED","flag");uiFlags();};
document.querySelectorAll(".da button").forEach(b=>b.onclick=()=>{if(!S)return;const c=S.cars[UI.sel];if(!c)return;const p=b.dataset.p;
  if(p==="inv"){investigate(c);return;}
  givePen(c,p==="5"?5:p==="10"?10:p,"Entscheidung der Rennleitung");uiTower();uiFlags();});
document.addEventListener("keydown",e=>{if(e.target.tagName==="INPUT"||e.target.tagName==="SELECT")return;
  if(e.key==="Escape"&&R.inc)closeReplay();
  else if(R.inc){if(e.key===" "){e.preventDefault();R.playing=!R.playing;rpSync();}else if(e.key==="ArrowLeft")$("rpB").click();else if(e.key==="ArrowRight")$("rpF").click();}
  else if(S&&!$("overlay").classList.contains("show")){if(e.key==="1"||e.key==="2"||e.key==="3")cycleSector(+e.key-1);else if(e.key===" "){e.preventDefault();setSpeed(UI.speed?0:1);}}});

const NPOST_=0;
function ccSet(v){UI.cctvMan=v;$("ccAuto").classList.toggle("on",v==null);}
$("ccPrev").onclick=()=>ccSet(((UI.cctvMan==null?UI.cctvCo:UI.cctvMan)-1+CORNERS.length+2)%(CORNERS.length+2));
$("ccNext").onclick=()=>ccSet(((UI.cctvMan==null?UI.cctvCo:UI.cctvMan)+1)%(CORNERS.length+2));
$("ccAuto").onclick=()=>ccSet(null);
$("cvCctv").addEventListener("wheel",e=>{e.preventDefault();UI.cctvZ=clamp(UI.cctvZ*(e.deltaY<0?1.1:0.9),0.4,3);},{passive:false});
$("cvFeed").addEventListener("wheel",e=>{e.preventDefault();UI.feedZ=clamp(UI.feedZ*(e.deltaY<0?1.1:0.9),0.4,3);},{passive:false});
function advice(){const n=S.incidents.filter(i=>i.status==="open").length,race=S.type==="race";let a=[];
  if(!race&&!S.started)a.push("Empfehlung: Boxenausfahrt öffnen, sobald du bereit bist");
  if(race&&(S.phase==="pre"||S.phase==="gridwait")){if(S.stall)a.push(`⚠ ${S.stall.drv.code} steht mit Problem in der Startaufstellung – Empfehlung: Start abbrechen`);
    if(S.wx.wet>0.3&&!S.restartGrid)a.push("Strecke ist nass – Empfehlung: Start hinter dem Safety Car");}
  if(race&&S.phase==="racing"){const dm=S.cars.filter(c=>c.dmg&&c.ignoreDmg&&!c.pit&&c.mode==="race");if(dm.length)a.push(`${dm.map(c=>c.drv.code).join(", ")} fährt mit beschädigtem Frontflügel weiter – Empfehlung: schwarz-orange Flagge`);
    if(S.flag.mode==="sc"&&S.sc&&S.sc.on&&!S.unlapOn&&!S.hazard&&lappedCount()>0)a.push("Empfehlung: Überrundete zurückrunden lassen, dann „SC in this lap“");
    if(S.pitClosed)a.push("Boxeneinfahrt ist geschlossen");}
  if(race&&S.phase==="racing"&&!S.chequered&&S.flag.mode==="green"){const lap=Math.floor((S.leader?S.leader.s:0)/L)+1;
    if(S.om&&S.wx.wet>0.3)a.push("Empfehlung: Overtake Mode sperren – Strecke ist nass");
    else if(!S.om&&S.wx.wet<0.2&&lap>=2)a.push("Empfehlung: Overtake Mode freigeben – Strecke ist trocken");
    if(S.wx.eta<40&&S.wx.rain<0.03)a.push(`Regen in ca. ${Math.round(S.wx.eta)}s`);}
  if(S.sec.some(x=>x)&&!S.hazard)a.push("Kein Vorfall gemeldet – Sektoren können grün geschaltet werden");
  if(n)a.push(`${n} Vorfall${n>1?"e":""} wartet auf deine Entscheidung (Stewards → Prüfen)`);
  return a.join(" · ")||"Keine Meldungen. Alles ruhig.";}
/* ---- Hauptschleife ---- */
const CV={all:$("cvAll"),feed:$("cvFeed"),cctv:$("cvCctv"),radar:$("radar")};CV.radar.addEventListener("click",()=>openRadar());
function drawMonitors(rdt){
  let fr=REC[REC.length-1];if(!fr)return;if(REC.length>1&&UI.speed>0)fr=lerpFrame(REC[REC.length-2],fr,clamp(UI.acc/DT,0,1),UI._lf||(UI._lf={}));const ro=S.cars,sel=clamp(UI.sel,0,ro.length-1);
  const li=S.leader?ro.indexOf(S.leader):-1;
  const hist=[];for(let j=2;j<=17&&REC.length-j>=0;j++)hist.push(REC[REC.length-j]);
  let [c,cw,ch]=beginCv(CV.all);drawScene(c,cw,ch,camFit(cw,ch),fr,ro,{bg:"#070b10",hi:li>=0&&S.type==="race"?[sel,li]:[sel],grid:S.type==="race"});
  hud(c,cw,TRACK.name.toUpperCase(),null,`STRECKE ${S.wx.wet<0.05?"TROCKEN":S.wx.wet<0.25?"FEUCHT":"NASS"} · OVERTAKE MODE ${S.om?"FREI":"GESPERRT"}`);
  // Weltregie: folgt gewähltem Auto
  if(UI.feedAuto)autoDirector(rdt);
  const fs=UI.feedAuto?clamp(UI.feedCar,0,ro.length-1):sel;
  [c,cw,ch]=beginCv(CV.feed);const sc=ro[fs];
  let cam=camCar(fr,fs,(sc&&(sc.pit||sc.mode==="garage"||sc.mode==="grid")?3.4:4.3)*UI.feedZ,false);
  if(UI.pov&&sc&&!sc.removed&&sc.mode!=="garage")drawPOV(c,cw,ch,fr,ro,fs);else
  drawScene(c,cw,ch,cam,fr,ro,{hist,marks:true,labels:"all",hi:[fs],grid:S.type==="race"&&S.phase!=="racing",showLights:S.phase==="lights"});
  hud(c,cw,"● LIVE",null,sc?`${sc.drv.code} · ${Math.round(sc.v*KMH)} KM/H`:"");
  if(UI.tv&&UI.tv.left>0){UI.tv.left-=rdt;const a=Math.min(1,UI.tv.left*2,(4.5-UI.tv.left)*4),bw=Math.min(cw-24,UI.tv.t.length*7.4+26);   // TV-Einblendung
    c.save();c.globalAlpha=Math.max(0,a);c.fillStyle="rgba(10,13,18,.92)";c.fillRect(12,ch-58,bw,26);c.fillStyle=UI.tv.col;c.fillRect(12,ch-58,5,26);
    c.fillStyle="#fff";c.font="bold 12px ui-monospace,monospace";c.textAlign="left";c.fillText(UI.tv.t,24,ch-41);c.restore();}
  sndEngine(sc?sc.v:0,UI.speed>0&&!S.ended&&sc&&sc.mode!=="garage"&&sc.mode!=="grid"&&!sc.removed,sc&&(sc.brk||sc.crash||sc.spinT>0)?0:1,sc&&sc.drv.code);
  if(S.lights!==UI._li){if(S.lights>0&&S.lights>(UI._li||0))sndEvent("light");else if(UI._li>0&&S.lights===0&&S.phase==="racing")sndEvent("go");UI._li=S.lights;}
  // Bremsspuren bleiben auf der Strecke liegen
  if(UI._ms!==S){UI._ms=S;MARKS.length=0;}
  for(const k of ro){if(k.removed||!(k.lockT>0||k.spinT>0)||k.v<12){k._mk=null;continue;}const q=posXY(k.s,k.lat),hd=q.ang+k.spin+SIDE*k.yaw,cx=Math.cos(hd),sx=Math.sin(hd);
    const pts=[[q.x-5*cx+2.5*sx,q.y-5*sx-2.5*cx],[q.x-5*cx-2.5*sx,q.y-5*sx+2.5*cx]];
    if(k._mk)for(let w=0;w<2;w++){const dx=pts[w][0]-k._mk[w][0],dy=pts[w][1]-k._mk[w][1];if(dx*dx+dy*dy<140)MARKS.push([k._mk[w][0],k._mk[w][1],pts[w][0],pts[w][1]]);}
    k._mk=pts;if(MARKS.length>1400)MARKS.splice(0,300);}
  $("feedLbl").textContent=`MON 02 · WELTREGIE · ${UI.feedAuto?"AUTO":"FOLGT"} ${sc?sc.drv.code:"–"}`;
  // CCTV: Gefahr > Boxengasse bei Betrieb > Kurvenposten
  [c,cw,ch]=beginCv(CV.cctv);let lbl,pos;const h=S.hazard;
  UI.cctvT+=rdt;if(UI.cctvT>9){UI.cctvT=0;UI.cctvCo=(UI.cctvCo+1+irand(0,3))%CORNERS.length;}
  if(h&&!h.cleared&&h.pos>=0){pos=h.pos;lbl=`POSTEN · SEKTOR ${h.sector+1} · VORFALL AKTIV`;cam={x:0,y:0,z:4.6,rot:0};}
  else if(S.phase==="lights"||S.phase==="gridwait"||(S.type==="race"&&S.phase==="racing"&&S.raceT-S.goT<6)){pos=-60;lbl="START / ZIEL";cam={x:0,y:0,z:3,rot:0};}
  else if(ro.some(x=>x.pit&&(x.pit.ph==="svc"||x.pit.ph==="in")&&x.mode!=="cool"&&x.mode!=="in")){pos=0;lbl="BOXENGASSE";cam={x:0,y:0,z:2.6,rot:0};}
  else{const co=CORNERS[UI.cctvCo];pos=co.s;lbl=`POSTEN ${co.n} · ${cnm(co).toUpperCase()}`;cam={x:0,y:0,z:4,rot:0};}
  if(UI.cctvMan!=null){const m=UI.cctvMan;cam={x:0,y:0,z:4,rot:0};
    if(m<CORNERS.length){pos=CORNERS[m].s;lbl=`POSTEN ${m+1} · ${cnm(CORNERS[m]).toUpperCase()} · MANUELL`;}
    else if(m===CORNERS.length){pos=-60;lbl="START / ZIEL · MANUELL";cam.z=3;}
    else{pos=0;lbl="BOXENGASSE · MANUELL";cam.z=2.6;}}
  cam.z*=UI.cctvZ;
  const q=posXY(pos,lbl.startsWith("BOXENGASSE")?-20:0);cam.x=q.x;cam.y=q.y;
  drawScene(c,cw,ch,cam,fr,ro,{hist,marks:true,labels:"all",grid:S.type==="race"&&S.phase!=="racing",showLights:S.phase==="lights"});
  hud(c,cw,"CCTV",null,null);$("cctvLbl").textContent="MON 03 · "+lbl;
}
function uiTop(){
  const m=S.flag.mode,st=$("status");let t="GRÜN",bg="var(--green)",fg="#000";
  if(m==="red"){t="ROTE FLAGGE";bg="var(--red)";fg="#fff";}else if(m==="sc"){t=S.restart?"SC IN – RESTART":"SAFETY CAR";bg="var(--orange)";}
  else if(m==="vsc"){t="VSC";bg="var(--yellow)";}else if(S.sec.some(x=>x)){t="GELB "+S.sec.map((x,i)=>x?"S"+(i+1):"").filter(Boolean).join(" ");bg="var(--yellow)";}
  else if(S.chequered){t="ZIELFLAGGE";bg="#fff";}else if(S.type!=="race"&&!S.started){t="BOXENAUSFAHRT ZU";bg="#3a3f48";fg="#fff";}
  st.textContent=t;st.style.background=bg;st.style.color=fg;
  $("clock").textContent=S.type==="race"?(S.phase==="racing"?`Runde ${clamp(Math.floor((S.leader?S.leader.s:0)/L)+1,1,S.laps)}/${S.laps}`:"Start"):fmtClock(S.clock*W.cs);
  [...$("ld").children].forEach((b,i)=>b.classList.toggle("on",i<S.lights));
  {const bl=S.cars.filter(c=>c.blueT>0&&!c.removed).map(c=>c.drv.code);$("blueInfo").textContent=bl.length?bl.join(" · "):"keine";}
  if(!S.hazard)setAlert("",advice());}
function fitCanvases(){const d=Math.min(2,window.devicePixelRatio||1);
  for(const k of ["all","feed","cctv"]){const cv=CV[k],r=cv.getBoundingClientRect();if(r.width<50||r.height<50)continue;
    const w=Math.round(r.width*d),h=Math.round(r.height*d);if(getComputedStyle(cv).position!=="absolute")continue;
    cv._d=d;if(cv.width!==w||cv.height!==h){cv.width=w;cv.height=h;}}}
function beginCv(cv){const d=cv._d||1,c=cv.getContext("2d");c.setTransform(d,0,0,d,0,0);return [c,cv.width/d,cv.height/d];}
let lastT=performance.now();
/* Ein Fehler in Simulation oder Zeichnen darf die Schleife nicht stoppen (sonst bleibt alles schwarz) */
function frame(now){try{frameInner(now);}catch(e){frameErr(e);}requestAnimationFrame(frame);}
function frameErr(e){UI.errN=(UI.errN||0)+1;if(UI.errN<=3&&typeof console!=="undefined")console.error(e);if(UI.errBox)return;
  const d=document.createElement("div");d.style.cssText="position:fixed;left:50%;top:14px;transform:translateX(-50%);z-index:9999;background:#2a1212;border:1px solid #e10600;color:#fff;padding:10px 14px;border-radius:8px;font:13px system-ui;max-width:90vw";
  d.innerHTML=`<b>Race Control: Fehler beim Ausführen.</b> Meist hilft Neuladen ohne Cache (Mac: Cmd+Shift+R, Windows: Strg+F5).<br><small style="opacity:.7">${esc(String(e&&e.message||e))}</small>`;
  document.body.appendChild(d);UI.errBox=d;}
function frameInner(now){const rdt=Math.min(0.1,(now-lastT)/1000);lastT=now;
  if(S){
    if(FUN.t>=0){funFrame(rdt);return;}
    if(R.inc)rpFrame(rdt);
    else{UI.acc+=rdt*UI.speed;let n=0;while(UI.acc>=DT&&n<60){simStep(DT);UI.acc-=DT;n++;}if(n>=60)UI.acc=0;
      drawMonitors(rdt);}
    UI.saveT+=rdt;if(UI.saveT>12&&!R.inc&&UI.speed>0){UI.saveT=0;liveSave();}
    UI.towerT+=rdt;if(UI.towerT>0.25){UI.towerT=0;fitCanvases();uiTower();uiTop();uiFlags();drawRadar(CV.radar);$("wxText").innerHTML=wxText();}
  }}
showMenu();requestAnimationFrame(frame);
window.addEventListener("rc-cloud-updated",()=>{if(!S&&!$("overlay").classList.contains("show"))showMenu();});
window.__rc={get S(){return S;},get W(){return W;},UI,R,step:n=>{for(let i=0;i<n;i++)simStep(DT);},decide,openReplay,closeReplay,setNeutral};
