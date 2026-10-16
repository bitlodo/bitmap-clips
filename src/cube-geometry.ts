import {BoxGeometry,BufferGeometry,Float32BufferAttribute,Vector3} from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
export type CubeType='square'|'chamfered'|'rounded-small'|'rounded-large';
export function cubeGeometry(type:CubeType){
 if(type==='chamfered')return chamferedCube();
 if(type==='square')return new BoxGeometry(1,1,1);
 const geometry=new RoundedBoxGeometry(1,1,1,3,type==='rounded-large'?.08:.032);
 return geometry;
}

/** Six faces, twelve single bevel bands, eight corner caps. */
function chamferedCube(){
 const half=.5,inset=half-.025,positions:number[]=[];
 const vertex=(axis:number,value:number,a:number,b:number)=>{const v=[0,0,0];v[axis]=value;v[(axis+1)%3]=a;v[(axis+2)%3]=b;return new Vector3(...v as [number,number,number]);};
 const face=(points:Vector3[])=>{
  const center=points.reduce((sum,p)=>sum.add(p),new Vector3()).divideScalar(points.length);
  const normal=points[1]!.clone().sub(points[0]!).cross(points[2]!.clone().sub(points[0]!));
  if(normal.dot(center)<0)points.reverse();
  for(let i=1;i<points.length-1;i++)for(const p of [points[0]!,points[i]!,points[i+1]!])positions.push(p.x,p.y,p.z);
 };
 for(let axis=0;axis<3;axis++)for(const sign of [-1,1]){
  face([vertex(axis,sign*half,-inset,-inset),vertex(axis,sign*half,inset,-inset),vertex(axis,sign*half,inset,inset),vertex(axis,sign*half,-inset,inset)]);
 }
 for(let free=0;free<3;free++)for(const a of [-1,1])for(const b of [-1,1]){
  face([vertex(free,-inset,a*half,b*inset),vertex(free,inset,a*half,b*inset),vertex(free,inset,a*inset,b*half),vertex(free,-inset,a*inset,b*half)]);
 }
 for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1]){
  face([new Vector3(x*half,y*inset,z*inset),new Vector3(x*inset,y*half,z*inset),new Vector3(x*inset,y*inset,z*half)]);
 }
 const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(positions,3));geometry.computeVertexNormals();return geometry;
}
