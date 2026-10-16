import * as THREE from 'three';
import {sampleCamera,cameraRotationAngle,zoomEndDistance} from './camera-motion';
import type {CameraSetting} from './camera-settings';
import {easeProgress} from './easing';
import type {Project,SceneData} from './editor-model';

export function cameraEditTime(startFrame:number,durationFrames:number,time:number){
  return Math.max(startFrame/30,Math.min(time,(startFrame+durationFrames-1)/30));
}

/** Convert the pose edited at a local time back to the scene's camera setting. */
export function cameraEditSettings(data:SceneData,project:Project,time:number,aspect:number,key:string,value:CameraSetting):Record<string,CameraSetting>{
  const settings=project.cameraSettings,t=Math.max(0,Math.min(1,time/project.duration));
  if(settings?.animation||settings?.rotation==='rotating'||settings?.zoomMode&&settings.zoomMode!=='none'){
    const target=new THREE.Vector3(...value.target),offset=new THREE.Vector3(...value.position).sub(target);
    if(settings.animation==='rotating'||settings.rotation==='rotating')offset.applyAxisAngle(new THREE.Vector3(0,1,0),-cameraRotationAngle(time,settings.animationSpeed));
    if(settings.animation==='zoom-in'||settings.zoomMode&&settings.zoomMode!=='none'){
      const eased=easeProgress(t,settings.zoomEasing),progress=settings.zoomMode==='zoom-out'?1-eased:eased,desired=offset.length(),direction=offset.clone().normalize();
      const rendered=(radius:number)=>{const edited={position:target.clone().addScaledVector(direction,radius),target:target.clone(),fov:value.fov,txIndex:0};return radius*(1-progress)+zoomEndDistance(data,project,edited,aspect,settings.zoomStrength)*progress;};
      let low=.001,high=Math.max(desired,1);
      while(rendered(high)<desired&&high<1e12)high*=2;
      for(let i=0;i<60;i++){const mid=(low+high)/2;if(rendered(mid)<desired)low=mid;else high=mid;}
      offset.setLength((low+high)/2);
    }
    return {[key]:{...value,position:target.add(offset).toArray()}};
  }
  const pose=sampleCamera(data,project,time,aspect);
  if(settings?.interpolation==='linear'){
    const a=sampleCamera(data,project,0,aspect),b=sampleCamera(data,project,project.duration,aspect),weight=key==='cameraB'?t:1-t;
    // Before either endpoint is saved, playback may still use the native shot path.
    // Saving an endpoint enables linear interpolation, so solve against that path.
    pose.position.copy(a.position).lerp(b.position,t);pose.target.copy(a.target).lerp(b.target,t);pose.fov=a.fov+(b.fov-a.fov)*t;
    const adjust=(base:typeof pose,factor:number):CameraSetting=>({
      position:base.position.clone().addScaledVector(new THREE.Vector3(...value.position).sub(pose.position),factor).toArray(),
      target:base.target.clone().addScaledVector(new THREE.Vector3(...value.target).sub(pose.target),factor).toArray(),
      fov:base.fov+(value.fov-pose.fov)*factor,
    });
    if(weight<.001)return {cameraA:adjust(a,1),cameraB:adjust(b,1)};
    return {[key]:adjust(key==='cameraB'?b:a,1/weight)};
  }
  const raw={...project,cameraSettings:undefined},start=sampleCamera(data,raw,0,aspect),current=sampleCamera(data,raw,time,aspect);
  return {[key]:{
    position:new THREE.Vector3(...value.position).sub(current.position).add(start.position).toArray(),
    target:new THREE.Vector3(...value.target).sub(current.target).add(start.target).toArray(),fov:value.fov,
  }};
}
