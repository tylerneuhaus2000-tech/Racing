/* Imported meshes may contain all four wheels in one primitive. Split only
   wheel geometry into car-local pivots; retain the original vertex attributes. */
(function (root) {
  'use strict';
  function attach(THREE, model, body, config = {}) {
    body.updateWorldMatrix(true, true);
    const inverse = body.matrixWorld.clone().invert();
    const bounds = new THREE.Box3();
    model.traverse(mesh => {
      if(!mesh.isMesh) return;
      if(!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
      bounds.union(mesh.geometry.boundingBox.clone().applyMatrix4(inverse.clone().multiply(mesh.matrixWorld)));
    });
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const buckets = Array.from({length:4}, () => []);
    const steering = [];
    const meshes = [];
    model.traverse(mesh => { if(mesh.isMesh && !mesh.isSkinnedMesh) meshes.push(mesh); });
    const rig = new THREE.Group();
    rig.name = 'vehicle-animation';
    model.updateMatrix();
    rig.matrix.copy(model.matrix).invert();
    rig.matrixAutoUpdate = false;
    model.add(rig);
    for(const mesh of meshes) {
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      let name = mesh.name + ' ' + materials.map(m => m.name || '').join(' ');
      for(let parent=mesh.parent;parent && parent!==model;parent=parent.parent) name+=' '+parent.name;
      const isSteering = /steer(?:ing)?[_ -]?(?:wheel|hr)|lenkrad|volant|int_steer|sw_decals|int_wheelleather/i.test(name);
      const namedWheel = !isSteering && /tire|tyre|rim|wheel|gume|discuri|rotor|caliper|calliper/i.test(name)
        && !/wheelhouse|tyre_cover|rim_blur|rim.*blur/i.test(name);
      if(!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
      const transform = inverse.clone().multiply(mesh.matrixWorld);
      const box = mesh.geometry.boundingBox.clone().applyMatrix4(transform);
      const s = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
      // Conservative geometric fallback for exports with anonymous materials.
      const geometricWheel = Math.abs(c.x-center.x) > size.x*0.27 && c.y < bounds.min.y+size.y*0.48
        && Math.abs(c.z-center.z) > size.z*0.18 && s.x < size.x*0.28
        && s.y > size.z*0.065 && s.y < size.z*0.20 && s.z/s.y > 0.80 && s.z/s.y < 1.25;
      if(!isSteering && !namedWheel && !geometricWheel) continue;
      if(/rim.*blur/i.test(name)) continue;
      const geometry = mesh.geometry.clone();
      // Quantized GLBs store normalized integers. Transforming those buffers
      // directly truncates coordinates; decode into floats before rigging.
      for(const key of ['position','normal','tangent']) {
        const attr=geometry.attributes[key];
        if(!attr) continue;
        const array=new Float32Array(attr.count*attr.itemSize);
        const source=attr.isInterleavedBufferAttribute?attr.data.array:attr.array;
        const max=source instanceof Int8Array?127:source instanceof Uint8Array?255:source instanceof Int16Array?32767:source instanceof Uint16Array?65535:1;
        for(let i=0;i<attr.count;i++) for(let k=0;k<attr.itemSize;k++) {
          const value=source[attr.isInterleavedBufferAttribute?i*attr.data.stride+attr.offset+k:i*attr.itemSize+k];
          array[i*attr.itemSize+k]=attr.normalized?Math.max(-1,value/max):value;
        }
        geometry.setAttribute(key,new THREE.BufferAttribute(array,attr.itemSize));
      }
      geometry.applyMatrix4(transform);
      const pos = geometry.attributes.position;
      const index = geometry.index;
      const selections = Array.from({length:6}, () => []);
      const a = new THREE.Vector3(), b = new THREE.Vector3(), c3 = new THREE.Vector3();
      for(let i=0, count=index ? index.count : pos.count; i<count; i+=3) {
        const ids = [0,1,2].map(k => index ? index.getX(i+k) : i+k);
        a.fromBufferAttribute(pos,ids[0]); b.fromBufferAttribute(pos,ids[1]); c3.fromBufferAttribute(pos,ids[2]);
        const x=(a.x+b.x+c3.x)/3, y=(a.y+b.y+c3.y)/3, z=(a.z+b.z+c3.z)/3;
        let slot=5;
        if(isSteering && s.x < size.x*0.65 && s.z < size.z*0.35) slot=4;
        else if(!isSteering && Math.abs(x-center.x)>size.x*0.23 && y<bounds.min.y+size.y*0.65
          && Math.abs(z-center.z)>size.z*0.16) slot=(z>center.z?0:2)+(x>center.x?1:0);
        selections[slot].push(...ids);
      }
      if(selections.slice(0,5).every(ids=>!ids.length)) { geometry.dispose(); continue; }
      // Preserve primitive groups/material indices when partitioning a mesh.
      if(materials.length>1) { geometry.dispose(); continue; }
      selections.forEach((ids,slot) => {
        if(!ids.length) return;
        const part = new THREE.BufferGeometry();
        for(const [key,attr] of Object.entries(geometry.attributes)) part.setAttribute(key,attr);
        part.setIndex(ids);
        part.boundingBox=new THREE.Box3();
        for(const id of ids) part.boundingBox.expandByPoint(a.fromBufferAttribute(pos,id));
        const object = new THREE.Mesh(part,mesh.material);
        object.name = mesh.name;
        object.castShadow=mesh.castShadow; object.receiveShadow=mesh.receiveShadow;
        rig.add(object);
        if(slot<4) buckets[slot].push({object, stationary:/caliper|calliper/i.test(name)});
        else if(slot===4) steering.push(object);
      });
      mesh.visible=false;
    }
    const wheels=[];
    buckets.forEach((parts,i) => {
      if(!parts.length) return;
      const box=new THREE.Box3();
      parts.forEach(p=>box.union(p.object.geometry.boundingBox));
      const pivot=box.getCenter(new THREE.Vector3());
      if(box.max.y-box.min.y > size.z*0.3) return;
      const outer=new THREE.Group(), inner=new THREE.Group();
      outer.position.copy(pivot); rig.add(outer); outer.add(inner);
      for(const {object,stationary} of parts) { (stationary?outer:inner).add(object); object.position.copy(pivot).negate(); }
      wheels.push({outer,inner,front:i<2,radius:Math.max(0.1,(box.max.y-box.min.y)/2),spin:0});
    });
    let steeringPivot=null;
    if(steering.length) {
      const box=new THREE.Box3();
      steering.forEach(o=>box.union(o.geometry.boundingBox));
      steeringPivot=new THREE.Group(); steeringPivot.position.copy(box.getCenter(new THREE.Vector3())); rig.add(steeringPivot);
      steering.forEach(o=>{steeringPivot.add(o);o.position.copy(steeringPivot.position).negate();});
    }
    const axis=new THREE.Vector3(...(config.steeringAxis || [0,0.35,1])).normalize();
    return {
      wheels, steering:steeringPivot,
      update(dt,speed,steer,slipping=false) {
        for(const w of wheels) {
          w.spin=(w.spin+speed*dt/w.radius*(slipping&&!w.front?2.4:1))%(Math.PI*2);
          w.inner.rotation.x=w.spin;
          w.outer.rotation.y=w.front?steer:0;
        }
        if(steeringPivot) steeringPivot.quaternion.setFromAxisAngle(axis,-steer*(config.steeringRatio || 8));
      }
    };
  }
  root.VehicleAnimation = {attach};
})(typeof window !== 'undefined' ? window : globalThis);
