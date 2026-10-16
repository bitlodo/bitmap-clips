import {test,expect} from 'bun:test';
import * as THREE from 'three';
import snapshot from '../src/demo.json';
import {makeClip,createFilm,parseDocument,validateFilm} from '../src/clips/film';
import {buildClip} from '../src/clips/registry';
import {bakeDrop} from '../src/drop-physics';
import {sampleDrop} from '../src/physics-cache';
import type {SceneData} from '../src/editor-model';
const data=snapshot as SceneData;
test('Gravity uses the existing physics effect with every transaction and preserves project data',()=>{
 const film=createFilm(data);film.clips=[makeClip('reveal',300)];film.clips[0]!.settings.revealType='gravity';const valid=validateFilm(film,data),restored=parseDocument(JSON.parse(JSON.stringify({data,film:valid})));
 expect(restored.film).toEqual(valid);expect(restored.data.layout.parcels).toEqual(data.layout.parcels);
 const plan=buildClip({data,look:film.look},film.clips[0]!);expect(plan.engine.models).toHaveLength(1);expect(plan.engine.models[0]!.kind).toBe('drop');expect(plan.phases.map(p=>p.id)).toEqual(['flow','settle']);expect(plan.text).toBeUndefined();
});
test('Gravity bakes collisions for different cube sizes and holds the final pile when seeking',async()=>{
 const parcels=[{...data.layout.parcels[0]!,size:2,x:0,y:0,txIndex:0},{...data.layout.parcels[1]!,size:3,x:3,y:0,txIndex:1},{...data.layout.parcels[2]!,size:1,x:6,y:0,txIndex:2}];
 const tiny={...data,txCount:3,layout:{width:8,height:4,parcels}},c=makeClip('presentation-gravity'),model=buildClip({data:tiny,look:'monument'},c).engine.models[0]!;
 const progress:number[]=[];const bake=await bakeDrop(tiny,model,value=>progress.push(value));expect(progress.length).toBeGreaterThan(1);expect(progress.at(-1)).toBe(1);for(let i=1;i<progress.length;i++)expect(progress[i]!).toBeGreaterThanOrEqual(progress[i-1]!);expect(bake.count).toBe(parcels.length);
 const position=new THREE.Vector3(),rotation=new THREE.Quaternion();
 expect(sampleDrop(bake,0,0,position,rotation)).toBe(false);
 for(let i=0;i<parcels.length;i++){
  expect(sampleDrop(bake,i,bake.seconds,position,rotation)).toBe(true);const final=position.clone(),finalRotation=rotation.clone();
  expect(position.y).toBeLessThan(10);sampleDrop(bake,i,bake.seconds+10,position,rotation);expect(position.equals(final)).toBe(true);expect(rotation.equals(finalRotation)).toBe(true);
  const matrix=new THREE.Matrix4().makeRotationFromQuaternion(rotation),r=matrix.elements,half=(parcels[i]!.size-.5)/2;
  expect(position.y-half*(Math.abs(r[1]!)+Math.abs(r[5]!)+Math.abs(r[9]!))).toBeGreaterThan(-.04);
 }
});

test('physics publishes computed frame batches that match the final bake',async()=>{
 const tiny={...data,txCount:2,layout:{width:8,height:4,parcels:data.layout.parcels.slice(0,2).map((p,i)=>({...p,size:i+1,x:i*3,y:0,txIndex:i}))}};
 const model=buildClip({data:tiny,look:'monument'},makeClip('presentation-gravity')).engine.models[0]!;
 const chunks:import('../src/drop-physics').DropChunk[]=[];
 const bake=await bakeDrop(tiny,model,()=>{},chunk=>chunks.push(chunk));
 expect(chunks.length).toBeGreaterThan(2);let frames=0;
 for(const chunk of chunks){expect(chunk.startFrame).toBe(frames);expect(chunk.frames).toEqual(bake.frames.slice(chunk.startFrame*bake.count*7,(chunk.startFrame*bake.count*7)+chunk.frames.length));frames+=chunk.frames.length/(bake.count*7);}
 expect(frames).toBe(bake.frameCount);
 const partial={...bake,frames:bake.frames.slice(0,25*bake.count*7),completedFrames:25};
 const p=new THREE.Vector3(),q=new THREE.Quaternion(),expectedP=new THREE.Vector3(),expectedQ=new THREE.Quaternion();
 for(const time of [.2,.5,.8]){expect(sampleDrop(partial,0,time,p,q)).toBe(sampleDrop(bake,0,time,expectedP,expectedQ));expect(p.toArray()).toEqual(expectedP.toArray());expect(q.toArray()).toEqual(expectedQ.toArray());}
 sampleDrop(partial,0,100,p,q);sampleDrop(bake,0,24/bake.fps,expectedP,expectedQ);expect(p.toArray()).toEqual(expectedP.toArray());expect(q.toArray()).toEqual(expectedQ.toArray());
});

test('Gravity simulation follows resized clip duration while Flow is independent',async()=>{
 for(const duration of [60,300,600]){
  const c=makeClip('presentation-gravity',duration);c.settings.flow=1;
  const model=buildClip({data,look:'monument'},c).engine.models[0]!;
  expect(model.duration).toBe(data.layout.parcels.length/100);expect(model.simulationDuration).toBe(duration/30);
 }
 const c=makeClip('presentation-gravity',60);c.settings.flow=1;
 const tiny={...data,txCount:2,layout:{width:8,height:4,parcels:data.layout.parcels.slice(0,2).map((p,i)=>({...p,size:2,x:i*3,y:0,txIndex:i}))}};
 const model=buildClip({data:tiny,look:'monument'},c).engine.models[0]!,bake=await bakeDrop(tiny,model);
 expect(bake.seconds).toBe(2);expect(bake.flowDuration).toBe(2/100);
});
test('births stay within a fixed spawn volume without raising the emitter over time',async()=>{
 const count=12,parcels=Array.from({length:count},(_,i)=>({...data.layout.parcels[0]!,size:1,x:i*2,y:0,txIndex:i}));
 const tiny={...data,txCount:count,layout:{width:26,height:4,parcels}},c=makeClip('presentation-gravity',120);c.settings.flow=10;
 const model=buildClip({data:tiny,look:'monument'},c).engine.models[0]!,bake=await bakeDrop(tiny,model);
 const height=(26*.2+.5*1.5)*Number(c.settings.dropHeight)/5+.5,depth=height;
 const birthHeights=parcels.map((_,i)=>{
  const first=Math.ceil((bake.birthTimes![i]!-1e-6)*bake.fps);
  return bake.frames[(first*count+i)*7+1]!;
 });
 for(const y of birthHeights){expect(y).toBeGreaterThan(height-1);expect(y).toBeLessThanOrEqual(height+depth);}

});

test('faucet emits throughout a fixed circular region independently of bitmap parcel positions',async()=>{
 const {emissionPoint}=await import('../src/drop-physics');const points=Array.from({length:100},(_,i)=>emissionPoint(i,42,5));
 for(const point of points)expect(Math.hypot(point.x,point.z)).toBeLessThanOrEqual(5);
 expect(new Set(points.map(p=>JSON.stringify(p))).size).toBe(100);expect(emissionPoint(7,42,5)).toEqual(emissionPoint(7,42,5));
 const c=makeClip('presentation-gravity');c.settings.flow=10;const model=buildClip({data,look:'monument'},c).engine.models[0]!;expect(model.emitterRadius).toBe(.3);
});

test('Fall speed accelerates physical descent while preserving emission timing and cube sizes',async()=>{
 const tiny={...data,txCount:1,layout:{width:8,height:4,parcels:[{...data.layout.parcels[0]!,size:2,x:0,y:0,txIndex:0}]}},c=makeClip('presentation-gravity',240);c.settings.flow=10;
 c.settings.speed=1;const slow=buildClip({data:tiny,look:'monument'},c).engine.models[0]!;
 c.settings.speed=3;const fast=buildClip({data:tiny,look:'monument'},c).engine.models[0]!;
 const a=await bakeDrop(tiny,slow),b=await bakeDrop(tiny,fast);
 expect(a.flowDuration).toBe(b.flowDuration);expect(Math.abs(a.birthTimes![0]!-b.birthTimes![0]!)).toBeLessThanOrEqual(1/60);expect(a.count).toBe(b.count);
 const time=a.birthTimes![0]!+.15,p=new THREE.Vector3(),q=new THREE.Quaternion();sampleDrop(a,0,time,p,q);const slowHeight=p.y;sampleDrop(b,0,time,p,q);expect(p.y).toBeLessThan(slowHeight);
});

test('emission order is shuffled, repeatable and retains every transaction exactly once',async()=>{
 const {emissionOrder}=await import('../src/drop-physics');const order=emissionOrder(100,42);
 expect(order).not.toEqual(Array.from({length:100},(_,i)=>i));expect(order).toEqual(emissionOrder(100,42));expect(order).not.toEqual(emissionOrder(100,43));expect(order.toSorted((a,b)=>a-b)).toEqual(Array.from({length:100},(_,i)=>i));
});

test('Drop height alone controls the spawn volume; saved legacy spawn depth is discarded',async()=>{
 const {settingsFor,controlsFor}=await import('../src/clips/registry');
 const settings=settingsFor('presentation-gravity',{height:.2,spawnDepth:.4});expect(settings.dropHeight).toBe(1);expect(settings).not.toHaveProperty('spawnDepth');expect(controlsFor('presentation-gravity').map(c=>c.key)).not.toContain('spawnDepth');
});

test('three Gravity controls drive emission rate, automatic radius and height',async()=>{
 const {controlsFor,settingsFor}=await import('../src/clips/registry');
 expect(controlsFor('presentation-gravity').map(c=>c.label)).toEqual(['Gravity Speed','Drop Height','Flow','Camera animation','Speed','Zoom strength','Interpolation']);
 const c=makeClip('presentation-gravity');c.settings.flow=1;const gentle=buildClip({data,look:'monument'},c).engine.models[0]!;
 c.settings.flow=10;c.settings.dropHeight=10;c.settings.speed=5;const abundant=buildClip({data,look:'monument'},c).engine.models[0]!;
 expect(abundant.duration).toBeLessThan(gentle.duration);expect(abundant.emitterRadius!).toBeGreaterThan(gentle.emitterRadius!);expect(abundant.strength).toBe(2);expect(abundant.fallSpeed).toBe(5);
 const migrated=settingsFor('presentation-gravity',{height:.4,flowFraction:.15,speed:3});expect(migrated.dropHeight).toBe(2);expect(migrated.flow).toBe(10);expect(migrated.speed).toBe(3);expect(migrated).not.toHaveProperty('emitterRadius');
});

test('extending physics resumes from the saved world and preserves every previous frame',async()=>{
 const tiny={...data,txCount:2,layout:{width:8,height:4,parcels:data.layout.parcels.slice(0,2).map((p,i)=>({...p,size:i+1,x:i*3,y:0,txIndex:i}))}},c=makeClip('presentation-gravity',60);c.settings.flow=10;
 const model=buildClip({data:tiny,look:'monument'},c).engine.models[0]!;let checkpoint:import('../src/drop-physics').DropCheckpoint|undefined;
 const first=await bakeDrop(tiny,model,()=>{},undefined,undefined,state=>{checkpoint=state;});
 expect([...first.birthTimes!].every(Number.isFinite)).toBe(true);
 expect(checkpoint!.step).toBe(first.seconds*checkpoint!.hz);
 const extended={...model,simulationDuration:4},chunks:import('../src/drop-physics').DropChunk[]=[];
 const continued=await bakeDrop(tiny,extended,()=>{},chunk=>chunks.push(chunk),checkpoint);
 expect(chunks[0]!.startFrame).toBe(first.frameCount);expect(continued.frames.slice(0,first.frames.length)).toEqual(first.frames.slice());
 const direct=await bakeDrop(tiny,extended);
 expect(continued.birthTimes).toEqual(direct.birthTimes);for(let i=0;i<continued.frames.length;i++)expect(continued.frames[i]!).toBeCloseTo(direct.frames[i]!,4);
});

test('Flow sets a transaction rate independent of clip duration and Drop Height accepts 20',()=>{
 const c=makeClip('presentation-gravity');Object.assign(c.settings,{flow:4,dropHeight:20});
 const small={...data,layout:{...data.layout,parcels:data.layout.parcels.slice(0,100)}},large={...data,layout:{...data.layout,parcels:data.layout.parcels.slice(0,200)}};
 const a=buildClip({data:small,look:'monument'},c).engine.models[0]!,b=buildClip({data:large,look:'monument'},c).engine.models[0]!;
 expect(a.duration).toBe(.25);expect(b.duration).toBe(.5);expect(b.strength).toBe(4);
 c.durationFrames=600;expect(buildClip({data:large,look:'monument'},c).engine.models[0]!.duration).toBe(b.duration);
});

test('Gravity camera animations start from the Camera module default pose',async()=>{
 const {sampleCamera}=await import('../src/camera-motion');
 for(const movement of ['none','rotating']){
  const c=makeClip('presentation-gravity');Object.assign(c.settings,{movement,cameraA:{position:[12,8,20],target:[1,2,3],fov:45}});
  const p=buildClip({data,look:'monument'},c).engine,start=sampleCamera(data,p,0,1),end=sampleCamera(data,p,p.duration,1);
  expect(start.position.toArray()).toEqual([12,8,20]);expect(end.target.toArray()).toEqual([1,2,3]);expect(end.fov).toBe(45);
  if(movement==='none')expect(end.position.toArray()).toEqual(start.position.toArray());
  if(movement==='rotating'){expect(end.position.equals(start.position)).toBe(false);expect(end.position.distanceTo(end.target)).toBeCloseTo(start.position.distanceTo(start.target));}
  if(movement==='zoom-in')expect(end.position.distanceTo(end.target)).toBeCloseTo(start.position.distanceTo(start.target)*.75);
 }
});

test('dense mixed-size cube piles remain finite and above ground at low and high Gravity speeds',async()=>{
 const count=64,parcels=Array.from({length:count},(_,i)=>({...data.layout.parcels[0]!,size:[1,2,3,5][i%4]!,x:i%8,y:Math.floor(i/8),txIndex:i}));
 const scene={...data,txCount:count,layout:{width:48,height:48,parcels}};
 const q=new THREE.Quaternion(),matrix=new THREE.Matrix4();
 for(const speed of [.5,2,5]){
  const clip=makeClip('presentation-gravity',300);Object.assign(clip.settings,{speed,dropHeight:3,flow:6});
  const model=buildClip({data:scene,look:'monument'},clip).engine.models[0]!,bake=await bakeDrop(scene,model);
  expect([...bake.birthTimes!].every(Number.isFinite)).toBe(true);expect([...bake.frames].every(Number.isFinite)).toBe(true);
  let lowest=Infinity,furthest=0,rotationError=0;
  for(let frame=0;frame<bake.frameCount;frame++)for(let i=0;i<count;i++){
   if(frame/bake.fps<bake.birthTimes![i]!)continue;
   const offset=(frame*count+i)*7,f=bake.frames;q.set(f[offset+3]!,f[offset+4]!,f[offset+5]!,f[offset+6]!);matrix.makeRotationFromQuaternion(q);
   const r=matrix.elements,half=(parcels[i]!.size-.5)/2;
   lowest=Math.min(lowest,f[offset+1]!-half*(Math.abs(r[1]!)+Math.abs(r[5]!)+Math.abs(r[9]!)));
   furthest=Math.max(furthest,Math.abs(f[offset]!),Math.abs(f[offset+1]!),Math.abs(f[offset+2]!));rotationError=Math.max(rotationError,Math.abs(q.length()-1));
  }
  expect(lowest).toBeGreaterThan(-.00001);expect(furthest).toBeLessThan(480);expect(rotationError).toBeLessThan(.00001);
 }
});

test('a dense pile resumes its settling state without changing the prefix or subsequent collisions',async()=>{
 const count=48,parcels=Array.from({length:count},(_,i)=>({...data.layout.parcels[0]!,size:i%3+1,x:i%8,y:Math.floor(i/8),txIndex:i}));
 const scene={...data,txCount:count,layout:{width:16,height:16,parcels}},clip=makeClip('presentation-gravity',60);Object.assign(clip.settings,{speed:2,dropHeight:2,flow:6});
 const model=buildClip({data:scene,look:'monument'},clip).engine.models[0]!;let checkpoint:import('../src/drop-physics').DropCheckpoint|undefined,snapshots=0;
 const first=await bakeDrop(scene,model,()=>{},()=>{},undefined,state=>{checkpoint=state;snapshots++;});
 expect(snapshots).toBe(1);expect(checkpoint!.quietFrames!.some(value=>value>0)).toBe(true);
 const extended={...model,simulationDuration:4},continued=await bakeDrop(scene,extended,()=>{},undefined,checkpoint),direct=await bakeDrop(scene,extended);
 expect(continued.frames.slice(0,first.frames.length)).toEqual(first.frames.slice());expect(continued.birthTimes).toEqual(direct.birthTimes);
 let difference=0;for(let i=0;i<direct.frames.length;i++)difference=Math.max(difference,Math.abs(direct.frames[i]!-continued.frames[i]!));expect(difference).toBeLessThan(.0001);
});

test('Gravity rotation has constant speed across revolutions and clip durations',async()=>{
 const {sampleCamera}=await import('../src/camera-motion');
 const {settingsFor,controlsFor}=await import('../src/clips/registry');
 const {controlVisible}=await import('../src/clips/types');
 const speedControl=controlsFor('presentation-gravity').find(c=>c.key==='cameraSpeed')!;
 expect(settingsFor('presentation-gravity',{}).cameraSpeed).toBe(2);
 expect(speedControl.step).toBe(1);
 expect(controlVisible({movement:'none'},speedControl)).toBe(false);
 expect(controlVisible({movement:'rotating'},speedControl)).toBe(true);
 for(const legacy of ['fixed'])expect(settingsFor('presentation-gravity',{movement:legacy}).movement).toBe('none');
 for(const speed of [1,4,10]){
  const c=makeClip('presentation-gravity',60);Object.assign(c.settings,{movement:'rotating',cameraSpeed:speed,cameraA:{position:[0,8,20],target:[0,2,0],fov:45}});
  const p=buildClip({data,look:'monument'},c).engine;
  for(const time of [0,.5,3,37,73]){
   const pose=sampleCamera(data,p,time,1),angle=(5+(speed-1)*95/9)*Math.PI/180*time;
   expect(pose.position.x).toBeCloseTo(20*Math.sin(angle),8);
   expect(pose.position.z).toBeCloseTo(20*Math.cos(angle),8);
   expect(pose.position.y).toBe(8);
   const longer=sampleCamera(data,{...p,duration:20},time,1);
   expect(longer.position.toArray()).toEqual(pose.position.toArray());
  }
 }
});
