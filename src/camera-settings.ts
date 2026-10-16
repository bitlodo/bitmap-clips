import {cameraMotionSchema} from './camera-animation-controls';
import {z} from 'zod';
import * as THREE from 'three';
import type {CameraPose} from './camera-motion';
import type {StyleView} from './scene-style';
const vector=z.tuple([z.number().finite(),z.number().finite(),z.number().finite()]);
export const cameraPoseSchema=z.object({position:vector,target:vector,fov:z.number().min(10).max(120)}).refine(p=>Math.hypot(...p.position.map((n,i)=>n-p.target[i]!))>1e-6,'Camera position must differ from target');
export type CameraSetting=z.infer<typeof cameraPoseSchema>;
export const cameraSettingsSchema=z.object({...cameraMotionSchema,inheritLastCamera:z.boolean().default(true),cameraA:cameraPoseSchema.optional(),cameraB:cameraPoseSchema.optional()});
export function cameraMode(settings:Record<string,unknown>,hasPrevious:boolean):'default'|'inherit'|'custom'{
 if(hasPrevious&&settings.inheritLastCamera!==false)return 'inherit';
 return settings.cameraA||settings.cameraB?'custom':'default';
}
export function cameraEditorView(p:CameraSetting):StyleView {
 const offset=new THREE.Vector3(...p.position).sub(new THREE.Vector3(...p.target)),radius=offset.length();
 return {yaw:Math.atan2(offset.x,offset.z)*180/Math.PI,elevation:Math.asin(offset.y/radius)*180/Math.PI,distance:1};
}
export function cameraEditorPose(base:CameraSetting,view:StyleView):CameraSetting {
 const target=new THREE.Vector3(...base.target).add(new THREE.Vector3(...(view.pan??[0,0,0]))),radius=new THREE.Vector3(...base.position).distanceTo(new THREE.Vector3(...base.target))*view.distance;
 const yaw=view.yaw*Math.PI/180,elevation=view.elevation*Math.PI/180;
 const position=target.clone().add(new THREE.Vector3(Math.cos(elevation)*Math.sin(yaw),Math.sin(elevation),Math.cos(elevation)*Math.cos(yaw)).multiplyScalar(radius));
 return {position:position.toArray(),target:target.toArray(),fov:base.fov};
}
export function settingPose(value:CameraSetting,txIndex:number):CameraPose {return {position:new THREE.Vector3(...value.position),target:new THREE.Vector3(...value.target),fov:value.fov,txIndex};}
