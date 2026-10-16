import {applySceneCamera} from '../scene-camera';
import {z} from 'zod';
import {makeModel,largestParcel} from '../../editor-model';
import {defineClip} from '../types';
import {assemblyOptions,basePlan,camera,assembly,frame} from '../shared';

export const transaction=defineClip({
  id:'transaction',version:1,name:'Transaction spotlight',description:'Lift a transaction above the bitmap with a gentle orbit and a smooth return.',complexity:'complex',glyph:'⌖',
  duration:{min:30,max:1800,default:300},
  schema:z.object({target:z.enum(['largest','selected']).default('largest'),txIndex:z.number().int().min(0).default(0),assembly:z.enum(['build','rise','scatter','wave','none']).default('none'),treatment:z.enum(['highlight','isolate']).default('highlight'),movement:z.enum(['orbit','still']).default('orbit'),zoomIn:z.boolean().default(true),zoomInDuration:z.number().min(.3).max(3).default(1.5),returnWide:z.boolean().default(true)}),
  cameraControls:[{key:'cameraA',label:'Initial camera',at:0}],
  controls:[
    {key:'target',label:'Transaction',kind:'select',options:[{value:'largest',label:'Largest parcel · automatic'},{value:'selected',label:'Choose transaction'}]},
    {key:'txIndex',label:'Scene target',kind:'transaction',when:{key:'target',value:'selected'}},
    {key:'assembly',label:'Opening assembly',kind:'select',options:assemblyOptions},
    {key:'treatment',label:'Target treatment',kind:'select',options:[{value:'highlight',label:'Highlight with context'},{value:'isolate',label:'Isolate transaction'}]},
    {key:'movement',label:'Detail camera',kind:'select',options:[{value:'orbit',label:'Short orbit'},{value:'still',label:'Steady framing'}]},
    {key:'zoomIn',label:'Zoom In',kind:'toggle'},
    {key:'zoomInDuration',label:'Zoom in duration',kind:'range',unit:'seconds',min:.3,max:3,step:.1,when:{key:'zoomIn',value:true}},
    {key:'returnWide',label:'Return to overview',kind:'toggle'},
  ],
  build(context,s,c){
    const p=basePlan(context,c),tx=s.target==='largest'?largestParcel(context.data):s.txIndex;
    if(!context.data.layout.parcels.some(x=>x.txIndex===tx))throw Error('The selected transaction does not exist in this bitmap.');
    const returnDuration=s.returnWide?p.duration*.25:0,detailDuration=p.duration-returnDuration;
    const zoomDuration=Math.min(s.zoomInDuration,detailDuration*.65);
    const focus=camera(p,c,'focus',0,detailDuration,tx);
    focus.camera.target=s.zoomIn?'parcel':'block';focus.camera.compositionLift=s.zoomIn ? .08 : .12;
    focus.camera.distanceStart=focus.camera.distanceEnd=s.zoomIn? .85:1.2;
    focus.camera.transition='cut';focus.camera.blend=0;
    if(s.zoomIn)focus.camera.zoomIn={duration:zoomDuration,distance:1.3};
    if(s.returnWide){const end=camera(p,c,'outro',detailDuration,returnDuration,tx);end.camera.distanceStart=end.camera.distanceEnd=1.2;end.camera.blend=returnDuration;}
    // One angular rate over the complete clip, including the return blend.
    for(const shot of p.shots){shot.camera.ease='linear';shot.camera.linearYaw=true;shot.camera.yawStart=45+(s.movement==='orbit'?28*shot.start/p.duration:0);shot.camera.yawEnd=45+(s.movement==='orbit'?28*(shot.start+shot.duration)/p.duration:0);}
    assembly(p,c,s.assembly,tx);
    const effect=makeModel(s.treatment,0,p.duration,tx);effect.id=c.id+':treatment';effect.targetLift=context.data.layout.parcels.reduce((height,parcel)=>Math.max(height,parcel.size-.5),0)+Math.max(context.data.layout.width,context.data.layout.height)*.06;effect.fadeIn=s.zoomIn?zoomDuration:Math.min(.8,p.duration*.25);effect.fadeOut=returnDuration;effect.end='hold';p.models.push(effect);frame(p,c);p.cameraSettings={cameraA:s.cameraA,cameraB:s.cameraB};if(s.rotation||s.zoomEnabled)applySceneCamera(p,s);
    const detailStart=s.zoomIn?zoomDuration/p.duration:0,detailEnd=detailDuration/p.duration;
    return {engine:p,txIndex:tx,phases:[...(s.zoomIn?[{id:'zoom-in',label:'Zoom in',from:0,to:detailStart}]:[]),{id:'detail',label:'Detail',from:detailStart,to:detailEnd},...(s.returnWide?[{id:'return',label:'Return',from:detailEnd,to:1}]:[])],text:{source:'transaction',from:s.zoomIn?detailStart:.05,to:detailEnd-.025,template:'callout'}};
  },
});
