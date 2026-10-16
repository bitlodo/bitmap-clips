import {z} from 'zod';
import {defineClip} from '../types';
import {scene as ready} from '../presentation-ready';

export const scene=defineClip({
 id:'presentation-static',version:1,category:'Presentation',name:'Static',description:'Present the complete bitmap with a stationary camera.',complexity:'simple',glyph:'■',
 duration:ready.duration,cameraControls:ready.cameraControls,
 schema:z.object({}),controls:[],
 build(context,settings,common){
  const plan=ready.build(context,ready.schema.parse({...settings,movement:'none'}),common);
  return {engine:plan.engine,txIndex:plan.txIndex,phases:[{id:'static',label:'Static',from:0,to:1}]};
 },
});
