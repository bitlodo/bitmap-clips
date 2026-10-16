import {cameraAnimationSchema,cameraAnimationControls} from '../camera-animation';
import {z} from 'zod';
import {defineClip} from '../types';
import {basePlan,camera,frame,target} from '../shared';
import {makeModel} from '../../editor-model';

export const scene=defineClip({
 id:'presentation-gravity',version:1,category:'Presentation',name:'Gravity',description:'Pour every bitmap transaction as a cube, with real collisions and a settled pile.',complexity:'simple',glyph:'↓',
 duration:{min:30,max:1800,default:300},
 schema:z.object({speed:z.number().min(.5).max(5).default(2),dropHeight:z.number().min(1).max(20).default(10),flow:z.number().min(1).max(10).default(7),...cameraAnimationSchema}),
 cameraControls:[{key:'cameraA',label:'Default camera',at:0}],
 controls:[
  {key:'speed',label:'Gravity Speed',kind:'range',min:.5,max:5,step:.1,unit:'multiplier'},
  {key:'dropHeight',label:'Drop Height',kind:'range',min:1,max:20,step:1},
  {key:'flow',label:'Flow',kind:'range',min:1,max:10,step:1},
  ...cameraAnimationControls,
 ],
 build(context,s,c){
  const intensity=(s.flow-1)/9,flowSeconds=context.data.layout.parcels.length/(100*s.flow),emitterRadius=.08+.22*intensity;
  const p=basePlan(context,c),tx=target(context),shot=camera(p,c,'orbit',0,p.duration,tx),model=makeModel('drop',0,flowSeconds,tx);
  shot.camera.compositionLift=.18;shot.camera.yawStart=35;shot.camera.yawEnd=35;shot.camera.distanceStart=.95;shot.camera.distanceEnd=.95;
  model.duration=flowSeconds;model.simulationDuration=p.duration;model.emitterRadius=emitterRadius;model.fallSpeed=s.speed;model.physicsVariant=s.movement;model.id=c.id+':gravity';model.seed=c.seed;model.strength=s.dropHeight/5;p.models.push(model);
  frame(p,c);p.cameraSettings={cameraA:s.cameraA,cameraB:s.cameraB,animation:s.movement,animationSpeed:s.cameraSpeed,zoomStrength:s.zoomStrength,zoomEasing:s.zoomEasing};const flowEnd=Math.min(1,model.duration/p.duration);
  return {engine:p,txIndex:tx,phases:[{id:'flow',label:'Cube waterfall',from:0,to:flowEnd},...(flowEnd<1?[{id:'settle',label:'Settle',from:flowEnd,to:1}]:[])]};
 },
});
