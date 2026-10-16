import {z} from 'zod';
import {defineClip,type Control} from '../types';
import {presentation} from '../presentation';
import {scene as gravity} from '../presentation-gravity';
import {applySceneCamera} from '../scene-camera';
export const revealTypes=[{value:'build',label:'Build'},{value:'wave',label:'Wave'},{value:'radial',label:'Radial'},{value:'scale-rotate',label:'Scale & Rotate'},{value:'gravity',label:'Gravity'}] as const;
export const reveal=defineClip({
 id:'reveal',version:1,inheritCameraByDefault:false,name:'Reveal',description:'Introduce the bitmap with an animated reveal.',complexity:'simple',glyph:'◒',duration:{min:30,max:1800,default:150},cameraControls:[{key:'cameraA',label:'Initial camera',at:0}],
 schema:z.object({radialDuration:z.number().min(.1).max(.8).default(.6),radialStagger:z.number().min(0).max(.9).default(.7),radialIntensity:z.number().min(.1).max(2).default(2),revealType:z.enum(['build','wave','radial','scale-rotate','gravity']).default('build'),revealFraction:z.number().min(.1).max(.8).default(.4),stagger:z.number().min(0).max(.9).default(.7),strength:z.number().min(.1).max(2).default(.45),buildOrder:z.enum(['sequential','random']).default('random'),bounceBack:z.number().min(0).max(.6).default(.6),speed:z.number().min(.5).max(5).default(2),dropHeight:z.number().min(1).max(20).default(10),flow:z.number().min(1).max(10).default(7)}),
 controls:[{key:'revealType',label:'Reveal type',kind:'select',options:revealTypes},
  ...(['build','wave','scale-rotate'] as const).flatMap(value=>[
   {key:'revealFraction',label:'Opening duration',kind:'range',min:.1,max:.8,step:.01,unit:'percent',when:{key:'revealType',value}},
   {key:'stagger',label:'Opening stagger',kind:'range',min:0,max:.9,step:.01,unit:'percent',when:{key:'revealType',value}},
   ...(value==='build'?[]:[{key:'strength',label:'Intensity',kind:'range',min:.1,max:2,step:.05,when:{key:'revealType',value}}]),
  ]),
  {key:'radialDuration',label:'Opening duration',kind:'range',min:.1,max:.8,step:.01,unit:'percent',when:{key:'revealType',value:'radial'}},
  {key:'radialStagger',label:'Opening stagger',kind:'range',min:0,max:.9,step:.01,unit:'percent',when:{key:'revealType',value:'radial'}},
  {key:'radialIntensity',label:'Intensity',kind:'range',min:.1,max:2,step:.05,when:{key:'revealType',value:'radial'}},
  {key:'buildOrder',label:'Build order',kind:'select',options:[{value:'sequential',label:'Sequential'},{value:'random',label:'Random'}],when:{key:'revealType',value:'build'}},
  {key:'bounceBack',label:'Bounce back',kind:'range',min:0,max:.6,step:.01,unit:'percent',when:{key:'revealType',value:'build'}},
  ...gravity.controls.filter(c=>['speed','dropHeight','flow'].includes(c.key)).map(c=>({...c,when:{key:'revealType',value:'gravity'}})),
 ] as Control<'revealType'|'revealFraction'|'stagger'|'strength'|'buildOrder'|'bounceBack'|'speed'|'dropHeight'|'flow'|'radialDuration'|'radialStagger'|'radialIntensity'>[],
 build(context,s,c){
  const plan=s.revealType==='gravity'?gravity.build(context,gravity.schema.parse({...s,movement:'none'}),c):presentation.build(context,presentation.schema.parse({...s,...(s.revealType==='radial'?{revealFraction:s.radialDuration,stagger:s.radialStagger,strength:s.radialIntensity}:{}),assembly:s.revealType==='radial'?'scatter':s.revealType==='scale-rotate'?'build':s.revealType,movement:'orbit'}),c);
  if(s.revealType==='scale-rotate')plan.engine.models[0]!.kind='scale-rotate';
  applySceneCamera(plan.engine,s);return plan;
 },
});
