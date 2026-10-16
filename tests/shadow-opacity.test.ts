import {test,expect} from 'bun:test';
import * as THREE from 'three';
import snapshot from '../src/demo.json';
import {createProject,type SceneData} from '../src/editor-model';
import {FilmRenderer} from '../src/film-renderer';

test('shadow opacity reaches the actual light shadow for model and ground, without double attenuation',()=>{
 const renderer=Object.create(FilmRenderer.prototype) as FilmRenderer;
 const key=new THREE.DirectionalLight(),ground=new THREE.Mesh(new THREE.PlaneGeometry(),new THREE.ShadowMaterial());
 const materials={solid:new THREE.MeshStandardMaterial(),neon:new THREE.MeshStandardMaterial(),wireframe:new THREE.MeshBasicMaterial(),hologram:new THREE.MeshBasicMaterial()};
 Object.assign(renderer,{look:'',span:10,scene:new THREE.Scene(),mesh:new THREE.Mesh(),ground,cubeGeometries:{'rounded-small':new THREE.BoxGeometry(),square:new THREE.BoxGeometry()},materials,key,hemi:new THREE.HemisphereLight(),rim:new THREE.DirectionalLight(),fill:new THREE.DirectionalLight(),grid:new THREE.GridHelper(),renderer:{setClearColor(){},shadowMap:{enabled:true}}});
 const project=createProject(snapshot as SceneData,'editorial');
 const apply=(opacity:number|undefined)=>{project.shadowOpacity=opacity;Reflect.get(renderer,'applyLook').call(renderer,project,1);};
 for(const opacity of [0,.15,.5,1,0]){
  apply(opacity);expect(key.shadow.intensity).toBe(opacity);expect(ground.material.opacity).toBe(1);
 }
 // Older projects retain their previous receiver opacity and full model shadow.
 apply(undefined);expect(key.shadow.intensity).toBe(1);expect(ground.material.opacity).toBe(.22);
 project.fog=true;project.fogNear=2;project.fogFar=7;project.backgroundColor='#123456';project.lightRotation=90;apply(.5);
 const scene=Reflect.get(renderer,'scene') as THREE.Scene,fog=scene.fog as THREE.Fog;
 expect(fog).toBeInstanceOf(THREE.Fog);expect(fog.near).toBe(20);expect(fog.far).toBe(70);expect(fog.color.getHexString()).toBe('123456');
 expect(key.position.x).toBeCloseTo(9);expect(key.position.y).toBe(19);expect(key.position.z).toBeCloseTo(10);
 const radius=Math.hypot(key.position.x,key.position.z);project.lightRotation=-90;project.fog=false;apply(.5);
 expect(scene.fog).toBeNull();expect(key.position.y).toBe(19);expect(Math.hypot(key.position.x,key.position.z)).toBeCloseTo(radius);
 for(const material of Object.values(materials))material.dispose();ground.geometry.dispose();ground.material.dispose();
});
