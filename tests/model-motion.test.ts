import {test,expect} from 'bun:test';
import * as THREE from 'three';
import snapshot from '../src/demo.json';
import {allClips,createProject,makeFade,makeModel,moveScene,parseProject,retime,type SceneData} from '../src/editor-model';
import {sampleCamera} from '../src/camera-motion';
import {modelState,parcelPose,sampleFade,emittedCount} from '../src/model-motion';
import {bakeDrop} from '../src/drop-physics';
import {sampleDrop,dropKey} from '../src/physics-cache';
const data=snapshot as SceneData;

test('montagens e fades não alteram câmera; mover câmera não move os efeitos',()=>{
 const p=createProject(data),camera=sampleCamera(data,p,2,1),models=structuredClone(p.models);
 p.models.push(makeModel('destroy',1,2,0));p.fades.push(makeFade('fade-out',1,2));
 expect(sampleCamera(data,p,2,1)).toEqual(camera);
 p.models=models;moveScene(p,p.shots[0]!,1,3);expect(p.models).toEqual(models);
});
test('o modelo não depende das cenas, suas lentes ou seus alvos',()=>{
 const p=createProject(data),reference=modelState(p,1);
 p.shots[0]!.start=2;p.shots[0]!.camera.target='parcel';p.shots[0]!.camera.fov=75;p.shots[0]!.txIndex=0;
 expect(modelState(p,1)).toEqual(reference);
});
test('construção, desmontagem e montagens conservam o estado final e o chão',()=>{
 const parcel=data.layout.parcels[0]!;
 for(const kind of ['build','rise','scatter','wave','destroy'] as const){
  const c=makeModel(kind,1,2,0),initial=parcelPose(data,parcel,0,c,1),last=parcelPose(data,parcel,0,c,3),held=parcelPose(data,parcel,0,c,6);
  expect(last).toEqual(held);expect(Object.values(initial).every(Number.isFinite)).toBe(true);
  expect(last.scale).toBe(kind==='destroy'?0:1);expect(last.x).toBeCloseTo(parcel.x+(parcel.size-.5)/2-data.layout.width/2);
  expect(last.y-(parcel.size-.5)*last.scale/2).toBeGreaterThanOrEqual(-.00001);
 }
 const p=createProject(data);p.models=[makeModel('destroy',1,2,0),makeModel('build',4,2,0)];expect(modelState(p,3.5).transform?.kind).toBe('destroy');expect(modelState(p,4).transform?.kind).toBe('build');
});
test('contexto e pulso são temporários e independentes das montagens',()=>{
 const p=createProject(data);p.models=[makeModel('destroy',0,1,0),makeModel('highlight',1,2,0),makeModel('pulse',1,2,0)];
 const state=modelState(p,2);expect(state.transform?.kind).toBe('destroy');expect(state.dim).toBe(1);expect(state.pulse).toBeGreaterThan(0);expect(modelState(p,3).dim).toBe(0);expect(modelState(p,3).pulse).toBe(0);
});
test('fade cobre o filme inteiro e conserva a cor até a próxima entrada',()=>{
 const p=createProject(data);p.fades=[makeFade('fade-out',1,1),makeFade('fade-in',3,1)];p.fades[0]!.color='#ffffff';
 expect(sampleFade(p,0).opacity).toBe(0);expect(sampleFade(p,1).opacity).toBe(0);expect(sampleFade(p,1.5).opacity).toBeCloseTo(.5);expect(sampleFade(p,2.5)).toEqual({color:'#ffffff',opacity:1});
 expect(sampleFade(p,3).opacity).toBe(1);expect(sampleFade(p,4).opacity).toBe(0);
});
test('migração v2 separa reconstrução e isolamento e preserva IDs, câmera e textos',()=>{
 const p=createProject(data),v2:any={...p,version:2};delete v2.models;delete v2.fades;
 v2.shots=p.shots.map(s=>({...s,kind:s.kind==='establish'?'reveal':s.kind,camera:{...s.camera,context:s.kind==='focus'?'isolate':'keep'}}));
 v2.titles[0]!.binding=null;v2.titles[0]!.text='Texto preservado';
 const restored=parseProject({project:v2,data}).project;
 expect(restored.version).toBe(4);expect(restored.titles).toEqual(p.titles);expect(restored.shots[0]!.id).toBe(p.shots[0]!.id);expect(restored.shots[0]!.camera).toEqual(p.shots[0]!.camera);
 expect(restored.models.map(m=>m.kind)).toEqual(['build','isolate']);expect(restored.models[0]!.start).toBe(p.shots[0]!.start);expect(restored.fades).toEqual([]);
});
test('retiming, validação e serialização cobrem todas as trilhas',()=>{
 const p=createProject(data);retime(p,5);for(const clip of allClips(p))expect(clip.start+clip.duration).toBeLessThanOrEqual(5.001);
 expect(parseProject(JSON.parse(JSON.stringify({project:p,data}))).project).toEqual(p);
 for(const mutate of [(p:any)=>p.models[0].strength=Infinity,(p:any)=>p.models[0].seed=-1,(p:any)=>p.models[0].kind='arbitrary',(p:any)=>p.models[0].txIndex=99999,(p:any)=>p.fades[0].color='red',(p:any)=>p.fades[0].duration=100,(p:any)=>p.models[0].id=p.shots[0].id]){const next=createProject(data);mutate(next);expect(()=>parseProject({project:next,data})).toThrow();}
});
test('Rapier produz colisões com chão, repetíveis e amostradas fora de ordem',async()=>{
 const parcels=[{...data.layout.parcels[0]!,size:2,x:0,y:0,txIndex:0},{...data.layout.parcels[1]!,size:2,x:3,y:0,txIndex:1},{...data.layout.parcels[2]!,size:1,x:6,y:0,txIndex:2}];
 const tiny={...data,txCount:3,layout:{width:8,height:4,parcels}},clip=makeModel('drop',1,2,0);clip.stagger=0;clip.strength=.5;
 const first=await bakeDrop(tiny,clip),second=await bakeDrop(tiny,clip);expect(first.frames).toEqual(second.frames);
 const position=new THREE.Vector3(),rotation=new THREE.Quaternion();
 sampleDrop(first,0,0,position,rotation);const initial=position.clone();sampleDrop(first,0,first.seconds,position,rotation);const settled=position.clone();expect(settled.y).toBeLessThan(initial.y);
 for(let i=0;i<parcels.length;i++){sampleDrop(first,i,first.seconds,position,rotation);const matrix=new THREE.Matrix4().makeRotationFromQuaternion(rotation),r=matrix.elements,half=(parcels[i]!.size-.5)/2;expect(position.y-half*(Math.abs(r[1]!)+Math.abs(r[5]!)+Math.abs(r[9]!))).toBeGreaterThan(-.04);expect(rotation.length()).toBeCloseTo(1,4);}
 sampleDrop(first,0,.75,position,rotation);const middle=position.clone();sampleDrop(first,0,0,position,rotation);sampleDrop(first,0,.75,position,rotation);expect(position).toEqual(middle);
 expect(dropKey(tiny,clip)).toBe(dropKey(tiny,{...clip,start:4,id:'copy'}));expect(dropKey(tiny,clip)).not.toBe(dropKey(tiny,{...clip,seed:43}));
});

test('torneira emite todas as transações em sequência até o fim do fluxo',()=>{
 expect(emittedCount(3509,0,4)).toBe(0);expect(emittedCount(3509,2,4)).toBe(1754);expect(emittedCount(3509,4,4)).toBe(3509);expect(emittedCount(3509,8,4)).toBe(3509);
});
