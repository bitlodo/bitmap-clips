import {clamp,smooth,clipEnvelope,type Project,type SceneData,type ModelClip} from './editor-model';
import type {BitmapParcel} from './lib/bitmap-layout';
import {positiveCubeRoot} from './deterministic-math';
export const isTransform=(clip:ModelClip)=>!['hold','isolate','highlight','pulse'].includes(clip.kind);
export function faucetHeight(data:SceneData,strength:number){const max=data.layout.parcels.reduce((n,p)=>Math.max(n,p.size-.5),.5),volume=data.layout.parcels.reduce((n,p)=>{const side=p.size-.5;return n+side*side*side;},0);return (Math.max(Math.max(data.layout.width,data.layout.height)*.32,positiveCubeRoot(volume)*2)+max*2)*(.8+.2*strength);}
export const emittedCount=(count:number,time:number,duration:number)=>Math.min(count,Math.max(0,Math.floor((time+1e-8)/duration*count)));
export function modelRandom(index:number,seed:number):number{let n=Math.imul(index+1,374761393)^Math.imul(seed+1,668265263);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967296;}
export function modelState(project:Project,time:number){
 const ordered=[...project.models].sort((a,b)=>a.start-b.start);
 const transform=ordered.filter(m=>isTransform(m)&&m.start<=time&&(m.end==='hold'||time<m.start+m.duration)).at(-1);
 const context=ordered.filter(m=>['isolate','highlight'].includes(m.kind)&&m.start<=time&&(m.end==='hold'||time<m.start+m.duration)).at(-1);
 const amount=context?clipEnvelope(context,Math.min(time,context.start+context.duration))*Math.min(1,context.strength):0;
 const pulse=ordered.filter(m=>m.kind==='pulse'&&m.start<=time&&time<m.start+m.duration).at(-1);
 const styleClip=ordered.filter(m=>(m.style!==null||isTransform(m)||m.kind==='hold')&&m.start<=time&&(m.end==='hold'||time<m.start+m.duration)).at(-1),fadeClip=ordered.filter(m=>!['isolate','highlight','pulse'].includes(m.kind)&&m.start<=time&&(m.end==='hold'||time<m.start+m.duration)).at(-1);
 const style=styleClip?.style;
 return {transform,context,contextAmount:amount,targetLift:(context?.targetLift??0)*amount,styleClip,material:style?.material??project.material,accent:style?.accent??project.accent,opacity:(style?.opacity??1)*(fadeClip?clipEnvelope(fadeClip,Math.min(time,fadeClip.start+fadeClip.duration)):1),isolate:context?.kind==='isolate'?amount:0,dim:context?.kind==='highlight'?amount:0,pulse:pulse?Math.sin(Math.PI*clamp((time-pulse.start)/pulse.duration,0,1))**2*.18*pulse.strength:0};
}
export function parcelPose(data:SceneData,parcel:BitmapParcel,index:number,clip:ModelClip|undefined,time:number){
 const side=parcel.size-.5,span=Math.max(data.layout.width,data.layout.height);
 let x=parcel.x+side/2-data.layout.width/2,y=side/2,z=parcel.y+side/2-data.layout.height/2,scale=1,yaw=0,heightScale:number|undefined;
 if(clip){
  const random=modelRandom(index,clip.seed),order=clip.kind==='build'&&clip.buildOrder==='sequential'?index/Math.max(1,data.layout.parcels.length-1):random,delay=(clip.kind==='wave'?parcel.y/data.layout.height:order)*clip.stagger;
  const phase=clamp((time-clip.start)/clip.duration,0,1),local=clamp((phase-delay)/(1-clip.stagger),0,1),progress=smooth(local);
  if(clip.kind==='build'||clip.kind==='destroy'){scale=clip.kind==='build'?progress:1-progress;
   if(clip.kind==='build'&&(clip.bounceBack??0)>0){const bounce=clip.bounceBack!;scale=clamp(smooth(clamp(local*2,0,1)),0,1);heightScale=local<.7?(1+bounce)*smooth(local/.7):1+bounce*(1-smooth((local-.7)/.3));}
   y=side*(heightScale??scale)/2;}
  if(clip.kind==='scale-rotate'){scale=progress;y=side*scale/2;yaw=(1-progress)*Math.PI*2*clip.strength;}
  if(clip.kind==='rise')y+=span*.22*clip.strength*(1-progress);
  if(clip.kind==='scatter'){x*=1+(1-progress)*clip.strength*1.8;z*=1+(1-progress)*clip.strength*1.8;y+=span*.1*clip.strength*(1-progress);scale=progress;}
  if(clip.kind==='wave'){y+=span*.08*clip.strength*(1-progress);scale=progress;}
  // Shown only while the real simulation is being prepared; playback/export await it.
  if(clip.kind==='drop'){x=0;y=span*.6;z=0;scale=0;}
 }
 return {x,y,z,scale,yaw,heightScale:heightScale??scale};
}
export function sampleFade(project:Project,time:number):{color:string;opacity:number}{
 const clip=[...project.fades].sort((a,b)=>a.start-b.start).filter(f=>f.start<=time).at(-1);
 if(!clip)return {color:'#000000',opacity:0};
 const t=smooth(clamp((time-clip.start)/clip.duration,0,1));return {color:clip.color,opacity:clip.kind==='fade-in'?1-t:t};
}

export function displayParcelPose(p:{x:number;y:number;z:number;scale:number;heightScale:number;yaw:number},motion:NonNullable<Project['displayMotion']>,time:number,span:number){
 const phase=time*motion.speed*Math.PI/3;
 if(motion.kind==='pulse'){const scale=1+Math.sin(phase)*motion.intensity*.15;p.scale*=scale;p.heightScale*=scale;p.y*=scale;}
 if(motion.kind==='wave')p.y+=(1+Math.sin(phase+p.x/span*Math.PI*2+p.z/span*Math.PI))*span*.025*motion.intensity;
 return p;
}
