import {test,expect} from 'bun:test';
import * as THREE from 'three';
import snapshot from '../src/demo.json';
import type {SceneData} from '../src/editor-model';
import {stylePreviewProject,styleDefaults} from '../src/scene-style';
import {shotPose} from '../src/camera-motion';
import {centerStyleCamera} from '../src/style-camera';
const data=snapshot as SceneData;
test('Scene Style reset centers projected geometry at desktop and portrait aspects',()=>{
 for(const aspect of [1.5,.5,2.4]){
  const project=stylePreviewProject(data,'monument',styleDefaults(data,'monument'),{yaw:35,elevation:55,distance:1.15});
  const pose=shotPose(data,project.shots[0]!,2,aspect),direction=pose.target.clone().sub(pose.position).normalize();
  centerStyleCamera(data,pose,aspect);
  expect(pose.target.clone().sub(pose.position).normalize().distanceTo(direction)).toBeLessThan(1e-10);
  const camera=new THREE.PerspectiveCamera(pose.fov,aspect,.001,1e9);camera.position.copy(pose.position);camera.lookAt(pose.target);camera.updateMatrixWorld();
  const bounds=new THREE.Box3();
  for(const parcel of data.layout.parcels){const side=parcel.size-.5;if(side<=0)continue;
   for(const x of [0,side])for(const y of [0,side])for(const z of [0,side])bounds.expandByPoint(new THREE.Vector3(parcel.x+x-data.layout.width/2,y,parcel.y+z-data.layout.height/2).project(camera));
  }
  expect(Math.abs((bounds.min.x+bounds.max.x)/2)).toBeLessThan(.0001);
  expect(Math.abs((bounds.min.y+bounds.max.y)/2)).toBeLessThan(.0001);
 }
});

test('isometric uses orthographic projection and centers bounds at different aspects',async()=>{
 const {projectionCamera}=await import('../src/style-camera');
 const {defaultStyleView}=await import('../src/style-navigation');
 const {sceneStyleSchema}=await import('../src/scene-style');
 expect(defaultStyleView.elevation).toBe(30);
 expect(sceneStyleSchema.parse({cameraType:'isometric'}).cameraType).toBe('isometric');
 for(const aspect of [.5,1.5,2.4]){
  const project=stylePreviewProject(data,'monument',{cameraType:'isometric'},defaultStyleView);
  expect(project.cameraType).toBe('isometric');
  const pose=shotPose(data,project.shots[0]!,2,aspect);
  centerStyleCamera(data,pose,aspect,'isometric');
  const camera=projectionCamera(pose,aspect,'isometric');expect(camera).toBeInstanceOf(THREE.OrthographicCamera);
  camera.position.copy(pose.position);camera.lookAt(pose.target);camera.updateMatrixWorld();
  const bounds=new THREE.Box3();
  for(const p of data.layout.parcels){const side=p.size-.5;if(side<=0)continue;
   for(const x of [0,side])for(const y of [0,side])for(const z of [0,side])bounds.expandByPoint(new THREE.Vector3(p.x+x-data.layout.width/2,y,p.y+z-data.layout.height/2).project(camera));
  }
  expect(Math.abs(bounds.min.x+bounds.max.x)).toBeLessThan(.0001);expect(Math.abs(bounds.min.y+bounds.max.y)).toBeLessThan(.0001);
  const near=new THREE.Vector3(0,0,-10).applyMatrix4(camera.matrixWorld),far=new THREE.Vector3(0,0,-20).applyMatrix4(camera.matrixWorld);
  const right=new THREE.Vector3(1,0,0).transformDirection(camera.matrixWorld);
  expect(near.clone().add(right).project(camera).x-near.clone().project(camera).x).toBeCloseTo(far.clone().add(right).project(camera).x-far.clone().project(camera).x,10);
 }
});
