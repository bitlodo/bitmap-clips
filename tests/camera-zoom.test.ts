import * as THREE from 'three';
import {test,expect} from 'bun:test';
import snapshot from '../src/demo.json';
import type {SceneData} from '../src/editor-model';
import {makeClip} from '../src/clips/film';
import {buildClip,settingsFor,controlsFor} from '../src/clips/registry';
import {sampleCamera,zoomEndDistance} from '../src/camera-motion';
import {controlVisible} from '../src/clips/types';
const data=snapshot as SceneData;
test('Ready and Gravity zoom between user endpoints while preserving target and direction',()=>{
 for(const type of ['presentation-ready','presentation-gravity']){
  expect(settingsFor(type,{movement:'push-in'}).movement).toBe('zoom-in');
  for(const zoomStrength of [.1,.5,1,2]){
   const clip=makeClip(type);Object.assign(clip.settings,{movement:'zoom-in',zoomStrength,cameraA:{position:[0,8,20],target:[0,8,0],fov:45}});
   const project=buildClip({data,look:'monument'},clip).engine;
   for(const t of [0,.5,1]){
    const pose=sampleCamera(data,project,t*project.duration,1);
    const end=zoomEndDistance(data,project,{position:new THREE.Vector3(0,8,20),target:new THREE.Vector3(0,8,0),fov:45,txIndex:0},1,zoomStrength);
    expect(pose.position.z).toBeCloseTo(20*(1-t)+end*t,8);
    expect(pose.target.toArray()).toEqual([0,8,0]);expect(pose.fov).toBe(45);
   }
  }
  for(const c of controlsFor(type).filter(c=>c.key.startsWith('zoom'))){expect(controlVisible({movement:'zoom-in'},c)).toBe(true);expect(controlVisible({movement:'rotating'},c)).toBe(false);}
 }
});

test('automatic zoom starts with complete bitmap bounds visible at different sizes and aspects',async()=>{
 const THREE=await import('three');const {projectionCamera}=await import('../src/style-camera');
 for(const scale of [.2,1,10])for(const aspect of [.5,1,2])for(const cameraType of ['perspective','isometric'] as const){
  const scaled={...data,layout:{width:data.layout.width*scale,height:data.layout.height*scale,parcels:data.layout.parcels.map(p=>({...p,x:p.x*scale,y:p.y*scale,size:(p.size-.5)*scale+.5}))}};
  const clip=makeClip('presentation-ready');clip.settings.movement='zoom-in';
  const project=buildClip({data:scaled,look:'monument',sceneStyle:{cameraType}},clip).engine,pose=sampleCamera(scaled,project,0,aspect);
  const camera=projectionCamera(pose,aspect,cameraType);camera.position.copy(pose.position);camera.lookAt(pose.target);camera.updateMatrixWorld();
  for(const p of scaled.layout.parcels){const side=p.size-.5;
   for(const x of [0,side])for(const y of [0,side])for(const z of [0,side]){
    const v=new THREE.Vector3(p.x+x-scaled.layout.width/2,y,p.y+z-scaled.layout.height/2).project(camera);
    expect(Math.abs(v.x)).toBeLessThan(1);expect(Math.abs(v.y)).toBeLessThan(1);
   }
  }
 }
});

test('distant custom cameras reach the same subject-relative end zoom',()=>{
 for(const type of ['presentation-ready','presentation-gravity']){
  const distances:number[]=[];
  for(const radius of [1000,10000]){
   const clip=makeClip(type);Object.assign(clip.settings,{movement:'zoom-in',zoomStrength:1,cameraA:{position:[0,0,radius],target:[0,0,0],fov:45}});
   const project=buildClip({data,look:'monument'},clip).engine;
   expect(sampleCamera(data,project,0,1).position.z).toBe(radius);
   distances.push(sampleCamera(data,project,project.duration,1).position.z);
  }
  expect(distances[0]).toBeCloseTo(distances[1]!,8);
 }
});

test('zoom strength permits subtle travel and closeups beyond full framing',()=>{
 const clip=makeClip('presentation-ready');Object.assign(clip.settings,{movement:'zoom-in',cameraA:{position:[0,0,10000],target:[0,0,0],fov:45}});
 const project=buildClip({data,look:'monument'},clip).engine,pose=sampleCamera(data,project,0,1);
 const full=zoomEndDistance(data,project,pose,1,1),subtle=zoomEndDistance(data,project,pose,1,.1),close=zoomEndDistance(data,project,pose,1,2);
 expect(subtle).toBeCloseTo(10000+(full-10000)*.1,8);
 expect(close).toBeLessThan(full);expect(close).toBeGreaterThan(0);
 expect(settingsFor(clip.type,{}).zoomStrength).toBe(1);
 const start=sampleCamera(data,project,0,1),early=sampleCamera(data,project,project.duration*.01,1);
 expect(start.position.distanceTo(early.position)).toBeLessThan(10000*.001);
});
