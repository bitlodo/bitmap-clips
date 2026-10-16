import {bakeDrop,releaseDropCheckpoint,type DropCheckpoint} from './drop-physics';
import type {ModelClip,SceneData} from './editor-model';
const scope=self as unknown as DedicatedWorkerGlobalScope;
const checkpoints=new Map<string,DropCheckpoint>();
let queue=Promise.resolve();
scope.onmessage=(event:MessageEvent<{key:string;data:SceneData;clip:ModelClip;keepKeys?:string[]}>)=>{
 const {key,data,clip,keepKeys}=event.data;
 queue=queue.then(async()=>{
  try{
   if(keepKeys)for(const existing of checkpoints.keys())if(!keepKeys.includes(existing)){releaseDropCheckpoint(checkpoints.get(existing)!);checkpoints.delete(existing);}
   const state=checkpoints.get(key),seconds=clip.simulationDuration??(Math.min(8,clip.duration)+3);
   if(state&&(state.bake.completedFrames??0)>=Math.ceil(seconds*state.bake.fps)+1){scope.postMessage({key,bake:state.bake});return;}
   const bake=await bakeDrop(data,clip,progress=>scope.postMessage({key,progress}),chunk=>scope.postMessage({key,chunk},[chunk.frames.buffer as ArrayBuffer]),state,checkpoint=>{checkpoints.set(key,checkpoint);});
   // Keep the backing frames for subsequent extensions; transfer a copy to the UI.
   const output={...bake,frames:bake.frames.slice()};scope.postMessage({key,bake:output},[output.frames.buffer as ArrayBuffer]);
  }catch(error){scope.postMessage({key,error:(error as Error).message});}
 });
};
