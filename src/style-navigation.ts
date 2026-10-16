import type {StyleView} from './scene-style';
export const defaultStyleView:StyleView={yaw:35,elevation:30,distance:1.15};
export function navigateStyle(view:StyleView,command:string,largeStep=false):StyleView {
 const next={...view},step=largeStep?15:5;
 switch(command){
  case 'view-reset':return {...defaultStyleView};
  case 'view-fit':next.distance=1.15;delete next.pan;break;
  case 'view-front':Object.assign(next,{yaw:0,elevation:10});break;
  case 'view-top':next.elevation=89;break;
  case 'view-iso':Object.assign(next,{yaw:45,elevation:35.26438968});break;
  case 'view-left':next.yaw-=step;break;case 'view-right':next.yaw+=step;break;
  case 'view-up':next.elevation+=step;break;case 'view-down':next.elevation-=step;break;
  case 'view-in':next.distance/=1.12;break;case 'view-out':next.distance*=1.12;break;
 }
 next.elevation=Math.max(10,Math.min(89,next.elevation));next.distance=Math.max(.6,Math.min(8,next.distance));return next;
}

/** Translate along camera right/up, in world units per CSS pixel. */
export function panStyle(view:StyleView,position:number[],target:number[],fov:number,height:number,dx:number,dy:number):StyleView {
 const forward=target.map((n,i)=>n-position[i]!),length=Math.hypot(...forward);
 const f=forward.map(n=>n/length),r=[-f[2]!,0,f[0]!],rl=Math.hypot(...r);
 if(!length||!rl||height<=0)return view;
 const right=r.map(n=>n/rl),up=[right[1]!*f[2]!-right[2]!*f[1]!,right[2]!*f[0]!-right[0]!*f[2]!,right[0]!*f[1]!-right[1]!*f[0]!];
 const scale=2*length*Math.tan(fov*Math.PI/360)/height;
 return {...view,pan:right.map((n,i)=>(view.pan?.[i]??0)+scale*(-dx*n+dy*up[i]!)) as [number,number,number]};
}
