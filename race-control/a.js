"use strict";
/* ============ Daten ============ */
const TEAMS={
  MER:{name:"Mercedes",color:"#27f4d2",pace:0.00},MCL:{name:"McLaren",color:"#ff8000",pace:0.45},
  FER:{name:"Ferrari",color:"#e8002d",pace:0.30},RBR:{name:"Red Bull",color:"#3671c6",pace:0.55},
  HAA:{name:"Haas",color:"#b6babd",pace:1.40},ALP:{name:"Alpine",color:"#ff87bc",pace:1.20},
  WIL:{name:"Williams",color:"#64c4ff",pace:1.60},RCB:{name:"Racing Bulls",color:"#6692ff",pace:1.10},
  AUD:{name:"Audi",color:"#c0392b",pace:1.50},AMR:{name:"Aston Martin",color:"#229971",pace:1.80},
  CAD:{name:"Cadillac",color:"#d4af37",pace:2.00}};
const TEAM_KEYS=Object.keys(TEAMS);
/* Fahrstil im Zweikampf: 0 = vorsichtig, 1 = sehr aggressiv */
const AGG={VER:.9,ALO:.8,HAM:.6,LEC:.6,NOR:.45,PIA:.5,RUS:.65,ANT:.7,HAD:.6,ALB:.4,SAI:.55,OCO:.85,GAS:.6,BEA:.75,HUL:.3,BOR:.55,LAW:.8,LIN:.55,STR:.65,COL:.8,PER:.6,BOT:.3};
const aggOf=c=>AGG[c.drv.code]==null?0.55:AGG[c.drv.code];
const aggName=a=>a>=0.75?"aggressiv":a>=0.5?"hart, aber fair":"vorsichtig";
const DRIVERS=[
 ["NOR","Lando Norris",1,"MCL",0.00],["PIA","Oscar Piastri",81,"MCL",0.05],
 ["RUS","George Russell",63,"MER",0.08],["ANT","Kimi Antonelli",12,"MER",0.00],
 ["LEC","Charles Leclerc",16,"FER",0.00],["HAM","Lewis Hamilton",44,"FER",0.12],
 ["VER","Max Verstappen",3,"RBR",-0.25],["HAD","Isack Hadjar",6,"RBR",0.20],
 ["ALB","Alexander Albon",23,"WIL",0.05],["SAI","Carlos Sainz",55,"WIL",0.00],
 ["OCO","Esteban Ocon",31,"HAA",0.10],["BEA","Oliver Bearman",87,"HAA",0.00],
 ["GAS","Pierre Gasly",10,"ALP",0.00],["COL","Franco Colapinto",43,"ALP",0.30],
 ["LAW","Liam Lawson",30,"RCB",0.10],["LIN","Arvid Lindblad",41,"RCB",0.20],
 ["HUL","Nico Hülkenberg",27,"AUD",0.00],["BOR","Gabriel Bortoleto",5,"AUD",0.08],
 ["ALO","Fernando Alonso",14,"AMR",-0.10],["STR","Lance Stroll",18,"AMR",0.30],
 ["PER","Sergio Pérez",11,"CAD",0.05],["BOT","Valtteri Bottas",77,"CAD",0.00]
].map((d,i)=>({code:d[0],name:d[1],num:d[2],team:d[3],ti:TEAM_KEYS.indexOf(d[3]),slot:i%2,
  color:TEAMS[d[3]].color,perf:TEAMS[d[3]].pace+d[4]}));
const WETSTYLE={VER:.9,ALO:.9,HAM:.75,NOR:.5,PIA:.35,RUS:.6,ANT:.55,LEC:.65,HAD:.6,ALB:.5,SAI:.55,OCO:.6,BEA:.7,GAS:.6,COL:.7,LAW:.6,LIN:.5,HUL:.7,BOR:.4,STR:.25,PER:.45,BOT:.3};
DRIVERS.forEach(d=>d.style=WETSTYLE[d.code]);
const styleName=s=>s>=0.7?"Zocker":s<=0.4?"vorsichtig":"ausgewogen";

/* ============ Helfer ============ */
let FB_LIVE=false;   // Sofort-Feedback zu Entscheidungen (Standard: aus – Bewertung erst nach dem Rennen)
function neutralLog(t){if(FB_LIVE)return t;
  if(/^(Korrekte Reaktion|Sicher, aber|Deutliche Überreaktion|Protest geprüft)/.test(t))return null;
  t=t.replace(/\s*\((?:[+−-]\s?\d+)\)/g,"").replace(/\s*–\s*(Korrekte Entscheidung|richtige Entscheidung[^–]*|unnötig|unbegründet|gefährlich!?)\s*$/,"").replace(/\. Korrekte Entscheidung/,"");
  return t;}
const $=id=>document.getElementById(id);
const rand=(a,b)=>a+Math.random()*(b-a);
const irand=(a,b)=>Math.floor(rand(a,b+1));
const pick=a=>a[Math.floor(Math.random()*a.length)];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const shuffle=arr=>{const a=arr.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
const esc=s=>String(s).replace(/[&<>]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]));
const fmtLap=s=>{const m=Math.floor(s/60);return m+":"+(s-m*60).toFixed(3).padStart(6,"0");};
const fmtClock=s=>{s=Math.max(0,s);const m=Math.floor(s/60);return m+":"+String(Math.floor(s-m*60)).padStart(2,"0");};

/* ============ Konstanten ============ */
const PITLINE=-20.2;   // weiße Linie an der Boxenausfahrt (lat)
const HW=16, LINE_OUT=17.5, CAR_L=15, CAR_W=5.1, TL_OFF=LINE_OUT+CAR_W/2;
const VTOP=170, ALAT=52, ACC=48, BRK=140, PITV=40, KMH=2.0;
const PLAT=-30, BOXLAT=-39, GARLAT=-46, DT=1/30;
const COAST=24, LATACC=38;   // Verzögerung beim Gaswegnehmen; maximale Querbeschleunigung der Seitenführung

/* ============ Strecken ============ */
const TRACKS={
  ring:{name:"Grid Line Ring (Fantasie)",lapS:77.2,laps:50,sc:1,pts:[[500,530],[720,530],[860,500],[910,400],[850,310],[720,300],[660,230],[720,140],[640,70],
    [500,90],[420,170],[330,200],[230,130],[120,150],[90,260],[170,340],[300,330],[330,420],[200,430],[120,480],[180,535],[340,532]]}
};
for(const k in TRACK_DATA){const d=TRACK_DATA[k];TRACKS[k]={name:d.name,lapS:d.lapS,laps:d.laps,sc:d.sc,pts:d.pts,side:d.side,real:true,len:d.len,cal:d.cal};}
let SIDE=1;
const TRACK_META={
  spa:{turns:19,sec:[4,14],names:{1:"La Source",3:"Eau Rouge",4:"Raidillon",5:"Les Combes",7:"Malmedy",8:"Bruxelles",10:"Pouhon",12:"Fagnes",14:"Campus",15:"Stavelot",17:"Blanchimont",18:"Bus Stop"}},
  monza:{turns:11,num:[1,2,4,5,6,7,8,9,10,11],sec:[2,7],names:{1:"Rettifilo",2:"Rettifilo",3:"Curva Grande",4:"Roggia",5:"Roggia",6:"Lesmo 1",7:"Lesmo 2",8:"Ascari",9:"Ascari",10:"Ascari",11:"Parabolica"}},
  silverstone:{turns:18,num:[1,2,3,4,5,5,7,8,9,10,11,12,13,14,15,16,17,18],sec:[5,14],names:{1:"Abbey",2:"Farm",3:"Village",4:"The Loop",5:"Aintree",6:"Brooklands",7:"Luffield",8:"Woodcote",9:"Copse",10:"Maggotts",11:"Maggotts",12:"Becketts",13:"Becketts",14:"Chapel",15:"Stowe",16:"Vale",17:"Club",18:"Club"}},
  monaco:{turns:19,num:[1,2,3,4,5,6,7,8,10,11,12,13,14,15,16,17,18,19,19],sec:[5,12],names:{1:"Sainte Dévote",2:"Beau Rivage",3:"Massenet",4:"Casino",5:"Mirabeau",6:"Grand Hotel",7:"Mirabeau Bas",8:"Portier",9:"Tunnel",10:"Nouvelle Chicane",11:"Nouvelle Chicane",12:"Tabac",13:"Piscine",14:"Piscine",15:"Piscine",16:"Piscine",17:"Rascasse",18:"Anthony Noghès",19:"Anthony Noghès"}},
  suzuka:{turns:18,sec:[7,14],names:{1:"First Corner",2:"First Corner",3:"S-Kurven",4:"S-Kurven",5:"S-Kurven",6:"S-Kurven",7:"Dunlop",8:"Degner 1",9:"Degner 2",11:"Hairpin",13:"Spoon",14:"Spoon",15:"130R",16:"Casio-Schikane",17:"Casio-Schikane"}},
  interlagos:{turns:15,num:[1,2,3,3,4,5,6,8,9,10,11,12,13,14,15],sec:[3,11],names:{1:"Senna-S",2:"Senna-S",3:"Curva do Sol",4:"Descida do Lago",6:"Ferradura",7:"Ferradura",8:"Laranjinha",9:"Pinheirinho",10:"Bico de Pato",11:"Mergulho",12:"Junção",14:"Subida dos Boxes"}},
  rbr:{turns:10,num:[1,3,4,4,5,6,7,8,9,10],sec:[1,6],names:{1:"Niki-Lauda-Kurve",3:"Remus",4:"Schlossgold",6:"Rauch",7:"Würth",9:"Rindt",10:"Red-Bull-Mobile"}},
  melbourne:{turns:14},shanghai:{turns:16},bahrain:{dry:true,turns:15},jeddah:{dry:true,turns:27},miami:{turns:19},montreal:{turns:14},barcelona:{turns:14},hungaroring:{turns:14},
  zandvoort:{turns:14},madrid:{turns:22},baku:{turns:20},singapore:{turns:19},austin:{turns:20},mexico:{turns:17},vegas:{dry:true,turns:17},lusail:{dry:true,turns:16},yas:{dry:true,turns:16},
  imola:{turns:19},nuerburgring:{turns:15},hockenheim:{turns:17}};
const NU=1400;
const T={x:new Float32Array(NU),y:new Float32Array(NU),ang:new Float32Array(NU),k:new Float32Array(NU),
  prof:new Float32Array(NU),line:new Float32Array(NU)};
let BOX0=-125,L=0,DS=0,LAPT=0,TSCALE=1,TRACK=null,PIT_ENTRY_S=0,PIT_IN_S=0,PIT_OUT_S=0,PIT_EXIT_S=0,DEC_S=0;
const TB={x0:0,y0:0,x1:1000,y1:600};
const CORNERS=[];const SECB=[0,0,0,0];
const cnm=c=>c.name||`Kurve ${c.num}`;
function buildTrack(key){
  TRACK=TRACKS[key];TRACK.key=key;let PTS=TRACK.pts.map(p=>[p[0]*TRACK.sc,p[1]*TRACK.sc]);
  if(TRACK.real){ // längste Ausdehnung waagerecht legen, damit die Strecke den Monitor füllt
    let mx=0,my=0;for(const p of PTS){mx+=p[0];my+=p[1];}mx/=PTS.length;my/=PTS.length;
    let sxx=0,syy=0,sxy=0;for(const p of PTS){const dx=p[0]-mx,dy=p[1]-my;sxx+=dx*dx;syy+=dy*dy;sxy+=dx*dy;}
    const th=0.5*Math.atan2(2*sxy,sxx-syy),c=Math.cos(-th),s=Math.sin(-th);
    PTS=PTS.map(p=>[(p[0]-mx)*c-(p[1]-my)*s,(p[0]-mx)*s+(p[1]-my)*c]);}
  const raw=[],n=PTS.length;LAPT=0;CORNERS.length=0;
  const cr=(a,b,c,d,t)=>0.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t);
  for(let i=0;i<n;i++){const p0=PTS[(i-1+n)%n],p1=PTS[i],p2=PTS[(i+1)%n],p3=PTS[(i+2)%n];
    const NQ=n>200?6:50;for(let q=0;q<NQ;q++){const t=q/NQ;raw.push([cr(p0[0],p1[0],p2[0],p3[0],t),cr(p0[1],p1[1],p2[1],p3[1],t)]);}}
  const cum=[0];
  for(let i=1;i<=raw.length;i++){const a=raw[i-1],b=raw[i%raw.length];cum.push(cum[i-1]+Math.hypot(b[0]-a[0],b[1]-a[1]));}
  L=cum[raw.length];DS=L/NU;let j=0;
  TB.x0=TB.y0=1e9;TB.x1=TB.y1=-1e9;
  for(let i=0;i<NU;i++){const tg=L*i/NU;while(cum[j+1]<tg)j++;
    const a=raw[j],b=raw[(j+1)%raw.length],t=(tg-cum[j])/(cum[j+1]-cum[j]||1);
    T.x[i]=a[0]+(b[0]-a[0])*t;T.y[i]=a[1]+(b[1]-a[1])*t;
    TB.x0=Math.min(TB.x0,T.x[i]);TB.x1=Math.max(TB.x1,T.x[i]);TB.y0=Math.min(TB.y0,T.y[i]);TB.y1=Math.max(TB.y1,T.y[i]);}
  const W=i=>((i%NU)+NU)%NU;
  if(TRACK.real){const w=Math.max(1,Math.round(15/DS));for(let r=0;r<2;r++){const x=Float32Array.from(T.x),y=Float32Array.from(T.y);
    for(let i=0;i<NU;i++){let sx=0,sy=0;for(let q=-w;q<=w;q++){sx+=x[W(i+q)];sy+=y[W(i+q)];}T.x[i]=sx/(2*w+1);T.y[i]=sy/(2*w+1);}}}
  const smooth=(a,w)=>{const o=new Float32Array(NU);for(let i=0;i<NU;i++){let s=0;for(let q=-w;q<=w;q++)s+=a[W(i+q)];o[i]=s/(2*w+1);}return o;};
  const sw=Math.max(2,Math.round(8/DS));
  let k;
  const geo=()=>{for(let i=0;i<NU;i++)T.ang[i]=Math.atan2(T.y[W(i+1)]-T.y[W(i-1)],T.x[W(i+1)]-T.x[W(i-1)]);
    k=new Float32Array(NU);
    for(let i=0;i<NU;i++){let d=T.ang[W(i+1)]-T.ang[W(i-1)];while(d>Math.PI)d-=2*Math.PI;while(d<-Math.PI)d+=2*Math.PI;k[i]=d/(2*DS);}
    k=smooth(smooth(k,sw),sw);};
  geo();
  TRACK.shift=0;
  if(TRACK.real){ // Start/Ziel so auf die Gerade legen, dass Startaufstellung und Boxengasse passen
    const a0=Math.round(-255/DS),a1=Math.round(265/DS),rng=Math.round(420/DS);let best=0,bv=1e9;
    for(let o=-rng;o<=rng;o++){let m=0;for(let q=a0;q<=a1;q++)m=Math.max(m,Math.abs(k[W(o+q)]));m+=Math.abs(o)*DS*1e-6;if(m<bv){bv=m;best=o;}}
    if(best){const x=Float32Array.from(T.x),y=Float32Array.from(T.y);for(let i=0;i<NU;i++){T.x[i]=x[W(i+best)];T.y[i]=y[W(i+best)];}geo();}
    TRACK.shift=best*DS;TRACK.kwin=bv;}
  SIDE=TRACK.side==="R"?-1:1;
  if(SIDE<0)for(let i=0;i<NU;i++)k[i]=-k[i];
  T.k.set(k);
  const kl=smooth(k,Math.round(44/DS));
  // Ideallinie: außen anbremsen, innen am Scheitel, außen heraustragen lassen
  const kn=smooth(kl,Math.round(26/DS)),kw=smooth(smooth(k,Math.round(120/DS)),Math.round(90/DS)),lraw=new Float32Array(NU);
  for(let i=0;i<NU;i++){const apex=10.5*Math.tanh(kn[i]/0.011),outer=-8.5*Math.tanh((kw[i]-kn[i])/0.0035)*(1-Math.min(1,Math.abs(kn[i])/0.009));lraw[i]=clamp(apex+outer,-11.5,11.5);}
  const l2=smooth(smooth(lraw,Math.round(34/DS)),Math.round(22/DS));
  // Optimierte Ideallinie: minimale Krümmung über die ganze Runde (Kurvenkombinationen werden zusammen durchfahren)
  {const l=Float32Array.from(l2),nx=new Float32Array(NU),ny=new Float32Array(NU),LIM=11.5;
    for(let i=0;i<NU;i++){nx[i]=-Math.sin(T.ang[i])*SIDE;ny[i]=Math.cos(T.ang[i])*SIDE;}
    for(const[kk0,it]of[[70,60],[34,90],[16,120],[7,160]]){const kk=Math.max(2,Math.round(kk0/DS));
      for(let r=0;r<it;r++)for(let i=0;i<NU;i++){const a=(i-kk+NU)%NU,b=(i+kk)%NU;
        const mx=(T.x[a]+nx[a]*l[a]+T.x[b]+nx[b]*l[b])/2,my=(T.y[a]+ny[a]*l[a]+T.y[b]+ny[b]*l[b])/2;
        const d=(mx-T.x[i])*nx[i]+(my-T.y[i])*ny[i];l[i]+=(clamp(d,-LIM,LIM)-l[i])*0.6;}}
    const l3=smooth(l,Math.max(1,Math.round(8/DS)));for(let i=0;i<NU;i++)T.line[i]=clamp(0.8*l3[i]+0.2*l2[i],-LIM,LIM);}
  const v=T.prof;
  for(let i=0;i<NU;i++)v[i]=Math.min(VTOP,Math.sqrt(ALAT/Math.max(1e-4,Math.abs(k[i]))));
  for(let r=0;r<2;r++)for(let i=NU-1;i>=0;i--)v[i]=Math.min(v[i],Math.sqrt(v[W(i+1)]**2+2*BRK*0.85*DS));
  for(let r=0;r<2;r++)for(let i=0;i<NU;i++)v[W(i+1)]=Math.min(v[W(i+1)],Math.sqrt(v[i]**2+2*ACC*1.1*DS));
  for(let i=0;i<NU;i++)LAPT+=DS/v[i];
  TSCALE=TRACK.lapS/LAPT;
  const kd=T.k,detect=th=>{const out=[];let i=0;while(i<NU){if(Math.abs(kd[i])>th){let i0=i,best=i;
      while(i<NU&&Math.abs(kd[i])>th&&Math.sign(kd[i])===Math.sign(kd[i0])){if(Math.abs(kd[i])>Math.abs(kd[best]))best=i;i++;}
      if((i-i0)*DS>6)out.push({i0,i1:i-1,ia:best,s:best*DS,dir:Math.sign(kd[best]),kmax:Math.abs(kd[best])});}else i++;}return out;};
  let cs=detect(0.0105);const meta=TRACK_META[key];
  if(meta&&meta.turns){let bd=1e9;for(let th=0.0025;th<=0.03;th+=0.0005){const c=detect(th),dd=Math.abs(c.length-meta.turns);if(dd<bd||(dd===bd&&Math.abs(th-0.0105)<0.004)){bd=dd;cs=c;}}}
  const num=meta&&meta.num&&meta.num.length===cs.length?meta.num:null,okN=!!(meta&&(num||cs.length===meta.turns));
  cs.forEach((c,n)=>{c.n=n+1;c.num=num?num[n]:n+1;c.name=okN&&meta.names?meta.names[c.num]||null:null;CORNERS.push(c);});
  SECB[0]=0;SECB[1]=L/3;SECB[2]=2*L/3;SECB[3]=L;TRACK.realSec=false;
  if(meta&&meta.sec&&okN){let ok=true;const b=[];for(let q=0;q<2;q++){let i=-1;for(let n=0;n<cs.length;n++)if(cs[n].num<=meta.sec[q])i=n;
      if(i<0||i+1>=cs.length){ok=false;break;}b.push((cs[i].i1*DS+cs[i+1].i0*DS)/2);}
    if(ok&&b[0]<b[1]){SECB[1]=b[0];SECB[2]=b[1];TRACK.realSec=true;}}
  PIT_ENTRY_S=L-246;PIT_IN_S=L-160;PIT_OUT_S=160;PIT_EXIT_S=250;DEC_S=L-330;BOX0=-125;
  try{if(typeof applyPitData==="function"){applyPitData();tagRunoff();buildZones();}}catch(e){}
}
buildTrack("ring");
const mod=s=>((s%L)+L)%L;
const sidx=pos=>Math.min(NU-1,Math.floor(pos/DS));
const sectorOf=pos=>pos<SECB[1]?0:pos<SECB[2]?1:2;
function posXY(s,lat){const p=mod(s)/DS,i=Math.floor(p)%NU,t=p-Math.floor(p),j=(i+1)%NU;
  let da=T.ang[j]-T.ang[i];if(da>Math.PI)da-=2*Math.PI;else if(da<-Math.PI)da+=2*Math.PI;
  const a=T.ang[i]+da*t;lat*=SIDE;return {x:T.x[i]+(T.x[j]-T.x[i])*t-Math.sin(a)*lat,y:T.y[i]+(T.y[j]-T.y[i])*t+Math.cos(a)*lat,ang:a};}
function nextCorner(pos,minD,sig){let best=null,bd=1e9;for(const c of CORNERS){if(sig&&c.kmax<0.0135)continue;
  const d=(c.s-pos+L)%L;if(d>=minD&&d<bd){bd=d;best=c;}}return best?{c:best,d:bd}:null;}
function cornerNear(pos){let best=CORNERS[0],bd=1e9;for(const c of CORNERS){let d=Math.abs(c.s-pos);d=Math.min(d,L-d);if(d<bd){bd=d;best=c;}}return best;}
const boxPos=ti=>mod(L+BOX0+24*ti);
const gridSlot=k=>({s:-8-10*k,lat:k%2?6:-6});

/* ============ Reifen ============ */
function tyreGrip(t,wear,w){let g;
  if(t==="I")g=w<0.15?0.90-(0.15-w)*0.25:w<=0.65?0.915:0.915-(w-0.65)*0.35;
  else if(t==="W")g=0.87-Math.max(0,0.5-w)*0.12;
  else g=(t==="S"?1.012:t==="M"?1.006:1.0)*(1-0.62*Math.pow(w,0.7));   // Slicks auf Nässe: kaum Traktion
  return g-0.022*wear-(wear>0.8?(wear-0.8)*0.3:0);}
const wetClass=w=>w<0.1?"dry":w<0.78?"I":"W";
const tyreClass=t=>t==="I"||t==="W"?t:"dry";

/* ============ Wetter ============ */
function mkWeather(mode,span){span=span||1;
  const wx={cells:[],wind:rand(0,6.28),spd:rand(4.5,7),rain:0,wet:0,eta:Infinity,endIn:0,amp:Math.random()<0.5?rand(0.2,0.45):rand(0,0.12),ph:rand(0,6.28),windKmh:Math.random()<0.3?rand(22,45):rand(3,20)};
  const desert=!!(TRACK&&TRACK_META[TRACK.key]&&TRACK_META[TRACK.key].dry);
  const wet=desert||mode==="dry"?false:mode==="wet"?true:Math.random()<0.4;wx.desert=desert;
  if(wet){const n=irand(1,span>3?2:3);let dist=rand(350,1000)*span;
    for(let i=0;i<n;i++){const off=rand(-50,50);
      wx.cells.push({x:-Math.cos(wx.wind)*dist-Math.sin(wx.wind)*off,y:-Math.sin(wx.wind)*dist+Math.cos(wx.wind)*off,
        r:rand(100,180)*Math.min(3,Math.sqrt(span)),int:rand(0.35,1)});dist+=rand(250,500)*span;}}
  if(wet&&Math.random()<0.35){const c=wx.cells[0];c.r*=2.6;wx.spd*=0.55;wx.long=true;}
  return wx;}
function wetAt(pos){const wx=S.wx;let b=wx.wet;if(wx.wp){const n=wx.wp.length,f=mod(pos)/L*n,i=Math.floor(f)%n,j=(i+1)%n,u=f-Math.floor(f);b=wx.wp[i]*(1-u)+wx.wp[j]*u;}return clamp(b*(1+wx.amp*0.5*Math.sin(6.2832*pos/L+wx.ph)),0,1);}
function wxStep(wx,dt){
  let rain=0,eta=Infinity,endIn=0;const vx=Math.cos(wx.wind)*wx.spd,vy=Math.sin(wx.wind)*wx.spd;
  for(const c of wx.cells){c.x+=vx*dt;c.y+=vy*dt;const d=Math.hypot(c.x,c.y);
    if(d<c.r*1.6&&typeof cellInt==="function"?cellInt(c,0,0)>0:d<c.r){const q=typeof cellInt==="function"?cellInt(c,0,0)/c.int:clamp((1-d/c.r)*2.2,0,1);rain=Math.max(rain,c.int*q);endIn=Math.max(endIn,(c.r+(c.x*vx+c.y*vy)/wx.spd*-1)/wx.spd);}
    else if(c.x*vx+c.y*vy<0)eta=Math.min(eta,(d-c.r)/wx.spd);}
  wx.rain=rain;wx.eta=eta;wx.endIn=endIn;
  if(typeof secRain==="function"&&typeof T!=="undefined"&&NU){secRain(wx,dt);return;}
  const tg=Math.min(1,rain*1.25);
  wx.wet=clamp(wx.wet+(tg>wx.wet?0.035:-0.012)*dt,0,1);if(tg<=wx.wet&&wx.wet<tg)wx.wet=tg;
}
