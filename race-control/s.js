"use strict";
/* ===== Sound: alles synthetisch über WebAudio, keine Dateien ===== */
const SND={ctx:null,on:true,osc:null,eg:null,flt:null,master:null,last:{}};
function sndInit(){if(SND.ctx||!SND.on)return;try{const C=window.AudioContext||window.webkitAudioContext;if(!C)return;const x=SND.ctx=new C();
    SND.master=x.createGain();SND.master.gain.value=0.5;SND.master.connect(x.destination);
    SND.osc=x.createOscillator();SND.osc.type="sawtooth";SND.osc.frequency.value=80;SND.flt=x.createBiquadFilter();SND.flt.type="lowpass";SND.flt.frequency.value=500;
    SND.eg=x.createGain();SND.eg.gain.value=0;SND.osc.connect(SND.flt);SND.flt.connect(SND.eg);SND.eg.connect(SND.master);SND.osc.start();}catch(e){SND.ctx=null;}}
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
function sndEngine(v,active){const x=SND.ctx;if(!x)return;const t=x.currentTime,on=SND.on&&active;
  SND.eg.gain.setTargetAtTime(on?0.022+Math.min(0.02,v/9000):0,t,0.15);if(on){SND.osc.frequency.setTargetAtTime(62+v*1.45,t,0.08);SND.flt.frequency.setTargetAtTime(380+v*5,t,0.1);}}
function sndToggle(){SND.on=!SND.on;if(SND.on)sndInit();else if(SND.ctx)SND.eg.gain.value=0;const b=document.getElementById("sndBtn");if(b)b.textContent=SND.on?"🔊":"🔇";}
window.addEventListener("pointerdown",()=>{sndInit();if(SND.ctx&&SND.ctx.state==="suspended")SND.ctx.resume();},{passive:true});
