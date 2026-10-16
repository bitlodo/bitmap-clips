import {test,expect} from 'bun:test';
import snapshot from '../src/demo.json';
import type {SceneData} from '../src/editor-model';
import {makeClip} from '../src/clips/film';
import {buildClip} from '../src/clips/registry';
import {sampleCamera} from '../src/camera-motion';
import {cameraEditTime,cameraEditSettings} from '../src/camera-edit';
const data=snapshot as SceneData;

test('camera editing preserves timeline offsets and stays in the scene at its end',()=>{
  expect(cameraEditTime(300,150,12.4)).toBe(12.4);
  expect(cameraEditTime(300,150,8)).toBe(10);
  expect(cameraEditTime(300,150,15)).toBe(449/30);
  const local=2.4;
  expect(cameraEditTime(300,150,300/30+local)).toBe(12.4);
});

test('applying a camera at the selected time reproduces the edited pose after scene motion',()=>{
  for(const type of ['presentation-ready','presentation-gravity','panorama']){
    for(const movement of type!=='panorama'?['none','rotating','zoom-in']:['orbit']){
      const clip=makeClip(type);clip.settings.movement=movement;clip.settings.cameraSpeed=7;
      for(const fraction of [.0,.45,.9]){
        const project=buildClip({data,look:'monument'},clip).engine,time=project.duration*fraction;
        const original=sampleCamera(data,project,time,1);
        const desired={position:original.position.clone().addScalar(3).toArray(),target:original.target.clone().addScalar(2).toArray(),fov:original.fov};
        for(const key of type==='panorama'?['cameraA','cameraB']:['cameraA']){
          const settings=cameraEditSettings(data,project,time,1,key,desired);
          const adjusted=sampleCamera(data,{...project,cameraSettings:{...project.cameraSettings,...settings}},time,1);
          adjusted.position.toArray().forEach((n,i)=>expect(n).toBeCloseTo(desired.position[i]!,8));
          adjusted.target.toArray().forEach((n,i)=>expect(n).toBeCloseTo(desired.target[i]!,8));
          expect(adjusted.fov).toBeCloseTo(desired.fov,8);
        }
      }
    }
  }
});
