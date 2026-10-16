import * as THREE from 'three';
import type {BitmapLayout} from './lib/bitmap-layout';

/** Choose readable subdivisions in layout units, with hysteresis during zoom. */
export function gridStep(pixelsPerUnit:number,current=0){
  if(current&&pixelsPerUnit*current>=18&&pixelsPerUnit*current<=65)return current;
  const required=28/Math.max(pixelsPerUnit,.0001);
  for(let magnitude=1;magnitude<=1e8;magnitude*=10){
    for(const factor of [1,2,5])if(factor*magnitude>=required)return factor*magnitude;
  }
  return 1e9;
}

/** One-unit precision when zoomed in; coarser lines keep wide views readable. */
export function createBitmapGrid(layout:Pick<BitmapLayout,'width'|'height'>,step=1,paper=false){
  const half=Math.max(step,Math.ceil(Math.max(layout.width,layout.height)/step)*step);
  const size=half*2;
  const minor=new THREE.Color(paper?'#587477':'#44777c'),major=new THREE.Color(paper?'#304d50':'#82c5c6');
  const grid=new THREE.GridHelper(size,size/step,major,minor);
  // Keep integer parcel boundaries on grid lines for odd-sized layouts too.
  grid.position.set(Math.floor(layout.width/2/step)*step-layout.width/2,-.58,Math.floor(layout.height/2/step)*step-layout.height/2);
  const positions=grid.geometry.getAttribute('position'),colors=grid.geometry.getAttribute('color');
  for(let i=0;i<positions.count;i+=2){
    const alongX=positions.getZ(i)===positions.getZ(i+1);
    const coordinate=alongX?positions.getZ(i)+grid.position.z+layout.height/2:positions.getX(i)+grid.position.x+layout.width/2;
    const color=Math.round(coordinate/step)%5===0?major:minor;
    for(const vertex of [i,i+1])colors.setXYZ(vertex,color.r,color.g,color.b);
  }
  const material=grid.material as THREE.Material;
  material.transparent=true;material.opacity=paper?.65:.7;material.depthWrite=false;
  grid.userData.step=step;grid.userData.paper=paper;
  return grid;
}

export function gridPixelsPerUnit(camera:THREE.PerspectiveCamera|THREE.OrthographicCamera,target:THREE.Vector3,width:number,height:number){
  camera.updateMatrixWorld();
  const origin=new THREE.Vector3(target.x,-.58,target.z),center=origin.clone().project(camera);
  const lengths=[new THREE.Vector3(1,0,0),new THREE.Vector3(0,0,1)].map(axis=>{
    const point=origin.clone().add(axis).project(camera);
    return Math.hypot((point.x-center.x)*width/2,(point.y-center.y)*height/2);
  });
  // Avoid unbounded subdivision sizes when one axis is seen edge-on.
  return Math.max(Math.min(...lengths),Math.max(...lengths)*.35);
}
