import {z} from 'zod';
/** Shared easing catalog for select controls and deterministic timeline sampling. */
export const easingNames=['Linear','Smooth','SineIn','SineOut','SineInOut','QuadIn','QuadOut','QuadInOut','CubicIn','CubicOut','CubicInOut','BackIn','BackOut','BackInOut','BounceIn','BounceOut','BounceInOut','ElasticIn','ElasticOut','ElasticInOut'] as const;
export const easingSchema=z.enum(easingNames);
export type EasingName=z.infer<typeof easingSchema>;
export const easingOptions=easingNames.map(value=>({value,label:value}));
function bounce(t:number){
 const n=7.5625,d=2.75;
 if(t<1/d)return n*t*t;
 if(t<2/d){t-=1.5/d;return n*t*t+.75;}
 if(t<2.5/d){t-=2.25/d;return n*t*t+.9375;}
 t-=2.625/d;return n*t*t+.984375;
}
function easeIn(family:string,t:number){
 switch(family){
  case 'Sine':return 1-Math.cos(t*Math.PI/2);
  case 'Quad':return t*t;
  case 'Cubic':return t*t*t;
  case 'Back':return t*t*(2.70158*t-1.70158);
  case 'Bounce':return 1-bounce(1-t);
  case 'Elastic':return -Math.pow(2,10*(t-1))*Math.sin((t-1.1)*5*Math.PI);
  default:return t;
 }
}
export function easeProgress(time:number,name:EasingName='Smooth'){
 const t=Math.max(0,Math.min(1,time));if(t===0||t===1)return t;
 if(name==='Linear')return t;
 if(name==='Smooth')return t*t*t*(t*(t*6-15)+10);
 const mode=name.endsWith('InOut')?'InOut':name.endsWith('Out')?'Out':'In',family=name.slice(0,-mode.length);
 if(mode==='In')return easeIn(family,t);
 if(mode==='Out')return 1-easeIn(family,1-t);
 return t<.5?easeIn(family,t*2)/2:1-easeIn(family,(1-t)*2)/2;
}

/** Compact choices for camera zoom; the full catalog remains reusable. */
export const zoomEasingOptions=[
 {value:'Linear',label:'Constant'},
 {value:'SineInOut',label:'Smooth'},
 {value:'SineIn',label:'Slow start'},
 {value:'SineOut',label:'Slow finish'},
 {value:'ElasticOut',label:'Elastic'},
] as const;
export function zoomEasingFor(value:unknown):EasingName{
 if(zoomEasingOptions.some(o=>o.value===value))return value as EasingName;
 if(typeof value!=='string')return 'SineInOut';
 if(value.startsWith('Elastic')||value.startsWith('Bounce')||value.startsWith('Back'))return 'ElasticOut';
 if(value.endsWith('InOut')||value==='Smooth')return 'SineInOut';
 return value.endsWith('In')?'SineIn':value.endsWith('Out')?'SineOut':'SineInOut';
}
