import RAPIER from '@dimforge/rapier3d-deterministic-compat';
import {modelRandom,faucetHeight,emittedCount} from './model-motion';
import type {ModelClip,SceneData} from './editor-model';
import {DROP_PHYSICS_VERSION} from './physics-version';
export {DROP_PHYSICS_VERSION} from './physics-version';
const SQRT3=1.7320508075688772;
const square=(value:number)=>value*value;
export interface DropBake {frames:Float32Array;count:number;fps:number;frameCount:number;seconds:number;flowDuration:number;completedFrames?:number;birthTimes?:Float32Array;}
export interface DropChunk {count:number;fps:number;frameCount:number;seconds:number;flowDuration:number;startFrame:number;frames:Float32Array;birthTimes?:Float32Array;}
interface DropUpdate {index:number;ground?:{x:number;y:number;z:number};fixed?:boolean;}
export interface DropCheckpoint {version:string;world:RAPIER.World|null;handles:number[];step:number;emitted:number;hz:number;quietFrames?:Uint16Array;updates?:DropUpdate[];bake:DropBake;}
/** Checkpoints own a live WASM world and can be consumed once or released. */
export function releaseDropCheckpoint(checkpoint:DropCheckpoint){checkpoint.world?.free();checkpoint.world=null;}
export function emissionPoint(index:number,seed:number,radius:number,attempt=0){
 // Rejection sampling is uniform in a disk and uses no native trigonometry.
 // Separate the birth, collision attempt and rejection stream with integer hashes.
 const stream=Math.imul(index,374761393)^Math.imul(attempt,668265263)^seed;
 for(let sample=0;sample<128;sample++){
  const x=modelRandom(sample*2,stream)*2-1,z=modelRandom(sample*2+1,stream)*2-1;
  if(x*x+z*z<=1)return {x:x*radius,z:z*radius};
 }
 return {x:0,z:0};
}
export function emissionOrder(count:number,seed:number){
 const order=Array.from({length:count},(_,index)=>index);
 for(let i=count-1;i>0;i--){const j=Math.floor(modelRandom(i,seed)* (i+1));[order[i],order[j]]=[order[j]!,order[i]!];}
 return order;
}
let initialization:Promise<void>|undefined;
export function initPhysics(){return initialization??=RAPIER.init();}
export async function bakeDrop(data:SceneData,clip:ModelClip,onProgress:(n:number)=>void=()=>{},onFrames?:(chunk:DropChunk)=>void,resume?:DropCheckpoint,onCheckpoint?:(state:DropCheckpoint)=>void):Promise<DropBake>{
 if(resume&&resume.version!==DROP_PHYSICS_VERSION)throw Error('Physics checkpoint uses a different simulation version. Recalculate this scene.');
 if(resume&&!resume.world)throw Error('Physics checkpoint was already consumed or released.');
 if(data.txCount>8000)throw Error('Collision simulation supports up to 8,000 parcels. Use an assembly for this block.');
 await initPhysics();
 const flowDuration=clip.simulationDuration===undefined?Math.min(8,clip.duration):clip.duration,seconds=clip.simulationDuration??(flowDuration+3),count=data.layout.parcels.length,span=Math.max(data.layout.width,data.layout.height),maxSide=data.layout.parcels.reduce((m,p)=>Math.max(m,p.size-.5),.5),height=clip.simulationDuration===undefined?faucetHeight(data,clip.strength):(span*.2+maxSide*1.5)*clip.strength+maxSide;
 // Cube piles use a fixed 30 Hz step; rendering interpolates stored transforms.
 const speed=clip.fallSpeed??1,hz=resume?.hz??30,birthTimes=resume?resume.bake.birthTimes!.slice():new Float32Array(count).fill(Infinity);
 const fps=resume?.bake.fps??([30,15,10,5].find(rate=>count*7*(20*rate+1)<=8_000_000)??5),recordEvery=hz/fps,frameCount=Math.ceil(seconds*fps)+1;
 const frames=new Float32Array(frameCount*count*7),world=resume?resume.world!:new RAPIER.World({x:0,y:-36*speed*speed,z:0});world.timestep=1/hz;world.integrationParameters.numSolverIterations=2;
 let retained=false;
 if(resume){resume.world=null;}
 if(resume)frames.set(resume.bake.frames.subarray(0,Math.min(frames.length,(resume.bake.completedFrames??resume.bake.frameCount)*count*7)));

 try{
  if(!resume)world.createCollider(RAPIER.ColliderDesc.cuboid(span*3,span,span*3).setTranslation(0,-span,0).setFriction(.7));
  const bodies:Array<RAPIER.RigidBody|undefined>=resume?resume.handles.map(handle=>handle<0?undefined:world.getRigidBody(handle)):Array(count);
  const radius=Math.max(span*(clip.emitterRadius??.15),maxSide),depth=clip.simulationDuration===undefined?0:height;
  const order=emissionOrder(count,clip.seed);
  let emitted=resume?.emitted??0,currentStep=resume?.step??0;
  const quietFrames=resume?.quietFrames?.slice()??new Uint16Array(count);
  const updates:DropUpdate[]=resume?.updates?.map(update=>({...update}))??[];
  const settleFrames=Math.max(2,Math.ceil(fps*2/15));
  let fixedCount=bodies.reduce((total,body)=>total+(body?.isFixed()?1:0),0);
  const record=(frame:number)=>{for(let i=0;i<count;i++){const body=bodies[i],offset=(frame*count+i)*7;
   if(frame>0&&body?.isFixed()){
    // A settled cube's transform cannot change; avoid repeated JS/WASM reads.
    frames.copyWithin(offset,offset-count*7,offset-count*7+7);continue;
   }
   const p=body?.translation()??{x:0,y:height,z:0},r=body?.rotation()??{x:0,y:0,z:0,w:1};
   if(body&&body.isDynamic()){
    // Project the rotated cube onto the ground plane before storing or fixing it.
    const half=(data.layout.parcels[i]!.size-.5)/2;
    const bottom=half*(Math.abs(2*(r.x*r.y+r.w*r.z))+Math.abs(1-2*(r.x*r.x+r.z*r.z))+Math.abs(2*(r.y*r.z-r.w*r.x)));
    if(p.y<bottom){p.y=bottom;updates.push({index:i,ground:{...p}});}
   }
   if(body&&body.isDynamic()&&frame>0){
    const previous=offset-count*7,side=data.layout.parcels[i]!.size-.5;
    const motion=square(p.x-frames[previous]!)+square(p.y-frames[previous+1]!)+square(p.z-frames[previous+2]!);
    const rotation=square(r.x-frames[previous+3]!)+square(r.y-frames[previous+4]!)+square(r.z-frames[previous+5]!)+square(r.w-frames[previous+6]!);
    quietFrames[i]=motion<square(.08*side)&&rotation<.004?Math.min(settleFrames,quietFrames[i]!+1):0;
    if(quietFrames[i]!>=settleFrames){
     const collider=body.collider(0);let supported=false;
     world.contactPairsWith(collider,other=>{
      if(other.parent()?.isDynamic())return;
      world.contactPair(collider,other,(manifold,flipped)=>{if(manifold.numContacts()>0&&manifold.normal().y*(flipped?-1:1)<-.5)supported=true;});
     });
     // This is a one-way settling approximation for a decorative cube pile.
     // Only contacts supported by the ground/already-fixed cubes can settle.
     if(supported)updates.push({index:i,fixed:true});
    }
   }
   frames[offset]=p.x;frames[offset+1]=p.y;frames[offset+2]=p.z;frames[offset+3]=r.x;frames[offset+4]=r.y;frames[offset+5]=r.z;frames[offset+6]=r.w;}};
  let sentFrames=resume?(resume.bake.completedFrames??resume.bake.frameCount):0;
  const publish=(completedFrames:number,checkpoint=false)=>{
   // Publish a resumable checkpoint only at the end; chunks contain recorded frames.
   if(checkpoint&&onCheckpoint){onCheckpoint({version:DROP_PHYSICS_VERSION,world,handles:Array.from(bodies,body=>body?.handle??-1),step:currentStep,emitted,hz,quietFrames:quietFrames.slice(),updates:updates.map(update=>({...update})),bake:{count,fps,frameCount,seconds,flowDuration,birthTimes:birthTimes.slice(),frames,completedFrames}});retained=true;}
   if(onFrames)onFrames({count,fps,frameCount,seconds,flowDuration,birthTimes:birthTimes.slice(),startFrame:sentFrames,frames:frames.slice(sentFrames*count*7,completedFrames*count*7)});sentFrames=completedFrames;
  };
  if(!resume){record(0);publish(1);}else onProgress(Math.min(1,currentStep/hz/seconds));
  for(let step=currentStep+1;step<=(frameCount-1)*recordEvery;step++){
   // Pending frame corrections are applied before the next step, identically
   // in uninterrupted bakes and when consuming a live continuation checkpoint.
   for(const update of updates){
    const body=bodies[update.index]!;
    if(update.ground){body.setTranslation(update.ground,false);const velocity=body.linvel();if(velocity.y<0)body.setLinvel({x:velocity.x,y:0,z:velocity.z},false);}
   }
   if(updates.some(update=>update.ground))world.propagateModifiedBodyPositionsToColliders();
   for(const update of updates)if(update.fixed){
    const body=bodies[update.index]!,p=body.translation(),rotation=body.rotation(),half=(data.layout.parcels[update.index]!.size-.5)/2;
    // Replace the settled dynamic body with a fixed cube in a stable order.
    world.removeRigidBody(body);
    const fixed=world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(p.x,p.y,p.z).setRotation(rotation));
    world.createCollider(RAPIER.ColliderDesc.cuboid(half,half,half).setFriction(.75),fixed);bodies[update.index]=fixed;fixedCount++;
   }
   updates.length=0;
   currentStep=step;
   const time=step/hz;
   const due=emittedCount(count,time,flowDuration);
   const sourceNeighbors:Array<{p:{x:number;y:number;z:number};r:number}>=[];
   if(emitted<due){const margin=maxSide*SQRT3;for(let i=0;i<count;i++){const body=bodies[i];if(!body)continue;const p=body.translation(),r=(data.layout.parcels[i]!.size-.5)*SQRT3/2;if(p.y+r>=height-margin&&p.y-r<=height+depth+margin)sourceNeighbors.push({p,r});}}
   for(;emitted<due;emitted++){
    const index=order[emitted]!,parcel=data.layout.parcels[index]!,half=(parcel.size-.5)/2,bodyRadius=half*SQRT3;
    const nearby=sourceNeighbors;
    let spawn:{x:number;y:number;z:number}|undefined;
    for(let attempt=0;attempt<128;attempt++){
     const point=emissionPoint(emitted,clip.seed+step,radius,attempt),candidate={...point,y:height+modelRandom(emitted*257+attempt,clip.seed+step)*depth};
     if(nearby.every(other=>square(candidate.x-other.p.x)+square(candidate.y-other.p.y)+square(candidate.z-other.p.z)>=square(bodyRadius+other.r+.04))){spawn=candidate;break;}
    }
    // Queue a crowded birth instead of letting penetration generate explosive impulses.
    if(!spawn)break;
    const rand=modelRandom(emitted,clip.seed),spin=(rand-.5)*1.4*speed;
    const body=world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(spawn.x,spawn.y,spawn.z).setLinvel(0,-8*speed,0).setAngvel({x:spin,y:spin*.6,z:-spin*.8}).setLinearDamping(.35).setAngularDamping(2.4).setCcdEnabled(false));
    world.createCollider(RAPIER.ColliderDesc.cuboid(half,half,half).setRestitution(0).setFriction(.75),body);bodies[index]=body;birthTimes[index]=time;sourceNeighbors.push({p:spawn,r:bodyRadius});
   }
   if(fixedCount<count)world.step();
   if(step%recordEvery===0){const frame=step/recordEvery;record(frame);if(frame%12===0){publish(frame+1);onProgress(frame/(frameCount-1));await new Promise<void>(resolve=>setTimeout(resolve,0));}}
  }
  publish(frameCount,true);onProgress(1);return {frames,count,fps,frameCount,seconds,flowDuration,birthTimes};
 }finally{if(!retained)world.free();}
}
