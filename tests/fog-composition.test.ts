import {test,expect} from 'bun:test';
import * as THREE from 'three';
import {FilmRenderer} from '../src/film-renderer';

test('postprocessing fog receives exact sRGB background and depth, and restores render/shadow state',()=>{
 const engine=Object.create(FilmRenderer.prototype) as FilmRenderer,scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(38,1,.01,1000);
 scene.fog=new THREE.Fog('#aaff00',10,20);
 const depth=new THREE.WebGLRenderTarget(1,1),original=new THREE.WebGLRenderTarget(1,1),depthMaterial=new THREE.MeshDepthMaterial(),override=new THREE.MeshBasicMaterial();scene.overrideMaterial=override;
 const uniforms:Record<string,{value:unknown}>=Object.fromEntries(['orthographic','fogEnabled','tDepth','fogNear','fogFar','cameraNear','cameraFar'].map(k=>[k,{value:null}]));uniforms.background={value:new THREE.Vector3()};
 let current:THREE.WebGLRenderTarget|null=original,passes=0,fail=false;
 const renderer={shadowMap:{enabled:true},getRenderTarget(){return current;},setRenderTarget(target:THREE.WebGLRenderTarget|null){current=target;},setClearColor(){},clear(){},render(){passes++;expect(current).toBe(depth);expect(scene.overrideMaterial).toBe(depthMaterial);expect(this.shadowMap.enabled).toBe(false);if(fail)throw Error('Depth pass failed');}};
 Object.assign(engine,{scene,camera,fogDepth:depth,fogDepthMaterial:depthMaterial,renderer,fx:{uniforms}});
 const render=()=>Reflect.get(engine,'renderFogDepth').call(engine,640,480);
 render();expect(depth.width).toBe(640);expect(depth.height).toBe(480);expect(uniforms.tDepth!.value).toBe(depth.texture);expect(uniforms.fogNear!.value).toBe(10);expect(uniforms.fogFar!.value).toBe(20);
 const color=uniforms.background!.value as unknown as THREE.Vector3;expect(color.x).toBeCloseTo(170/255);expect(color.y).toBeCloseTo(1);expect(color.z).toBeCloseTo(0);
 expect(current).toBe(original);expect(scene.overrideMaterial).toBe(override);expect(renderer.shadowMap.enabled).toBe(true);
 scene.fog=null;render();expect(uniforms.fogEnabled!.value).toBe(0);expect(passes).toBe(1);
 scene.fog=new THREE.Fog('#aaff00',10,20);fail=true;expect(render).toThrow('Depth pass failed');expect(current).toBe(original);expect(scene.overrideMaterial).toBe(override);expect(renderer.shadowMap.enabled).toBe(true);
 depth.dispose();original.dispose();depthMaterial.dispose();override.dispose();
});
