import * as THREE from 'three';
import type {SceneData} from './editor-model';
import type {CameraPose} from './camera-motion';

/** Orthographic framing matches perspective scale at the orbit target. */
export function projectionCamera(pose:CameraPose,aspect:number,type='perspective'):THREE.PerspectiveCamera|THREE.OrthographicCamera{
 const half=pose.position.distanceTo(pose.target)*Math.tan(pose.fov*Math.PI/360);
 return type==='isometric'?new THREE.OrthographicCamera(-half*aspect,half*aspect,half,-half,.001,1e9):new THREE.PerspectiveCamera(pose.fov,aspect,.001,1e9);
}
/** Center the visible parcel bounds, accounting for perspective and cube height. */
export function centerStyleCamera(data:SceneData,pose:CameraPose,aspect:number,type='perspective'):void {
 const camera=projectionCamera(pose,aspect,type);
 camera.position.copy(pose.position);camera.lookAt(pose.target);camera.updateMatrixWorld();
 const right=new THREE.Vector3(1,0,0).applyQuaternion(camera.quaternion),up=new THREE.Vector3(0,1,0).applyQuaternion(camera.quaternion);
 const distance=pose.position.distanceTo(pose.target),halfHeight=distance*Math.tan(pose.fov*Math.PI/360);
 const points:THREE.Vector3[]=[];
 for(const parcel of data.layout.parcels){const side=parcel.size-.5;if(side<=0)continue;
  for(const x of [0,side])for(const y of [0,side])for(const z of [0,side])points.push(new THREE.Vector3(parcel.x+x-data.layout.width/2,y,parcel.y+z-data.layout.height/2));
 }
 if(!points.length)return;
 const projected=new THREE.Vector3();
 for(let iteration=0;iteration<8;iteration++){
  camera.position.copy(pose.position);camera.updateMatrixWorld();
  let left=Infinity,rightEdge=-Infinity,bottom=Infinity,top=-Infinity;
  for(const point of points){projected.copy(point).project(camera);left=Math.min(left,projected.x);rightEdge=Math.max(rightEdge,projected.x);bottom=Math.min(bottom,projected.y);top=Math.max(top,projected.y);}
  const x=(left+rightEdge)/2,y=(bottom+top)/2;if(Math.abs(x)+Math.abs(y)<1e-7)break;
  const shift=right.clone().multiplyScalar(x*halfHeight*aspect).addScaledVector(up,y*halfHeight);
  pose.position.add(shift);pose.target.add(shift);
 }
}
