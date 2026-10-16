import {expect,test} from 'bun:test';
import * as THREE from 'three';
import {createBitmapGrid,gridStep,gridPixelsPerUnit} from '../src/bitmap-grid';

test('wide views use 50 units and close views resolve one unit without zoom jitter',()=>{
  expect(gridStep(.7)).toBe(50);
  expect(gridStep(30)).toBe(1);
  expect(gridStep(.6,50)).toBe(50);
  expect(gridStep(2,50)).toBe(20);
  const camera=new THREE.PerspectiveCamera(38,1,.01,10000),target=new THREE.Vector3();
  camera.position.set(200,300,200);camera.lookAt(target);camera.updateProjectionMatrix();
  const wide=gridPixelsPerUnit(camera,target,900,900);
  camera.position.multiplyScalar(.02);camera.lookAt(target);
  const close=gridPixelsPerUnit(camera,target,900,900);
  expect(close).toBeGreaterThan(wide*20);
  expect(gridStep(close)).toBe(1);
});

test('coarse lines stay aligned to multiples of the layout unit and have visible contrast',()=>{
  const grid=createBitmapGrid({width:123,height:87},50),positions=grid.geometry.getAttribute('position');
  for(let i=0;i<positions.count;i+=2){
    const alongX=positions.getZ(i)===positions.getZ(i+1);
    const coordinate=alongX?positions.getZ(i)+grid.position.z+87/2:positions.getX(i)+grid.position.x+123/2;
    expect(coordinate/50).toBe(Math.round(coordinate/50));
  }
  expect((grid.material as THREE.Material).opacity).toBeGreaterThan(.5);
  const colors=grid.geometry.getAttribute('color');
  expect(new Set(Array.from(colors.array))).toHaveProperty('size',6);
  grid.dispose();
});

test('grid cells stay one layout unit wide across small and dense blocks',()=>{
  for(const layout of [{width:1,height:1},{width:5,height:7},{width:120,height:83},{width:0,height:0}]){
    const grid=createBitmapGrid(layout),positions=grid.geometry.getAttribute('position');
    const lines=new Set<number>();
    for(let i=0;i<positions.count;i+=2){
      if(positions.getX(i)===positions.getX(i+1))lines.add(positions.getX(i)+grid.position.x);
    }
    const xs=[...lines].sort((a,b)=>a-b);
    for(let i=1;i<xs.length;i++)expect(xs[i]!-xs[i-1]!).toBe(1);
    // Parcel x/y are integers relative to the centered layout origin.
    expect(lines.has(-layout.width/2)).toBe(true);
    const zs=new Set<number>();
    for(let i=0;i<positions.count;i+=2){
      if(positions.getZ(i)===positions.getZ(i+1))zs.add(positions.getZ(i)+grid.position.z);
    }
    expect(zs.has(-layout.height/2)).toBe(true);
    grid.dispose();
  }
});
