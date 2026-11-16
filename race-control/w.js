"use strict";
/* ============ Regen: stehendes Wasser, Aquaplaning, Radar-Prognose ============ */
/* Pfützen liegen fest pro Strecke (Senken auf Geraden vor Bremszonen und am Kurvenausgang) */
function mkPuddles(){const out=[];let seed=0;for(const ch of TRACK.key)seed=(seed*31+ch.charCodeAt(0))%9973;
  const rnd=()=>{seed=(seed*16807)%2147483647;return (seed%10000)/10000;};
  const cand=[];for(const co of CORNERS){if(co.kmax<0.009)continue;
    cand.push({s:mod(co.s-60-rnd()*90),lat:(rnd()-0.5)*14});           // Bremszone
    if(rnd()<0.5)cand.push({s:mod(co.s+55+rnd()*60),lat:(rnd()-0.5)*16});}      // Kurvenausgang
  const n=Math.min(cand.length,4+Math.floor(rnd()*3));
  for(let i=0;i<n&&cand.length;i++){const k=Math.floor(rnd()*cand.length),p=cand.splice(k,1)[0];
    if(p.s>PIT_ENTRY_S-120||p.s<PIT_EXIT_S+80)continue;
    out.push({s:p.s,lat:p.lat,len:28+rnd()*34,w:4.5+rnd()*4});}
  return out;}
/* Wassertiefe 0–1: entsteht erst bei viel Regen und nasser Strecke, trocknet langsamer ab als die Linie */
function pudDepth(wet,rain){return clamp((wet-0.42)*1.9+Math.max(0,rain-0.55)*0.8,0,1);}
function aquaStep(c,dt){
  if(c.aquaT>0)c.aquaT-=dt;
  if(!S.pud||!S.pud.length||c.pit||c.crash||c.spinT>0||c.removed||c.mode==="garage")return false;
  const d=pudDepth(S.wx.wet,S.wx.rain);if(d<0.1){c._pud=null;return false;}
  for(const p of S.pud){const rel=mod(c.pos-p.s);
    if(rel<p.len&&Math.abs(c.lat-p.lat)<p.w+CAR_W*0.35){if(c._pud===p)return false;c._pud=p;
      const tc=tyreClass(c.tyre),tk=tc==="dry"?0.6:tc==="I"?0.06*(1+c.wear*1.5):0.012;
      const sp=clamp((c.v-58)/50,0,1.5),neut=S.flag.mode==="sc"||S.flag.mode==="vsc"?0.15:1;
      const pr=tk*Math.pow(d,1.4)*sp*sp*(0.75+(c.drv.style||0.5)*0.6)*neut*(S.type==="race"?1:0.7);
      c.aquaT=Math.max(c.aquaT||0,d>0.35&&c.v>70?0.5:0);                // Gischt beim Durchfahren
      if(Math.random()>=pr)return false;
      return aquaEvent(c,d);}}
  if(c._pud&&mod(c.pos-c._pud.s)>c._pud.len+10)c._pud=null;
  return false;}
function aquaEvent(c,d){const dir=Math.random()<0.5?1:-1,r=Math.random(),co=nextCorner(c.pos,0)||CORNERS[0];
  c.aquaT=2.2;c.ot=null;S.aquaLog=(S.aquaLog||[]).filter(t=>S.t-t<70);S.aquaLog.push(S.t);
  addLog(`AQUAPLANING – CAR ${c.drv.num} (${c.drv.code}) bei ${Math.round(c.v*KMH)} km/h`,"flag");
  if(r<0.5-d*0.15){                                                     // aufschwimmen, eingefangen
    c.wob={t:0,T:1.9,amp:rand(0.75,1.15)*dir};c.lockT=0.9;c.v*=0.78;c.latV=(c.latV||0)+dir*rand(4,7);
    radio(c,pick(["AQUAPLANING! Das Auto ist komplett aufgeschwommen!","Ich bin nur noch Passagier, da steht Wasser!","Riesige Pfütze – ich hatte null Kontrolle, Glück gehabt."]),true);
    registerInc({kind:"info",title:`Aquaplaning · ${c.drv.code}`,cars:[c],pos:c.pos,pre:4,post:4});return false;}
  if(r<0.86){c.spinCo=co;spinCar(c,dir*SIDE,-dir,Math.random()<0.6?"off":null);   // Dreher auf dem Wasserfilm
    radio(c,pick(["Aquaplaning, ich hab mich gedreht! Da steht ein See!","Weg war es – das Auto hat einfach abgehoben."]),true);
    registerInc({kind:"info",title:`Aquaplaning-Dreher · ${c.drv.code}`,cars:[c],pos:c.pos,pre:5,post:4});return true;}
  c.soloArm={crash:true};soloEvent(c,co);                               // geradeaus in die Mauer
  registerInc({kind:"info",title:`Aquaplaning-Unfall · ${c.drv.code}`,cars:[c],pos:c.pos,pre:5,post:4});
  return true;}
/* Stehendes Wasser auf dem Asphalt zeichnen */
function drawPuddles(ctx,fr){if(!S||!S.pud)return;const d=pudDepth(fr.wet||0,fr.rain||0);if(d<0.05)return;
  for(const p of S.pud){const L1=[],R1=[],N=8;
    for(let i=0;i<=N;i++){const u=i/N,f=Math.sin(Math.PI*u)*(0.55+0.45*Math.sin(u*7+p.s));
      const a=posXY(p.s+u*p.len,p.lat+p.w*f*(0.6+d*0.5)),b=posXY(p.s+u*p.len,p.lat-p.w*f*(0.6+d*0.5));L1.push(a);R1.push(b);}
    ctx.beginPath();ctx.moveTo(L1[0].x,L1[0].y);for(const q of L1)ctx.lineTo(q.x,q.y);for(let i=R1.length-1;i>=0;i--)ctx.lineTo(R1[i].x,R1[i].y);ctx.closePath();
    ctx.fillStyle=`rgba(30,60,92,${(0.35+0.4*d).toFixed(3)})`;ctx.fill();
    ctx.strokeStyle=`rgba(170,205,240,${(0.25*d).toFixed(3)})`;ctx.lineWidth=0.6;ctx.stroke();}}
/* Brennendes Auto (Flag-Bit 1<<21): Flammen, Rauch, Löschpulver gegen Ende */
function drawFire(ctx,fr,n){const t=fr.t||0;for(let k=0;k<n;k++){const o=k*5,fl=fr.a[o+4];if(!(fl&1)||!(fl&(1<<21)))continue;
  const q=posXY(fr.a[o],fr.a[o+1]);
  for(let m=0;m<10;m++){const a=t*1.3+m*0.9+k,r=5+((t*7+m*13)%14);ctx.fillStyle=`rgba(40,40,44,${(0.35*(1-r/20)).toFixed(3)})`;ctx.beginPath();ctx.arc(q.x+Math.cos(a)*2+r*0.9,q.y-r*0.7+Math.sin(a*1.7)*2,3+r*0.45,0,7);ctx.fill();}
  for(let m=0;m<9;m++){const j=Math.sin(t*23+m*2.1+k)*1.6,h=3+Math.abs(Math.sin(t*17+m))*4;
    ctx.fillStyle=m%3===0?"rgba(255,230,120,0.9)":m%3===1?"rgba(255,140,30,0.85)":"rgba(230,60,20,0.8)";ctx.beginPath();ctx.ellipse(q.x-4+m*1+j,q.y-1-h*0.4,1.6,h*0.6,0,0,7);ctx.fill();}}}
/* Gischtwolke beim Aquaplaning (Flag-Bit 1<<20) */
function drawAquaSpray(ctx,fr,n){for(let k=0;k<n;k++){const o=k*5,fl=fr.a[o+4];if(!(fl&1)||!(fl&(1<<20)))continue;
  const q=posXY(fr.a[o],fr.a[o+1]),h=q.ang+fr.a[o+2],cx=Math.cos(h),sx=Math.sin(h),t=fr.t||0;
  for(let m=0;m<14;m++){const lx=-6-m*2.4,ly=Math.sin(m*1.9+t*9+k)*(2+m*0.7),r=2.5+m*0.9;
    ctx.fillStyle=`rgba(225,235,248,${(0.42*(1-m/15)).toFixed(3)})`;ctx.beginPath();ctx.arc(q.x+lx*cx-ly*sx,q.y+lx*sx+ly*cx,r,0,7);ctx.fill();}
  for(const sgn of [-1,1]){ctx.fillStyle="rgba(235,242,252,0.5)";ctx.beginPath();ctx.arc(q.x+(-1)*cx-sgn*5*sx,q.y+(-1)*sx+sgn*5*cx,3.2,0,7);ctx.fill();}}}
/* Radar-Prognose: Regenstärke an der Strecke für die nächsten Minuten (Spielzeit) */
function wxForecast(steps,dt){const wx=S.wx,cs=wx.cells.map(c=>({x:c.x,y:c.y,r:c.r,int:c.int})),vx=Math.cos(wx.wind)*wx.spd,vy=Math.sin(wx.wind)*wx.spd,out=[];
  for(let i=0;i<steps;i++){let rain=0;for(const c of cs){c.x+=vx*dt;c.y+=vy*dt;const dd=Math.hypot(c.x,c.y);if(dd<c.r)rain=Math.max(rain,c.int*clamp((1-dd/c.r)*2.2,0,1));}out.push(rain);}
  return out;}
const gCS=()=>(W&&W.cs)||1;
function drawForecast(c,Wd,H){const W_=Wd,st=24,dt=15,f=wxForecast(st,dt),bw=(W_-60)/st,y0=H-8,hh=34,cs=gCS();
  c.fillStyle="#000a";c.fillRect(0,H-hh-22,W_,hh+22);c.fillStyle="#9fb3c8";c.font="10px ui-monospace,monospace";
  c.fillText("Prognose Strecke",6,H-hh-10);c.fillText("jetzt",30,y0+0);c.fillText(`+${Math.round(st*dt*cs/60)} min`,W_-44,y0);
  for(let i=0;i<st;i++){const v=f[i],unc=Math.min(1,i/st*0.9);if(v<0.02)continue;
    const col=v>0.75?"255,70,50":v>0.45?"255,210,0":"60,200,110";
    c.fillStyle=`rgba(${col},${(0.95-unc*0.55).toFixed(2)})`;const h=Math.max(2,v*hh*0.8);c.fillRect(30+i*bw,y0-12-h,bw-1,h);}
  const pk=f.indexOf(Math.max(...f));if(f[pk]>0.6){c.fillStyle="#ff8a7a";c.fillText(`Starkregen ~${Math.round(pk*dt*cs/60)} min · Aquaplaning-Gefahr`,120,H-hh-10);}}
/* ============ Regen pro Sektor (Zellen treffen Teile der Strecke unterschiedlich) ============ */
let RPTS=null,RPTSkey=null;
function radarPts(){if(RPTSkey===TRACK.key&&RPTS)return RPTS;const kk=90/Math.max(TB.x1-TB.x0,TB.y1-TB.y0),cx=(TB.x0+TB.x1)/2,cy=(TB.y0+TB.y1)/2,out=[];
  for(let j=0;j<120;j++){const i=Math.floor(j*NU/120),s=i*DS;out.push({x:(T.x[i]-cx)*kk,y:(T.y[i]-cy)*kk,sec:sectorOf(s),s});}RPTS=out;RPTSkey=TRACK.key;return out;}
/* Zellen sind keine Kreise: ausgefranste, in Windrichtung gestreckte Formen mit Kernen */
function cellShape(c){if(!c.lob){c.lob=[0,1,2].map(()=>({k:irand(2,6),a:rand(0.07,0.2),p:rand(0,6.28)}));c.el=rand(1.1,1.9);c.cores=[0,1,2,3].slice(0,irand(1,4)).map(()=>({dx:rand(-0.45,0.45),dy:rand(-0.35,0.35),r:rand(0.18,0.38),f:rand(1.05,1.3)}));}return c;}
function cellNorm(c,x,y){cellShape(c);const w=S&&S.wx?S.wx.wind:0,dx=x-c.x,dy=y-c.y,ca=Math.cos(w),sa=Math.sin(w),u=(dx*ca+dy*sa)/c.el,v=-dx*sa+dy*ca,th=Math.atan2(v,u);
  let m=1;for(const l of c.lob)m+=l.a*Math.sin(l.k*th+l.p);return Math.hypot(u,v)/(c.r*m);}       // <1 = innerhalb
function cellInt(c,x,y){const q=cellNorm(c,x,y);if(q>=1)return 0;let v=c.int*clamp((1-q)*2.2,0,1);
  const w=S&&S.wx?S.wx.wind:0,ca=Math.cos(w),sa=Math.sin(w);for(const k of c.cores){const cx=c.x+(k.dx*ca-k.dy*sa)*c.r,cy=c.y+(k.dx*sa+k.dy*ca)*c.r,d=Math.hypot(x-cx,y-cy)/(k.r*c.r);if(d<1)v=Math.max(v,Math.min(1,c.int*k.f*(1-d*0.6)));}
  return v;}
const rainAt=(cells,x,y)=>{let r=0;for(const c of cells)r=Math.max(r,cellInt(c,x,y));return r;};
function cellPath(ctx,k,sc){cellShape(k);const w=S.wx.wind,ca=Math.cos(w),sa=Math.sin(w);ctx.beginPath();
  for(let i=0;i<=48;i++){const th=i/48*6.2832;let m=1;for(const l of k.lob)m+=l.a*Math.sin(l.k*th+l.p);const u=Math.cos(th)*k.r*m*k.el,v=Math.sin(th)*k.r*m;
    const x=(k.x+u*ca-v*sa)*sc,y=(k.y+u*sa+v*ca)*sc;i?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.closePath();}
function drawCell(ctx,k,sc,alpha){const col=rcol(k.int),R=k.r*k.el*sc;const g=ctx.createRadialGradient(k.x*sc,k.y*sc,0,k.x*sc,k.y*sc,R);
  g.addColorStop(0,`rgba(${col},${0.75*alpha})`);g.addColorStop(0.6,`rgba(${col},${0.4*alpha})`);g.addColorStop(1,`rgba(${col},0)`);ctx.fillStyle=g;cellPath(ctx,k,sc);ctx.fill();
  const w=S.wx.wind,ca=Math.cos(w),sa=Math.sin(w);for(const o of k.cores){const cx=(k.x+(o.dx*ca-o.dy*sa)*k.r)*sc,cy=(k.y+(o.dx*sa+o.dy*ca)*k.r)*sc,rr=o.r*k.r*sc,cc=rcol(Math.min(1,k.int*o.f));
    const g2=ctx.createRadialGradient(cx,cy,0,cx,cy,rr);g2.addColorStop(0,`rgba(${cc},${0.8*alpha})`);g2.addColorStop(1,`rgba(${cc},0)`);ctx.fillStyle=g2;ctx.beginPath();ctx.arc(cx,cy,rr,0,7);ctx.fill();}}
function secRain(wx,dt){const P=radarPts(),rs=[0,0,0],n=[0,0,0],ws=[0,0,0];if(!wx.wp||wx.wp.length!==P.length)wx.wp=P.map(()=>wx.wet);
  P.forEach((p,i)=>{const r=rainAt(wx.cells,p.x,p.y),tg=Math.min(1,r*1.25);rs[p.sec]+=r;n[p.sec]++;
    wx.wp[i]=clamp(wx.wp[i]+(tg>wx.wp[i]?0.035:-0.012*(0.7+0.6*((i*37)%11)/10))*dt,0,1);ws[p.sec]+=wx.wp[i];});   // jede Stelle trocknet etwas anders ab
  for(let k=0;k<3;k++){rs[k]/=Math.max(1,n[k]);ws[k]/=Math.max(1,n[k]);}wx.rs=rs;wx.ws=ws;
  wx.wet=(wx.ws[0]+wx.ws[1]+wx.ws[2])/3;wx.rain=0.5*Math.max(rs[0],rs[1],rs[2])+0.5*(rs[0]+rs[1]+rs[2])/3;}
/* Prognose: Zellen bewegen sich mit dem Wind, Unsicherheit wächst mit der Vorlaufzeit */
function cellsAt(wx,t){const vx=Math.cos(wx.wind)*wx.spd,vy=Math.sin(wx.wind)*wx.spd,T_=Math.max(1,t);
  return wx.cells.map(c=>(cellShape(c),{x:c.x+vx*t,y:c.y+vy*t,r:c.r*(1+0.0009*t),int:c.int*(1-Math.min(0.25,t*0.0004)),u:Math.min(1,T_/900),lob:c.lob,el:c.el,cores:c.cores}));}
function secForecast(wx,t){const P=radarPts(),cs=cellsAt(wx,t),rs=[0,0,0],n=[0,0,0];for(const p of P){rs[p.sec]+=rainAt(cs,p.x,p.y);n[p.sec]++;}return rs.map((v,k)=>v/Math.max(1,n[k]));}

/* ============ Großes Regenradar mit Zeitstrahl ============ */
const RDR={t:0,play:false,zoom:1,raf:0,px:0,py:0};
function openRadar(){if(!S)return;const m=$("modal");m.className="modal wide";RDR.t=0;RDR.play=false;
  m.innerHTML=`<h2>🌧 Regenradar & Prognose</h2>
   <div style="display:flex;gap:8px;align-items:center;margin-bottom:6px"><button class="ghost" id="rdPlay">▶ Abspielen</button>
   <input type="range" id="rdT" min="0" max="1200" step="5" value="0" style="flex:1"><b id="rdLbl" style="min-width:150px;text-align:right">jetzt</b>
   <button class="ghost" id="rdZ">Zoom: Umgebung</button></div>
   <canvas id="rdBig" width="1000" height="420" style="width:100%;border-radius:8px;background:#06110b"></canvas>
   <canvas id="rdTl" width="1000" height="120" style="width:100%;margin-top:6px;border-radius:8px;background:#0b1118"></canvas>
   <div id="rdTxt" class="hint" style="margin-top:6px;line-height:1.6"></div>
   <button class="big" style="background:#3a3f48" id="rdClose">Schließen</button>`;
  $("overlay").classList.add("show");
  $("rdT").oninput=e=>{RDR.t=+e.target.value;RDR.play=false;$("rdPlay").textContent="▶ Abspielen";};
  $("rdPlay").onclick=()=>{RDR.play=!RDR.play;if(RDR.play&&RDR.t>=1200)RDR.t=0;$("rdPlay").textContent=RDR.play?"⏸ Pause":"▶ Abspielen";};
  $("rdZ").onclick=()=>{const tr=RDR.zoom<4;RDR.zoom=tr?8:1;RDR.px=0;RDR.py=0;$("rdZ").textContent=tr?"Zoom: Strecke":"Zoom: Umgebung";};
  const cv=$("rdBig");cv.style.cursor="grab";
  cv.addEventListener("wheel",e=>{e.preventDefault();const r=cv.getBoundingClientRect(),mx=(e.clientX-r.left)*cv.width/r.width-cv.width/2,my=(e.clientY-r.top)*cv.height/r.height-cv.height/2,
    z0=RDR.zoom,z1=clamp(z0*(e.deltaY<0?1.2:1/1.2),0.6,60),s0=radScale(z0),s1=radScale(z1);
    const wx=(mx-RDR.px)/s0,wy=(my-RDR.py)/s0;RDR.zoom=z1;RDR.px=mx-wx*s1;RDR.py=my-wy*s1;$("rdZ").textContent=z1>=4?"Zoom: Strecke":"Zoom: Umgebung";},{passive:false});
  let drag=null;cv.addEventListener("mousedown",e=>{drag=[e.clientX,e.clientY,RDR.px,RDR.py];cv.style.cursor="grabbing";});
  window.addEventListener("mouseup",()=>{drag=null;if($("rdBig"))$("rdBig").style.cursor="grab";});
  cv.addEventListener("mousemove",e=>{if(!drag)return;const r=cv.getBoundingClientRect(),k=cv.width/r.width;RDR.px=drag[2]+(e.clientX-drag[0])*k;RDR.py=drag[3]+(e.clientY-drag[1])*k;});
  $("rdClose").onclick=()=>{cancelAnimationFrame(RDR.raf);RDR.raf=0;$("overlay").classList.remove("show");};
  const loop=()=>{if(!$("rdBig")){RDR.raf=0;return;}if(RDR.play){RDR.t=Math.min(1200,RDR.t+4);$("rdT").value=RDR.t;if(RDR.t>=1200){RDR.play=false;$("rdPlay").textContent="▶ Abspielen";}}
    drawBigRadar();RDR.raf=requestAnimationFrame(loop);};cancelAnimationFrame(RDR.raf);loop();}
const rcol=v=>v>0.75?"255,70,50":v>0.45?"255,200,0":v>0.12?"60,200,110":"90,140,255";
function radScale(z){const cv=$("rdBig");return (Math.min(cv.width,cv.height)/1500)*z;}
function drawBigRadar(){const cv=$("rdBig"),c=cv.getContext("2d"),Wd=cv.width,H=cv.height,wx=S.wx,cs=gCS(),t=RDR.t,sc=radScale(RDR.zoom);
  c.fillStyle="#06110b";c.fillRect(0,0,Wd,H);c.save();c.translate(Wd/2+RDR.px,H/2+RDR.py);
  c.strokeStyle="#143322";c.lineWidth=1;for(let r=100;r<=1200;r+=100){c.beginPath();c.arc(0,0,r*sc,0,7);c.stroke();}
  const cells=cellsAt(wx,t);
  for(const k of cells){drawCell(c,k,sc,1-k.u*0.4);
    if(k.u>0.15){c.setLineDash([4,4]);c.strokeStyle=`rgba(${rcol(k.int)},0.4)`;cellPath(c,Object.assign({},k,{r:k.r*(1+k.u*0.35)}),sc);c.stroke();c.setLineDash([]);}}   // Unsicherheitsbereich
  const P=radarPts();c.lineCap="round";
  c.lineWidth=Math.max(3,1.6*sc+2);c.strokeStyle="#1b232c";c.beginPath();P.forEach((p,i)=>i?c.lineTo(p.x*sc,p.y*sc):c.moveTo(p.x*sc,p.y*sc));c.closePath();c.stroke();
  c.lineWidth=Math.max(2,1.1*sc+1);
  for(let i=0;i<P.length;i++){const a=P[i],b=P[(i+1)%P.length],v=rainAt(cells,a.x,a.y),w=t===0&&wx.wp?wx.wp[i]:0;
    c.strokeStyle=v>=0.04?`rgb(${rcol(v)})`:w>0.05?`rgb(${Math.round(200-150*w)},${Math.round(215-110*w)},${Math.round(235)})`:"rgb(235,235,235)";c.beginPath();c.moveTo(a.x*sc,a.y*sc);c.lineTo(b.x*sc,b.y*sc);c.stroke();}
  if(sc>2.5){const kk=90/Math.max(TB.x1-TB.x0,TB.y1-TB.y0),cx=(TB.x0+TB.x1)/2,cy=(TB.y0+TB.y1)/2;c.font=`${Math.min(14,6+sc*0.4)}px ui-monospace,monospace`;
    for(const co of CORNERS){const i=sidx(co.s),x=(T.x[i]-cx)*kk*sc,y=(T.y[i]-cy)*kk*sc;c.fillStyle="#cfd8e3";c.fillText(co.num,x+5,y-5);}
    if(S.pud){const d=pudDepth(wx.wet,wx.rain);if(d>0.05)for(const p of S.pud){const i=sidx(p.s),x=(T.x[i]-cx)*kk*sc,y=(T.y[i]-cy)*kk*sc;c.fillStyle=`rgba(80,150,255,${0.4+0.5*d})`;c.beginPath();c.arc(x,y,3+sc*0.15,0,7);c.fill();}}}
  c.fillStyle="#fff";c.font="bold 12px ui-monospace,monospace";for(let k=0;k<3;k++){const p=P.find(q=>q.sec===k&&Math.abs(q.s-(SECB[k]+SECB[k+1])/2)<L/40)||P.find(q=>q.sec===k);if(p)c.fillText("S"+(k+1),p.x*sc+6,p.y*sc-6);}
  c.fillStyle="#f2c94c";c.beginPath();c.arc(P[0].x*sc,P[0].y*sc,4,0,7);c.fill();
  c.restore();
  c.strokeStyle="#7fb0ff";c.fillStyle="#7fb0ff";c.lineWidth=2;const ax=40,ay=40;c.beginPath();c.moveTo(ax-Math.cos(wx.wind)*18,ay-Math.sin(wx.wind)*18);c.lineTo(ax+Math.cos(wx.wind)*18,ay+Math.sin(wx.wind)*18);c.stroke();c.beginPath();c.arc(ax+Math.cos(wx.wind)*18,ay+Math.sin(wx.wind)*18,4,0,7);c.fill();
  c.font="12px ui-monospace,monospace";c.fillText(`Wind ${Math.round(wx.windKmh||0)} km/h · Zellen ziehen mit ${Math.round(wx.spd*3.6*cs)} km/h`,66,44);
  const lead=t*cs/60;$("rdLbl").textContent=t?`+${Math.floor(lead)}:${String(Math.round((lead%1)*60)).padStart(2,"0")} min${lead>1?` (±${Math.max(0.5,lead*0.15).toFixed(1)} min)`:""}`:"jetzt";
  /* Zeitstrahl: Regen je Sektor */
  const tc=$("rdTl"),g=tc.getContext("2d"),TW=tc.width,TH=tc.height,N=120,rows=["S1","S2","S3"];g.fillStyle="#0b1118";g.fillRect(0,0,TW,TH);
  const fc=[];for(let i=0;i<=N;i++)fc.push(secForecast(wx,i*1200/N));const rh=(TH-30)/3;
  for(let k=0;k<3;k++){g.fillStyle="#9fb3c8";g.font="11px ui-monospace,monospace";g.fillText(rows[k],6,14+k*rh+rh/2);
    for(let i=0;i<N;i++){const v=fc[i][k];if(v<0.03)continue;const unc=i/N;g.fillStyle=`rgba(${rcol(v)},${(0.95-unc*0.5).toFixed(2)})`;g.fillRect(36+i*(TW-46)/N,6+k*rh+rh*(1-Math.min(1,v)),(TW-46)/N+0.5,rh*Math.min(1,v)-2);}}
  const xm=36+t/1200*(TW-46);g.strokeStyle="#fff";g.beginPath();g.moveTo(xm,0);g.lineTo(xm,TH-22);g.stroke();
  g.fillStyle="#9fb3c8";for(let m=0;m<=4;m++){const x=36+m/4*(TW-46);g.fillText(`+${Math.round(m*300*cs/60)} min`,x-12,TH-6);}
  /* Klartext-Prognose */
  const txt=[0,1,2].map(k=>{let st=-1,pk=0,pt=0,en=-1;for(let i=0;i<=N;i++){const v=fc[i][k];if(v>0.1&&st<0)st=i;if(v>pk){pk=v;pt=i;}if(st>=0&&en<0&&i>pt&&v<0.08)en=i;}
    const mn=i=>Math.round(i*1200/N*cs/60);if(st<0)return `<b>S${k+1}</b>: kein Regen in Sicht`;
    return `<b>S${k+1}</b>: ${st===0?"Regen jetzt":`Regen ab ca. ${mn(st)} min`}, Höhepunkt ${pk>0.75?"<b style='color:#ff6b5a'>stark</b>":pk>0.45?"<b style='color:#f2c94c'>mittel</b>":"leicht"} nach ~${mn(pt)} min${en>0?`, vorbei nach ~${mn(en)} min`:""}`;});
  $("rdTxt").innerHTML=txt.join("<br>")+`<br><span style="opacity:.7">Mausrad: zoomen · ziehen: verschieben. Bei „jetzt“ zeigt die Strecke die aktuelle Nässe (hellblau feucht → dunkelblau nass), blaue Punkte = stehendes Wasser. Je weiter in der Zukunft, desto unsicherer: gestrichelte Ringe zeigen den möglichen Bereich der Zelle.</span>`;}
