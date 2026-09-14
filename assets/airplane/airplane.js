'use strict';

(() => {
const $ = id => document.getElementById(id);
const canvas = $('flight-canvas');
const ui = {
  speed:$('hud-speed'), alt:$('hud-alt'), heading:$('hud-heading'), vs:$('hud-vs'), warning:$('hud-warning'),
  score:$('hud-score'), fuel:$('hud-fuel'), damage:$('hud-damage'), missionTitle:$('mission-title'), missionText:$('mission-text'), progress:$('mission-progress'),
  throttleBar:$('bar-throttle'), liftBar:$('bar-lift'), stallBar:$('bar-stall'), throttleTxt:$('txt-throttle'), liftTxt:$('txt-lift'), stallTxt:$('txt-stall'), gear:$('gear-state'),
  main:$('main-menu'), pause:$('pause-menu'), toast:$('toast'), pauseSummary:$('pause-summary')
};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const smooth=(a,b,t)=>a+(b-a)*(1-Math.exp(-t));
const DEG=Math.PI/180;
const KT=1.94384, FT=3.28084;

const aircraftDefs={
  trainer:{name:'Skytrainer', model:'assets/airplane/models/crj900_cityjet.glb', length:13.5, mass:4700, wing:28, thrust:18500, drag:0.030, roll:1.7, pitch:1.25, yaw:.72, stall:34, vmax:145, color:0xe8f1f6},
  cargo:{name:'Cargo Twin', model:'assets/airplane/models/lowpoly_ac130.glb', length:18.5, mass:9500, wing:48, thrust:27500, drag:0.040, roll:1.0, pitch:.9, yaw:.55, stall:40, vmax:130, color:0x8aa0a0},
  sport:{name:'SportJet', model:'assets/airplane/models/air_force_one.glb', length:16.5, mass:7200, wing:34, thrust:34000, drag:0.027, roll:2.2, pitch:1.45, yaw:.78, stall:44, vmax:190, color:0xffffff}
};
let selected='trainer';

const state={mode:'menu', camera:0, free:false, score:0, checkpoint:0, missionDone:false, time:0, lastToast:0};
const keys=new Set();
const pointer={active:false, x:0, y:0, cx:0, cy:0};

let renderer, scene, camera, clock, hemi, sun, plane, airportModel, audio;
const tmpV=new THREE.Vector3(), tmpQ=new THREE.Quaternion(), forward=new THREE.Vector3(), right=new THREE.Vector3(), up=new THREE.Vector3();

const flight={
  pos:new THREE.Vector3(0,2,360), vel:new THREE.Vector3(0,0,0), quat:new THREE.Quaternion(), ang:new THREE.Vector3(),
  throttle:0, gearDown:true, brake:0, fuel:1, damage:0, onGround:true, crashed:false, stall:false, lift01:0, aoa:0, vSpeed:0, wheels:[], def:aircraftDefs.trainer
};

const checkpoints=[
  {p:new THREE.Vector3(0,95,-850), r:80, text:'Steigflug: durch den ersten Gate über der Bahn.'},
  {p:new THREE.Vector3(620,180,-1600), r:95, text:'Rechtskurve: halte mindestens 450 ft.'},
  {p:new THREE.Vector3(1220,220,-550), r:100, text:'Cargo-Route: durch den grünen Navigationsring.'},
  {p:new THREE.Vector3(760,150,780), r:95, text:'Sinkflug einleiten, Fahrwerk vorbereiten.'},
  {p:new THREE.Vector3(0,70,1250), r:90, text:'Final Approach: auf Runway 18 ausrichten.'},
  {p:new THREE.Vector3(0,7,460), r:65, text:'Landezone: weich aufsetzen und bremsen.'}
];
const checkpointMeshes=[];

function init(){
  renderer=new THREE.WebGLRenderer({canvas, antialias:true, powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.75)); renderer.setSize(innerWidth,innerHeight); renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFShadowMap; renderer.toneMapping=THREE.ACESFilmicToneMapping;
  scene=new THREE.Scene(); scene.background=new THREE.Color(0x91b8dd); scene.fog=new THREE.Fog(0x91b8dd,750,5200);
  camera=new THREE.PerspectiveCamera(65,innerWidth/innerHeight,.1,9000);
  clock=new THREE.Clock();
  hemi=new THREE.HemisphereLight(0xd8ecff,0x3d4b37,.84); scene.add(hemi);
  sun=new THREE.DirectionalLight(0xfff2d0,1.75); sun.position.set(-900,1500,650); sun.castShadow=true; sun.shadow.camera.near=1; sun.shadow.camera.far=3500; sun.shadow.camera.left=-1300; sun.shadow.camera.right=1300; sun.shadow.camera.top=1300; sun.shadow.camera.bottom=-1300; sun.shadow.mapSize.set(2048,2048); scene.add(sun);
  buildWorld(); buildPlane(); buildCheckpoints(); loadModels(); bindInput(); resize(); requestAnimationFrame(loop);
}

function mat(color, rough=.8){return new THREE.MeshLambertMaterial({color});}
function buildWorld(){
  const groundTex=makeCanvasTex(512,512,(ctx,w,h)=>{ctx.fillStyle='#526d45';ctx.fillRect(0,0,w,h);for(let i=0;i<4000;i++){ctx.fillStyle=Math.random()>.5?'#5f7b4e':'#48633e';ctx.globalAlpha=.13;ctx.fillRect(Math.random()*w,Math.random()*h,2+Math.random()*8,1+Math.random()*7)}ctx.globalAlpha=1;}); groundTex.wrapS=groundTex.wrapT=THREE.RepeatWrapping; groundTex.repeat.set(80,80);
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(9000,9000),new THREE.MeshLambertMaterial({map:groundTex})); ground.rotation.x=-Math.PI/2; ground.receiveShadow=true; scene.add(ground);
  runway(0,0,0,70,1800,'18','36'); taxiways(); lights(); buildings(); clouds(); water();
}
function runway(x,z,rot,w,l,a,b){
  const g=new THREE.Group(); g.position.set(x,.012,z); g.rotation.y=rot; scene.add(g);
  const asphalt=new THREE.Mesh(new THREE.PlaneGeometry(w,l),new THREE.MeshLambertMaterial({color:0x30363b})); asphalt.rotation.x=-Math.PI/2; asphalt.receiveShadow=true; g.add(asphalt);
  const centerMat=new THREE.MeshBasicMaterial({color:0xe8eef3}); for(let i=-l/2+70;i<l/2-70;i+=70){const m=new THREE.Mesh(new THREE.PlaneGeometry(2.2,36),centerMat);m.rotation.x=-Math.PI/2;m.position.set(0,.018,i);g.add(m)}
  const edgeMat=new THREE.MeshBasicMaterial({color:0xf6f6f6}); for(const sx of [-w/2+2,w/2-2]){const m=new THREE.Mesh(new THREE.PlaneGeometry(1.4,l-20),edgeMat);m.rotation.x=-Math.PI/2;m.position.set(sx,.02,0);g.add(m)}
  const nums=makeTextPlane(a+'      '+b,220,42,'#ffffff'); nums.rotation.x=-Math.PI/2; nums.position.set(0,.03,l/2-115); g.add(nums);
  const zoneMat=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.8}); for(const end of [-1,1]) for(let r=0;r<3;r++) for(const sx of [-16,-8,8,16]){const m=new THREE.Mesh(new THREE.PlaneGeometry(4,32),zoneMat);m.rotation.x=-Math.PI/2;m.position.set(sx,.025,end*(l/2-145-r*42));g.add(m)}
}
function taxiways(){const m=new THREE.MeshLambertMaterial({color:0x3d4247}); const add=(x,z,w,l)=>{const t=new THREE.Mesh(new THREE.PlaneGeometry(w,l),m);t.rotation.x=-Math.PI/2;t.position.set(x,.01,z);t.receiveShadow=true;scene.add(t)}; add(105,120,26,1200); add(230,500,250,26); add(-180,-420,290,24); add(360,500,26,450);}
function lights(){
  const blue=new THREE.MeshBasicMaterial({color:0x47a9ff}), white=new THREE.MeshBasicMaterial({color:0xeef7ff}), red=new THREE.MeshBasicMaterial({color:0xff3344}), green=new THREE.MeshBasicMaterial({color:0x37ff8a});
  const bulb=new THREE.SphereGeometry(1.2,8,6); const addLight=(x,z,material,intensity=.55,color=0xffffff)=>{const s=new THREE.Mesh(bulb,material);s.position.set(x,1.2,z);scene.add(s);const p=new THREE.PointLight(color,intensity,70);p.position.set(x,4,z);scene.add(p)};
  for(let z=-880;z<=880;z+=42){addLight(-39,z,white,.18,0xddeeff);addLight(39,z,white,.18,0xddeeff)}
  for(let x=-24;x<=24;x+=12){addLight(x,-910,green,.5,0x37ff8a);addLight(x,910,red,.5,0xff3344)}
  for(let z=-520;z<=620;z+=55){addLight(119,z,blue,.18,0x47a9ff)}
  for(let i=0;i<7;i++){addLight(-220+i*70,1080+i*32, i<3?red:white, .45, i<3?0xff3344:0xffffff)}
}
function buildings(){
  const wall=mat(0xb9c4c9), dark=mat(0x202833), glass=new THREE.MeshPhongMaterial({color:0x5aa0c9,transparent:true,opacity:.45,shininess:80});
  const terminal=new THREE.Mesh(new THREE.BoxGeometry(260,42,72),wall); terminal.position.set(260,21,655); terminal.castShadow=terminal.receiveShadow=true; scene.add(terminal);
  for(let i=0;i<9;i++){const win=new THREE.Mesh(new THREE.BoxGeometry(18,14,1),glass);win.position.set(150+i*26,27,618);scene.add(win)}
  const tower=new THREE.Mesh(new THREE.CylinderGeometry(10,14,86,10),dark);tower.position.set(420,43,570);tower.castShadow=true;scene.add(tower); const cab=new THREE.Mesh(new THREE.BoxGeometry(44,20,36),glass);cab.position.set(420,94,570);cab.castShadow=true;scene.add(cab);
  for(let i=0;i<4;i++){const h=new THREE.Mesh(new THREE.BoxGeometry(92,28,70),mat(0x8e989b));h.position.set(-380+i*115,14,650);h.castShadow=h.receiveShadow=true;scene.add(h)}
}
function water(){const sea=new THREE.Mesh(new THREE.PlaneGeometry(4500,1800),new THREE.MeshLambertMaterial({color:0x4a91b8,transparent:true,opacity:.65}));sea.rotation.x=-Math.PI/2;sea.position.set(-1850,-.04,-850);scene.add(sea)}
function clouds(){const geo=new THREE.SphereGeometry(1,10,8), material=new THREE.MeshLambertMaterial({color:0xffffff,transparent:true,opacity:.72}); for(let i=0;i<95;i++){const c=new THREE.Group(); c.position.set((Math.random()-.5)*4800,520+Math.random()*650,(Math.random()-.5)*4800); const n=3+Math.floor(Math.random()*5); for(let j=0;j<n;j++){const s=new THREE.Mesh(geo,material);s.scale.set(35+Math.random()*75,8+Math.random()*18,18+Math.random()*45);s.position.set((Math.random()-.5)*110,(Math.random()-.5)*18,(Math.random()-.5)*65);c.add(s)} scene.add(c)}}
function makeCanvasTex(w,h,draw){const c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d');draw(ctx,w,h);const t=new THREE.CanvasTexture(c);t.anisotropy=8;return t}
function makeTextPlane(txt,w,h,col){const tex=makeCanvasTex(512,128,(ctx,W,H)=>{ctx.clearRect(0,0,W,H);ctx.fillStyle=col;ctx.font='900 64px ui-monospace,monospace';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(txt,W/2,H/2)});return new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:tex,transparent:true,side:THREE.DoubleSide}))}

function buildPlane(){
  if(plane) scene.remove(plane); plane=new THREE.Group(); scene.add(plane);
  const bodyMat=new THREE.MeshPhongMaterial({color:flight.def.color,shininess:60}), dark=mat(0x222831), glass=new THREE.MeshPhongMaterial({color:0x79c9ff,transparent:true,opacity:.48,shininess:100});
  const fus=new THREE.Mesh(new THREE.CylinderGeometry(1.25,1.6,10,16),bodyMat); fus.rotation.x=Math.PI/2; fus.castShadow=true; plane.add(fus);
  const nose=new THREE.Mesh(new THREE.SphereGeometry(1.25,16,10),bodyMat); nose.position.z=-5; nose.scale.z=1.45; nose.castShadow=true; plane.add(nose);
  const wing=new THREE.Mesh(new THREE.BoxGeometry(15,.22,2.0),bodyMat); wing.position.z=-.25; wing.castShadow=true; plane.add(wing);
  const tail=new THREE.Mesh(new THREE.BoxGeometry(6,.18,1.25),bodyMat); tail.position.z=4.5; tail.position.y=.6; tail.castShadow=true; plane.add(tail);
  const fin=new THREE.Mesh(new THREE.BoxGeometry(.35,3,1.25),bodyMat); fin.position.set(0,1.55,4.35); fin.castShadow=true; plane.add(fin);
  const cockpit=new THREE.Mesh(new THREE.BoxGeometry(2.2,.7,1.2),glass); cockpit.position.set(0,.9,-3.3); plane.add(cockpit);
  for(const x of [-4.6,4.6]){const e=new THREE.Mesh(new THREE.CylinderGeometry(.45,.52,1.35,14),dark);e.rotation.z=Math.PI/2;e.position.set(x,-.35,-.55);e.castShadow=true;plane.add(e)}
  flight.wheels=[]; for(const [x,z] of [[-2.4,2.0],[2.4,2.0],[0,-3.1]]){const w=new THREE.Mesh(new THREE.CylinderGeometry(.34,.34,.24,14),dark);w.rotation.z=Math.PI/2;w.position.set(x,-1.25,z);w.castShadow=true;plane.add(w);flight.wheels.push(w)}
}
function loadModels(){
  const loader=THREE.GLTFLoader ? new THREE.GLTFLoader() : null; if(!loader) return;
  loader.load('assets/airplane/models/low_poly_airport.glb',g=>{airportModel=g.scene; airportModel.scale.setScalar(.46); airportModel.position.set(-520,0,1180); airportModel.rotation.y=Math.PI; airportModel.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=true}}); scene.add(airportModel)},undefined,()=>{});
  loadPlaneModel();
}
function loadPlaneModel(){
  const loader=THREE.GLTFLoader ? new THREE.GLTFLoader() : null; if(!loader) return;
  const def=flight.def;
  loader.load(def.model,g=>{
    const model=g.scene;
    model.updateMatrixWorld(true);
    const rawBox=new THREE.Box3().setFromObject(model);
    const rawSize=rawBox.getSize(new THREE.Vector3());
    const longest=Math.max(rawSize.x,rawSize.y,rawSize.z)||1;
    model.scale.setScalar((def.length||14)/longest);
    model.updateMatrixWorld(true);
    const box=new THREE.Box3().setFromObject(model), center=box.getCenter(new THREE.Vector3());
    model.position.sub(center);
    model.rotation.y=Math.PI;
    model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true}});
    while(plane.children.length)plane.remove(plane.children[0]);
    flight.wheels=[];
    plane.add(model);
  },undefined,()=>{});
}
function buildGearVisual(){flight.wheels=[]; const dark=mat(0x111111); for(const [x,z] of [[-2.4,2.2],[2.4,2.2],[0,-3.3]]){const w=new THREE.Mesh(new THREE.CylinderGeometry(.34,.34,.24,14),dark);w.rotation.z=Math.PI/2;w.position.set(x,-1.3,z);w.castShadow=true;plane.add(w);flight.wheels.push(w)}}

function buildCheckpoints(){const geo=new THREE.TorusGeometry(1,0.035,8,64); checkpoints.forEach((cp,i)=>{const m=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color:i===checkpoints.length-1?0x37d488:0x58d7ff,transparent:true,opacity:.75}));m.position.copy(cp.p);m.scale.setScalar(cp.r);m.rotation.x=Math.PI/2;scene.add(m);checkpointMeshes.push(m)})}

function bindInput(){
  addEventListener('keydown',e=>{keys.add(e.code); if(['KeyW','KeyA','KeyS','KeyD','Space','ShiftLeft','ControlLeft'].includes(e.code))e.preventDefault(); if(e.code==='KeyC')state.camera=(state.camera+1)%3; if(e.code==='KeyG')toggleGear(); if(e.code==='KeyR')resetFlight(); if(e.code==='Escape'||e.code==='KeyP')togglePause();});
  addEventListener('keyup',e=>keys.delete(e.code)); addEventListener('resize',resize);
  canvas.addEventListener('pointerdown',e=>{pointer.active=true; pointer.cx=e.clientX; pointer.cy=e.clientY; canvas.setPointerCapture(e.pointerId)}); canvas.addEventListener('pointermove',e=>{if(pointer.active){pointer.x=clamp((e.clientX-pointer.cx)/260,-1,1); pointer.y=clamp((e.clientY-pointer.cy)/220,-1,1)}}); canvas.addEventListener('pointerup',()=>{pointer.active=false; pointer.x=pointer.y=0});
  document.querySelectorAll('.plane-choice').forEach(b=>b.onclick=()=>{selected=b.dataset.aircraft; document.querySelectorAll('.plane-choice').forEach(x=>x.classList.toggle('active',x===b));});
  $('start-game').onclick=()=>start(false); $('free-flight').onclick=()=>start(true); $('resume-game').onclick=togglePause; $('restart-game').onclick=()=>{ui.pause.classList.remove('open');resetFlight();state.mode='play'};
}
function start(free){state.free=free;ui.main.classList.remove('open');state.mode='play';resetFlight(selected);toast(free?'ATC: Freiflug freigegeben.':'ATC: Cleared for takeoff runway 36.');audioStart()}
function togglePause(){if(state.mode==='menu')return; const paused=ui.pause.classList.toggle('open'); state.mode=paused?'pause':'play'; if(paused)ui.pauseSummary.textContent=`${Math.round(flight.pos.y*FT)} ft · ${Math.round(flight.vel.length()*KT)} kt · Score ${state.score}`}
function toggleGear(){if(flight.pos.y<8 || flight.vel.length()*KT<210){flight.gearDown=!flight.gearDown;toast(flight.gearDown?'Gear down and locked.':'Gear up.')}else toast('Gear speed too high.')}
function resetFlight(kind=selected){flight.def=aircraftDefs[kind]||flight.def; flight.pos.set(0,2,360); flight.vel.set(0,0,-4); flight.quat.identity(); flight.ang.set(0,0,0); flight.throttle=.18; flight.gearDown=true; flight.brake=0; flight.fuel=1; flight.damage=0; flight.onGround=true; flight.crashed=false; state.score=0; state.checkpoint=0; state.missionDone=false; buildPlane(); loadPlaneModel(); updateMissionText();}

function update(dt){if(state.mode!=='play')return; state.time+=dt; handleInput(dt); physics(dt); mission(dt); updateCamera(dt); updateUI(); updateAudio();}
function handleInput(dt){
  const inc=(keys.has('ShiftLeft')||keys.has('ShiftRight')?1:0)-(keys.has('ControlLeft')||keys.has('ControlRight')?1:0); flight.throttle=clamp(flight.throttle+inc*dt*.45,0,1);
  flight.brake=keys.has('KeyB')||keys.has('Space')?1:0;
}
function physics(dt){
  const def=flight.def; flight.quat.normalize(); forward.set(0,0,-1).applyQuaternion(flight.quat); right.set(1,0,0).applyQuaternion(flight.quat); up.set(0,1,0).applyQuaternion(flight.quat);
  const speed=flight.vel.length(); const air=flight.vel.clone().sub(windAt(flight.pos,state.time)); const airspeed=Math.max(.1,air.length()); const airDir=air.clone().normalize();
  const localV=air.clone().applyQuaternion(flight.quat.clone().invert()); flight.aoa=Math.atan2(localV.y, -localV.z);
  const stall=Math.abs(flight.aoa)>17*DEG || airspeed<def.stall*.514; flight.stall=stall;
  const rho=1.225*Math.exp(-Math.max(0,flight.pos.y)/8500); const q=.5*rho*airspeed*airspeed; const aoaCl=clamp(flight.aoa/DEG,-18,18); let cl=clamp(aoaCl*.085,-1.15,1.45); if(stall)cl*=.42;
  const lift=up.clone().multiplyScalar(q*def.wing*cl/def.mass); const drag=airDir.clone().multiplyScalar(-q*def.wing*(def.drag+(cl*cl*.035))/def.mass); const thrust=forward.clone().multiplyScalar((def.thrust*flight.throttle)/def.mass); const gravity=new THREE.Vector3(0,-9.81,0);
  flight.vel.addScaledVector(gravity,dt).addScaledVector(lift,dt).addScaledVector(drag,dt).addScaledVector(thrust,dt);
  const turb=new THREE.Vector3(Math.sin(state.time*1.7+flight.pos.z*.003), Math.sin(state.time*2.3)*.15, Math.cos(state.time*1.2+flight.pos.x*.002)).multiplyScalar(.22); if(flight.pos.y>35)flight.vel.addScaledVector(turb,dt);
  const pitch=(keys.has('KeyS')?1:0)-(keys.has('KeyW')?1:0)-pointer.y*.55; const roll=(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0)+pointer.x*.75; const yaw=(keys.has('KeyQ')?1:0)-(keys.has('KeyE')?1:0);
  const ctrl=clamp(airspeed/42,0,1); const stallMul=stall?.42:1; flight.ang.x=smooth(flight.ang.x,pitch*def.pitch*ctrl*stallMul,dt*4.5); flight.ang.z=smooth(flight.ang.z,-roll*def.roll*ctrl*stallMul,dt*5.2); flight.ang.y=smooth(flight.ang.y,yaw*def.yaw*ctrl + roll*.18*ctrl,dt*3.6);
  const dq=new THREE.Quaternion().setFromEuler(new THREE.Euler(flight.ang.x*dt,flight.ang.y*dt,flight.ang.z*dt,'YXZ')); flight.quat.multiply(dq);
  if(stall && !flight.onGround){flight.quat.multiply(new THREE.Quaternion().setFromAxisAngle(right, -0.35*dt)); flight.vel.addScaledVector(up,-2.2*dt)}
  flight.pos.addScaledVector(flight.vel,dt); flight.vSpeed=flight.vel.y;
  const groundY=groundHeight(flight.pos.x,flight.pos.z)+1.35;
  if(flight.pos.y<=groundY){
    const impact=-flight.vel.y; flight.pos.y=groundY; flight.onGround=true; if(impact>4.5 || Math.abs(flight.ang.z)>1.1){damage((impact-4.5)*.09); if(impact>9||Math.abs(flight.ang.z)>1.6)crash('HARD LANDING')}
    flight.vel.y=0; const fwdSpeed=flight.vel.dot(forward); const sideSpeed=flight.vel.dot(right); const brake=flight.brake*(flight.gearDown?7.5:1.5); flight.vel.addScaledVector(forward,-Math.sign(fwdSpeed)*Math.min(Math.abs(fwdSpeed),brake*dt)); flight.vel.addScaledVector(right,-sideSpeed*clamp(dt*7,0,1));
    if(flight.gearDown){const steer=((keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0))*dt*.75; flight.quat.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),steer*clamp(speed/12,0,1)));}
  } else flight.onGround=false;
  flight.fuel=clamp(flight.fuel-dt*(.000018+.000065*flight.throttle),0,1); if(flight.fuel<=0)flight.throttle=0;
  if(flight.pos.y<groundY-15 || Math.abs(flight.pos.x)>4300 || Math.abs(flight.pos.z)>4300)crash('OUT OF BOUNDS');
  plane.position.copy(flight.pos); plane.quaternion.copy(flight.quat); flight.wheels.forEach(w=>w.visible=flight.gearDown);
  flight.lift01=clamp((lift.y+2)/14,0,1);
}
function windAt(p,t){return new THREE.Vector3(4+Math.sin(t*.21)*2,0,1.5*Math.sin(t*.13+p.x*.001));}
function groundHeight(){return 0}
function damage(v){flight.damage=clamp(flight.damage+v,0,1); if(flight.damage>=1)crash('AIRFRAME FAILURE')}
function crash(reason){if(flight.crashed)return; flight.crashed=true; state.mode='pause'; ui.pause.classList.add('open'); ui.pauseSummary.textContent=`${reason}. Score ${state.score}. Drücke Restart.`; toast(reason)}
function mission(){if(state.free||state.missionDone)return; const cp=checkpoints[state.checkpoint]; if(!cp)return; const d=flight.pos.distanceTo(cp.p); checkpointMeshes.forEach((m,i)=>{m.visible=i>=state.checkpoint; m.material.opacity = i === state.checkpoint ? .95 : .25; m.rotation.z+=.006}); if(d<cp.r){state.score+= state.checkpoint===checkpoints.length-1 ? landingScore() : 500+Math.round(flight.vel.length()*8); state.checkpoint++; if(state.checkpoint>=checkpoints.length){state.missionDone=true;toast('Mission complete. Saubere Landung!');} else {toast('Checkpoint cleared.'); updateMissionText();}}}
function landingScore(){const sink=Math.abs(flight.vSpeed), sp=flight.vel.length()*KT; return Math.max(300,Math.round(1800-sink*220-Math.abs(sp-85)*12-flight.damage*600))}
function updateMissionText(){const cp=checkpoints[state.checkpoint]; ui.missionTitle.textContent=state.free?'Freiflug':'Frachtflug GL-204'; ui.missionText.textContent=state.free?'Trainiere Start, Landung und Navigation ohne Wertung.':(cp?cp.text:'Mission abgeschlossen.');}
function updateCamera(dt){
  const mode=state.camera; forward.set(0,0,-1).applyQuaternion(flight.quat); right.set(1,0,0).applyQuaternion(flight.quat); up.set(0,1,0).applyQuaternion(flight.quat);
  let target=flight.pos.clone(), camPos;
  if(mode===0){
    camPos=flight.pos.clone().addScaledVector(forward,-28).addScaledVector(up,8);
    target=flight.pos.clone().addScaledVector(forward,60).addScaledVector(up,2.5);
  }
  else if(mode===1){
    camPos=flight.pos.clone().addScaledVector(forward,2.2).addScaledVector(up,1.45);
    target=flight.pos.clone().addScaledVector(forward,140).addScaledVector(up,4);
  }
  else camPos=flight.pos.clone().add(new THREE.Vector3(0,55,80)), target=flight.pos.clone();
  camera.position.lerp(camPos,1-Math.exp(-dt*4.2)); camera.lookAt(target);
}
function updateUI(){const sp=flight.vel.length()*KT, alt=Math.max(0,(flight.pos.y-1.35)*FT), hdg=(Math.atan2(forward.x,-forward.z)/DEG+360)%360; ui.speed.textContent=Math.round(sp); ui.alt.textContent=Math.round(alt); ui.heading.textContent=String(Math.round(hdg)).padStart(3,'0'); ui.vs.textContent=Math.round(flight.vSpeed*196.85); ui.score.textContent=state.score; ui.fuel.textContent=Math.round(flight.fuel*100)+'%'; ui.damage.textContent=Math.round(flight.damage*100)+'%'; ui.throttleBar.style.width=(flight.throttle*100)+'%'; ui.throttleTxt.textContent=Math.round(flight.throttle*100)+'%'; ui.liftBar.style.width=(flight.lift01*100)+'%'; ui.liftTxt.textContent=Math.round(flight.lift01*100)+'%'; ui.stallBar.style.width=(flight.stall?100:Math.min(99,Math.abs(flight.aoa)/(17*DEG)*100))+'%'; ui.stallTxt.textContent=flight.stall?'STALL':'OK'; ui.gear.textContent=flight.gearDown?'GEAR DOWN':'GEAR UP'; ui.progress.style.width=((state.checkpoint/checkpoints.length)*100)+'%'; const warn=flight.crashed?'CRASH':flight.stall?'STALL WARNING':flight.fuel<.12?'LOW FUEL':(!flight.gearDown&&flight.pos.y<90&&sp<155?'GEAR?':'READY'); ui.warning.textContent=warn; ui.warning.className='hud-tape warn '+(warn==='READY'?'':warn==='GEAR?'||warn==='LOW FUEL'?'caution':'danger')}
function toast(t){ui.toast.textContent='ATC: '+t; ui.toast.classList.add('show'); clearTimeout(state.toastTimer); state.toastTimer=setTimeout(()=>ui.toast.classList.remove('show'),2600)}
function audioStart(){if(audio)return; const AC=window.AudioContext||window.webkitAudioContext; if(!AC)return; const ctx=new AC(); const master=ctx.createGain(); master.gain.value=.12; master.connect(ctx.destination); const osc=ctx.createOscillator(), wind=ctx.createOscillator(), gain=ctx.createGain(), wg=ctx.createGain(); osc.type='sawtooth'; wind.type='triangle'; osc.frequency.value=80; wind.frequency.value=180; gain.gain.value=.05; wg.gain.value=.02; osc.connect(gain).connect(master); wind.connect(wg).connect(master); osc.start(); wind.start(); audio={ctx,osc,wind,gain,wg}}
function updateAudio(){if(!audio)return; const sp=flight.vel.length()*KT; audio.osc.frequency.setTargetAtTime(55+flight.throttle*150+sp*.16,audio.ctx.currentTime,.04); audio.gain.gain.setTargetAtTime(.03+flight.throttle*.08,audio.ctx.currentTime,.08); audio.wind.frequency.setTargetAtTime(120+sp*1.4,audio.ctx.currentTime,.08); audio.wg.gain.setTargetAtTime(clamp((sp-35)/220,0,.07)+(flight.onGround&&sp>8?.04:0),audio.ctx.currentTime,.08)}
function resize(){renderer.setSize(innerWidth,innerHeight); camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix()}
function loop(){const dt=Math.min(.033,clock.getDelta()); update(dt); renderer.render(scene,camera); requestAnimationFrame(loop)}

addEventListener('DOMContentLoaded',()=>{if(!window.THREE){alert('Three.js konnte nicht geladen werden.');return} init()});
})();
