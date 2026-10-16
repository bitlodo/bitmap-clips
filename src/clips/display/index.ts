import {z} from 'zod';
import {defineClip,type Control} from '../types';
import {scene as ready} from '../presentation-ready';
import {applySceneCamera} from '../scene-camera';
export const displayTypes=[{value:'none',label:'None'},{value:'pulse',label:'Pulse'},{value:'wave',label:'Wave'}] as const;
export const display=defineClip({
 id:'display',version:1,name:'Display',description:'Show the complete bitmap, still or with continuous animation.',complexity:'simple',glyph:'▱',duration:{min:30,max:1800,default:150},cameraControls:[{key:'cameraA',label:'Initial camera',at:0}],
 schema:z.object({displayAnimation:z.enum(['none','pulse','wave']).default('none'),displaySpeed:z.number().min(1).max(10).default(2),displayIntensity:z.number().min(.1).max(1).default(.3)}),
 controls:[{key:'displayAnimation',label:'Display animation',kind:'select',options:displayTypes},
 ...(['pulse','wave'] as const).map(value=>({key:'displaySpeed',label:'Speed',kind:'range',min:1,max:10,step:1,when:{key:'displayAnimation',value}})),
 ...(['pulse','wave'] as const).map(value=>({key:'displayIntensity',label:'Intensity',kind:'range',min:.1,max:1,step:.1,unit:'percent',when:{key:'displayAnimation',value}})),
 ] as Control<'displayAnimation'|'displaySpeed'|'displayIntensity'>[],
 build(context,s,c){
  const plan=ready.build(context,ready.schema.parse({...s,movement:'none'}),c);applySceneCamera(plan.engine,s);
  plan.engine.displayMotion={kind:s.displayAnimation,speed:s.displaySpeed,intensity:s.displayIntensity};
  return {...plan,phases:[{id:'display',label:'Display',from:0,to:1}]};
 },
});
