import {z} from 'zod';
import {defineClip} from '../types';
import {basePlan,camera,frame,target} from '../shared';

export const panorama=defineClip({
  id:'panorama',version:1,name:'Panorama',description:'Explore the geometry with the whole bitmap in frame.',complexity:'simple',glyph:'▱',
  duration:{min:30,max:1800,default:150},
  schema:z.object({view:z.enum(['oblique','top']).default('oblique'),direction:z.enum(['clockwise','counterclockwise']).default('clockwise'),amplitude:z.number().min(20).max(110).default(70)}),
  cameraControls:[{key:'cameraA',label:'Camera A',at:0},{key:'cameraB',label:'Camera B',at:1}],
  controls:[{key:'view',label:'View',kind:'select',options:[{value:'oblique',label:'Perspective'},{value:'top',label:'Top view'}]},{key:'direction',label:'Direction',kind:'select',options:[{value:'clockwise',label:'Clockwise'},{value:'counterclockwise',label:'Counterclockwise'}]},{key:'amplitude',label:'Sweep',kind:'range',unit:'degrees',min:20,max:110,step:5}],
  build(context,s,c){
    const p=basePlan(context,c),tx=target(context),shot=camera(p,c,'orbit',0,p.duration,tx);
    shot.camera.elevation=shot.camera.elevationEnd=s.view==='top'?82:52;shot.camera.yawStart=35;shot.camera.yawEnd=35+s.amplitude*(s.direction==='clockwise'?1:-1);shot.camera.distanceStart=shot.camera.distanceEnd=1.13;
    frame(p,c);p.cameraSettings={cameraA:s.cameraA,cameraB:s.cameraB,interpolation:'linear'};return {engine:p,txIndex:tx,phases:[{id:'panorama',label:'Explore',from:0,to:1}],text:{source:'transactions',from:.1,to:.9,template:'counter'}};
  },
});
