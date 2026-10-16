import {test,expect} from 'bun:test';
import snapshot from '../src/demo.json';
import type {SceneData} from '../src/editor-model';
import {makeClip,createFilm,parseDocument} from '../src/clips/film';
import {buildClip,definition} from '../src/clips/registry';
import {sampleCamera} from '../src/camera-motion';
const data=snapshot as SceneData;
test('Static has only Camera, Scene Style and Fade and holds its complete bitmap pose',()=>{
 const d=definition('presentation-static');expect(d.controls).toEqual([]);expect(Object.keys(d.settingsSchema.shape)).toEqual([]);
 expect(d.modules.map(m=>m.id)).toEqual(['camera','scene-style','fade']);
 for(const duration of [30,150,1800]){
  const clip=makeClip(d.id,duration);clip.styleOverride={cubeType:'square',cameraType:'isometric',accent:'#123456'};
  const project=buildClip({data,look:'monument'},clip).engine,start=sampleCamera(data,project,0,1);
  expect(project.models).toEqual([]);expect(project.cameraSettings?.animation).toBe('none');
  expect(project.cubeType).toBe('square');expect(project.cameraType).toBe('isometric');
  for(const time of [project.duration*.5,project.duration]){const pose=sampleCamera(data,project,time,1);expect(pose.position.toArray()).toEqual(start.position.toArray());expect(pose.target.toArray()).toEqual(start.target.toArray());}
 }
});
test('Static preserves a saved custom or matched camera without animation',()=>{
 const film=createFilm(data),clip=makeClip('presentation-static');
 clip.settings.cameraA={position:[10,8,20],target:[1,2,3],fov:45};clip.settings.inheritLastCamera=false;film.clips=[clip];
 const restored=parseDocument(JSON.parse(JSON.stringify({data,film}))).film.clips[0]!;
 const project=buildClip({data,look:'monument'},restored).engine;
 for(const time of [0,project.duration])expect(sampleCamera(data,project,time,1).position.toArray()).toEqual([10,8,20]);
});
