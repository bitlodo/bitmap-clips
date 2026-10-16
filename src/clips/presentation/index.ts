import {z} from 'zod';
import {defineClip,type Control} from '../types';
import {assemblyOptions,basePlan,camera,assembly,frame,target} from '../shared';

const assemblyControls:Control<'assembly'|'revealFraction'|'stagger'|'strength'>[]=assemblyOptions.filter(o=>o.value!=='none').flatMap(o=>[
  {key:'revealFraction',label:'Opening duration',kind:'range',min:.1,max:.8,step:.01,unit:'percent',when:{key:'assembly',value:o.value}},
  {key:'stagger',label:'Opening stagger',kind:'range',min:0,max:.9,step:.01,unit:'percent',when:{key:'assembly',value:o.value}},
  ...(o.value==='build'?[]:[{key:'strength',label:'Assembly intensity',kind:'range',min:.1,max:2,step:.05,when:{key:'assembly',value:o.value}} as const]),
]);

/** Legacy contract retained for importing older projects; never listed as a scene. */
export const presentation=defineClip({
  id:'presentation',version:1,name:'Presentation',description:'Reveal the bitmap. A clean opening with identity and smooth motion.',complexity:'simple',glyph:'◒',
  duration:{min:30,max:1800,default:150},
  schema:z.object({assembly:z.enum(['build','rise','scatter','wave','none']).default('build'),bounceBack:z.number().min(0).max(.6).default(0),buildOrder:z.enum(['sequential','random']).default('random'),revealFraction:z.number().min(.1).max(.8).default(.32),stagger:z.number().min(0).max(.9).default(.28),strength:z.number().min(.1).max(2).default(.45),movement:z.enum(['orbit','push-in']).default('orbit')}),
  cameraControls:[{key:'cameraA',label:'Initial camera',at:0}],
  controls:[{key:'assembly',label:'Opening assembly',kind:'select',options:assemblyOptions},{key:'buildOrder',label:'Build order',kind:'select',options:[{value:'sequential',label:'Sequential'},{value:'random',label:'Random'}],when:{key:'assembly',value:'build'}},{key:'bounceBack',label:'Bounce back',kind:'range',min:0,max:.6,step:.01,unit:'percent',when:{key:'assembly',value:'build'}},...assemblyControls,{key:'movement',label:'Movement',kind:'select',options:[{value:'orbit',label:'Gentle orbit'},{value:'push-in',label:'Push in'}]}],
  build(context,s,c){
    const p=basePlan(context,c),tx=target(context),shot=camera(p,c,s.movement,0,p.duration,tx);
    shot.camera.compositionLift=.18;shot.camera.yawStart=35;shot.camera.yawEnd=s.movement==='orbit'?85:45;shot.camera.distanceStart=s.assembly==='scatter'?1.75:1.25;shot.camera.distanceEnd=1.1;
    assembly(p,c,s.assembly,tx,s.revealFraction);const model=p.models[0];if(model){model.stagger=s.stagger;model.strength=s.strength;if(s.assembly==='build'){model.buildOrder=s.buildOrder;model.bounceBack=s.bounceBack;}}frame(p,c);p.cameraSettings={cameraA:s.cameraA,cameraB:s.cameraB};
    return {engine:p,txIndex:tx,phases:[{id:'reveal',label:'Reveal',from:0,to:s.assembly==='none'?0:s.revealFraction},{id:'present',label:'Present',from:s.assembly==='none'?0:s.revealFraction,to:1}],text:{source:'identity',from:.18,to:.9,template:'cinematic'}};
  },
});
