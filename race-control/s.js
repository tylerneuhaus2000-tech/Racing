"use strict";
/* ===== Sound: alles synthetisch über WebAudio, keine Dateien ===== */
const SND={ctx:null,on:true,eg:null,master:null,last:{},loops:[],rpm:0,thr:1};
/* ---- Motor: errechnete V6-Turbo-Schleifen (Zündimpulse, Auspuffresonanzen, Rauschen, Turbo), nach Drehzahl überblendet ---- */
const ENG_ON=[5000,8000,10500,12000],ENG_OFF=[6000,11000];
function sndHash(n){let x=Math.imul(n^0x9e3779b9,0x85ebca6b)>>>0;x=Math.imul(x^(x>>>13),0xc2b2ae35)>>>0;return ((x^(x>>>16))>>>0)/4294967296;}
/* eine exakt periodische Schleife bei Drehzahl rpm; load 1 = unter Last, 0 = Schiebebetrieb */
function sndSynthLoop(rpm,load,fs){const Tc=120/rpm,N=Math.max(4,Math.round(0.5/Tc)),len=Math.round(N*Tc*fs),Tl=len/fs,tc=Tl/N,out=new Float32Array(len);
  const res=[[340,0.0055,1],[1050,0.0028,0.55],[2500,0.0013,0.28]],PL=Math.ceil(0.05*fs),pulse=new Float32Array(PL);
  for(let j=0;j<PL;j++){const tau=j/fs;let v=0;for(const[f,dec,a]of res)v+=a*Math.exp(-tau/dec)*Math.sin(2*Math.PI*f*tau);pulse[j]=v;}
  const cyl=[0,1,2,3,4,5].map(k=>({ph:k/6+(sndHash(k+11)-0.5)*0.022,a:0.82+0.36*sndHash(k+31)}));
  const pa=load?1:0.33;
  for(let i=0;i<len;i++){const ph=(i/len*N)%1;let s=0;
    for(const c of cyl){let d=ph-c.ph;d-=Math.floor(d);for(let w=0;w<2;w++){const j=Math.round((d+w)*tc*fs);if(j<PL)s+=c.a*pulse[j];}}
    out[i]=s*pa;}
  /* Verbrennungs-/Mechanikrauschen, im Takt der Zündungen moduliert; zweimal umlaufend gefiltert, damit die Schleife nahtlos ist */
  const nz=new Float32Array(len);for(let i=0;i<len;i++)nz[i]=sndHash(i*7+rpm*13+load)*2-1;
  let lp=0;const k=Math.exp(-2*Math.PI*3200/fs);for(let r=0;r<2;r++)for(let i=0;i<len;i++){lp=lp*k+nz[i]*(1-k);if(r)nz[i]=lp;}
  for(let i=0;i<len;i++){const ph=(i/len*N*6)%1,env=0.35+0.65*Math.exp(-ph*5)*(1-Math.exp(-ph*40));out[i]+=nz[i]*(load?0.55:0.8)*env;}
  /* Turbo-Pfeifen: ganzzahlige Schwingungen pro Schleife */
  if(load){const ft=Math.round((2600+rpm*0.32)*Tl)/Tl;for(let i=0;i<len;i++)out[i]+=0.05*Math.sin(2*Math.PI*ft*i/fs);}
  /* Schiebebetrieb: vereinzelte Knaller im Auspuff */
  else for(let p=0;p<N;p++){if(sndHash(p+rpm)>0.45)continue;const st=Math.floor((p+sndHash(p*3+1))*len/N),L_=Math.floor(0.012*fs);for(let j=0;j<L_;j++){const i=(st+j)%len;out[i]+=(sndHash(i+999)*2-1)*1.4*Math.exp(-j/(0.003*fs));}}
  let pk=0;for(let i=0;i<len;i++){out[i]=Math.tanh(out[i]*1.6);pk=Math.max(pk,Math.abs(out[i]));}
  for(let i=0;i<len;i++)out[i]*=0.9/(pk||1);
  return out;}
function sndBuildEngine(x){SND.eg=x.createGain();SND.eg.gain.value=0;const hp=x.createBiquadFilter();hp.type="highpass";hp.frequency.value=70;SND.eg.connect(hp);hp.connect(SND.master);
  const mk=(rpm,load)=>{const d=sndSynthLoop(rpm,load,x.sampleRate),b=x.createBuffer(1,d.length,x.sampleRate);b.getChannelData(0).set(d);
    const s=x.createBufferSource(),g=x.createGain();s.buffer=b;s.loop=true;g.gain.value=0;s.connect(g);g.connect(SND.eg);s.start();return {rpm,load,s,g};};
  /* eine Schleife pro Schritt bauen, damit kein Frame lange blockiert; der Motor setzt ein, wenn alle da sind */
  const todo=ENG_ON.map(r=>[r,1]).concat(ENG_OFF.map(r=>[r,0])),built=[];
  const next=()=>{if(SND.ctx!==x)return;const it=todo.shift();if(!it){SND.loops=built;return;}try{built.push(mk(it[0],it[1]));}catch(e){}setTimeout(next,0);};next();}
/* Drehzahl aus Tempo und Gang (gleiche Schaltpunkte wie die Telemetrie) */
function sndRpm(v){const kmh=v*KMH,G=typeof GEARS!=="undefined"?GEARS:[0,85,120,155,190,225,262,298];if(kmh<3)return 4200;
  const g=G.filter(x=>kmh>=x).length,lo=G[g-1],hi=g<G.length?G[g]:345,f=clamp((kmh-lo)/(hi-lo),0,1);
  return g===1?4800+f*7000:9900+f*2050;}
/* Gewichte: gleichlautes Überblenden zwischen benachbarten Schleifen */
function sndMix(set,rpm){const w=set.map(()=>0);if(rpm<=set[0]){w[0]=1;return w;}if(rpm>=set[set.length-1]){w[set.length-1]=1;return w;}
  for(let i=0;i<set.length-1;i++)if(rpm>=set[i]&&rpm<=set[i+1]){const f=(rpm-set[i])/(set[i+1]-set[i]);w[i]=Math.cos(f*Math.PI/2);w[i+1]=Math.sin(f*Math.PI/2);}
  return w;}
function sndInit(){if(SND.ctx||!SND.on)return;try{const C=window.AudioContext||window.webkitAudioContext;if(!C)return;const x=SND.ctx=new C();
    SND.master=x.createGain();SND.master.gain.value=0.5;SND.master.connect(x.destination);sndBuildEngine(x);}catch(e){SND.ctx=null;}}
function sndTone(f,d,type,vol,at,f2){const x=SND.ctx;if(!x||!SND.on)return;const t=x.currentTime+(at||0),o=x.createOscillator(),g=x.createGain();o.type=type||"sine";o.frequency.setValueAtTime(f,t);
  if(f2)o.frequency.linearRampToValueAtTime(f2,t+d);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol||0.12,t+0.01);g.gain.exponentialRampToValueAtTime(0.0008,t+d);o.connect(g);g.connect(SND.master);o.start(t);o.stop(t+d+0.02);}
function sndNoise(d,vol,cut){const x=SND.ctx;if(!x||!SND.on)return;const n=Math.floor(x.sampleRate*d),b=x.createBuffer(1,n,x.sampleRate),a=b.getChannelData(0);for(let i=0;i<n;i++)a[i]=(Math.random()*2-1)*Math.pow(1-i/n,2);
  const s=x.createBufferSource(),f=x.createBiquadFilter(),g=x.createGain();s.buffer=b;f.type="lowpass";f.frequency.value=cut||900;g.gain.value=vol||0.3;s.connect(f);f.connect(g);g.connect(SND.master);s.start();}
function sndEvent(k){const x=SND.ctx;if(!x||!SND.on)return;const now=x.currentTime;if(SND.last[k]&&now-SND.last[k]<(k==="radio"?1.2:0.35))return;SND.last[k]=now;
  if(k==="radio"){sndTone(1250,0.06,"square",0.035);sndTone(950,0.07,"square",0.035,0.08);}
  else if(k==="tick"){sndTone(1900,0.025,"square",0.018);}
  else if(k==="ok"){sndTone(660,0.07,"triangle",0.07);sndTone(990,0.12,"triangle",0.07,0.07);}
  else if(k==="inc"){sndTone(660,0.14,"sine",0.12);sndTone(880,0.22,"sine",0.12,0.14);}
  else if(k==="flag"){sndTone(520,0.1,"triangle",0.1);sndTone(520,0.1,"triangle",0.1,0.16);}
  else if(k==="alert"){for(let i=0;i<3;i++)sndTone(780,0.12,"square",0.07,i*0.2);}
  else if(k==="crash"){sndNoise(0.5,0.4,700);sndTone(90,0.3,"sine",0.25,0,40);}
  else if(k==="light")sndTone(440,0.13,"sine",0.14);
  else if(k==="go")sndTone(880,0.5,"sine",0.16);
  else if(k==="good")sndTone(720,0.1,"sine",0.08,0,980);
  else if(k==="bad")sndTone(300,0.25,"sawtooth",0.06,0,180);}
function sndEngine(v,active,thr){const x=SND.ctx;if(!x||!SND.eg)return;const t=x.currentTime,on=SND.on&&active;
  SND.eg.gain.setTargetAtTime(on?0.05+Math.min(0.03,v/6000):0,t,0.15);if(!on)return;
  const rpm=sndRpm(v),th=thr==null?1:clamp(thr,0,1);SND.thr+=(th-SND.thr)*0.35;
  const wOn=sndMix(ENG_ON,rpm),wOff=sndMix(ENG_OFF,rpm),tc=rpm<SND.rpm-600?0.025:0.06;SND.rpm=rpm;
  SND.loops.forEach(L=>{const set=L.load?ENG_ON:ENG_OFF,w=(L.load?wOn:wOff)[set.indexOf(L.rpm)]*(L.load?Math.sqrt(SND.thr):Math.sqrt(1-SND.thr));
    L.g.gain.setTargetAtTime(w,t,0.05);L.s.playbackRate.setTargetAtTime(clamp(rpm/L.rpm,0.5,2),t,tc);});}
function sndToggle(){SND.on=!SND.on;if(SND.on)sndInit();else if(SND.ctx)SND.eg.gain.value=0;const b=document.getElementById("sndBtn");if(b)b.textContent=SND.on?"🔊":"🔇";}
window.addEventListener("pointerdown",()=>{sndInit();if(SND.ctx&&SND.ctx.state==="suspended")SND.ctx.resume();},{passive:true});
