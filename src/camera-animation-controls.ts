import {z} from 'zod';
import {easingSchema,zoomEasingOptions} from './easing';
import type {Control} from './clips/types';
export const cameraMotionSchema={
 rotation:z.preprocess(v=>v==='rotating'?true:v==='none'?false:v,z.boolean().default(false)),rotationSpeed:z.number().min(1).max(10).default(2),
 zoomEnabled:z.boolean().default(false),zoomMode:z.preprocess(v=>v==='none'?'zoom-in':v,z.enum(['zoom-in','zoom-out']).default('zoom-in')),cameraZoomStrength:z.number().min(.1).max(2).default(1),cameraZoomEasing:easingSchema.default('SineInOut'),
};
export const cameraMotionControls=[
 {key:'rotation',label:'Rotation',kind:'toggle'},
 {key:'rotationSpeed',label:'Rotation speed',kind:'range',min:1,max:10,step:1,unit:'multiplier',when:{key:'rotation',value:true}},
 {key:'zoomEnabled',label:'Zoom',kind:'toggle'},
 {key:'zoomMode',label:'Direction',kind:'select',options:[{value:'zoom-in',label:'Zoom in'},{value:'zoom-out',label:'Zoom out'}],when:{key:'zoomEnabled',value:true}},
 {key:'cameraZoomStrength',label:'Strength',kind:'range',min:.1,max:2,step:.1,unit:'percent',when:{key:'zoomEnabled',value:true}},
 {key:'cameraZoomEasing',label:'Interpolation',kind:'select',options:zoomEasingOptions,when:{key:'zoomEnabled',value:true}},
] as readonly Control[];
