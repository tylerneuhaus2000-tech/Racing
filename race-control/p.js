"use strict";
/* ===== Cockpit-Perspektive: echte Perspektivprojektion der Strecke aus Fahrersicht ===== */
function drawPOV(ctx,W,H,fr,roster,k){
  const o=k*5,q=posXY(fr.a[o],fr.a[o+1]),hd=q.ang+fr.a[o+2],ch=Math.cos(hd),sh=Math.sin(hd);
  const ex=q.x+ch*1.5,ey=q.y+sh*1.5,EYE=2.5,f=W*0.62,y0=H*0.43,night=NIGHT.has(TRACK.key),wet=fr.wet||0,v=Math.max(0,fr.a[o+3]);
  const bob=Math.sin(fr.t*31)*Math.min(1.6,v/110);
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
