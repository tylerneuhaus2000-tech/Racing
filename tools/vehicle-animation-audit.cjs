// Run with the same Three.js r128 build used by the game (path as first arg).
const fs=require('node:fs');
const vm=require('node:vm');
global.THREE=require(process.argv[2]);
global.window=global;
global.self=global;
global.Image=class {set src(value){this.height=1;queueMicrotask(()=>this.onload());}};
for(const file of ['assets/meshopt_decoder.js','assets/GLTFLoader.js','assets/vehicle-animation.js'])
  vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
const html=fs.readFileSync('gt3-web-racer.html','utf8');
const start=html.indexOf('const CARS = [');
const end=html.indexOf('\n];',start)+3;
const cars=vm.runInNewContext(html.slice(start,end)+'; CARS',{Math});
(async()=>{
  for(const car of cars) for(const cfg of [car.model,...(car.liveries||[]).map(l=>l.model)]) {
    const loader=new THREE.GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
    // Audit geometry without a browser/image decoder; keep material names intact.
    loader.register(parser=>{parser.loadTexture=parser.loadTextureImage=()=>Promise.resolve(new THREE.Texture());return {name:'audit-no-textures'};});
    const bytes=fs.readFileSync(cfg.url);
    const gltf=await new Promise((resolve,reject)=>loader.parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'',resolve,reject));
    const model=gltf.scene,body=new THREE.Group();
    const box=new THREE.Box3().setFromObject(model),size=box.getSize(new THREE.Vector3()),c=box.getCenter(new THREE.Vector3());
    const scale=(cfg.targetLength||4.6)/Math.max(size.x,size.z)*(cfg.scale||1),angle=cfg.rotY??Math.PI;
    model.scale.setScalar(scale);model.rotation.y=angle;
    model.position.set(-(c.x*Math.cos(angle)+c.z*Math.sin(angle))*scale,-box.min.y*scale, -(-c.x*Math.sin(angle)+c.z*Math.cos(angle))*scale);
    body.add(model);
    if(process.env.VEHICLE_AUDIT_DETAILS && ['lamborghini','bentley','mustang'].includes(car.id)) {
      model.updateWorldMatrix(true,true);
      model.traverse(o=>{
        if(o.name && /wheel.*(?:front|fl|lf)|steer_hr/i.test(o.name) && !o.isMesh)
          console.log('orientation',car.id,o.name,new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3()).toArray());
      });
    }
    body.position.set(14,2,-8);body.rotation.y=0.7;
    const rig=VehicleAnimation.attach(THREE,model,body,cfg);
    for(const w of rig.wheels) {
      if(w.radius<0.1 || w.radius>0.8)throw Error('Invalid radius: '+cfg.url);
      const origin=w.outer.position.clone();
      rig.update(0.1,10,0.25);
      if(!origin.equals(w.outer.position))throw Error('Wheel pivot moved');
    }
    rig.update(0,0,0);
    const previous=rig.wheels.map(w=>w.spin);
    rig.update(0.1,10,0.25);
    if(rig.wheels.some(w=>!Number.isFinite(w.inner.rotation.x)||w.front&&w.outer.rotation.y!==0.25))throw Error('Invalid wheel transform');
    rig.update(0.1,-10,-0.25);
    if(rig.wheels.some((w,i)=>Math.abs(Math.sin((w.spin-previous[i])/2))>1e-6))throw Error('Reverse rotation mismatch');
    console.log(JSON.stringify({car:car.id,url:cfg.url,wheels:rig.wheels.length,steering:!!rig.steering,radii:rig.wheels.map(w=>+w.radius.toFixed(3))}));
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
