"use strict";
/* ============ Rendering ============ */
function mkPath(latFn,i0,i1,close,into){const p=into||new Path2D();
  for(let i=i0;i<=i1;i++){const j=((i%NU)+NU)%NU,lat=SIDE*(typeof latFn==="number"?latFn:latFn(i));
    const x=T.x[j]-Math.sin(T.ang[j])*lat,y=T.y[j]+Math.cos(T.ang[j])*lat;if(i===i0)p.moveTo(x,y);else p.lineTo(x,y);}
  if(close)p.closePath();return p;}
let P;function buildPaths(){
  const iE=Math.ceil(PIT_ENTRY_S/DS),iI=sidx(PIT_IN_S),iO=sidx(PIT_OUT_S)+NU,iX=sidx(PIT_EXIT_S)+NU,
    iR=sidx(PIT_EXIT_S+PIT_ROUTE.rejoin)+NU;
  const pl=i=>pitRouteRoadLatAt(i*DS);
  const kerb=new Path2D();
  for(const c of CORNERS){if(c.s>PIT_ENTRY_S-40||c.s<PIT_EXIT_S)continue;mkPath(19,c.i0-6,c.i1+6,false,kerb);mkPath(-19,c.i0-6,c.i1+6,false,kerb);}
  // Umgebung: Kiesbetten außen an den Kurven, Tribünen, Boxengebäude, Bäume
  const gravel=new Path2D(),stands=new Path2D(),runA=new Path2D(),rwall=new Path2D();
  for(const c of CORNERS){if(c.s>PIT_ENTRY_S-60||c.s<PIT_EXIT_S+20)continue;const ro=c.ro||"gravel";
    if(ro==="wall")mkPath(-c.dir*21.5,c.i0-6,c.i1+10,false,rwall);else mkPath(-c.dir*26.3,c.i0-3,c.i1+9,false,ro==="asphalt"?runA:gravel);}
  mkPath(42,-Math.round(150/DS),Math.round(150/DS),false,stands);
  CORNERS.filter((c,i)=>i%3===1&&c.s<PIT_ENTRY_S-120&&c.s>PIT_EXIT_S+120).forEach(c=>mkPath(-c.dir*43,c.i0-2,c.i1+2,false,stands));
  const trees=[];let sd=TRACK.key.length*7919+NU;const rnd=()=>{sd=(sd*16807)%2147483647;return sd/2147483647;};
  for(let k=0;k<420&&trees.length<230;k++){const j=Math.floor(rnd()*NU),lat=(rnd()<0.5?-1:1)*(52+rnd()*85),x=T.x[j]-Math.sin(T.ang[j])*lat,y=T.y[j]+Math.cos(T.ang[j])*lat;let ok=true;
    for(let i=0;i<NU;i+=3){const dx=T.x[i]-x,dy=T.y[i]+0-y;if(dx*dx+dy*dy<50*50){ok=false;break;}}
    if(ok)trees.push([x,y,3+rnd()*3.5,rnd()]);}
  const pxLine=mkPath(PITLINE,iO+6,iX),peLine=mkPath(i=>pitRouteEntryLatAt(i*DS)+6.5,iE+1,iI-2);
  return {runA,rwall,pxLine,peLine,gravel,stands,trees,bld:mkPath(-60,iI+10,iO-10),center:mkPath(0,0,NU-1,true),sec:[0,1,2].map(k=>mkPath(0,Math.floor(SECB[k]/DS),Math.floor(SECB[k+1]/DS)+1)),kerb,
    pit:mkPath(pl,iE,iR),gar:mkPath(-51,iI+10,iO-10),wall:mkPath(-22.5,iI+4,iO-4),line:mkPath(i=>T.line[((i%NU)+NU)%NU],0,NU-1,true)};}
P=buildPaths();
const NIGHT=new Set(["bahrain","jeddah","singapore","vegas","lusail","yas"]);
const TEAM2={MER:"#101418",MCL:"#101418",FER:"#fff200",RBR:"#ffd000",HAA:"#e6002b",ALP:"#0093cc",WIL:"#ffffff",RCB:"#ffffff",AUD:"#111111",AMR:"#cedc00",CAD:"#ffffff"};
const MARKS=[];
const FLAGCOL={vsc:"#ffd400",sc:"#ff9d00",red:"#e10600"};
function w2s(x,y,cam,W,H){const dx=(x-cam.x)*cam.z,dy=(y-cam.y)*cam.z,c=Math.cos(-cam.rot),s=Math.sin(-cam.rot);return [W/2+dx*c-dy*s,H/2+dx*s+dy*c];}
const CARDYN={roll:0,steer:0,brk:false,v:0,dm:0,pw:0,t:0};
/* Lackierungen (private Bilddateien, Nase zeigt nach rechts) */
const LIV={};for(const k of ["ALP","AMR","AUD","CAD","FER","HAA","MCL","MER","RCB","RBR","WIL"]){const im=new Image();im.onload=()=>{im.ok=true;};im.src="img/"+k+".png";LIV[k]=im;}
let LIV_ON=true;
function drawCarShape(ctx,col,fl,z,drv,rainL){const dy=CARDYN.roll*0.38,dx=CARDYN.brk?0.35:0;
  const li=LIV_ON&&drv&&LIV[drv.team];
  if(li&&li.ok){const L_=14.9,H_=Math.min(L_*li.height/li.width,5.3);   // exakt so groß wie die Kollisionsbox (14,9 × 5,1)
    if(z>1.2){ctx.fillStyle="rgba(0,0,0,0.35)";ctx.beginPath();ctx.ellipse(-0.3+dx*0.5,0.9-dy*0.6,7.8,H_*0.5,0,0,7);ctx.fill();}
    ctx.save();ctx.translate(dx,dy);if(CARDYN.dm||Math.abs(CARDYN.steer)>0.015)dmgDrawImage(ctx,li,L_,H_,CARDYN.dm,CARDYN.steer,drv.team,CARDYN.pw,CARDYN.t);else ctx.drawImage(li,-L_/2,-H_/2,L_,H_);ctx.restore();
    if(fl&4){ctx.fillStyle="#ff2a2a";ctx.fillRect(-8.6,-0.5,0.6,1.0);}
    if(rainL){ctx.fillStyle="#ff2a2a";ctx.beginPath();ctx.arc(-8.4,0,0.9,0,7);ctx.fill();}
    return;}
  if(z>1.2){ctx.fillStyle="rgba(0,0,0,0.35)";ctx.beginPath();ctx.ellipse(-0.3+dx*0.5,0.9-dy*0.6,7.6,3.3,0,0,7);ctx.fill();}      // Schatten, verschiebt sich mit Rollen/Nicken
  ctx.fillStyle="#0a0a0a";
  {const dm=CARDYN.dm||0;if(!(dm&DP.wRL))ctx.fillRect(-6.4,-3.25,3.1,1.6);if(!(dm&DP.wRR))ctx.fillRect(-6.4,1.65,3.1,1.6);}
  for(const wy of[-2.525,2.525]){if((CARDYN.dm||0)&(wy<0?DP.wFL:DP.wFR))continue;ctx.save();ctx.translate(4.45,wy);ctx.rotate(CARDYN.steer);ctx.fillRect(-1.35,-0.73,2.7,1.45);ctx.restore();}   // Vorderräder lenken ein
  if(CARDYN.brk&&z>2.2){const a=clamp(CARDYN.v/150,0.3,0.9);ctx.fillStyle=`rgba(255,${Math.round(120-60*a)},20,${(0.55*a).toFixed(2)})`;
    for(const p of[[4.45,-2.5],[4.45,2.5],[-4.85,-2.45],[-4.85,2.45]]){ctx.beginPath();ctx.arc(p[0],p[1],0.75,0,7);ctx.fill();}}       // glühende Bremsscheiben
  ctx.save();ctx.translate(dx,dy);                                   // Karosserie: taucht beim Bremsen ein, neigt sich in der Kurve nach außen
  ctx.fillStyle=col;
  ctx.beginPath();ctx.moveTo(-6.6,-1.2);ctx.lineTo(-2.2,-2.1);ctx.lineTo(1.6,-2.0);ctx.lineTo(3.4,-0.9);ctx.lineTo(7.0,-0.45);
  ctx.lineTo(7.0,0.45);ctx.lineTo(3.4,0.9);ctx.lineTo(1.6,2.0);ctx.lineTo(-2.2,2.1);ctx.lineTo(-6.6,1.2);ctx.closePath();ctx.fill();
  if(fl&1024){ctx.fillRect(6.3,-2.9,1.2,2.2);}else ctx.fillRect(6.3,-2.9,1.2,5.8);   // beschädigt: halber Frontflügel fehlt
  if(drv&&z>1.6){ctx.fillStyle=TEAM2[drv.team]||"#fff";ctx.fillRect(-5.6,-0.45,4.2,0.9);ctx.fillRect(3.6,-0.3,3.2,0.6);ctx.fillRect(-2.2,-2.1,3.6,0.55);ctx.fillRect(-2.2,1.55,3.6,0.55);}   // Zweitfarbe der Lackierung
  ctx.fillStyle="#111";ctx.fillRect(-7.6,-2.6,1.3,5.2);
  if(rainL){ctx.fillStyle="#ff2020";ctx.fillRect(-8.1,-0.5,0.7,1);}
  if(drv&&z>3.4){ctx.save();ctx.rotate(Math.PI/2);ctx.fillStyle="#fff";ctx.font="bold 1.9px sans-serif";ctx.textAlign="center";ctx.fillText(drv.num,0,3.7);ctx.restore();}
  ctx.beginPath();ctx.ellipse(0.2,0,1.25,0.75,0,0,7);ctx.fill();
  ctx.restore();
  if(fl&4){ctx.fillStyle="#ff2a2a";ctx.fillRect(-7.9,-0.6,0.6,1.2);}
  if(fl&2){ctx.strokeStyle="#b06cff";ctx.lineWidth=0.7;ctx.strokeRect(-8,-3.6,16,7.2);}
  if(fl&32){ctx.fillStyle="#2f7bff";ctx.fillRect(-3,-7.4,5.5,3.4);ctx.strokeStyle="#fff";ctx.lineWidth=0.4;ctx.strokeRect(-3,-7.4,5.5,3.4);}
  if(fl&8){ctx.fillStyle="#ffcf40";for(let i=0;i<5;i++)ctx.fillRect(-8-Math.random()*5,-3+Math.random()*6,0.8,0.8);}
}
function drawScene(ctx,W,H,cam,fr,roster,opt){
  opt=opt||{};
  const night=NIGHT.has(TRACK.key);
  ctx.save();ctx.fillStyle=night?"#04070c":opt.bg||"#0b1f14";ctx.fillRect(0,0,W,H);
  if(fr.nk){const sh=nukeShake(fr);ctx.translate(sh[0],sh[1]);}
  ctx.translate(W/2,H/2);ctx.scale(cam.z,cam.z);ctx.rotate(-cam.rot);ctx.translate(-cam.x,-cam.y);
  ctx.lineJoin="round";ctx.lineCap="butt";
  const st=(p,w,c)=>{ctx.lineWidth=w;ctx.strokeStyle=c;ctx.stroke(p);};
  const wet=fr.wet||0;
  if(night)st(P.center,150,"rgba(255,236,190,0.05)");   // Flutlicht
  st(P.center,96,night?"#0b1410":"#11301c");
  for(const t of P.trees){ctx.fillStyle=night?"#07110c":t[3]<0.5?"#0d2a17":"#103420";ctx.beginPath();ctx.arc(t[0],t[1],t[2],0,7);ctx.fill();}
  st(P.stands,13,"#39465c");ctx.setLineDash([2.5,2.5]);st(P.stands,9,"#6f86ad");ctx.setLineDash([]);
  st(P.bld,13,"#565e6b");st(P.bld,9,"#3c434e");
  st(P.center,63,"#77808c");st(P.center,60,"#22343a");
  st(P.gravel,7.4,night?"#6e6247":"#8d7d58");st(P.runA,7.4,night?"#2c3742":"#46525f");st(P.rwall,1.6,"#d9dde3");
  st(P.gar,11,"#4b525e");st(P.pit,21,"#30353d");
  st(P.kerb,3,"#d22");ctx.setLineDash([4,4]);st(P.kerb,3,"#f4f4f4");ctx.setLineDash([]);
  if(fr.fm!=="green")st(P.center,40,FLAGCOL[fr.fm]);
  else for(let k=0;k<3;k++)if(fr.sec[k])st(P.sec[k],40,fr.sec[k]>1?"#ffb000":"#ffd400");
  st(P.center,35,"#eceef0");
  const g=Math.round(46-18*wet),b=Math.round(53-4*wet);
  st(P.center,32,`rgb(${g-4},${g},${b})`);
  if(cam.z>1.4)st(P.line,7,`rgba(0,0,0,${(0.05+0.14*clamp((S&&S.evo||0)/6,0,1))*(1-Math.min(0.8,wet*1.2))})`);
  if(wet>0.3&&cam.z>1.2)st(P.line,5,`rgba(190,215,240,${(0.07*wet).toFixed(3)})`);   // nasse Fahrbahn glänzt auf der Ideallinie
  drawPuddles(ctx,fr);
  if(fr.nk)drawNukeGround(ctx,fr);
  drawDebris(ctx,fr);
  if(typeof UI!=="undefined"&&UI.lineDbg){   /* Debug: Ideallinie, Scheitelpunkte und Abweichung jedes Autos (Taste L) */
    ctx.save();ctx.lineWidth=Math.max(0.9,2.2/cam.z);ctx.strokeStyle="rgba(70,255,150,.95)";ctx.stroke(P.line);
    ctx.fillStyle="#ffd400";for(const c of CORNERS){const q=posXY(c.ia*DS,T.line[c.ia]);ctx.beginPath();ctx.arc(q.x,q.y,Math.max(1.4,3.5/cam.z),0,7);ctx.fill();}
    ctx.lineWidth=Math.max(0.6,1.6/cam.z);ctx.strokeStyle="rgba(255,90,90,.9)";ctx.beginPath();
    for(let k=0;k<roster.length;k++){const o=k*5;if(!(fr.a[o+4]&1))continue;const s_=fr.a[o],la=fr.a[o+1],ix=sidx(mod(s_)),p1=posXY(s_,la),p2=posXY(s_,T.line[ix]);ctx.moveTo(p1.x,p1.y);ctx.lineTo(p2.x,p2.y);}
    ctx.stroke();ctx.restore();}
  if(opt.marks&&cam.z>1.2){ctx.lineWidth=0.9;ctx.strokeStyle="rgba(8,8,8,0.4)";ctx.beginPath();for(const m of MARKS){ctx.moveTo(m[0],m[1]);ctx.lineTo(m[2],m[3]);}ctx.stroke();}
  st(P.wall,1.4,"#c9ced6");
  // Start/Ziel + Boxen
  let p0=posXY(0,-16),p1=posXY(0,16);ctx.lineWidth=2.4;ctx.strokeStyle="#fff";ctx.beginPath();ctx.moveTo(p0.x,p0.y);ctx.lineTo(p1.x,p1.y);ctx.stroke();
  if(cam.z>1.2){
    const boxL={};for(let k=0;k<roster.length;k++){const fl=fr.a[k*5+4],ti=roster[k].drv.ti;if(fl&128)boxL[ti]=1;else if((fl&256)&&!boxL[ti])boxL[ti]=2;}
    // Streckenposten mit geschwenkten Flaggen
    for(let i=35;i<NU;i+=70){const sk=sectorOf(i*DS),stt=fr.fm==="red"?2:(fr.fm!=="green"||fr.sec[sk])?1:0;if(!stt)continue;
      const q=posXY(i*DS,25),wv=Math.sin(fr.t*10+i)*1.6;ctx.fillStyle="#e8e8e8";ctx.fillRect(q.x-0.7,q.y-0.7,1.4,1.4);
      ctx.fillStyle=stt===2?"#e10600":"#ffd400";ctx.beginPath();ctx.moveTo(q.x,q.y-0.6);ctx.lineTo(q.x+4.6,q.y-2.6+wv);ctx.lineTo(q.x+4.6,q.y+0.8+wv);ctx.lineTo(q.x,q.y+2.2);ctx.fill();
      if(stt===1&&fr.fm==="green"&&fr.sec[sk]>1){ctx.beginPath();ctx.moveTo(q.x,q.y-0.6);ctx.lineTo(q.x-4.6,q.y-2.6-wv);ctx.lineTo(q.x-4.6,q.y+0.8-wv);ctx.lineTo(q.x,q.y+2.2);ctx.fill();}}
    st(P.pxLine,0.9,"#ffffff");st(P.peLine,0.9,"#ffffff");     // weiße Linien an Ein- und Ausfahrt
    for(const s0 of [PIT_IN_S,PIT_OUT_S]){const a1=posXY(s0,-25),a2=posXY(s0,-43);ctx.strokeStyle="#ffd400";ctx.lineWidth=0.9;ctx.beginPath();ctx.moveTo(a1.x,a1.y);ctx.lineTo(a2.x,a2.y);ctx.stroke();}   // Beginn und Ende des Tempolimits
    {const q=posXY(PIT_OUT_S-2,-27.5);ctx.fillStyle="#0c0c0c";ctx.fillRect(q.x-2,q.y-2,4,4);ctx.beginPath();ctx.arc(q.x,q.y,1.3,0,7);ctx.fillStyle=fr.px?"#ff2020":"#25e060";ctx.fill();   // Ampel am Boxenausgang
      ctx.beginPath();ctx.arc(q.x,q.y,2.8,0,7);ctx.fillStyle=fr.px?"rgba(255,40,40,.25)":"rgba(40,230,100,.22)";ctx.fill();}
    for(let t=0;t<TEAM_KEYS.length;t++){const q=posXY(boxPos(t),BOXLAT);ctx.save();ctx.translate(q.x,q.y);ctx.rotate(q.ang);
      ctx.strokeStyle=TEAMS[TEAM_KEYS[t]].color;ctx.lineWidth=0.8;ctx.strokeRect(-9,-4.2,18,8.4);
      const pl=boxL[t]||0;ctx.fillStyle="#0c0c0c";ctx.fillRect(9.6,-2.6,3.4,5.2);       // Boxenampel
      ctx.beginPath();ctx.arc(11.3,-1.2,1.05,0,7);ctx.fillStyle=pl===1?"#ff2020":"#3a1010";ctx.fill();
      ctx.beginPath();ctx.arc(11.3,1.2,1.05,0,7);ctx.fillStyle=pl===2?"#25e060":"#0f3018";ctx.fill();
      if(pl){ctx.beginPath();ctx.arc(11.3,pl===1?-1.2:1.2,2.3,0,7);ctx.fillStyle=pl===1?"rgba(255,40,40,.28)":"rgba(40,230,100,.28)";ctx.fill();}
      ctx.restore();}
    if(opt.grid){ctx.strokeStyle="#ffffffaa";ctx.lineWidth=0.7;for(let k=0;k<22;k++){const s=gridSlot(k),q=posXY(s.s+8,s.lat);ctx.save();ctx.translate(q.x,q.y);ctx.rotate(q.ang);
      ctx.beginPath();ctx.moveTo(-2,-4);ctx.lineTo(0,-4);ctx.lineTo(0,4);ctx.lineTo(-2,4);ctx.stroke();ctx.restore();}}
  }
  if(fr.li>0||opt.showLights){for(let k=0;k<5;k++){const q=posXY(10,-10+k*5);ctx.beginPath();ctx.arc(q.x,q.y,1.9,0,7);ctx.fillStyle=k<fr.li?"#ff1e1e":"#3a1010";ctx.fill();}}
  if(fr.hz&&fr.hz[2]&&cam.z>1.2){const sgn=fr.hz[3]>=0?1:-1,q=posXY(fr.hz[0]-14,fr.hz[3]+sgn*2.5);   // Bergung: Kranwagen und Streckenposten
    ctx.save();ctx.translate(q.x,q.y);ctx.rotate(q.ang);ctx.fillStyle="#e8b400";ctx.fillRect(-6,-2.8,12,5.6);ctx.fillStyle="#222";ctx.fillRect(2,-2.2,3,4.4);ctx.strokeStyle="#e8b400";ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(4,0);ctx.lineTo(13,0);ctx.stroke();
    ctx.fillStyle=Math.sin(fr.t*12)>0?"#ff8a00":"#7a4200";ctx.fillRect(-1,-1,2,2);ctx.restore();
    for(let k=0;k<4;k++){const m=posXY(fr.hz[0]+Math.sin(fr.t*1.3+k*1.7)*7+k*3-4,fr.hz[3]+sgn*(-3.5+Math.cos(fr.t*1.1+k)*2.2));ctx.fillStyle="#ff7a00";ctx.beginPath();ctx.arc(m.x,m.y,1.15,0,7);ctx.fill();ctx.fillStyle="#fff";ctx.fillRect(m.x-0.3,m.y-0.3,0.6,0.6);}}
  if(fr.hz&&fr.hz[1]){const q=posXY(fr.hz[0],2);ctx.fillStyle="#cfd4dc";for(let k=0;k<7;k++)ctx.fillRect(q.x+Math.sin(k*2.1)*7,q.y+Math.cos(k*3.3)*6,1.3,1.3);}
  // Autos
  const n=roster.length;
  if(cam.z>1.3)drawFx(ctx,fr,opt.hist||[],n);drawAquaSpray(ctx,fr,n);drawFire(ctx,fr,n);
  for(let k=0;k<n;k++){const o=k*5,fl=fr.a[o+4];if(!(fl&1))continue;
    const q=posXY(fr.a[o],fr.a[o+1]);ctx.save();ctx.translate(q.x,q.y);ctx.rotate(q.ang+fr.a[o+2]);
    if(cam.z<1.25){const sc=Math.max(1,1.05/cam.z);ctx.scale(sc,sc);}
    {const ix=sidx(mod(fr.a[o])),kk=T.k[ix],v=Math.abs(fr.a[o+3]),r=clamp(v*v*Math.abs(T.kl?T.kl[ix]:kk)/ALAT,0,1.2);
      CARDYN.roll=(fl&128)||(fl&16)?0:-Math.sign(kk*SIDE)*r;CARDYN.steer=(fl&128)?0:clamp(kk*SIDE*16,-0.42,0.42);CARDYN.brk=(fl&4)&&v>30;CARDYN.v=v;CARDYN.dm=fr.e&&fr.e.length>=(k+1)*5?fr.e[k*5+3]|(fr.e[k*5+4]<<8):0;CARDYN.pw=(fl>>22)&3;CARDYN.t=fr.t||0;}
    drawCarShape(ctx,roster[k].drv.color,fl,cam.z,roster[k].drv,wet>0.25&&Math.sin(fr.t*14)>0);
    if((fl&128)&&fr.a[o+3]<0&&cam.z>1.5){const el=-fr.a[o+3];drawCrew(ctx,fl,((fl>>14)&63)/63,roster[k].drv,fr.t);ctx.restore();
      // Standuhr über dem Auto
      const lab=el.toFixed(1)+" s",wt=fl&2048;ctx.save();ctx.translate(q.x,q.y-15);ctx.font="bold 3.4px ui-monospace,monospace";ctx.textAlign="center";const tw=ctx.measureText(lab).width+2.4;
      ctx.fillStyle=wt?"#b00010":fl&(4096|8192)?"#b98a00":"#1c7a3c";ctx.fillRect(-tw/2,-3.4,tw,4.4);ctx.fillStyle="#fff";ctx.fillText(lab,0,0);
      ctx.font="bold 1.9px ui-monospace,monospace";ctx.fillStyle=wt?"#ff8a8a":"#ddd";ctx.fillText(wt?"STRAFE · HÄNDE WEG":fl&4096?"REIFENWECHSEL":fl&8192?"REPARATUR":"FERTIG",0,-4.3);ctx.restore();}
    else ctx.restore();}
  if(fr.sc){const q=posXY(fr.sc[0],fr.sc[1]);ctx.save();ctx.translate(q.x,q.y);ctx.rotate(q.ang);
    ctx.fillStyle="#d8dde3";ctx.fillRect(-7,-3.2,14,6.4);ctx.fillStyle="#ff9d00";ctx.fillRect(-1.5,-3.2,3,6.4);ctx.fillStyle="#111";ctx.fillRect(1,-2.4,3,4.8);ctx.restore();}
  if(fr.nk)drawNukeAir(ctx,fr);
  ctx.restore();
  if(fr.nk)drawNukeFlash(ctx,fr,W,H);
  // Labels
  ctx.font="bold 10px ui-monospace,monospace";ctx.textAlign="center";
  const hi=opt.hi||[];
  for(let k=0;k<n;k++){const o=k*5;if(!(fr.a[o+4]&1))continue;
    const isHi=hi.includes(k);if(!(opt.labels==="all"||isHi))continue;
    const q=posXY(fr.a[o],fr.a[o+1]),s=w2s(q.x,q.y,cam,W,H);if(s[0]<-20||s[0]>W+20||s[1]<-20||s[1]>H+20)continue;
    const off=Math.max(12,9.5*cam.z+4),t=roster[k].drv.code;
    ctx.fillStyle=isHi?"#fff":"#000b";ctx.fillRect(s[0]-13,s[1]-off-10,26,12);ctx.fillStyle=isHi?"#000":"#fff";ctx.fillText(t,s[0],s[1]-off-1);}
  if(fr.hz){const q=posXY(fr.hz[0],0),s=w2s(q.x,q.y,cam,W,H);ctx.font="bold 18px system-ui";ctx.fillStyle="#ffd400";ctx.fillText("⚠",s[0],s[1]-16);}
  if(fr.sc){const q=posXY(fr.sc[0],fr.sc[1]),s=w2s(q.x,q.y,cam,W,H);ctx.font="bold 10px ui-monospace,monospace";ctx.fillStyle="#ff9d00";ctx.fillText("SC",s[0],s[1]-12);}
  ctx.textAlign="left";
  if(fr.rain>0.03){ctx.strokeStyle=`rgba(170,200,255,${0.12+0.3*fr.rain})`;ctx.lineWidth=1;ctx.beginPath();
    const cnt=Math.floor(40+160*fr.rain),ph=(fr.t*900)%H;for(let i=0;i<cnt;i++){const x=(i*97.3)%W,y=((i*53.7)+ph)%H;ctx.moveTo(x,y);ctx.lineTo(x-3,y+9);}ctx.stroke();}
}
/* Boxencrew im Koordinatensystem des Autos: wartet mit Abstand, hebt an und wechselt Reifen, repariert */
function drawCrew(ctx,fl,u,drv,t){const col=drv.color,W4=[[4.6,-3],[4.6,3],[-4.9,-3],[-4.9,3]];
  const man=(x,y)=>{ctx.fillStyle="#0b0b0b";ctx.beginPath();ctx.arc(x,y,1.15,0,7);ctx.fill();ctx.fillStyle=col;ctx.beginPath();ctx.arc(x,y,0.95,0,7);ctx.fill();ctx.fillStyle="#f4f4f4";ctx.beginPath();ctx.arc(x,y,0.42,0,7);ctx.fill();};
  const tyre=(x,y,c2)=>{ctx.fillStyle="#0a0a0a";ctx.fillRect(x-1.35,y-0.75,2.7,1.5);ctx.fillStyle=c2;ctx.fillRect(x-0.5,y-0.75,1,1.5);};
  const ease=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
  if(fl&2048){      // Strafe läuft: alle stehen mit Abstand bereit, niemand berührt das Auto
    for(const w of W4){const s=Math.sign(w[1]);man(w[0],w[1]+s*4.2);man(w[0]+2.4,w[1]+s*5.2);tyre(w[0]+2.4,w[1]+s*6.9,"#d33");}
    man(12.5,-1.2);man(-12.6,1.2);ctx.strokeStyle="#ffffff";ctx.lineWidth=0.25;ctx.setLineDash([0.8,0.8]);ctx.strokeRect(-9.3,-5.4,18.6,10.8);ctx.setLineDash([]);
  }else if(fl&4096){ // ein durchgehender Ablauf: Wagenheber ansetzen (0–15 %), alte Reifen ab (15–45 %), neue dran (45–80 %), Wagenheber runter (80–100 %)
    const jack=ease(u/0.15)*(1-ease((u-0.82)/0.18)),off=ease((u-0.15)/0.3),on=ease((u-0.45)/0.35);
    ctx.strokeStyle="#c9ced6";ctx.lineWidth=0.7;ctx.beginPath();ctx.moveTo(7.6,0);ctx.lineTo(7.6+2.6*jack,0);ctx.moveTo(-7.7,0);ctx.lineTo(-7.7-2.6*jack,0);ctx.stroke();man(10.9,0);man(-11.1,0);
    for(const w of W4){const s=Math.sign(w[1]);man(w[0]-1.5,w[1]+s*1.5);                    // Schlagschrauber bleibt am Rad
      tyre(w[0]+1.6,w[1]+s*(2.6+off*4.2),"#888");man(w[0]+1.6,w[1]+s*(3.8+off*4.2));         // alter Reifen wird weggezogen
      tyre(w[0]+0.2,w[1]+s*(6.6-on*4.2),"#d33");man(w[0]+0.2,w[1]+s*(7.8-on*4.2));           // neuer Reifen kommt heran
      if(jack>0.9&&((u>0.12&&u<0.2)||(u>0.76&&u<0.84))&&Math.sin(t*40+w[0])>0){ctx.fillStyle="#ffd84a";ctx.fillRect(w[0]-0.4,w[1]+s*0.3,0.8,0.5);}}   // Schrauber lösen / anziehen
  }else if(fl&8192){ // Reparatur: Frontflügel abnehmen und neuen ansetzen
    const out=ease(u/0.4),inn=ease((u-0.5)/0.4);man(9.6,-2.4);man(9.6,2.4);
    ctx.fillStyle="#555";ctx.fillRect(7.6+out*4,-2.9,1.2,5.8);                                // alter Flügel wandert weg
    ctx.fillStyle=col;ctx.fillRect(13-inn*5.4,-2.9,1.2,5.8);man(14.4-inn*5.4,0);              // neuer Flügel kommt heran
    for(const w of W4){const s=Math.sign(w[1]);man(w[0],w[1]+s*3.6);}
  }else{for(const w of W4){const s=Math.sign(w[1]);man(w[0],w[1]+s*4.4);}man(12.5,-3.5);}}
/* Rauch, Staub, Gischt, Trümmer – aus den letzten Bildern berechnet, läuft deshalb auch im Replay vor- und rückwärts */
function drawFx(ctx,fr,hist,n){const wet=fr.wet||0,N=hist.length;
  for(let j=N-1;j>=-1;j--){const f=j<0?fr:hist[j];if(!f||f.a.length!==fr.a.length)continue;const age=(j+1)/(N+1);
    for(let k=0;k<n;k++){const o=k*5,fl=f.a[o+4];if(!(fl&1))continue;const v=f.a[o+3];
      const sm=fl&64,du=fl&512,cr=(fl&16)&&v>14,sp=wet>0.22&&v>55&&!(fl&128)&&(j&1);
      if(!(sm||du||cr||sp||(fl&8)))continue;
      const q=posXY(f.a[o],f.a[o+1]),h=q.ang+f.a[o+2],cx=Math.cos(h),sx=Math.sin(h),sd=k*7.13+f.t*31;
      const P_=(lx,ly,r,col)=>{ctx.fillStyle=col;ctx.beginPath();ctx.arc(q.x+lx*cx-ly*sx+Math.sin(sd+lx)*age*2.5,q.y+lx*sx+ly*cx+Math.cos(sd*1.7+ly)*age*2.5,r,0,7);ctx.fill();};
      if(sp)P_(-9,0,2.2+age*6,`rgba(205,222,240,${(0.2*Math.min(1,wet*1.6)*(1-age)).toFixed(3)})`);
      if(du){const a=(0.3*(1-age)).toFixed(3);P_(-5,-2.4,1.8+age*6.5,`rgba(176,140,92,${a})`);P_(-5,2.4,1.8+age*6.5,`rgba(176,140,92,${a})`);}
      if(sm){const a=(0.26*(1-age)).toFixed(3),r=1.1+age*4.2;P_(4.4,-2.5,r,`rgba(232,232,236,${a})`);P_(4.4,2.5,r,`rgba(232,232,236,${a})`);
        if(fl&16||Math.abs(f.a[o+2])>0.5){P_(-4.8,-2.5,r,`rgba(232,232,236,${a})`);P_(-4.8,2.5,r,`rgba(232,232,236,${a})`);}}
      if(cr)P_(0,0,2.5+age*7,`rgba(70,70,76,${(0.2*(1-age)).toFixed(3)})`);
      {if((fl&8)&&j%3===0){ctx.fillStyle=`rgba(215,215,220,${(0.9*(1-age)).toFixed(2)})`;for(let m=0;m<4;m++){const an=k*2.3+m*1.57+j,rr=4+age*12;ctx.fillRect(q.x+Math.cos(an)*rr,q.y+Math.sin(an)*rr,1.2,0.9);}}}
    }}}
/* Zwischenbild aus zwei Simulationsschritten – macht die Bewegung bei 60 Bildern pro Sekunde flüssig */
function lerpFrame(f0,f1,t,tmp){if(!tmp.a||tmp.a.length!==f1.a.length)tmp.a=new Float32Array(f1.a.length);const a=tmp.a,n=f1.a.length;if(f0.a.length!==n)return f1;
  for(let k=0;k<n;k+=5){a[k]=f0.a[k]+(f1.a[k]-f0.a[k])*t;a[k+1]=f0.a[k+1]+(f1.a[k+1]-f0.a[k+1])*t;{let da=f1.a[k+2]-f0.a[k+2];da-=Math.round(da/6.2832)*6.2832;a[k+2]=f0.a[k+2]+da*t;}a[k+3]=f1.a[k+3];a[k+4]=f1.a[k+4];}
  tmp.e=f1.e;tmp.db=f1.db;tmp.nk=f1.nk;tmp.fm=f1.fm;tmp.sec=f1.sec;tmp.li=f1.li;tmp.wet=f1.wet;tmp.rain=f1.rain;tmp.hz=f1.hz;tmp.px=f1.px;tmp.t=f0.t+(f1.t-f0.t)*t;
  tmp.sc=f1.sc&&f0.sc?[f0.sc[0]+(f1.sc[0]-f0.sc[0])*t,f0.sc[1]+(f1.sc[1]-f0.sc[1])*t]:f1.sc;return tmp;}
function hud(ctx,W,text,col,right){ctx.font="bold 11px ui-monospace,monospace";
  if(text){const w=ctx.measureText(text).width+12;ctx.fillStyle=col||"#000a";ctx.fillRect(8,8,w,18);ctx.fillStyle=col?"#000":"#fff";ctx.fillText(text,14,21);}
  if(right){const w=ctx.measureText(right).width+12;ctx.fillStyle="#000a";ctx.fillRect(W-w-8,8,w,18);ctx.fillStyle="#cfd4dc";ctx.fillText(right,W-w-2,21);}}
const camFit=(W,H)=>({x:(TB.x0+TB.x1)/2,y:(TB.y0+TB.y1)/2,z:Math.min(W/(TB.x1-TB.x0+150),H/(TB.y1-TB.y0+150)),rot:0});
function camCar(fr,k,z,rot){const q=posXY(fr.a[k*5],fr.a[k*5+1]),v=Math.max(0,fr.a[k*5+3]),la=Math.min(28,v*0.16)/Math.max(1,z*0.6),f=posXY(fr.a[k*5]+la,fr.a[k*5+1]);return {x:q.x+(f.x-q.x)*0.7,y:q.y+(f.y-q.y)*0.7,z,rot:rot?q.ang+Math.PI/2:0};}

/* ---- Regenradar ---- */
function drawRadar(cv){const c=cv.getContext("2d"),W=cv.width,H=cv.height,wx=S.wx,sc=W/900;
  c.fillStyle="#06110b";c.fillRect(0,0,W,H);c.save();c.translate(W/2,H/2);
  c.strokeStyle="#12301f";c.lineWidth=1;for(const r of [100,200,300,400]){c.beginPath();c.arc(0,0,r*sc,0,7);c.stroke();}
  c.beginPath();c.moveTo(-W,0);c.lineTo(W,0);c.moveTo(0,-H);c.lineTo(0,H);c.stroke();
  for(const k of wx.cells)drawCell(c,k,sc,1);
  c.save();{const kk=sc*90/Math.max(TB.x1-TB.x0,TB.y1-TB.y0);c.scale(kk,kk);}c.translate(-(TB.x0+TB.x1)/2,-(TB.y0+TB.y1)/2);c.lineWidth=30;c.strokeStyle="#fff";c.stroke(P.center);c.restore();
  c.strokeStyle="#7fb0ff";c.fillStyle="#7fb0ff";c.lineWidth=2;const ax=-W/2+26,ay=-H/2+26;
  c.beginPath();c.moveTo(ax-Math.cos(wx.wind)*12,ay-Math.sin(wx.wind)*12);c.lineTo(ax+Math.cos(wx.wind)*12,ay+Math.sin(wx.wind)*12);c.stroke();
  c.beginPath();c.arc(ax+Math.cos(wx.wind)*12,ay+Math.sin(wx.wind)*12,3.5,0,7);c.fill();
  c.restore();if(!wx.desert)drawForecast(c,W,H);}
function wxText(){const wx=S.wx,i=wx.rain;let t;
  if(i>0.03)t=`Regen: <b>${i>0.75?"stark":i>0.4?"mittel":"leicht"}</b>`+(wx.endIn>0?` · lässt in ca. ${Math.round(wx.endIn)}s nach`:"");
  else if(wx.eta<Infinity)t=`Regen in ca. <b>${Math.round(wx.eta*0.8)}–${Math.round(wx.eta*1.25)}s</b> erwartet`;
  else t="Kein Regen in Sicht";
  t+=`<br>Wind: <b>${Math.round(wx.windKmh||0)} km/h</b>`+((wx.windKmh||0)>30?" · böig, Autos in schnellen Kurven instabil":(wx.windKmh||0)>18?" · spürbar":"")+(wx.desert?" · Wüstenstrecke, kein Regen":"");
  {const pd=pudDepth(wx.wet,wx.rain);if(pd>0.05)t+=`<br>Stehendes Wasser: <b style="color:${pd>0.5?"#ff6b5a":"#f2c94c"}">${pd>0.5?"tief":"bildet sich"}</b> an ${S.pud.length} Stellen · Aquaplaning-Gefahr`+(S.aquaLog&&S.aquaLog.length?` · ${S.aquaLog.length} Fälle zuletzt`:"");}
  return t+`<br>Strecke: <b>${wx.wet<0.05?"trocken":wx.wet<0.25?"feucht":wx.wet<0.6?"nass":"sehr nass"}</b> (${Math.round(wx.wet*100)}%)`+(wx.amp>0.2&&wx.wet>0.08?` · am nassesten in S${[0,1,2].map(k=>wetAt((k+0.5)*L/3)).reduce((b,v,i,a)=>v>a[b]?i:b,0)+1}`:"");}

/* ============ Replay ============ */
const R={inc:null,pos:0,rate:0.25,dir:1,playing:true,cam:"corner",zoom:6,focus:0,who:null,tmp:null};
const RULES_K={ers:"Energie 2026: Die MGU-K darf pro Runde nur eine festgelegte Energiemenge ernten (je nach Strecke 8,5 oder 9 MJ). Jede Überschreitung ist ein messbarer Vorteil → Drive-Through.",
  tl:"Die weiße Linie gehört zur Strecke. Berührt mindestens ein Rad noch die Linie, ist es legal. Alle vier Räder dahinter = Verstoß. Quali: Runde streichen. Rennen: 3 Verstöße Verwarnung, der 4. gibt 5 Sekunden.",
  inc:"Klar verschuldete Kollision (Gegner dreht sich, fällt aus oder wird beschädigt – auch Auffahrunfall): 10 Sek. · Abdrängen komplett von der Strecke (am Ausgang oder durch Verbremser innen): 5 Sek. · Überholen neben der Strecke mit behaltenem Platz: Anweisung „Platz zurückgeben“; ist der Gegner schon zu weit weg, 5 Sek. · Rad an Rad mit leichter Berührung, Platz gelassen oder Platz zurückgegeben: keine Strafe.",
  yellow:"Überholen unter gelber Flagge ist ein Sicherheitsverstoß: Durchfahrtsstrafe.",
  impede:"Impeding: Ein langsames Auto bleibt auf der Ideallinie und zwingt ein Auto auf schneller Runde vom Gas – 3 Startplätze. Macht es rechtzeitig Platz: keine Strafe.",
  unsafe:"Unsichere Freigabe: Muss ein anderes Auto in der Fast Lane deutlich bremsen oder ausweichen, gibt es 5 Sekunden. Kein Einfluss: keine Strafe.",
  jump:"Bewegt sich das Auto, bevor die roten Lichter erlöschen, ist es ein Frühstart: 5 Sekunden.",
  pitline:"Boxenausfahrt: Bis zum Ende der weißen Linie darf kein Teil des Autos die Linie überfahren. Rennen: 5 Sekunden. Training/Quali: Verwarnung. Rad nur an der Linie: kein Verstoß.",
  speed:"Limit in der Boxengasse: 80,0 km/h. Darüber: 5 Sekunden.",
  delta:"Unter VSC muss jedes Auto über der Referenzzeit bleiben (positives Delta). Negatives Delta = zu schnell: 5 Sekunden.",
  gridpos:"Das Auto muss beim Start komplett innerhalb seiner Startbox stehen. Vorderräder vor der Markierung: 5 Sekunden.",
  serve:"Während eine Zeitstrafe abgesessen wird, darf niemand das Auto berühren. Die Standuhr über dem Auto läuft ab dem Stillstand. Geht ein Mechaniker ans Auto, bevor die Strafzeit voll ist, wurde sie nicht korrekt abgesessen: 10 Sekunden.",
  info:"Nur zur Ansicht – keine Entscheidung nötig."};
const OPTS_K={ers:["Innerhalb des Limits","Drive-Through (Energielimit überschritten)"],pitline:["Kein Verstoß","Linie überfahren – Strafe"],tl:["Kein Verstoß","Verstoß"],impede:["Keine Strafe","3 Startplätze (Impeding)"],unsafe:["Keine Strafe","5 Sek. (Unsafe Release)"],
  jump:["Legaler Start","5 Sek. (Frühstart)"],speed:["Keine Strafe","5 Sek. (Speeding)"],
  delta:["Keine Strafe","5 Sek. (VSC-Delta)"],gridpos:["Position korrekt","5 Sek. (falsche Startposition)"],serve:["Korrekt abgesessen","10 Sek. (Strafe nicht korrekt abgesessen)"]};
function openReplay(inc,hearing){R.hearing=!!hearing;if(hearing&&inc.status==="deferred")inc.status="open";
  R.inc=inc;R.pos=Math.max(0,inc.atIdx-Math.round(2.5/DT));R.rate=0.5;R.dir=1;R.playing=true;R.focus=0;R.who=null;
  R.cam=["unsafe","pitline","jump","speed","gridpos","serve","delta","inc","impede","yellow"].includes(inc.kind)?"heli":"corner";if(inc.kind==="inc"&&inc.cars.length>1)R.focus=1;R.zoom=inc.kind==="tl"?9:inc.kind==="unsafe"?5:5.5;
  R.prevSpeed=UI.speed;UI.speed=0;
  const cars=inc.cars,isDec=inc.status==="open";
  let h=`<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px"><h2 style="margin:0;flex:1">${esc(inc.title)}</h2>
    <span class="chip">${inc.tag}</span><button class="ghost" id="rpClose">Schließen · Esc</button></div><div class="rp"><div>
    <div style="position:relative"><canvas id="rpCv" width="960" height="540"></canvas><canvas id="rpTele" width="380" height="270" style="position:absolute;left:10px;bottom:10px;width:38%;max-width:380px;border-radius:10px;pointer-events:none;display:none"></canvas></div>
    <div class="rpbar"><span class="lbl">Kamera</span>
      <button class="ghost" data-cam="corner">Kurven-Cam</button><button class="ghost" data-cam="heli">Heli</button>
      <button class="ghost" data-cam="chase">Onboard-Chase</button><button class="ghost" data-cam="pov">Cockpit</button><button class="ghost" data-cam="all">Übersicht</button>
      <span class="lbl">Fokus</span>${cars.map((c,i)=>`<button class="ghost" data-foc="${i}">${c.drv.code}</button>`).join("")}
      <span class="lbl">Zoom</span><input type="range" id="rpZoom" min="1" max="16" step="0.1"><button class="ghost" id="rpTel">📈 Telemetrie</button></div>
    <div class="rpbar"><button class="ghost" id="rpPlay">⏸</button><button class="ghost" id="rpRev">◀ Rückwärts</button>
      <span class="lbl">Tempo</span>${[0.1,0.25,0.5,1].map(r=>`<button class="ghost" data-rate="${r}">${r}×</button>`).join("")}
      <button class="ghost" id="rpB">−1 Bild</button><button class="ghost" id="rpF">+1 Bild</button>
      <input type="range" id="rpScrub" min="0" max="${inc.clip.length-1}" step="0.01"></div></div>
    <div><div class="hint"><b>Beteiligt:</b><br>${cars.map(c=>`<span style="color:${c.drv.color}">■</span> ${c.drv.num} ${esc(c.drv.name)} · ${TEAMS[c.drv.team].name}`).join("<br>")}</div>
    ${inc.data?`<div class="fbk mid">${esc(inc.data)}</div>`:""}
    ${(R.hearing||inc.protest)?(()=>{const hi=hearingInfo(inc);return `<h4>${inc.protest?"Protest von "+esc(inc.protest):"Anhörung"}</h4>${hi.s.map(x=>`<div class="hint" style="margin-bottom:5px"><b>${x[0]}:</b> „${esc(x[1])}“</div>`).join("")}${hi.tel?`<div class="fbk mid">${esc(hi.tel)}</div>`:""}`;})():""}
    <h4>Reglement</h4><div class="hint">${RULES_K[inc.kind]}</div>${panelHtml(inc)}<h4>Entscheidung der Stewards</h4><div class="dec" id="rpDec"></div><div id="rpFb"></div></div></div>`;
  const m=$("modal");m.className="modal wide";m.innerHTML=h;$("overlay").classList.add("show");
  $("rpClose").onclick=closeReplay;
  m.querySelectorAll("[data-cam]").forEach(b=>b.onclick=()=>{R.cam=b.dataset.cam;if(R.cam==="all")R.zoom=1;else if(R.zoom<2)R.zoom=5.5;rpSync();});
  m.querySelectorAll("[data-foc]").forEach(b=>b.onclick=()=>{R.focus=+b.dataset.foc;if(R.cam==="corner"||R.cam==="all")R.cam="heli";rpSync();});
  m.querySelectorAll("[data-rate]").forEach(b=>b.onclick=()=>{R.rate=+b.dataset.rate;R.playing=true;rpSync();});
  $("rpZoom").oninput=e=>{R.zoom=+e.target.value;};
  $("rpPlay").onclick=()=>{R.playing=!R.playing;rpSync();};
  $("rpRev").onclick=()=>{R.dir=-R.dir;R.playing=true;rpSync();};
  {const tb=$("rpTel"),sh=()=>{$("rpTele").style.display=UI.tele?"block":"none";tb.classList.toggle("on",!!UI.tele);};sh();tb.onclick=()=>{UI.tele=!UI.tele;sh();};}
  $("rpB").onclick=()=>{R.playing=false;R.pos=Math.max(0,Math.round(R.pos)-1);rpSync();};
  $("rpF").onclick=()=>{R.playing=false;R.pos=Math.min(inc.clip.length-1,Math.round(R.pos)+1);rpSync();};
  $("rpScrub").oninput=e=>{R.pos=+e.target.value;R.playing=false;rpSync();};
  $("rpCv").onwheel=e=>{e.preventDefault();R.zoom=clamp(R.zoom*(e.deltaY<0?1.12:0.89),1,16);};
  rpDecision();rpSync();}
function rpSync(){const m=$("modal");if(!R.inc)return;
  m.querySelectorAll("[data-cam]").forEach(b=>b.classList.toggle("on",b.dataset.cam===R.cam));
  m.querySelectorAll("[data-foc]").forEach(b=>b.classList.toggle("on",+b.dataset.foc===R.focus));
  m.querySelectorAll("[data-rate]").forEach(b=>b.classList.toggle("on",+b.dataset.rate===R.rate));
  $("rpPlay").textContent=R.playing?"⏸":"▶";$("rpRev").classList.toggle("on",R.dir<0);}
function rpDecision(){const inc=R.inc,d=$("rpDec");
  if(inc.status!=="open"){d.innerHTML=inc.kind==="info"?`<div class="hint">Replay ohne Entscheidung.</div>`:"";
    if(inc.status==="done"&&!FB_LIVE)$("rpFb").innerHTML=`<div class="fbk mid">Entscheidung veröffentlicht. Die Bewertung der FIA folgt nach dem Rennen.</div>`;
    else if(inc.status==="done")$("rpFb").innerHTML=`<div class="fbk ${inc.ok&&inc.pts>=100?"ok":inc.pts>0?"mid":"bad"}">${inc.ok&&inc.pts>=100?"✔ Richtig":inc.pts>0?(inc.applied&&inc.applied.dsq?"≈ Richtiger Fahrer, aber viel zu hart":"≈ Vertretbar, aber nicht die beste Entscheidung"):"✘ Falsch"} (${inc.pts>0?"+":""}${inc.pts}). ${esc(inc.explain||"")}</div>`;
    return;}
  let h="";
  if(inc.kind==="inc"){h+=`<div class="hint">Wer ist schuld?</div><div class="who">${inc.cars.map((c,i)=>`<button data-who="${i}" class="${R.who===i?"on":""}">${c.drv.code}</button>`).join("")}</div>
    <button data-v="0">Keine Strafe (Rennunfall)</button><button class="pen" data-v="5">5 Sek.</button><button class="pen" data-v="10">10 Sek.</button><button class="pen" data-v="20">Durchfahrtsstrafe</button>`;
    if(inc.sessType==="race"&&inc.cars.length>1&&!R.hearing&&S&&!S.ended)h+=`<button class="pen" data-v="swap">Platz zurückgeben (Anweisung per Funk)</button>`;}
  else if(inc.kind==="yellow")h+=`<button data-v="0">Keine Strafe</button><button class="pen" data-v="5">5 Sek.</button><button class="pen" data-v="10">10 Sek.</button><button class="pen" data-v="20">Durchfahrtsstrafe</button>`;
  else{const o=OPTS_K[inc.kind];let a=o[0],b=o[1];if(inc.kind==="tl"){a=inc.sessType==="race"?"Kein Verstoß":"Runde gültig";b=inc.sessType==="race"?"Verstoß notieren":"Runde streichen";}
    h+=`<button data-s="ok">${a}</button><button class="pen" data-s="pen">${b}</button>`;}
  h+=`<button class="pen" data-v="dsq" style="background:#3a1010;border-color:#7a2020">Disqualifikation (schwarze Flagge)</button>`;
  if(inc.sessType==="race"&&!R.hearing&&S&&!S.ended)h+=`<button data-def="1" style="margin-top:14px;border-style:dashed">Nach dem Rennen untersuchen (Anhörung)</button>`;
  d.innerHTML=h;
  d.querySelectorAll("[data-def]").forEach(b=>b.onclick=()=>{inc.status="deferred";addLog(`${inc.title.toUpperCase()} – WILL BE INVESTIGATED AFTER THE RACE`,"flag");uiInbox();uiSession();closeReplay();});
  d.querySelectorAll("[data-who]").forEach(b=>b.onclick=()=>{R.who=+b.dataset.who;rpDecision();});
  d.querySelectorAll("[data-v]").forEach(b=>b.onclick=()=>{let v=b.dataset.v;const sp=v==="swap"||v==="dsq";if(!sp)v=+v;
    if(sp){if(inc.kind==="inc"){if(R.who==null){$("rpFb").innerHTML=`<div class="fbk mid">Erst auswählen, wen es betrifft.</div>`;return;}decide(inc,{who:inc.cars[R.who],pen:v});}else decide(inc,"dsq");rpDecision();return;}
    if(inc.kind==="inc"){if(v>0&&R.who==null){$("rpFb").innerHTML=`<div class="fbk mid">Erst auswählen, wer die Strafe bekommt.</div>`;return;}
      decide(inc,{who:v>0?inc.cars[R.who]:null,pen:v});}else decide(inc,v);rpDecision();});
  d.querySelectorAll("[data-s]").forEach(b=>b.onclick=()=>{decide(inc,b.dataset.s);rpDecision();});}
function closeReplay(){if(!R.inc)return;const inc=R.inc;R.inc=null;
  if(R.hearing){R.hearing=false;if(inc.status==="open")inc.status="deferred";uiHearing();return;}
  $("overlay").classList.remove("show");$("modal").className="modal";setSpeed(R.prevSpeed||1);}
function rpFrame(rdt){const inc=R.inc,cl=inc.clip,cv=$("rpCv");if(!cv||!cl.length)return;
  if(R.playing){R.pos+=R.dir*R.rate*rdt/DT;if(R.pos>=cl.length-1){R.pos=R.dir>0?0:cl.length-1;}if(R.pos<0)R.pos=cl.length-1;}
  const i=Math.floor(R.pos),t=R.pos-i,f0=cl[i],f1=cl[Math.min(cl.length-1,i+1)];
  if(!R.tmp||R.tmp.a.length!==f0.a.length)R.tmp={a:new Float32Array(f0.a.length)};
  const fr=R.tmp;for(let k=0;k<f0.a.length;k+=5){fr.a[k]=f0.a[k]+(f1.a[k]-f0.a[k])*t;fr.a[k+1]=f0.a[k+1]+(f1.a[k+1]-f0.a[k+1])*t;
    {let da=f1.a[k+2]-f0.a[k+2];da-=Math.round(da/6.2832)*6.2832;fr.a[k+2]=f0.a[k+2]+da*t;}fr.a[k+3]=f0.a[k+3];fr.a[k+4]=f0.a[k+4];}
  fr.fm=f0.fm;fr.sec=f0.sec;fr.li=f0.li;fr.wet=f0.wet;fr.rain=f0.rain;fr.sc=f0.sc;fr.hz=f0.hz;fr.px=f0.px;fr.t=f0.t+(f1.t-f0.t)*t;fr.e=f0.e;fr.db=f0.db;fr.nk=f0.nk;
  const c=cv.getContext("2d"),W=cv.width,H=cv.height,fc=inc.cars[Math.min(R.focus,inc.cars.length-1)],k=inc.roster.indexOf(fc);
  let cam;
  if(R.cam==="all")cam=camFit(W,H),cam.z*=Math.max(1,R.zoom);
  else if(R.cam==="corner"){const q=posXY(inc.pos,0);cam={x:q.x,y:q.y,z:R.zoom,rot:0};}
  else cam=camCar(fr,k,R.zoom,R.cam==="chase");
  if(R.cam==="all"){const q=posXY(inc.pos,0);if(cam.z>1.2){cam.x=q.x;cam.y=q.y;}}
  const hist=[];for(let j=1;j<=16&&i-j>=0;j++)hist.push(cl[i-j]);
  if(R.cam==="pov"){c.save();c.setTransform(1,0,0,1,0,0);drawPOV(c,W,H,fr,inc.roster,k);c.restore();}
  else drawScene(c,W,H,cam,fr,inc.roster,{hist,labels:cam.z>=2.5?"all":"",hi:inc.cars.map(x=>inc.roster.indexOf(x)),grid:inc.sessType==="race"&&(inc.kind==="jump"||inc.kind==="gridpos"),showLights:inc.kind==="jump"});
  const dtv=(R.pos-inc.atIdx)*DT;
  hud(c,W,`REPLAY · ${R.dir<0?"◀ ":""}${R.rate}× · T ${dtv>=0?"+":""}${dtv.toFixed(2)}s · F ${String(i).padStart(3,"0")}/${cl.length-1}`,"#ffd400",
    `${fc.drv.code}: ${Math.round(Math.max(0,fr.a[k*5+3])*KMH)} KM/H`+(inc.kind==="jump"?` · LICHTER ${fr.li>0?"AN ("+fr.li+")":"AUS"}`:"")+(fr.fm!=="green"?" · "+fr.fm.toUpperCase():fr.sec.some(x=>x)?" · GELB S"+(fr.sec.findIndex(x=>x)+1):""));
  if(UI.tele)drawTele(cl,R.pos);
  const sc=$("rpScrub");if(document.activeElement!==sc)sc.value=R.pos;
  const z=$("rpZoom");if(document.activeElement!==z)z.value=R.zoom;}
/* ---- Telemetrie-Panel im Replay ---- */
const GEARS=[0,85,120,155,190,225,262,298];
function teleAt(fr,ci){const o=ci*5,v=Math.max(0,fr.a[o+3]),fl=fr.a[o+4],e=fr.e;return {s:fr.a[o],lat:fr.a[o+1],v,kmh:v*KMH,fl,brk:!!(fl&4),soc:e?e[ci*5]/255:null,thr:e?e[ci*5+1]/255:(fl&4?0:1),ers:e?e[ci*5+2]:0,om:!!(fl&2)};}
function drawTele(cl,pos){const cv=$("rpTele");if(!cv)return;const g=cv.getContext("2d"),W_=cv.width,H_=cv.height,inc=R.inc,car=inc.cars[R.focus]||inc.cars[0],ci=S.cars.indexOf(car);if(ci<0)return;
  const i=Math.floor(pos),f=cl[i],fp=cl[Math.max(0,i-3)],d=teleAt(f,ci),dp=teleAt(fp,ci);
  g.clearRect(0,0,W_,H_);g.fillStyle="rgba(8,12,18,0.88)";g.fillRect(0,0,W_,H_);g.strokeStyle="#2a3442";g.strokeRect(0.5,0.5,W_-1,H_-1);
  g.fillStyle=car.drv.color;g.fillRect(0,0,5,H_);g.fillStyle="#fff";g.font="bold 13px ui-monospace,monospace";g.fillText(`TELEMETRIE · #${car.drv.num} ${car.drv.code}`,14,20);
  const t=(pos-inc.atIdx)*DT*(W&&W.cs||1);g.fillStyle="#8a96a8";g.font="11px ui-monospace,monospace";g.fillText(`T ${t>=0?"+":""}${t.toFixed(2)} s`,W_-90,20);
  // Tempo & Gang
  const pp=mod(d.s),inPit=f.a[ci*5+3]<0||((pp>=PIT_IN_S||pp<=PIT_OUT_S)&&d.lat*SIDE<-14)||(d.lat*SIDE<-14&&d.lat*SIDE>-40&&(pp>=PIT_ENTRY_S||pp<=PIT_EXIT_S));const inLim=inPit&&(pp>=PIT_IN_S||pp<=PIT_OUT_S);const kmh=f.a[ci*5+3]<0?0:d.kmh,gear=kmh<3?"N":GEARS.filter(x=>kmh>=x).length;
  g.fillStyle="#fff";g.font="bold 34px ui-monospace,monospace";g.fillText(Math.round(kmh),14,62);g.font="11px ui-monospace,monospace";g.fillStyle="#8a96a8";g.fillText("km/h",14+String(Math.round(kmh)).length*21,62);
  g.strokeStyle="#3a4452";g.strokeRect(118,32,34,34);g.fillStyle="#f2c94c";g.font="bold 22px ui-monospace,monospace";g.fillText(gear,128,58);g.font="9px ui-monospace,monospace";g.fillStyle="#8a96a8";g.fillText("GANG",120,76);
  // Gas / Bremse
  const bar=(x,lbl,v,col)=>{g.fillStyle="#1b232c";g.fillRect(x,30,16,52);g.fillStyle=col;const h=52*clamp(v,0,1);g.fillRect(x,82-h,16,h);g.fillStyle="#8a96a8";g.font="9px ui-monospace,monospace";g.fillText(lbl,x-2,94);};
  bar(168,"GAS",d.thr,"#2fd16b");bar(192,"BRE",d.brk?(d.fl&64?1:0.85):0,"#e10600");
  // Lenkung
  const ix=sidx(mod(d.s)),dl=(d.lat-dp.lat)/Math.max(0.05,3*DT)/Math.max(10,d.v),st=kmh<8?0:clamp(T.k[ix]*SIDE*16+dl*2.2+(f.a[ci*5+2]-fp.a[ci*5+2])*0.6,-1,1);
  g.save();g.translate(262,56);g.strokeStyle="#3a4452";g.lineWidth=5;g.beginPath();g.arc(0,0,22,0,7);g.stroke();g.rotate(st*1.6);g.strokeStyle="#e6e9ee";g.lineWidth=3;g.beginPath();g.moveTo(-22,0);g.lineTo(22,0);g.moveTo(0,0);g.lineTo(0,18);g.stroke();g.restore();
  g.fillStyle="#8a96a8";g.font="9px ui-monospace,monospace";g.fillText(`LENKUNG ${st>0.04?"◀":st<-0.04?"▶":"·"} ${Math.round(Math.abs(st)*100)}%`,228,94);
  // ERS
  if(d.soc!=null){g.fillStyle="#1b232c";g.fillRect(310,30,58,22);g.fillStyle=d.ers===2?"#e10600":d.soc<0.2?"#f2c94c":"#2fd16b";g.fillRect(312,32,54*d.soc,18);g.fillStyle="#fff";g.font="bold 11px ui-monospace,monospace";g.fillText(Math.round(d.soc*100)+"%",324,46);
    g.fillStyle="#8a96a8";g.font="9px ui-monospace,monospace";g.fillText("ERS",310,64);g.fillStyle=["#7fb0ff","#2fd16b","#e10600","#c38bff"][d.ers];g.fillText(["Deploy","Ernte","Clipping","Overtake"][d.ers]+(d.om?" · OM":""),310,76);}
  // Zusatzzeile: Abstand / Delta / Position
  g.font="11px ui-monospace,monospace";g.fillStyle="#cfd8e3";const lines=[];
  const other=inc.cars.find(c=>c!==car);if(other){const oi=S.cars.indexOf(other);if(oi>=0){const ds=f.a[oi*5]-d.s,gap=ds/Math.max(5,d.v);lines.push(`Abstand zu ${other.drv.code}: ${ds>=0?"+":""}${ds.toFixed(1)} m`+(kmh>30&&Math.abs(gap)<20?` · ${gap>=0?"+":""}${gap.toFixed(2)} s`:""));}}
  lines.push(inPit?"Position: Boxengasse":`Querlage: ${Math.abs(d.lat).toFixed(1)} m von der Mitte ${Math.abs(d.lat)>TL_OFF?"⚠ alle vier Räder über der Linie":""}`);
  if(f.a[ci*5+3]<0)lines.push(`Stopp in der Box: ${(-f.a[ci*5+3]).toFixed(1)} s Standzeit`);else if(inLim&&kmh>20)lines.push(`Tempolimit Boxengasse: ${Math.round(PITV*KMH)} km/h · Abweichung ${(kmh-PITV*KMH>=0?"+":"")}${(kmh-PITV*KMH).toFixed(1)} km/h`);else if(inc.kind==="speed")lines.push(`Noch vor der Limit-Linie – Tempolimit gilt ab Boxenlinie (${Math.round(PITV*KMH)} km/h)`);
  if(inc.kind==="delta"||f.fm==="vsc"||f.fm==="sc")lines.push(`Neutralisierung: ${f.fm.toUpperCase()} · Tempo ${Math.round(kmh)} km/h`);
  {const m=f.e&&f.e.length>=(ci+1)*5?f.e[ci*5+3]|(f.e[ci*5+4]<<8):0;if(m){const nm=Object.keys(DP).filter(k=>m&DP[k]).map(k=>DP_TXT[k].replace(" verloren"," weg").replace("Aufhängung","Aufh.").replace("Seitenkasten","Seitenk."));lines.push("Schaden: "+nm.slice(0,3).join(", ")+(nm.length>3?` +${nm.length-3}`:""));}}
  lines.forEach((l,k)=>g.fillText(l,14,116+k*15));
  // Verlauf über den Clip: Tempo-Linie, Brems-Balken, Cursor
  const gx=14,gy=116+lines.length*15+6,gw=W_-28,gh=H_-gy-10;if(gh<30)return;let vmax=1;for(const fr of cl){const v=Math.max(0,fr.a[ci*5+3]);if(v>vmax)vmax=v;}
  g.fillStyle="#11171f";g.fillRect(gx,gy,gw,gh);
  for(let k=0;k<cl.length;k++){const fr=cl[k],x=gx+k/(cl.length-1)*gw;if(fr.a[ci*5+4]&4){g.fillStyle="rgba(225,6,0,0.35)";g.fillRect(x,gy+gh-6,Math.max(1,gw/cl.length),6);}
    else if(fr.e&&fr.e[ci*5+1]>200){g.fillStyle="rgba(47,209,107,0.3)";g.fillRect(x,gy+gh-6,Math.max(1,gw/cl.length),6);}}
  g.strokeStyle="#7fb0ff";g.lineWidth=1.5;g.beginPath();cl.forEach((fr,k)=>{const x=gx+k/(cl.length-1)*gw,y=gy+gh-8-(Math.max(0,fr.a[ci*5+3])/vmax)*(gh-14);k?g.lineTo(x,y):g.moveTo(x,y);});g.stroke();
  if(cl[0].e){g.strokeStyle="#f2c94c";g.lineWidth=1;g.beginPath();cl.forEach((fr,k)=>{const x=gx+k/(cl.length-1)*gw,y=gy+gh-8-(fr.e[ci*5]/255)*(gh-14);k?g.lineTo(x,y):g.moveTo(x,y);});g.stroke();}
  const xi=gx+inc.atIdx/(cl.length-1)*gw;g.strokeStyle="rgba(255,255,255,0.35)";g.setLineDash([3,3]);g.beginPath();g.moveTo(xi,gy);g.lineTo(xi,gy+gh);g.stroke();g.setLineDash([]);
  const xc=gx+pos/(cl.length-1)*gw;g.strokeStyle="#fff";g.beginPath();g.moveTo(xc,gy);g.lineTo(xc,gy+gh);g.stroke();
  g.fillStyle="#8a96a8";g.font="9px ui-monospace,monospace";g.fillText("━ Tempo",gx+4,gy+10);g.fillStyle="#f2c94c";g.fillText("━ ERS",gx+58,gy+10);g.fillStyle="#e10600";g.fillText("▬ Bremse",gx+104,gy+10);g.fillStyle="#2fd16b";g.fillText("▬ Vollgas",gx+166,gy+10);}
