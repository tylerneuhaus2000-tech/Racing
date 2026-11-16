"use strict";
/* ============ Titelbildschirm im AAA-Stil: Attract-Mode im Hintergrund, Menü links, Infos rechts ============ */
const TT={on:false,raf:0,cars:[],shot:0,shotT:0,trk:null,t:0,idx:0,started:false,items:[]};
function ttCss(){if($("ttCss"))return;const st=document.createElement("style");st.id="ttCss";st.textContent=`
#title{position:fixed;inset:0;z-index:9;background:#030508;overflow:hidden;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#fff}
#title canvas{position:absolute;inset:0;width:100%;height:100%;filter:saturate(1.1) contrast(1.05)}
#title .vig{position:absolute;inset:0;background:radial-gradient(ellipse at 65% 50%,transparent 30%,rgba(0,0,0,.55) 70%,rgba(0,0,0,.9) 100%),linear-gradient(90deg,rgba(3,5,8,.96) 0%,rgba(3,5,8,.75) 32%,rgba(3,5,8,0) 62%);pointer-events:none}
#title .scan{position:absolute;inset:0;background:repeating-linear-gradient(0deg,rgba(255,255,255,.025) 0 1px,transparent 1px 3px);pointer-events:none;mix-blend-mode:overlay}
#title .wrap{position:absolute;inset:0;display:grid;grid-template-columns:minmax(380px,34%) 1fr minmax(300px,24%);padding:5vh 4vw;gap:2vw}
#title .logo{font-weight:900;font-style:italic;letter-spacing:.02em;line-height:.88;font-size:clamp(46px,6.2vw,104px);text-transform:uppercase;margin:0}
#title .logo span{display:block}#title .logo .r{color:#e10600;text-shadow:0 0 40px rgba(225,6,0,.45)}
#title .sub{margin-top:14px;font-size:13px;letter-spacing:.42em;text-transform:uppercase;color:#9aa6b6;display:flex;align-items:center;gap:12px}
#title .sub:before{content:"";width:46px;height:3px;background:#e10600;display:inline-block}
#title .menu2{margin-top:6vh;display:flex;flex-direction:column;gap:2px;opacity:0;transform:translateX(-30px);transition:all .6s cubic-bezier(.2,.8,.2,1)}
#title.ready .menu2{opacity:1;transform:none}
#title .mi{all:unset;cursor:pointer;position:relative;padding:13px 18px 13px 22px;font-weight:800;font-style:italic;font-size:clamp(20px,2vw,30px);text-transform:uppercase;letter-spacing:.04em;color:#cfd6df;transition:all .18s;clip-path:polygon(0 0,100% 0,96% 100%,0 100%)}
#title .mi small{display:block;font-size:12px;font-style:normal;font-weight:500;letter-spacing:.06em;text-transform:none;color:#7c8796;margin-top:2px;max-height:0;opacity:0;transition:all .2s;overflow:hidden}
#title .mi:before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;background:#e10600;transform:scaleY(0);transition:transform .18s}
#title .mi.sel{color:#fff;background:linear-gradient(90deg,rgba(225,6,0,.32),rgba(225,6,0,.04) 85%,transparent);padding-left:32px}
#title .mi.sel:before{transform:scaleY(1)}#title .mi.sel small{max-height:30px;opacity:1}
#title .mi[disabled]{opacity:.3;pointer-events:none}
#title .press{position:absolute;left:4vw;bottom:13vh;font-size:15px;letter-spacing:.5em;text-transform:uppercase;color:#e9ecef;animation:ttp 1.6s ease-in-out infinite}
#title.ready .press{display:none}
@keyframes ttp{0%,100%{opacity:.25}50%{opacity:1}}
#title .side{align-self:end;display:flex;flex-direction:column;gap:12px;opacity:0;transform:translateX(30px);transition:all .7s .15s cubic-bezier(.2,.8,.2,1)}
#title.ready .side{opacity:1;transform:none}
#title .card{background:rgba(10,14,20,.72);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.08);border-left:3px solid #e10600;padding:14px 16px;border-radius:4px}
#title .card h5{margin:0 0 8px;font-size:11px;letter-spacing:.3em;color:#8b96a6;text-transform:uppercase}
#title .card b{font-size:20px;font-style:italic;font-weight:800;text-transform:uppercase}
#title .card .row{display:flex;justify-content:space-between;font-size:12.5px;color:#b9c2ce;padding:3px 0;border-bottom:1px solid rgba(255,255,255,.05)}
#title .foot{position:absolute;left:0;right:0;bottom:0;display:flex;gap:26px;align-items:center;padding:12px 4vw;background:linear-gradient(0deg,rgba(0,0,0,.85),transparent);font-size:12px;color:#8b96a6;letter-spacing:.06em}
#title .foot kbd{display:inline-block;border:1px solid #4a5260;border-radius:4px;padding:1px 7px;margin-right:6px;color:#dfe5ec;font-family:ui-monospace,monospace;font-size:11px}
#title .ticker{flex:1;overflow:hidden;white-space:nowrap;mask-image:linear-gradient(90deg,transparent,#000 6%,#000 94%,transparent)}
#title .ticker span{display:inline-block;padding-left:100%;animation:tttk 38s linear infinite}
@keyframes tttk{to{transform:translateX(-100%)}}
#title .shot{position:absolute;right:4vw;top:5vh;font:700 11px ui-monospace,monospace;letter-spacing:.2em;color:#cfd6df;background:rgba(0,0,0,.45);padding:6px 10px;border-left:3px solid #e10600}
.overlay.ontitle{background:rgba(2,4,8,.55);backdrop-filter:blur(3px)}
#title .fade{position:absolute;inset:0;background:#000;opacity:1;transition:opacity 1.2s;pointer-events:none}
#title.vis .fade{opacity:0}
#title.dim .wrap,#title.dim .press,#title.dim .foot{opacity:0;pointer-events:none;transition:opacity .3s}
`;document.head.appendChild(st);}
function ttBuild(){ttCss();let el=$("title");if(el)return el;el=document.createElement("div");el.id="title";
  el.innerHTML=`<canvas id="ttCv"></canvas><div class="vig"></div><div class="scan"></div>
  <div class="wrap"><div><h1 class="logo"><span>Race</span><span class="r">Control</span></h1><div class="sub">Rennleitung · Saison 2026</div><div class="menu2" id="ttMenu"></div></div><div></div>
  <div class="side" id="ttSide"></div></div><div class="press">Taste drücken oder klicken</div><div class="shot" id="ttShot"></div>
  <div class="foot"><span><kbd>↑↓</kbd>Auswahl</span><span><kbd>Enter</kbd>Bestätigen</span><div class="ticker"><span id="ttTick"></span></div><span>v2026.11</span></div><div class="fade"></div>`;
  document.body.appendChild(el);return el;}
function ttItems(){const sv=loadSaves(),auto=sv.auto,n=Object.keys(sv).length;return [
  auto?{k:"cont",t:"Fortsetzen",s:`${auto.name} · ${auto.date}`,f:()=>{hideTitle();loadGame(auto.data);}}:null,
  (()=>{let d=false;try{d=localStorage.getItem("rc_tut")==="1";}catch(e){}return {k:"tut",t:"Tutorial",s:d?"Alle Funktionen der Rennleitung Schritt für Schritt erklärt":"★ Empfohlen für den Einstieg – alles Schritt für Schritt erklärt",f:()=>tutStart()};})(),
  {k:"season",t:"Saison",s:"Kompletter 2026er Kalender · WM, Fahrermarkt, Upgrades",f:()=>ttOpen(()=>menuSetup("season"))},
  {k:"single",t:"Einzelrennen",s:`Ein Wochenende auf einer von ${Object.keys(TRACKS).length} Strecken`,f:()=>ttOpen(()=>menuSetup("single"))},
  {k:"load",t:"Spielstand laden",s:n?`${n} Spielstand${n>1?"e":""} gespeichert`:"Noch nichts gespeichert",dis:!n,f:()=>ttOpen(menuLoad)},
  {k:"rules",t:"Regelbuch",s:"Flaggen, Strafen, Startverfahren, Safety Car",f:()=>ttOpen(()=>{const m=$("modal");m.className="modal";m.innerHTML=`<h2>📖 Regelbuch</h2>${RULES}<button class="big go" id="clBtn">Zurück</button>`;$("overlay").classList.add("show");$("clBtn").onclick=()=>titleScreen();})}
].filter(Boolean);}
function ttOpen(fn){const el=$("title");el.classList.add("dim");fn();$("overlay").classList.add("show","ontitle");if(typeof sndEvent==="function")sndEvent("ok");}
function ttRender(){const items=TT.items=ttItems();TT.idx=Math.min(TT.idx,items.length-1);
  $("ttMenu").innerHTML=items.map((it,i)=>`<button class="mi${i===TT.idx?" sel":""}" data-i="${i}" ${it.dis?"disabled":""}>${esc(it.t)}<small>${esc(it.s)}</small></button>`).join("");
  $("ttMenu").querySelectorAll(".mi").forEach(b=>{const i=+b.dataset.i;b.onmouseenter=()=>ttSel(i);b.onclick=()=>{ttSel(i);items[i].f();};});
  ttSide();
  const news=["Neue Energieregeln 2026: Overtake Mode statt DRS","Stewards-Panel: Drei Stimmen, eine Entscheidung – deine","Strafpunkte verfallen nach 12 Monaten – bei 12 Punkten droht die Sperre","Regenradar mit Prognose: Wer früh reagiert, verhindert Aquaplaning-Chaos","Technische Abnahme nach jedem Rennen: Plank, Gewicht, Benzinprobe","Teams dürfen unter Rot Reifen wechseln und reparieren","Red Bull und Racing Bulls tauschen Fahrer nur mit Freigabe der Rennleitung"];
  $("ttTick").textContent=shuffle(news).join("   ◆   ");}
function ttSide(){const k=CAREER&&CAREER.type==="season"?CAREER:null,next=k?TRACKS[k.cal[Math.min(k.round,k.cal.length-1)]]:TRACKS[TT.trk]||TRACKS[CALENDAR[0]];
  const pts=k?standingsRows(k).slice(0,3):null;
  $("ttSide").innerHTML=`<div class="card"><h5>${k?"Nächster Grand Prix":"Live · Strecke"}</h5><b>${esc(next.name.split(" · ")[0])}</b><div style="color:#9aa6b6;font-size:12.5px;margin-top:3px">${[next.name.split(" · ")[1],next.len?(next.len/1000).toFixed(3)+" km":"",next.laps?next.laps+" Runden":""].filter(Boolean).map(esc).join(" · ")}</div></div>
   ${pts?`<div class="card"><h5>WM-Stand · ${k.year||2026}</h5>${pts.map((r,i)=>`<div class="row"><span>${i+1}. <span style="color:${r.d.color}">■</span> ${esc(r.d.name)}</span><b style="font-size:13px">${r.p}</b></div>`).join("")}</div>`:""}
   <div class="card"><h5>Deine Rennleitung</h5><div class="row"><span>Ansehen</span><b style="font-size:13px">${k&&k.rep!=null?Math.round(k.rep):"–"}</b></div><div class="row"><span>Entscheidungen</span><b style="font-size:13px">${k&&k.dec?k.dec.total:0}</b></div><div class="row"><span>Seltene Ereignisse erlebt</span><b style="font-size:13px">${k&&k.rare?Object.keys(k.rare).length:0} / ${typeof RARE!=="undefined"?RARE.length:12}</b></div></div>`;
}
function ttSel(i){if(i===TT.idx)return;TT.idx=i;document.querySelectorAll("#ttMenu .mi").forEach((b,j)=>b.classList.toggle("sel",j===i));if(typeof sndEvent==="function")sndEvent("tick");}
function ttKey(e){const el=$("title");if(!TT.on||el.classList.contains("dim"))return;
  if(!el.classList.contains("ready")){el.classList.add("ready");TT.started=true;if(typeof sndInit==="function")sndInit();e.preventDefault();return;}
  const n=TT.items.length;let i=TT.idx;
  if(e.key==="ArrowDown"){do{i=(i+1)%n;}while(TT.items[i].dis);ttSel(i);e.preventDefault();}
  else if(e.key==="ArrowUp"){do{i=(i-1+n)%n;}while(TT.items[i].dis);ttSel(i);e.preventDefault();}
  else if(e.key==="Enter"){TT.items[TT.idx].f();e.preventDefault();}}
/* ---- Attract-Mode: zehn Autos fahren nachts über eine Strecke aus dem Kalender ---- */
function ttTrack(){const keys=CALENDAR.filter(k=>TRACKS[k]);const k=pick(keys.filter(x=>x!==TT.trk));setTrack(k);TT.trk=k;TT.pk=k;
  const ds=DRIVERS.slice(0,22);TT.cars=shuffle(ds).slice(0,10).map((d,i)=>({drv:d,s:L*0.3-i*rand(26,40),v:120,lat:0}));TT.shot=0;TT.shotT=0;TT.lap=0;}
function ttStep(dt){for(const c of TT.cars){const i=sidx(mod(c.s)),tg=(T.prof[i]||100)*(0.9+((c.drv.perf||1)<0.6?0.04:0));c.v+=(tg-c.v)*Math.min(1,dt*1.6);c.s+=c.v*dt*0.55;
    c.lat+=((T.line[i]||0)+(c.drv.slot?1.6:-1.6)-c.lat)*Math.min(1,dt*2);}
  TT.cars.sort((a,b)=>b.s-a.s);for(let i=1;i<TT.cars.length;i++){const a=TT.cars[i-1],b=TT.cars[i];if(a.s-b.s<17){b.s=a.s-17;b.v=Math.min(b.v,a.v);b.lat+=(b.lat>a.lat?1:-1)*dt*6;}}}
function ttFrame(){const n=TT.cars.length,a=new Float32Array(n*5);TT.cars.forEach((c,i)=>{const o=i*5;a[o]=c.s;a[o+1]=c.lat;a[o+2]=0;a[o+3]=c.v;a[o+4]=1|(T.prof[sidx(mod(c.s))]<c.v*0.97?4:0);});
  return {a,e:null,fm:"green",sec:[0,0,0],li:0,wet:0,rain:0,hz:null,px:0,t:TT.t};}
const SHOTS=[{n:"ONBOARD-CHASE",z:5,rot:true,dur:7},{n:"HELI · FELD",z:2.6,rot:false,dur:7},{n:"TV · KURVENAUSGANG",z:5.5,rot:false,dur:6},{n:"HELI · SPITZE",z:3.6,rot:false,dur:6}];
function ttLoop(ts){if(!TT.on)return;const cv=$("ttCv"),dpr=Math.min(2,window.devicePixelRatio||1),W_=cv.clientWidth,H_=cv.clientHeight;
  if(cv.width!==Math.round(W_*dpr)){cv.width=Math.round(W_*dpr);cv.height=Math.round(H_*dpr);}
  if(TRACK&&TRACK.key!==TT.pk){P=buildPaths();refreshCOI();TT.pk=TT.trk=TRACK.key;ttSide();}   // Strecke in der Vorschau gewählt → Hintergrund zeigt sie
  const dt=Math.min(0.05,(ts-(TT.last||ts))/1000);TT.last=ts;TT.t+=dt;ttStep(dt);TT.shotT+=dt;
  const sh=SHOTS[TT.shot%SHOTS.length];if(TT.shotT>sh.dur){TT.shotT=0;TT.shot++;if(TT.shot%8===0){ttTrack();ttSide();}}
  const fr=ttFrame(),ro=TT.cars.map(c=>({drv:c.drv})),c=cv.getContext("2d");c.setTransform(dpr,0,0,dpr,0,0);
  const foc=(TT.shot*3)%Math.min(4,TT.cars.length);let cam;
  if(sh.z===0)cam=typeof camFit==="function"?camFit(W_*0.9,H_*0.9):{x:0,y:0,z:0.3,rot:0};
  else{cam=camCar(fr,foc,sh.z*(1+0.05*Math.sin(TT.t*0.4)),sh.rot);if(sh.n.startsWith("TV")){const q=posXY(fr.a[foc*5]+30,0);cam.x=q.x;cam.y=q.y;}if(!sh.rot)cam.x-=0.16*W_/cam.z;}   // Motiv rechts der Menüspalte
  try{drawScene(c,W_,H_,cam,fr,ro,{bg:"#04070a",labels:"none"});}catch(e){}
  const tx=$("ttShot");if(tx)tx.textContent=`${sh.n} · ${TRACKS[TT.trk].name.split(" · ")[0].toUpperCase()}`;
  TT.raf=requestAnimationFrame(ttLoop);}
function titleScreen(){const el=ttBuild();el.classList.remove("dim");el.style.display="block";$("overlay").classList.remove("show");
  if(!TT.on){TT.on=true;ttTrack();TT.last=0;TT.raf=requestAnimationFrame(ttLoop);requestAnimationFrame(()=>el.classList.add("vis"));}
  ttRender();if(TT.started)el.classList.add("ready");
  if(!TT.bound){TT.bound=true;window.addEventListener("keydown",ttKey);el.addEventListener("click",e=>{if(!el.classList.contains("ready")){el.classList.add("ready");TT.started=true;if(typeof sndInit==="function")sndInit();}});}
  el.addEventListener("transitionend",()=>{},{once:true});}
function hideTitle(){$("overlay").classList.remove("ontitle");const el=$("title");if(!el)return;TT.on=false;cancelAnimationFrame(TT.raf);el.style.display="none";el.classList.remove("vis");}
