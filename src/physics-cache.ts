import * as THREE from 'three';
import type {ModelClip,Project,SceneData} from './editor-model';
import type {DropBake,DropChunk} from './drop-physics';
import {DROP_PHYSICS_VERSION} from './physics-version';
import {emittedCount} from './model-motion';
export const dropKey=(data:SceneData,clip:ModelClip)=>JSON.stringify([DROP_PHYSICS_VERSION,data.hash,clip.duration,clip.emitterRadius,clip.fallSpeed,clip.strength,clip.seed]);
export function sampleDrop(bake:DropBake,index:number,time:number,position:THREE.Vector3,rotation:THREE.Quaternion){
 const available=bake.completedFrames??bake.frameCount,sampleTime=Math.min(time,(available-1)/bake.fps);
 const frame=Math.max(0,Math.min(available-1,sampleTime*bake.fps)),a=Math.floor(frame),b=Math.min(a+1,available-1),t=frame-a;
 const offset=(a*bake.count+index)*7,next=(b*bake.count+index)*7,f=bake.frames;
 position.set(THREE.MathUtils.lerp(f[offset]!,f[next]!,t),THREE.MathUtils.lerp(f[offset+1]!,f[next+1]!,t),THREE.MathUtils.lerp(f[offset+2]!,f[next+2]!,t));
 rotation.set(f[offset+3]!,f[offset+4]!,f[offset+5]!,f[offset+6]!);nextRotation.set(f[next+3]!,f[next+4]!,f[next+5]!,f[next+6]!);if(t>0)rotation.slerp(nextRotation,t);
 return bake.birthTimes?bake.birthTimes[index]!<=sampleTime+1e-8:index<emittedCount(bake.count,sampleTime,bake.flowDuration);
}
const nextRotation=new THREE.Quaternion();
const simulationSeconds=(clip:ModelClip)=>clip.simulationDuration??(Math.min(8,clip.duration)+3);
export class PhysicsCache{
 private worker?:Worker;private cache=new Map<string,DropBake>();private jobs=new Map<string,{promise:Promise<void>;resolve:()=>void;reject:(e:Error)=>void}>();private failures=new Map<string,string>();private disposed=false;
 private keepKeys:string[]=[];
 private partial=new Map<string,DropBake>();
 private progressByKey=new Map<string,number>();
 progress=0;
 constructor(private data:SceneData,private updated:()=>void){}
 get(clip:ModelClip){const key=dropKey(this.data,clip);return this.partial.get(key)??this.cache.get(key);}
 status(clip:ModelClip){const key=dropKey(this.data,clip);return this.jobs.has(key)?{progress:this.progressByKey.get(key)??0}:null;}
 private targetFrames(clip:ModelClip,bake:DropBake){return Math.ceil(simulationSeconds(clip)*bake.fps)+1;}
 private stopWorker(error:Error){
  this.worker?.terminate();this.worker=undefined;
  for(const job of this.jobs.values())job.reject(error);
  this.jobs.clear();this.partial.clear();this.progressByKey.clear();this.progress=0;
 }
 get pending(){return this.jobs.size>0;}
 async prepare(project:Project,recalculate=false){
  if(this.disposed)throw Error('Renderer disposed.');
  if(recalculate){await Promise.allSettled([...this.jobs.values()].map(job=>job.promise));if(this.disposed)throw Error('Renderer disposed.');this.cache.clear();this.partial.clear();this.failures.clear();}
  const clips=project.models.filter(c=>c.kind==='drop'),keys=new Set(clips.map(c=>dropKey(this.data,c)));
  this.keepKeys=[...keys];
  if([...this.jobs.keys()].some(key=>!keys.has(key))){
   this.stopWorker(Error('Simulation superseded by updated settings.'));
  }
  const unique=[...new Map(clips.toSorted((a,b)=>simulationSeconds(a)-simulationSeconds(b)).map(c=>[dropKey(this.data,c),c])).values()];
  const estimate=unique.reduce((sum,c)=>sum+Math.min(8_000_000,this.data.txCount*7*(Math.ceil(simulationSeconds(c)*30)+1))*4,0);
  if(estimate>128_000_000)throw Error('Physics exceeds the 128 MB cache. Shorten the duration or reuse the same variation.');
  for(const key of this.cache.keys())if(!keys.has(key))this.cache.delete(key);
  await Promise.all(unique.map(c=>this.request(c)));
 }
 private acceptChunk(key:string,chunk:DropChunk){
  let partial=this.partial.get(key)??this.cache.get(key);
  if(!partial){partial={...chunk,frames:new Float32Array(chunk.frameCount*chunk.count*7),completedFrames:0};this.partial.set(key,partial);}
  if(partial.frames.length<chunk.frameCount*chunk.count*7){const frames=new Float32Array(chunk.frameCount*chunk.count*7);frames.set(partial.frames);partial={...partial,frames,frameCount:chunk.frameCount,seconds:chunk.seconds};}
  this.partial.set(key,partial);
  partial.birthTimes=chunk.birthTimes;
  partial.frames.set(chunk.frames,chunk.startFrame*chunk.count*7);
  partial.completedFrames=chunk.startFrame+chunk.frames.length/(chunk.count*7);
 }
 private ensureWorker():Worker {
  if(this.worker)return this.worker;
  const worker=new Worker('./physics-worker.js?v='+encodeURIComponent(DROP_PHYSICS_VERSION),{type:'module'});
  worker.onmessage=event=>{
   const {key,bake,error,progress,chunk}=event.data;
   const job=this.jobs.get(key);if(!job)return;
   if(chunk){this.acceptChunk(key,chunk);this.updated();return;}
   if(progress!==undefined){
    this.progress=progress;this.progressByKey.set(key,progress);this.updated();return;
   }
   this.jobs.delete(key);this.partial.delete(key);this.progressByKey.delete(key);
   if(error){this.failures.set(key,error);job.reject(Error(error));}
   else {this.cache.set(key,bake);job.resolve();}
   this.updated();
  };
  worker.onerror=()=>{this.stopWorker(Error('Could not prepare physics.'));this.updated();};
  this.worker=worker;return worker;
 }
 private request(clip:ModelClip):Promise<void>{
  const key=dropKey(this.data,clip),cached=this.cache.get(key);
  if(cached&&(cached.completedFrames??cached.frameCount)>=this.targetFrames(clip,cached))return Promise.resolve();
  if(this.failures.has(key))return Promise.reject(Error(this.failures.get(key)!));
  const existing=this.jobs.get(key);
  if(existing)return existing.promise.then(()=>this.request(clip));
  const worker=this.ensureWorker();
  let resolve!:()=>void,reject!:(e:Error)=>void;
  const promise=new Promise<void>((yes,no)=>{resolve=yes;reject=no;});
  this.jobs.set(key,{promise,resolve,reject});this.progress=0;
  this.progressByKey.set(key,cached?Math.min(1,(cached.completedFrames??cached.frameCount)/this.targetFrames(clip,cached)):0);
  this.updated();worker.postMessage({key,data:this.data,clip,keepKeys:this.keepKeys});
  return promise;
 }
 dispose(){this.disposed=true;this.stopWorker(Error('Simulation disposed.'));this.cache.clear();this.failures.clear();}
}
