import {easeProgress} from './easing';
import {settingPose} from './camera-settings';
import * as THREE from 'three';
import { activeShot, clamp, smooth, type Project, type SceneData, type Shot } from './editor-model';
import {faucetHeight,modelState} from './model-motion';
export interface CameraDraft {shotId:string;side:'start'|'end';yaw:number;elevation:number;distance:number;fov:number;}
export interface CameraPose {position:THREE.Vector3;target:THREE.Vector3;fov:number;txIndex:number;}
export function fitDistance(data:SceneData,fov:number,aspect:number):number{
  const v=THREE.MathUtils.degToRad(fov),h=2*Math.atan(Math.tan(v/2)*aspect);
  return Math.hypot(data.layout.width,data.layout.height,data.layout.parcels.reduce((max,p)=>Math.max(max,p.size),1))/2/Math.sin(Math.min(v,h)/2)*.88;
}
export function shotPose(data:SceneData,shot:Shot,time:number,aspect:number,parcelLift=0):CameraPose{
  const c=shot.camera,p=clamp((time-shot.start)/shot.duration,0,1),t=c.ease==='smooth'?smooth(p):p,span=Math.max(data.layout.width,data.layout.height);
  const maxHeight=data.layout.parcels.reduce((max,p)=>Math.max(max,p.size),1);
  const target=new THREE.Vector3(0,maxHeight*.2,0);let radius=fitDistance(data,c.fov,aspect);
  if(c.target==='parcel'){
    const parcel=data.layout.parcels.find(x=>x.txIndex===shot.txIndex)??data.layout.parcels[0]!,side=parcel.size-.5;
    target.set(parcel.x+side/2-data.layout.width/2,side/2+parcelLift,parcel.y+side/2-data.layout.height/2);
    const v=THREE.MathUtils.degToRad(c.fov),h=2*Math.atan(Math.tan(v/2)*aspect);radius=side*1.6/Math.sin(Math.min(v,h)/2);
  }
  if(c.target==='flow'){const height=faucetHeight(data,1);target.set(0,height*.4,0);const v=THREE.MathUtils.degToRad(c.fov),h=2*Math.atan(Math.tan(v/2)*aspect);radius=Math.hypot(span*.7,height)*.65/Math.sin(Math.min(v,h)/2);}
  if(c.compositionLift){const subject=c.target==='parcel'?(data.layout.parcels.find(p=>p.txIndex===shot.txIndex)?.size??1):span;target.y-=subject*c.compositionLift;}
  radius*=THREE.MathUtils.lerp(c.distanceStart,c.distanceEnd,t);
  if(c.zoomIn&&c.target==='parcel'){
    const zoom=smooth((time-shot.start)/c.zoomIn.duration);
    const overview=new THREE.Vector3(0,maxHeight*.2,0);
    target.lerp(overview,1-zoom);
    radius=THREE.MathUtils.lerp(fitDistance(data,c.fov,aspect)*c.zoomIn.distance,radius,zoom);
  }
  const yaw=THREE.MathUtils.degToRad(THREE.MathUtils.lerp(c.yawStart,c.yawEnd,t)),elevation=THREE.MathUtils.degToRad(THREE.MathUtils.lerp(c.elevation,c.elevationEnd,t));
  const direction=new THREE.Vector3(Math.cos(elevation)*Math.sin(yaw),Math.sin(elevation),Math.cos(elevation)*Math.cos(yaw));
  const sideDirection=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw));
  if(shot.kind==='truck')target.addScaledVector(sideDirection,(t-.5)*span*c.travel);
  if(shot.kind==='flyover'||shot.kind==='street'){
    target.add(new THREE.Vector3((t-.5)*data.layout.width*c.travel,maxHeight*(shot.kind==='street'?.6:.15),(t-.5)*data.layout.height*c.travel*.45));
  }
  const position=target.clone().addScaledVector(direction,radius);
  // Street paths remain above the tallest lot: immersive without passing through cubes.
  if(shot.kind==='street'){position.y=Math.max(position.y,maxHeight*1.3);target.y=maxHeight*.25;}
  return {position,target,fov:c.fov,txIndex:shot.txIndex};
}
/** Constant angular velocity, from 5 degrees/s at 1x to 100 degrees/s at 10x. */
export function cameraRotationAngle(time:number,speed=1):number{return THREE.MathUtils.degToRad(5+(speed-1)*95/9)*time;}
export function sampleCamera(data:SceneData,project:Project,time:number,aspect:number):CameraPose{
  const lift=modelState(project,time).targetLift;
  const shot=activeShot(project,time),pose=shotPose(data,shot,time,aspect,lift),ordered=[...project.shots].sort((a,b)=>a.start-b.start),prev=ordered[ordered.findIndex(s=>s.id===shot.id)-1];
  if(prev&&shot.camera.transition==='blend'&&shot.camera.blend>0){
    const t=smooth((time-shot.start)/Math.min(shot.camera.blend,shot.duration*.45));
    if(t<1){const from=shotPose(data,prev,Math.min(shot.start,prev.start+prev.duration),aspect,lift);
      pose.target.lerp(from.target,1-t);pose.position.lerp(from.position,1-t);pose.fov=THREE.MathUtils.lerp(from.fov,pose.fov,t);
      if(shot.camera.target!=='parcel')pose.txIndex=from.txIndex;
    }
  }
  // Keep the orbit's angular speed independent of the framing transition.
  if(shot.camera.linearYaw){
    const progress=clamp((time-shot.start)/shot.duration,0,1),yaw=THREE.MathUtils.degToRad(THREE.MathUtils.lerp(shot.camera.yawStart,shot.camera.yawEnd,progress));
    const horizontal=Math.hypot(pose.position.x-pose.target.x,pose.position.z-pose.target.z);
    pose.position.x=pose.target.x+horizontal*Math.sin(yaw);pose.position.z=pose.target.z+horizontal*Math.cos(yaw);
  }
  if(project.cameraSettings){
    const settings=project.cameraSettings,start=shotPose(data,ordered[0]!,0,aspect),end=shotPose(data,ordered.at(-1)!,project.duration,aspect),t=clamp(time/project.duration,0,1);
    const a=settings.cameraA?settingPose(settings.cameraA,pose.txIndex):start,b=settings.cameraB?settingPose(settings.cameraB,pose.txIndex):end;
    if(settings.animation||settings.rotation==='rotating'||settings.zoomMode&&settings.zoomMode!=='none'){
     const offset=a.position.clone().sub(a.target);
     if(settings.animation==='zoom-in'||settings.zoomMode&&settings.zoomMode!=='none'){if(!settings.cameraA){autoFrameCamera(data,project,a,aspect);offset.copy(a.position).sub(a.target).multiplyScalar(1.25);a.position.copy(a.target).add(offset);}const endDistance=zoomEndDistance(data,project,a,aspect,settings.zoomStrength),progress=easeProgress(t,settings.zoomEasing),out=settings.zoomMode==='zoom-out';offset.setLength(Math.max(.001,out?endDistance*(1-progress)+offset.length()*progress:offset.length()*(1-progress)+endDistance*progress));}
     if(settings.animation==='rotating'||settings.rotation==='rotating')offset.applyAxisAngle(new THREE.Vector3(0,1,0),cameraRotationAngle(time,settings.animationSpeed));
     pose.position.copy(a.target).add(offset);pose.target.copy(a.target);pose.fov=a.fov;
    }else if(settings.interpolation==='linear'&&(settings.cameraA||settings.cameraB)){pose.position.copy(a.position).lerp(b.position,t);pose.target.copy(a.target).lerp(b.target,t);pose.fov=THREE.MathUtils.lerp(a.fov,b.fov,t);}
    else if(settings.cameraA){pose.position.add(a.position.clone().sub(start.position));pose.target.add(a.target.clone().sub(start.target));pose.fov=a.fov;}
  }
  return pose;
}

/** Fit actual cube bounds to both screen axes with a small breathing margin. */
export function autoFrameCamera(data:SceneData,project:Project,pose:CameraPose,aspect:number){
 const bounds=new THREE.Box3();
 for(const p of data.layout.parcels){const side=p.size-.5;if(side<=0)continue;
  bounds.expandByPoint(new THREE.Vector3(p.x-data.layout.width/2,0,p.y-data.layout.height/2));
  bounds.expandByPoint(new THREE.Vector3(p.x+side-data.layout.width/2,side,p.y+side-data.layout.height/2));
 }
 if(bounds.isEmpty())return;
 const drop=project.models.find(m=>m.kind==='drop');
 if(drop){const height=faucetHeight(data,drop.strength);bounds.max.y=Math.max(bounds.max.y,height*2);}
 const center=bounds.getCenter(new THREE.Vector3()),direction=pose.position.clone().sub(pose.target).normalize();
 const right=new THREE.Vector3(0,1,0).cross(direction).normalize(),up=direction.clone().cross(right).normalize();
 const tan=Math.tan(pose.fov*Math.PI/360);let radius=0;
 for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){
  const v=new THREE.Vector3(x,y,z).sub(center),depth=project.cameraType==='isometric'?0:v.dot(direction);
  radius=Math.max(radius,depth+Math.abs(v.dot(right))/(tan*aspect)*1.12,depth+Math.abs(v.dot(up))/tan*1.12);
 }
 pose.target.copy(center);pose.position.copy(center).addScaledVector(direction,Math.max(radius,.01));
}

/** The end framing depends on the subject, never on how far the initial camera is. */
export function zoomEndDistance(data:SceneData,project:Project,pose:CameraPose,aspect:number,strength=1){
 const fitted={...pose,position:pose.position.clone(),target:pose.target.clone()};autoFrameCamera(data,project,fitted,aspect);
 const initial=pose.position.distanceTo(pose.target),full=Math.min(initial,fitted.position.distanceTo(fitted.target));
 // Below 100% travel partway; above it, magnify beyond the complete-subject frame.
 return Math.max(.001,strength<=1?initial+(full-initial)*strength:full/(1+2*(strength-1)));
}
