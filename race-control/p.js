"use strict";
/* ===== Cockpit-Perspektive: echte Perspektivprojektion der Strecke aus Fahrersicht ===== */
function drawPOV(ctx,W,H,fr,roster,k){
  const o=k*5,q=posXY(fr.a[o],fr.a[o+1]),hd=q.ang+fr.a[o+2],ch=Math.cos(hd),sh=Math.sin(hd);
  const ex=q.x+ch*1.5,ey=q.y+sh*1.5,EYE=2.5,f=W*0.62,y0=H*0.43,night=NIGHT.has(TRACK.key),wet=fr.wet||0,v=Math.max(0,fr.a[o+3]);
  const bob=Math.sin(fr.t*31)*Math.min(1.6,v/110);
  ctx.save();if(fr.nk){const sh=nukeShake(fr);ctx.translate(sh[0],sh[1]);}
  const pr=(x,y,h)=>{const dx=x-ex,dy=y-ey,z=dx*ch+dy*sh,xr=-dx*sh+dy*ch;return z<1.2?null:[W/2+f*xr/z,y0+bob+f*(EYE-(h||0))/z,z];};
  // Himmel und Boden
  let g=ctx.createLinearGradient(0,0,0,y0);if(night){g.addColorStop(0,"#02040a");g.addColorStop(1,"#141c2e");}else if(wet>0.2){g.addColorStop(0,"#56606c");g.addColorStop(1,"#9aa3ad");}else{g.addColorStop(0,"#3c7fd0");g.addColorStop(1,"#bcdcf5");}
  ctx.fillStyle=g;ctx.fillRect(0,0,W,y0+3);ctx.fillStyle=night?"#0a1710":"#1c4a2a";ctx.fillRect(0,y0+bob,W,H);
  const i0=sidx(mod(fr.a[o])),N=Math.min(190,Math.round(560/DS));
  const pt=(j,lat)=>{const a=T.ang[j],l=SIDE*lat;return [T.x[j]-Math.sin(a)*l,T.y[j]+Math.cos(a)*l];};
  const quad=(a,b,c2,d,col)=>{if(!a||!b||!c2||!d)return;ctx.fillStyle=col;ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.lineTo(c2[0],c2[1]);ctx.lineTo(d[0],d[1]);ctx.fill();};
  const fl=fr.fm!=="green"?FLAGCOL[fr.fm]:null,asp=wet>0.2?"#30363f":night?"#2b2f38":"#3a3e46";
  const pitJ=j=>{const s=j*DS;return s>PIT_ENTRY_S||s<PIT_EXIT_S;};
  for(let n=N;n>=-3;n--){const j=((i0+n)%NU+NU)%NU,j2=(j+1)%NU,P_=(lat,h)=>{const a=pt(j,lat),b=pt(j2,lat);return [pr(a[0],a[1],h),pr(b[0],b[1],h)];};
    const L3=P_(-31.5),L2=P_(-20.5),L1=P_(-17.5),L0=P_(-16.6),R0=P_(16.6),R1=P_(17.5),R2=P_(20.5),R3=P_(31.5),co=COI[j]>=0?CORNERS[COI[j]]:null,pj=pitJ(j);
    quad(L3[0],L3[1],R3[1],R3[0],night?"#18222a":"#25373c");                       // Auslaufzone
    if(co&&!pj){const gl=-co.dir>0?[P_(22.5),P_(30)]:[P_(-30),P_(-22.5)];quad(gl[0][0],gl[0][1],gl[1][1],gl[1][0],"#8d7d58");}   // Kiesbett außen
    if(pj)quad(P_(-44)[0],P_(-44)[1],L3[1],L3[0],"#30353d");                          // Boxengasse
    quad(L1[0],L1[1],R1[1],R1[0],asp);
    if(Math.abs(T.line[j])<14){const a=P_(T.line[j]-3.2),b=P_(T.line[j]+3.2);quad(a[0],a[1],b[1],b[0],wet>0.3?"rgba(170,200,230,.10)":"rgba(0,0,0,.14)");}   // Gummi auf der Ideallinie
    quad(L1[0],L1[1],L0[1],L0[0],"#f2f2f2");quad(R0[0],R0[1],R1[1],R1[0],"#f2f2f2");
    if(co&&!pj){const kc=(j>>1)%2?"#d62222":"#f4f4f4";quad(L2[0],L2[1],L1[1],L1[0],kc);quad(R1[0],R1[1],R2[1],R2[0],kc);}
    if(fl&&n%6<3){quad(L3[0],L3[1],P_(-29.5)[1],P_(-29.5)[0],fl);quad(P_(29.5)[0],P_(29.5)[1],R3[1],R3[0],fl);}
    // Leitplanken als senkrechte Wände
    const wl=P_(pj?-56:-31.5,0),wlt=P_(pj?-56:-31.5,pj?7:1.7),wr=P_(31.5,0),wrt=P_(31.5,1.7),wc=n%8<4?"#aeb5bf":"#8d949e";
    quad(wl[0],wl[1],wlt[1],wlt[0],pj?"#4a515c":wc);quad(wr[0],wr[1],wrt[1],wrt[0],wc);
    if(Math.abs(j*DS)<DS*1.2||j===0){const a=pr(...pt(0,-16)),b=pr(...pt(0,16)),c2=pr(...pt(1,16)),d=pr(...pt(1,-16));quad(a,b,c2,d,"#fff");}
  }
  // andere Autos als Heckansicht, von hinten nach vorn
  const cars=[];for(let m=0;m<roster.length;m++){if(m===k||!(fr.a[m*5+4]&1))continue;const p2=posXY(fr.a[m*5],fr.a[m*5+1]),s=pr(p2.x,p2.y,0);if(s&&s[2]<520)cars.push([s,m,p2.ang+fr.a[m*5+2]-hd]);}
  if(fr.sc){const p2=posXY(fr.sc[0],fr.sc[1]),s=pr(p2.x,p2.y,0);if(s&&s[2]<520)cars.push([s,-1,0]);}
  cars.sort((a,b)=>b[0][2]-a[0][2]);
  for(const [s,m,rel] of cars){const sc=f/s[2],side=Math.abs(Math.sin(rel)),w=(6.6+8.5*side)*sc,h=3.1*sc,x=s[0],y=s[1],col=m<0?"#d8dde3":roster[m].drv.color,fl2=m<0?0:fr.a[m*5+4];
    ctx.fillStyle="rgba(0,0,0,.35)";ctx.fillRect(x-w/2,y-h*0.12,w,h*0.2);
    ctx.fillStyle="#0b0b0b";ctx.fillRect(x-w/2,y-h*0.62,w*0.2,h*0.62);ctx.fillRect(x+w/2-w*0.2,y-h*0.62,w*0.2,h*0.62);
    ctx.fillStyle=col;ctx.fillRect(x-w*0.3,y-h*0.8,w*0.6,h*0.66);ctx.fillStyle="#111";ctx.fillRect(x-w*0.42,y-h,w*0.84,h*0.2);
    if(m<0){ctx.fillStyle=Math.sin(fr.t*12)>0?"#ff9d00":"#6a3f00";ctx.fillRect(x-w*0.2,y-h*1.15,w*0.4,h*0.15);}
    if((fl2&4)||(wet>0.25&&Math.sin(fr.t*14)>0)){ctx.fillStyle="#ff2020";ctx.fillRect(x-w*0.05,y-h*0.45,w*0.1,h*0.2);}
    if(fl2&64||fl2&512){ctx.fillStyle=fl2&512?"rgba(176,140,92,.45)":"rgba(230,230,235,.45)";ctx.beginPath();ctx.arc(x,y-h*0.3,w*0.8,0,7);ctx.fill();}
    if(m>=0&&s[2]<260){ctx.font=`bold ${Math.max(9,Math.min(15,sc*2.2))}px ui-monospace,monospace`;ctx.textAlign="center";ctx.fillStyle="#fff";ctx.fillText(roster[m].drv.code,x,y-h*1.25);}}
  if(wet>0.25){ctx.fillStyle=`rgba(200,215,230,${(0.18*wet).toFixed(3)})`;ctx.fillRect(0,0,W,H);for(let i=0;i<50;i++){const x=(i*97+fr.t*900)%W,y=(i*53+fr.t*1400)%H;ctx.fillStyle="rgba(220,235,250,.5)";ctx.fillRect(x,y,1,9);}}
  // Cockpit: Nase, Vorderräder, Halo, Lenkrad
  const col=roster[k].drv.color,cx=W/2,by=H+bob*0.4;ctx.fillStyle="#0c0c0c";ctx.fillRect(cx-W*0.36,by-H*0.25,W*0.11,H*0.25);ctx.fillRect(cx+W*0.25,by-H*0.25,W*0.11,H*0.25);
  ctx.fillStyle=col;ctx.beginPath();ctx.moveTo(cx-W*0.17,by);ctx.lineTo(cx-W*0.045,by-H*0.3);ctx.lineTo(cx+W*0.045,by-H*0.3);ctx.lineTo(cx+W*0.17,by);ctx.fill();
  ctx.fillStyle="#111";ctx.fillRect(cx-W*0.22,by-H*0.315,W*0.44,H*0.022);
  ctx.strokeStyle="#15171b";ctx.lineWidth=H*0.035;ctx.beginPath();ctx.moveTo(cx,by-H*0.13);ctx.lineTo(cx,y0-H*0.12);ctx.stroke();
  ctx.lineWidth=H*0.05;ctx.beginPath();ctx.moveTo(-10,y0-H*0.02);ctx.quadraticCurveTo(cx,y0-H*0.2,W+10,y0-H*0.02);ctx.stroke();
  ctx.fillStyle="#1a1d22";ctx.beginPath();ctx.ellipse(cx,by-H*0.02,W*0.13,H*0.11,0,Math.PI,0);ctx.fill();
  ctx.fillStyle="#0a0";ctx.font=`bold ${Math.round(H*0.045)}px ui-monospace,monospace`;ctx.textAlign="center";ctx.fillStyle="#7dff9a";ctx.fillText(Math.round(v*KMH),cx,by-H*0.04);
  if(fl){ctx.fillStyle=fl;ctx.fillRect(cx-W*0.1,by-H*0.115,W*0.2,H*0.018);}
  ctx.restore();if(fr.nk)drawNukeFlash(ctx,fr,W,H);
}
/* ===== Just for fun: geheimer Code auf Wüstenstrecken. Wechselt alle 5 Minuten, steht getarnt im Regelbuch ===== */
function funCode(){let x=(Math.floor(Date.now()/300000)^0x5bd1e995)>>>0;const A="ABCDEFGHJKLMNPQRSTUVWXYZ";let s="";
  for(let i=0;i<4;i++){x=Math.imul(x^(x>>>15),0x2c1b3c6d)>>>0;x=Math.imul(x^(x>>>12),0x297a2d39)>>>0;x=(x^(x>>>15))>>>0;s+=A[x%A.length];}return s;}
const FUN={buf:"",t:-1};
document.addEventListener("keydown",e=>{if(!e.shiftKey||e.key.length!==1||!/[a-z]/i.test(e.key))return;
  FUN.buf=(FUN.buf+e.key.toUpperCase()).slice(-4);
  if(typeof S!=="undefined"&&S&&S.wx&&S.wx.desert&&!S.ended&&FUN.t<0&&!R.inc&&FUN.buf===funCode()){FUN.buf="";FUN.t=0;UI.speed=0;addLog("⚠ UNBEKANNTES FLUGOBJEKT ÜBER DER STRECKE","bad");if(typeof sndEvent==="function")sndEvent("alert");}},true);
function funFrame(rdt){if(FUN.t<0)return;FUN.t+=rdt;const t=FUN.t;
  if(t>1.2&&!FUN.boom){FUN.boom=true;if(typeof sndNoise==="function"){sndNoise(3.5,0.9,300);sndTone(60,3,"sine",0.4,0,25);}}
  for(const id of ["cvAll","cvFeed","cvCctv"]){const cv=document.getElementById(id);if(!cv)continue;const c=cv.getContext("2d"),W=cv.width,H=cv.height,cx=W/2,cy=H*0.55;c.save();c.setTransform(1,0,0,1,0,0);
    if(t<1.2){c.fillStyle="#fff";c.beginPath();c.arc(cx,H*t/1.2*0.55,3,0,7);c.fill();}
    else{const u=t-1.2,fl=Math.max(0,1-u/1.6);c.fillStyle=`rgba(255,255,255,${fl})`;c.fillRect(0,0,W,H);
      const r=Math.min(W,H)*(0.08+u*0.16);let g=c.createRadialGradient(cx,cy,0,cx,cy,r);g.addColorStop(0,"rgba(255,250,210,.95)");g.addColorStop(0.5,"rgba(255,150,40,.85)");g.addColorStop(1,"rgba(90,30,10,0)");c.fillStyle=g;c.beginPath();c.arc(cx,cy,r,0,7);c.fill();
      c.strokeStyle=`rgba(255,255,255,${Math.max(0,0.8-u/3)})`;c.lineWidth=4;c.beginPath();c.arc(cx,cy,r*2.2,0,7);c.stroke();
      if(u>1){const m=Math.min(1,(u-1)/2.2),sw=H*0.05,top=cy-H*0.42*m;c.fillStyle="rgba(70,55,50,.92)";c.fillRect(cx-sw/2,top,sw,cy-top);c.beginPath();c.ellipse(cx,top,H*0.2*m+8,H*0.11*m+5,0,0,7);c.fill();c.fillStyle="rgba(200,110,50,.5)";c.beginPath();c.ellipse(cx,top+4,H*0.13*m,H*0.05*m,0,0,7);c.fill();}}
    c.restore();}
  if(t>6.5){FUN.t=-1;FUN.boom=false;const m=$("modal");m.className="modal";
    m.innerHTML=`<h2>💥 Strecke nicht mehr vorhanden</h2><p>Die Session wurde aus naheliegenden Gründen abgebrochen. Die Fahrer waren zum Glück alle rechtzeitig in der Box – das Ganze zählt nicht.</p><button class="big go" id="funBtn">Session neu starten</button>`;
    $("overlay").classList.add("show");$("funBtn").onclick=()=>{$("overlay").classList.remove("show");if(W.snap)loadGame(JSON.parse(JSON.stringify(W.snap)));};}}

/* ===== Atombombe per Strg+Shift+B (alle Strecken): fällt in Weltkoordinaten, schleudert Autos weg, Rote Flagge, Krater. Zählt nicht. ===== */
const NUKE_R=110,NUKE_R2=290,NUKE_DROP=2.6,NUKE_MODAL=6.5;
const NUKE_UI={mouse:null};
(()=>{const cv=document.getElementById("cvAll");if(!cv||!cv.addEventListener)return;
  cv.addEventListener("mousemove",e=>{const r=cv.getBoundingClientRect();NUKE_UI.mouse={x:e.clientX-r.left,y:e.clientY-r.top,w:r.width,h:r.height};});
  cv.addEventListener("mouseleave",()=>{NUKE_UI.mouse=null;});})();
function nukeTarget(){const m=NUKE_UI.mouse;
  if(m&&m.w>50&&m.h>50){const cam=camFit(m.w,m.h);return {x:cam.x+(m.x-m.w/2)/cam.z,y:cam.y+(m.y-m.h/2)/cam.z,src:"mouse"};}
  const c=S.cars[clamp(UI.sel||0,0,S.cars.length-1)];if(c&&!c.removed){const moving=!c.crash&&!c.pit&&c.mode!=="garage"&&c.mode!=="grid",q=moving?posXY(c.s+c.v*NUKE_DROP*0.92,c.lat):null,b=carBox(c);
    return q?{x:q.x,y:q.y,src:"car",car:c}:{x:b.x,y:b.y,src:"car",car:c};}
  return {x:T.x[0],y:T.y[0],src:"start"};}
function nukeNearestIdx(x,y){let bi=0,bd=1e18;for(let i=0;i<NU;i++){const dx=T.x[i]-x,dy=T.y[i]-y,d=dx*dx+dy*dy;if(d<bd){bd=d;bi=i;}}return bi;}
function nukeTrigger(tg){if(typeof S==="undefined"||!S||S.ended||S.nuke||FUN.t>=0)return false;
  if(typeof R!=="undefined"&&R.inc)return false;
  {const ov=document.getElementById("overlay");if(ov&&ov.classList&&ov.classList.contains("show"))return false;}
  tg=tg||nukeTarget();const pos=nukeNearestIdx(tg.x,tg.y)*DS;
  S.nuke={x:tg.x,y:tg.y,pos,tDrop:S.t,tBoom:S.t+NUKE_DROP,ph:0,score0:W.score,dec0:{ok:W.dec.ok,total:W.dec.total},rep0:W.career?W.career.rep:null};
  S.nuke.rec=[tg.x,tg.y,S.nuke.tDrop,S.nuke.tBoom];
  setSpeed(1);
  addLog(`⚠ RACE CONTROL: UNBEKANNTES FLUGOBJEKT ÜBER ${cnm(cornerNear(pos)).toUpperCase()} – ALLE FAHRER SOFORT VOM GAS`,"bad");
  if(typeof sndEvent==="function")sndEvent("alert");
  {let fc=tg.car;if(!fc){let bd=1e18;for(const c of S.cars){if(c.removed||c.mode==="garage")continue;const b=carBox(c),d=(b.x-tg.x)**2+(b.y-tg.y)**2;if(d<bd){bd=d;fc=c;}}}
    if(fc)S.nuke.inc=registerInc({kind:"info",title:"Atomschlag · Easter Egg (zählt nicht)",cars:[fc],pos,pre:1.5,post:NUKE_DROP+NUKE_MODAL+1});}
  return true;}
document.addEventListener("keydown",e=>{if(!(e.ctrlKey&&e.shiftKey)||(e.code!=="KeyB"&&String(e.key).toLowerCase()!=="b"))return;
  if(e.target&&(e.target.tagName==="INPUT"||e.target.tagName==="SELECT"||e.target.tagName==="TEXTAREA"))return;
  if(nukeTrigger()){e.preventDefault();e.stopPropagation();}},true);
function nukeBoom(){const N=S.nuke;N.ph=1;const wrecked=[];let core=null,coreF=0;
  if(typeof sndNoise==="function"){sndNoise(3.5,0.9,300);if(typeof sndTone==="function")sndTone(60,3,"sine",0.4,0,25);}
  for(const c of S.cars){if(c.removed||c.mode==="garage")continue;const b=carBox(c),dx=b.x-N.x,dy=b.y-N.y,d=Math.hypot(dx,dy);
    if(d<NUKE_R){const f=1-d/NUKE_R,a=d>0.5?Math.atan2(dy,dx):rand(0,6.28),ux=Math.cos(a),uy=Math.sin(a),sp=45+120*f;
      if(c.script)endScript(c);for(const o of S.cars)if(o.script&&o.script.B===c)endScript(o);
      c.ot=null;c.soloArm=null;c.wob=null;c.spinT=0;c.wide=null;c.busy=null;c.impede=null;c.fakeImp=null;c.wantPit=false;
      c.retired=true;c.v=0;c.latV=0;c.crash={dir:1,rest:-1e4,h0:T.ang[sidx(c.pos)],v0:1,sv0:0,grav:0,done:true,mech:true,hit:true,nuke:true};
      c.blast={vx:ux*sp,vy:uy*sp,w:rand(5,11)*(Math.random()<0.5?-1:1)*(0.4+f)};
      const parts=["fwL","fwR"];if(f>0.25)parts.push("nose","rw");parts.push(Math.random()<0.5?"spL":"spR");if(f>0.4)parts.push(Math.random()<0.5?"spR":"spL","floor");
      const wh=shuffle(["wFL","wFR","wRL","wRR"]),nw=f>0.7?irand(2,4):f>0.35?irand(1,2):irand(0,1);for(let i=0;i<nw;i++)parts.push(wh[i]);
      for(const k of parts)breakPart(c,k);
      for(let i=0;i<irand(4,8);i++){const aa=a+rand(-0.6,0.6),vv=sp*rand(0.6,1.5);spawnDeb(b.x+rand(-2,2),b.y+rand(-2,2),Math.cos(aa)*vv,Math.sin(aa)*vv,Math.random()<0.25?"wing":"cf",c);}
      if(f>0.35&&Math.random()<0.65)c.fire={t:0,T:rand(45,80)};
      c.sparks=1;wrecked.push(c);if(f>coreF){coreF=f;core=c;}}
    else if(d<NUKE_R2){const f=1-(d-NUKE_R)/(NUKE_R2-NUKE_R),a=Math.atan2(dy,dx);
      c.wob={t:0,T:rand(1,1.8),amp:rand(0.2,0.5)*f*(Math.random()<0.5?1:-1)};c.lockT=0.8;c.sparks=0.5;if(!c.crash)c.v*=1-0.4*f;
      for(let i=0;i<irand(1,3);i++)spawnDeb(b.x+rand(-3,3),b.y+rand(-3,3),Math.cos(a)*rand(20,60)*f,Math.sin(a)*rand(20,60)*f,"cf",null);
      if(Math.random()<0.5)radio(c,pick(["WAS WAR DAS?! Der Himmel ist komplett weiß!","Riesige Explosion vor mir! Ich bremse!","Druckwelle! Das Auto hat richtig gewackelt!"]),true,true);}}
  if(core&&!core.fire)core.fire={t:0,T:rand(45,80)};
  for(let i=0;i<14;i++){const a=rand(0,6.28),r=rand(0,NUKE_R*0.5);spawnDeb(N.x+Math.cos(a)*r,N.y+Math.sin(a)*r,Math.cos(a)*rand(40,140),Math.sin(a)*rand(40,140),"cf",null);}
  addLog(`💥 DETONATION BEI ${cnm(cornerNear(N.pos)).toUpperCase()} – ${wrecked.length} Auto${wrecked.length===1?"":"s"} getroffen`,"bad");
  if(S.flag.mode!=="red"){setNeutral("red");if(S.flag.mode!=="red"){S.flag.mode="red";S.sc=null;S.restart=false;}}
  const prev=S.hazard,cars=(prev?prev.cars:[]).concat(wrecked);
  spawnHazard(4,N.pos,`Atomexplosion in ${cnm(cornerNear(N.pos))} – Krater, zerstörte Barrieren, ${wrecked.length} Wrack${wrecked.length===1?"":"s"}`,cars,{nuke:true,counted:true,handled:true,deb:true,rep:true,dur:rand(60,90)});
  S.hazard.clearAt=S.t+S.hazard.dur;S.hazCount=Math.max(0,S.hazCount-1);
  if(typeof uiFlags==="function")uiFlags();}
/* läuft in simStep: Fallphase, Explosion, weggeschleuderte Autos, Modal, automatischer Neustart nach Rot */
function nukeStep(dt){const N=S.nuke;if(!N)return;
  if(N.ph===0){if(S.t>=N.tBoom)nukeBoom();return;}
  for(const c of S.cars){const b=c.blast;if(!b)continue;
    pushCar(c,b.vx*dt,b.vy*dt);c.spin+=b.w*dt;
    if(Math.abs(c.lat)>29){c.lat=Math.sign(c.lat)*29;b.vx*=0.25;b.vy*=0.25;b.w*=0.5;c.sparks=0.6;}
    const k=Math.exp(-1.7*dt);b.vx*=k;b.vy*=k;b.w*=Math.exp(-1.3*dt);
    if(Math.hypot(b.vx,b.vy)<1.2){c.blast=null;if(c.crash){c.crash.rest=c.lat;c.crash.dir=Math.sign(c.lat)||1;}}}
  if(N.ph===1&&S.t>=N.tBoom+NUKE_MODAL){N.ph=2;nukeModal();}
  if(N.cont&&S.flag.mode==="red"&&(!S.hazard||S.hazard.cleared)){N.contT=(N.contT||0)+dt;if(N.contT<1)return;N.contT=0;
    if(S.type==="race"&&S.phase==="racing"){const run=S.cars.filter(c=>!c.removed&&!c.retired&&!c.finished&&!c.crash&&c.mode!=="garage");
      if(run.every(c=>c.pit&&c.v<=2)){N.cont=false;standingRestart();}}
    else if(S.type!=="race"){N.cont=false;setNeutral("restart");}
    else{N.cont=false;S.flag.mode="green";if(typeof uiFlags==="function")uiFlags();}}}
/* Rote Flagge ohne Wertung: kein Score, kein Ansehen, keine Entscheidung */
function nukeHazStep(h,dt){const r=respLevel(h);
  if(!h.cleared){if(S.t>=h.clearAt){h.cleared=true;h.clT=0;h.cars.forEach(c=>c.removed=true);addLog("TRACK CLEAR – Wracks geborgen, Krater abgesichert","good");}
    else setAlert("",`Wracks werden geborgen, Krater wird abgesichert – noch ca. ${Math.max(0,Math.ceil(h.clearAt-S.t))}s.${S.nuke&&S.nuke.cont?" Neustart folgt automatisch.":""}`);return;}
  h.clT+=dt;
  if(r===0||(S.flag.mode==="sc"&&(S.restart||(S.sc&&S.sc.inLap)))||S.phase==="form"){S.hazard=null;setAlert("","Strecke frei – Krater bleibt.");}
  else setAlert("clear",`✅ Strecke frei. EMPFEHLUNG: ${endText(h)} – du entscheidest.`);}
function nukeModal(){if(typeof setSpeed==="function")setSpeed(0);const m=$("modal");if(!m)return;m.className="modal";
  const race=S.type==="race"&&S.phase==="racing";
  m.innerHTML=`<h2>💥 Strecke nicht mehr vorhanden</h2><p>Ein Krater mitten auf der Strecke. Die Session steht unter Roter Flagge. Das Ganze zählt nicht – kein Einfluss auf Score und Ansehen, keine Stewards-Dokumente.</p>`
    +(W.snap?`<button class="big go" id="nkNew">Session neu starten</button>`:"")
    +`<button class="big" id="nkGo" style="background:#5a1010;color:#fff">Weiterfahren nach Rot</button>`;
  $("overlay").classList.add("show");
  if(W.snap)$("nkNew").onclick=()=>{$("overlay").classList.remove("show");loadGame(JSON.parse(JSON.stringify(W.snap)));};
  $("nkGo").onclick=()=>{$("overlay").classList.remove("show");nukeContinue();};}
function nukeContinue(){if(!S||!S.nuke)return;S.nuke.cont=true;if(typeof setSpeed==="function")setSpeed(1);
  addLog(S.type==="race"&&S.phase==="racing"?"Rote Flagge bleibt bis zur Bergung – danach stehender Neustart aus der Boxengasse (automatisch, sobald alle Autos aufgereiht sind)":"Rote Flagge bleibt bis zur Bergung – danach wird die Session automatisch fortgesetzt","flag");
  if(typeof uiFlags==="function")uiFlags();if(typeof uiSession==="function")uiSession();}
/* ---- Zeichnen (Weltkoordinaten), auch im Replay über REC-Feld nk=[x,y,tDrop,tBoom] ---- */
function nukeShake(fr){const n=fr&&fr.nk;if(!n)return [0,0];const age=(fr.t||0)-n[3];if(age<0||age>3.5)return [0,0];const a=(1-age/3.5)*(age<0.4?16:10);
  return [Math.sin((fr.t||0)*91.7)*a,Math.cos((fr.t||0)*77.3)*a];}
function drawNukeGround(ctx,fr){const n=fr.nk;if(!n)return;const age=(fr.t||0)-n[3];if(age<0)return;const[x,y]=n;
  let g=ctx.createRadialGradient(x,y,0,x,y,NUKE_R*1.25);g.addColorStop(0,"rgba(12,10,9,0.92)");g.addColorStop(0.35,"rgba(30,24,20,0.8)");g.addColorStop(0.7,"rgba(45,38,30,0.35)");g.addColorStop(1,"rgba(45,38,30,0)");
  ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,NUKE_R*1.25,0,7);ctx.fill();
  ctx.fillStyle="rgba(5,5,5,0.95)";ctx.beginPath();for(let i=0;i<=24;i++){const a=i/24*6.2832,r=26+Math.sin(i*2.7)*3.5+Math.cos(i*1.3)*2.5;i?ctx.lineTo(x+Math.cos(a)*r,y+Math.sin(a)*r):ctx.moveTo(x+Math.cos(a)*r,y+Math.sin(a)*r);}ctx.fill();
  ctx.strokeStyle="rgba(70,58,46,0.9)";ctx.lineWidth=3;ctx.stroke();
  if(age<20){ctx.fillStyle=`rgba(255,${Math.round(90+60*Math.sin(age*7))},20,${(0.5*(1-age/20)).toFixed(3)})`;ctx.beginPath();ctx.arc(x,y,18,0,7);ctx.fill();}}
function drawNukeAir(ctx,fr){const n=fr.nk;if(!n)return;const t=fr.t||0,[x,y,t0,tb]=n,age=t-tb;
  if(age<0){const u=clamp((t-t0)/(tb-t0),0,1),alt=1-u;
    ctx.strokeStyle=`rgba(255,40,40,${(0.5+0.4*Math.sin(t*14)).toFixed(3)})`;ctx.lineWidth=1.6;ctx.beginPath();ctx.arc(x,y,NUKE_R*(0.25+0.75*alt),0,7);ctx.stroke();
    ctx.beginPath();ctx.moveTo(x-12,y);ctx.lineTo(x+12,y);ctx.moveTo(x,y-12);ctx.lineTo(x,y+12);ctx.stroke();
    ctx.fillStyle=`rgba(0,0,0,${(0.15+0.45*u).toFixed(3)})`;ctx.beginPath();ctx.ellipse(x,y,4+6*u,2.5+3.5*u,0,0,7);ctx.fill();
    const by=y-alt*70,sc=1.6+2.4*u;ctx.save();ctx.translate(x,by);ctx.scale(sc,sc);ctx.rotate(Math.sin(t*9)*0.08);
    ctx.fillStyle="#3b4148";ctx.beginPath();ctx.ellipse(0,0,1.5,3.2,0,0,7);ctx.fill();ctx.fillStyle="#d6c23a";ctx.fillRect(-1.5,-0.5,3,0.6);
    ctx.fillStyle="#22272c";ctx.beginPath();ctx.moveTo(-1.4,-2.4);ctx.lineTo(-2.6,-4.4);ctx.lineTo(2.6,-4.4);ctx.lineTo(1.4,-2.4);ctx.fill();ctx.restore();return;}
  if(age>40)return;
  if(age<2.5){const r=NUKE_R*(0.25+0.75*Math.min(1,age/0.6)),a=Math.max(0,1-age/2.5);let g=ctx.createRadialGradient(x,y,0,x,y,r);
    g.addColorStop(0,`rgba(255,255,235,${a})`);g.addColorStop(0.35,`rgba(255,200,80,${a*0.95})`);g.addColorStop(0.7,`rgba(255,90,20,${a*0.7})`);g.addColorStop(1,"rgba(120,30,10,0)");ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,r,0,7);ctx.fill();}
  if(age<4){const r=40+age*260,a=Math.max(0,0.85-age/4);ctx.strokeStyle=`rgba(255,255,255,${a.toFixed(3)})`;ctx.lineWidth=6+age*5;ctx.beginPath();ctx.arc(x,y,r,0,7);ctx.stroke();
    ctx.strokeStyle=`rgba(255,180,90,${(a*0.5).toFixed(3)})`;ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,r*0.92,0,7);ctx.stroke();}
  if(age>0.6){const m=Math.min(1,(age-0.6)/3.5),fade=age>25?Math.max(0,1-(age-25)/15):1,H=NUKE_R*1.5*m,cw=NUKE_R*(0.25+0.6*m),sw=NUKE_R*0.22;
    ctx.globalAlpha=fade;
    let g=ctx.createLinearGradient(x,y,x,y-H);g.addColorStop(0,"rgba(110,85,70,0.9)");g.addColorStop(1,"rgba(150,120,95,0.85)");ctx.fillStyle=g;
    ctx.beginPath();ctx.moveTo(x-sw*0.8,y);ctx.quadraticCurveTo(x-sw*0.35,y-H*0.5,x-sw*0.5,y-H);ctx.lineTo(x+sw*0.5,y-H);ctx.quadraticCurveTo(x+sw*0.35,y-H*0.5,x+sw*0.8,y);ctx.fill();
    for(let i=0;i<9;i++){const a=i/9*6.2832+age*0.15,rx=Math.cos(a)*cw*0.75,ry=Math.sin(a)*cw*0.3;ctx.fillStyle=i%2?"rgba(120,95,80,0.92)":"rgba(160,130,105,0.9)";ctx.beginPath();ctx.arc(x+rx,y-H+ry,cw*0.42,0,7);ctx.fill();}
    g=ctx.createRadialGradient(x,y-H,0,x,y-H,cw*0.75);g.addColorStop(0,`rgba(255,170,60,${(0.85*Math.max(0,1-age/9)).toFixed(3)})`);g.addColorStop(1,"rgba(255,120,40,0)");ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(x,y-H,cw*0.75,cw*0.4,0,0,7);ctx.fill();
    ctx.globalAlpha=1;}}
function drawNukeFlash(ctx,fr,W,H){const n=fr&&fr.nk;if(!n)return;const age=(fr.t||0)-n[3];if(age<0||age>1.6)return;
  ctx.fillStyle=`rgba(255,255,245,${Math.max(0,1-age/1.6).toFixed(3)})`;ctx.fillRect(0,0,W,H);}
/* ===== Entwicklung: Strg+Shift+D bricht beim gewählten Auto ein zufälliges Teil ab (nur localhost, file:// oder ?dev) ===== */
const RC_DEV=(()=>{try{const l=location;return /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])$/.test(l.hostname||"")||l.protocol==="file:"||/[?&]dev\b/.test(l.search||"");}catch(e){return false;}})();
document.addEventListener("keydown",e=>{if(!RC_DEV||!(e.ctrlKey&&e.shiftKey)||(e.code!=="KeyD"&&String(e.key).toLowerCase()!=="d"))return;
  if(typeof S==="undefined"||!S||(typeof R!=="undefined"&&R.inc))return;e.preventDefault();e.stopPropagation();
  const i=clamp(UI.sel||0,0,S.cars.length-1),c=S.cars[i];if(!dbgBreak(c))return;
  const f=REC[REC.length-1];if(f&&f.e&&f.e.length>=(i+1)*5){const d=(c.dp||0)|(c.punct?DP.tyre:0);f.e[i*5+3]=d&255;f.e[i*5+4]=(d>>8)&255;
    if(c.punct)f.a[i*5+4]=(f.a[i*5+4]&~(3<<22))|((c.punctW&3)<<22);f.db=debrisRec();}},true);
