import {easingSchema,zoomEasingOptions} from '../easing';
import {z} from 'zod';
import type {Control} from './types';
export const cameraAnimationSchema={movement:z.enum(['none','rotating','zoom-in']).default('rotating'),cameraSpeed:z.number().min(1).max(10).default(2),zoomEasing:easingSchema.default('SineInOut'),zoomStrength:z.number().min(.1).max(2).default(1)};
export const cameraAnimationControls=[
 {key:'movement',label:'Camera animation',kind:'select',options:[{value:'none',label:'None'},{value:'rotating',label:'Rotating'},{value:'zoom-in',label:'Zoom in'}]},
 {key:'cameraSpeed',label:'Speed',kind:'range',min:1,max:10,step:1,unit:'multiplier',when:{key:'movement',value:'rotating'}},
 {key:'zoomStrength',label:'Zoom strength',kind:'range',min:.1,max:2,step:.1,unit:'percent',when:{key:'movement',value:'zoom-in'}},
 {key:'zoomEasing',label:'Interpolation',kind:'select',options:zoomEasingOptions,when:{key:'movement',value:'zoom-in'}},
] as const satisfies readonly Control<'movement'|'cameraSpeed'|'zoomStrength'|'zoomEasing'>[];
