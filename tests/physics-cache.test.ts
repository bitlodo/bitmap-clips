import {test,expect} from 'bun:test';
import snapshot from '../src/demo.json';
import {PhysicsCache} from '../src/physics-cache';
import {createProject,makeModel,type SceneData} from '../src/editor-model';
class FakeWorker {
 static instances:FakeWorker[]=[];messages:any[]=[];terminated=false;onmessage:any;onerror:any;
 constructor(){FakeWorker.instances.push(this);}
 postMessage(message:any){this.messages.push(message);}
 terminate(){this.terminated=true;}
 complete(message:any){this.onmessage({data:{key:message.key,bake:{count:1,fps:30,frameCount:Math.ceil((message.clip.simulationDuration??(message.clip.duration+3))*30)+1,seconds:message.clip.simulationDuration??(message.clip.duration+3),flowDuration:message.clip.duration,frames:new Float32Array((Math.ceil((message.clip.simulationDuration??(message.clip.duration+3))*30)+1)*7)}}});}
}
const data=snapshot as SceneData;
test('physics reuses unchanged scenes while calculating changed settings',async()=>{
 const original=globalThis.Worker;globalThis.Worker=FakeWorker as any;FakeWorker.instances=[];
 const cache=new PhysicsCache(data,()=>{});
 try{
  const project=createProject(data);project.models=[makeModel('drop',0,2,0),makeModel('drop',0,3,0)];
  const first=cache.prepare(project),worker=FakeWorker.instances[0]!;for(const message of worker.messages)worker.complete(message);await first;
  const unchanged=cache.get(project.models[1]!);project.models[0]!.strength=2;
  const second=cache.prepare(project);expect(worker.messages).toHaveLength(3);expect(cache.get(project.models[1]!)).toBe(unchanged);worker.complete(worker.messages[2]);await second;
 }finally{cache.dispose();globalThis.Worker=original;}
});
test('physics terminates an obsolete calculation instead of waiting for it before new settings',async()=>{
 const original=globalThis.Worker;globalThis.Worker=FakeWorker as any;FakeWorker.instances=[];
 const cache=new PhysicsCache(data,()=>{});
 try{
  const project=createProject(data);project.models=[makeModel('drop',0,2,0)];
  const first=cache.prepare(project).catch(error=>error),old=FakeWorker.instances[0]!;project.models[0]!.strength=2;
  const second=cache.prepare(project),current=FakeWorker.instances[1]!;
  expect(old.terminated).toBe(true);expect(current.messages).toHaveLength(1);expect(await first).toBeInstanceOf(Error);current.complete(current.messages[0]);await second;
 }finally{cache.dispose();globalThis.Worker=original;}
});

test('resize retains the cache and worker; shortening requests no computation and extension keeps the prefix visible',async()=>{
 const original=globalThis.Worker;globalThis.Worker=FakeWorker as any;FakeWorker.instances=[];const cache=new PhysicsCache(data,()=>{});
 try{
  const project=createProject(data);const model=makeModel('drop',0,3,0);model.simulationDuration=4;project.models=[model];
  const first=cache.prepare(project),worker=FakeWorker.instances[0]!;worker.complete(worker.messages[0]);await first;const cached=cache.get(model);
  model.simulationDuration=2;await cache.prepare(project);expect(worker.messages).toHaveLength(1);expect(cache.get(model)).toBe(cached);
  model.simulationDuration=6;const extension=cache.prepare(project);expect(worker.terminated).toBe(false);expect(worker.messages).toHaveLength(2);expect(cache.get(model)).toBe(cached);worker.complete(worker.messages[1]);await extension;
 }finally{cache.dispose();globalThis.Worker=original;}
});

test('Gravity camera and style changes reuse the collision simulation',async()=>{
 const original=globalThis.Worker;globalThis.Worker=FakeWorker as any;FakeWorker.instances=[];const cache=new PhysicsCache(data,()=>{});
 try{
  const project=createProject(data),model=makeModel('drop',0,3,0);project.models=[model];
  const first=cache.prepare(project),worker=FakeWorker.instances[0]!;worker.complete(worker.messages[0]);await first;const bake=cache.get(model);
  model.physicsVariant='rotating';model.style={material:'neon',accent:'#ff5500'};await cache.prepare(project);
  expect(worker.messages).toHaveLength(1);expect(cache.get(model)).toBe(bake);
 }finally{cache.dispose();globalThis.Worker=original;}
});

test('worker failure discards partial frames and progress, notifies the preview and permits retry',async()=>{
 const original=globalThis.Worker;globalThis.Worker=FakeWorker as any;FakeWorker.instances=[];
 let updates=0;const cache=new PhysicsCache(data,()=>updates++);
 try{
  const project=createProject(data),model=makeModel('drop',0,3,0);project.models=[model];
  const pending=cache.prepare(project).catch(error=>error),worker=FakeWorker.instances[0]!,message=worker.messages[0];
  worker.onmessage({data:{key:message.key,progress:.5}});
  worker.onmessage({data:{key:message.key,chunk:{count:1,fps:30,frameCount:2,seconds:1,flowDuration:3,startFrame:0,frames:new Float32Array(7)}}});
  expect(cache.get(model)).toBeDefined();expect(cache.status(model)?.progress).toBe(.5);
  const before=updates;worker.onerror();
  expect(await pending).toBeInstanceOf(Error);expect(worker.terminated).toBe(true);
  expect(cache.get(model)).toBeUndefined();expect(cache.status(model)).toBeNull();
  expect(cache.pending).toBe(false);expect(cache.progress).toBe(0);expect(updates).toBe(before+1);
  const retry=cache.prepare(project),replacement=FakeWorker.instances[1]!;
  replacement.complete(replacement.messages[0]);await retry;expect(cache.get(model)).toBeDefined();
 }finally{cache.dispose();globalThis.Worker=original;}
});

test('shared physics settings request only the longest effective simulation',async()=>{
 const original=globalThis.Worker;globalThis.Worker=FakeWorker as any;FakeWorker.instances=[];
 const cache=new PhysicsCache(data,()=>{});
 try{
  const project=createProject(data),first=makeModel('drop',0,8,0),second=structuredClone(first);
  first.duration=second.duration=20;second.simulationDuration=15;project.models=[first,second];
  const pending=cache.prepare(project),worker=FakeWorker.instances[0]!;
  expect(worker.messages).toHaveLength(1);expect(worker.messages[0].clip.simulationDuration).toBe(15);
  worker.complete(worker.messages[0]);await pending;expect(worker.messages).toHaveLength(1);
 }finally{cache.dispose();globalThis.Worker=original;}
});
