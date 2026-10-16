import {createProject,makeModel,makeShot,largestParcel,clamp,type Project,type ShotKind,type ModelKind} from '../editor-model';
import type {ClipContext,ClipCommon} from './types';
export const assemblyOptions=[{value:'build',label:'Build'},{value:'rise',label:'Vertical'},{value:'scatter',label:'Radial'},{value:'wave',label:'Wave'},{value:'none',label:'Ready / no assembly'}] as const;
export function basePlan(context:ClipContext,common:ClipCommon):Project {
  const p=createProject(context.data,context.look,common.durationFrames/30);
  p.duration=common.durationFrames/30;p.shots=[];p.models=[];p.titles=[];p.fades=[];
  Object.assign(p,context.sceneStyle??{},common.styleOverride??{});return p;
}
export function camera(p:Project,c:ClipCommon,kind:ShotKind,start:number,duration:number,tx:number){
  const s=makeShot(kind,start,duration,tx,p.preset);s.id=c.id+':camera:'+p.shots.length;s.camera.transition=p.shots.length?'blend':'cut';s.camera.blend=Math.min(.9,duration*.4);p.shots.push(s);return s;
}
export function assembly(p:Project,c:ClipCommon,kind:string,tx:number,fraction=.32){
  if(kind==='none')return;
  const m=makeModel(kind as ModelKind,0,p.duration*fraction,tx);m.id=c.id+':assembly';m.seed=c.seed;m.strength=.45;m.stagger=.28;p.models.push(m);
}
export function frame(p:Project,c:ClipCommon){
  for(const shot of p.shots)if(shot.camera.zoomIn)shot.camera.zoomIn.distance/=c.framing.zoom;
  for(const shot of p.shots){const k=shot.camera;k.yawStart+=c.framing.yawOffset;k.yawEnd+=c.framing.yawOffset;k.elevation=clamp(k.elevation+c.framing.pitchOffset,15,85);k.elevationEnd=clamp(k.elevationEnd+c.framing.pitchOffset,15,85);k.distanceStart/=c.framing.zoom;k.distanceEnd/=c.framing.zoom;}
}
export const target=(context:ClipContext)=>largestParcel(context.data);
