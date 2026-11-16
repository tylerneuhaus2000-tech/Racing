"use strict";
/* ============ Schadensmodell: einzelne Teile, Trümmer, Auswirkungen ============ */
/* Bitmaske pro Auto (c.dp): Frontflügel links/rechts, Nase, Heckflügel, Rad weg (VL,VR,HL,HR), Aufhängung gebrochen (VL,VR,HL,HR), Seitenkasten L/R, Unterboden */
const DP={fwL:1,fwR:2,nose:4,rw:8,wFL:16,wFR:32,wRL:64,wRR:128,sFL:256,sFR:512,sRL:1024,sRR:2048,spL:4096,spR:8192,floor:16384};
const DP_TXT={fwL:"Frontflügel links",fwR:"Frontflügel rechts",nose:"Nase",rw:"Heckflügel",wFL:"Rad vorne links verloren",wFR:"Rad vorne rechts verloren",wRL:"Rad hinten links verloren",wRR:"Rad hinten rechts verloren",
  sFL:"Aufhängung vorne links gebrochen",sFR:"Aufhängung vorne rechts gebrochen",sRL:"Aufhängung hinten links gebrochen",sRR:"Aufhängung hinten rechts gebrochen",spL:"Seitenkasten links",spR:"Seitenkasten rechts",floor:"Unterboden"};
/* lokale Lage von b relativ zu a: lx>0 vorne, ly>0 rechte Seite (Fahrzeugkoordinaten) */
function localOf(a,bx,by){const A=carBox(a),dx=bx-A.x,dy=by-A.y;return {lx:dx*A.c+dy*A.s,ly:-dx*A.s+dy*A.c};}
function breakPart(c,k,why){if((c.dp||0)&DP[k])return false;c.dp=(c.dp||0)|DP[k];c.dmg=1;c.dmgT=S.t;c.ignoreDmg=false;
  const B=carBox(c),side=/L$/.test(k)?-1:/R$/.test(k)?1:0,front=/^(fw|nose|wF|sF)/.test(k),lx=front?6.5:/^(rw)/.test(k)?-6.8:/^(wR|sR)/.test(k)?-5.2:k==="floor"?0:1.5,ly=side*2.4;
  const wx=B.x+lx*B.c-ly*B.s,wy=B.y+lx*B.s+ly*B.c,v=c.v*0.9,h=Math.atan2(B.s,B.c);
  if(/^w/.test(k)){spawnDeb(wx,wy,Math.cos(h)*v*0.85+(-B.s)*side*rand(6,18),Math.sin(h)*v*0.85+B.c*side*rand(6,18),"wheel",c);
    addLog(`CAR ${c.drv.num} (${c.drv.code}) – ${DP_TXT[k]}!`,"bad");radio(c,pick(["Das Rad ist weg! Das Rad ist weg!","Ich hab ein Rad verloren!","Rad ab, ich komme nicht mehr weit!"]),true,true);}
  else{const n=k==="floor"?2:/^sp/.test(k)?irand(3,5):irand(2,5);
    for(let i=0;i<n;i++)spawnDeb(wx+rand(-1,1),wy+rand(-1,1),Math.cos(h)*v*rand(0.3,0.9)+rand(-12,12),Math.sin(h)*v*rand(0.3,0.9)+rand(-12,12),/^(fw|rw|nose)/.test(k)&&i===0?"wing":"cf",c);}
  dmgEffects(c);return true;}
function dmgEffects(c){const m=c.dp||0,b=k=>m&DP[k]?1:0;
  c.dmul=1-0.016*(b("fwL")+b("fwR"))-0.035*b("nose")-0.05*b("rw")-0.022*b("floor")-0.009*(b("spL")+b("spR"));
  const wheels=b("wFL")+b("wFR")+b("wRL")+b("wRR"),susp=b("sFL")+b("sFR")+b("sRL")+b("sRR");
  if(wheels+susp>=2||(wheels&&susp)){if(!c.retired&&!c.crash){c.retired=true;c.crash={dir:c.lat>=0?1:-1,rest:(c.lat>=0?1:-1)*rand(19,23),h0:T.ang[sidx(c.pos)],v0:Math.max(20,c.v),sv0:rand(-2,2),grav:60,done:false,mech:true};
    radio(c,"Das war's, das Auto ist hinüber. Ich stelle es ab.",false,true);}}
  else if(wheels+susp===1){c.limp=Math.min(c.limp||1,rand(0.22,0.34));c.wantPit=true;}
  if((b("fwL")+b("fwR")+b("nose"))&&!c.wantPit&&Math.random()<0.7)c.wantPit=true;}
function dmgClear(c){const lost=c.dp||0;c.dp=0;c.dmul=1;c.limp=0;return lost;}
/* Treffer zwischen zwei Autos: Ort ergibt sich aus der Geometrie */
function hitDamage(c,o,sev){if(!c||c.removed)return;const B=carBox(o),L=localOf(c,B.x,B.y),side=L.ly>=0?"R":"L";const out=[];
  if(Math.abs(L.lx)>Math.abs(L.ly)*1.4){
    if(L.lx>0){if(sev>0.15)out.push("fw"+side);if(sev>0.55&&Math.random()<0.6)out.push("fw"+(side==="L"?"R":"L"));if(sev>0.6&&Math.random()<0.45)out.push("nose");if(sev>0.85&&Math.random()<0.35)out.push((Math.random()<0.6?"sF":"wF")+side);}
    else{if(sev>0.3&&Math.random()<sev)out.push("rw");if(Math.random()<sev*0.5)out.push("floor");if(sev>0.75&&Math.random()<0.3)out.push((Math.random()<0.6?"sR":"wR")+side);}}
  else{const ax=L.lx>0?"F":"R";if(Math.random()<sev*0.55)out.push((Math.random()<0.7?"s":"w")+ax+side);if(Math.random()<0.5*sev+0.15)out.push("sp"+side);if(ax==="F"&&Math.random()<0.35)out.push("fw"+side);}
  for(const k of out)breakPart(c,k);return out;}
/* Mauereinschlag: Seite zur Mauer bekommt es ab */
function wallDamage(c,sev,latDir){const side=latDir*SIDE>0?"R":"L",out=[];
  if(Math.random()<0.6)out.push("fw"+side);if(sev>0.4&&Math.random()<0.5)out.push("sF"+side);if(sev>0.55&&Math.random()<0.35)out.push("wF"+side);
  if(sev>0.5&&Math.random()<0.4)out.push(pick(["sR","wR"])+side);if(Math.random()<0.4)out.push("sp"+side);if(sev>0.7&&Math.random()<0.4)out.push("rw");
  for(const k of out)breakPart(c,k);return out;}

/* ---- Trümmer ---- */
function spawnDeb(x,y,vx,vy,ty,c){S.debris=S.debris||[];if(S.debris.length>90)S.debris.shift();
  S.debris.push({x,y,vx,vy,r:rand(0,6.28),vr:rand(-8,8)*(ty==="wheel"?0.4:1),ty,sz:ty==="wheel"?1:ty==="wing"?rand(0.8,1.3):rand(0.35,0.9),col:c?c.drv.color:"#888",t:0});}
function debrisStep(dt){if(!S.debris||!S.debris.length)return;
  for(const d of S.debris){d.t+=dt;const fr=d.ty==="wheel"?0.45:2.2,sp=Math.hypot(d.vx,d.vy);if(sp>0.1){const k=Math.max(0,sp-fr*sp*dt-3*dt)/sp;d.vx*=k;d.vy*=k;}
    d.x+=d.vx*dt;d.y+=d.vy*dt;d.r+=d.vr*dt;d.vr*=1-dt*1.5;}
  S.debris=S.debris.filter(d=>d.t<(S.hazard&&!S.hazard.cleared?400:150));}
function debrisRec(){return S.debris&&S.debris.length?S.debris.map(d=>[d.x,d.y,d.r,d.ty==="wheel"?2:d.ty==="wing"?1:0,d.sz,d.col]):null;}
function drawDebris(ctx,fr){const L_=fr.db;if(!L_)return;for(const[x,y,r,ty,sz,col]of L_){ctx.save();ctx.translate(x,y);ctx.rotate(r);
    if(ty===2){ctx.fillStyle="#0c0c0c";ctx.fillRect(-1.1,-0.7,2.2,1.4);ctx.fillStyle="#555";ctx.fillRect(-0.45,-0.7,0.9,1.4);}
    else if(ty===1){ctx.fillStyle=col;ctx.fillRect(-1.4*sz,-0.35*sz,2.8*sz,0.7*sz);ctx.fillStyle="#111";ctx.fillRect(-1.4*sz,-0.35*sz,0.35*sz,0.7*sz);}
    else{ctx.fillStyle="#1b1b1e";ctx.beginPath();ctx.moveTo(-0.6*sz,-0.4*sz);ctx.lineTo(0.7*sz,-0.2*sz);ctx.lineTo(0.3*sz,0.5*sz);ctx.lineTo(-0.5*sz,0.3*sz);ctx.closePath();ctx.fill();}
    ctx.restore();}}
/* ---- Schaden am Bild darstellen: fehlende Teile ausschneiden, gebrochene Aufhängung hängt schief ---- */
const WPOS={F:3.7,R:-5.3};
/* Vorderräder je Lackierung in Bildpixeln: x0, x1, Unterkante oberes Rad, Oberkante unteres Rad (Nase zeigt nach rechts) */
const WRECT={ALP:[227,271,22,85],AMR:[227,271,22,87],AUD:[228,276,23,89],CAD:[217,263,29,104],FER:[227,271,25,88],HAA:[227,269,20,83],MCL:[227,269,24,91],MER:[227,271,24,92],RCB:[227,269,21,86],RBR:[227,271,21,86],WIL:[229,273,22,88]};
function dmgDrawImage(ctx,li,L_,H_,m,st,key){const hw=H_/2;m=m||0;ctx.save();ctx.beginPath();ctx.rect(-L_/2-1,-hw-1,L_+2,H_+2);
  const wr=st&&Math.abs(st)>0.015&&WRECT[key],sw=[];
  if(wr){const kx=L_/li.width,ky=H_/li.height;
    if(!(m&(DP.wFL|DP.sFL)))sw.push([wr[0],0,wr[1],wr[2]]);if(!(m&(DP.wFR|DP.sFR)))sw.push([wr[0],wr[3],wr[1],li.height]);
    for(const w of sw){w.push(-L_/2+w[0]*kx,-hw+w[1]*ky,(w[2]-w[0])*kx,(w[3]-w[1])*ky);ctx.rect(w[4],w[5],w[6],w[7]);}}
  const hole=(x0,y0,x1,y1)=>ctx.rect(x0,y0,x1-x0,y1-y0);
  if(m&DP.fwL)hole(L_/2-1.3,-hw-0.1,L_/2+0.2,-0.35);if(m&DP.fwR)hole(L_/2-1.3,0.35,L_/2+0.2,hw+0.1);if(m&DP.nose)hole(L_/2-2.6,-0.6,L_/2+0.2,0.6);
  if(m&DP.rw)hole(-L_/2-0.2,-hw*0.8,-L_/2+1.2,hw*0.8);
  for(const[a,ax]of[["F",WPOS.F],["R",WPOS.R]])for(const[s,sy]of[["L",-1],["R",1]]){if(m&(DP["w"+a+s]|DP["s"+a+s]))hole(ax-1.15,sy>0?hw-1.45:-hw-0.1,ax+1.15,sy>0?hw+0.1:-hw+1.45);}
  ctx.clip("evenodd");ctx.drawImage(li,-L_/2,-H_/2,L_,H_);ctx.restore();
  for(const w of sw){ctx.save();ctx.translate(w[4]+w[6]/2,w[5]+w[7]/2);ctx.rotate(st);ctx.drawImage(li,w[0],w[1],w[2]-w[0],w[3]-w[1],-w[6]/2,-w[7]/2,w[6],w[7]);ctx.restore();}
  for(const[a,ax]of[["F",WPOS.F],["R",WPOS.R]])for(const[s,sy]of[["L",-1],["R",1]]){if(m&DP["s"+a+s]){ctx.save();ctx.translate(ax-0.3,sy*(hw-0.2));ctx.rotate(sy*0.45);
      ctx.fillStyle="#0c0c0c";ctx.beginPath();ctx.roundRect?ctx.roundRect(-1.1,-0.65,2.2,1.3,0.35):ctx.rect(-1.1,-0.65,2.2,1.3);ctx.fill();ctx.fillStyle="#4a4a4a";ctx.fillRect(-0.35,-0.65,0.7,1.3);ctx.strokeStyle="#333";ctx.lineWidth=0.18;ctx.beginPath();ctx.moveTo(0,-sy*0.7);ctx.lineTo(-0.6,-sy*1.6);ctx.stroke();ctx.restore();}}
  if(m&(DP.spL|DP.spR|DP.floor)){ctx.fillStyle="rgba(15,15,18,0.75)";if(m&DP.spL){ctx.beginPath();ctx.ellipse(-0.5,-hw*0.55,1.6,0.55,0.2,0,7);ctx.fill();}if(m&DP.spR){ctx.beginPath();ctx.ellipse(-0.5,hw*0.55,1.6,0.55,-0.2,0,7);ctx.fill();}
    ctx.strokeStyle="rgba(230,230,230,0.5)";ctx.lineWidth=0.1;ctx.beginPath();for(let i=0;i<4;i++){const s=i%2?1:-1;if(!(m&(s>0?DP.spR:DP.spL)))continue;ctx.moveTo(-1.5+i*0.5,s*hw*0.4);ctx.lineTo(-1.1+i*0.5,s*hw*0.75);}ctx.stroke();}}
