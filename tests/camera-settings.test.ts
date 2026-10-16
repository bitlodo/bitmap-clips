import {test,expect} from 'bun:test';
import snapshot from '../src/demo.json';
import type {SceneData} from '../src/editor-model';
import {cameraSettingsSchema,cameraEditorView,cameraEditorPose} from '../src/camera-settings';
import {makeClip,createFilm,parseDocument,validateFilm} from '../src/clips/film';
import {buildClip} from '../src/clips/registry';
import {sampleCamera} from '../src/camera-motion';
import {ProjectHistory} from '../src/history';
const data=snapshot as SceneData;
const a={position:[100,140,180] as [number,number,number],target:[10,20,30] as [number,number,number],fov:45};
const b={position:[200,100,50] as [number,number,number],target:[20,30,40] as [number,number,number],fov:55};
test('camera schema persists through validation, project import and undo',()=>{
 const film=createFilm(data),history=new ProjectHistory(film);film.clips[0]!.settings.cameraA=a;history.record(film);
 expect(validateFilm(film,data).clips[0]!.settings.cameraA).toEqual(a);
 expect(parseDocument(JSON.parse(JSON.stringify({data,film}))).film.clips[0]!.settings.cameraA).toEqual(a);
 expect(history.undo()!.clips[0]!.settings.cameraA).toBeUndefined();expect(history.redo()!.clips[0]!.settings.cameraA).toEqual(a);
 expect(()=>cameraSettingsSchema.parse({cameraA:{...a,position:a.target}})).toThrow();
});
test('camera editor round trips pose, including camera-plane translation',()=>{
 const view=cameraEditorView(a),pose=cameraEditorPose(a,view);
 pose.position.forEach((n,i)=>expect(n).toBeCloseTo(a.position[i]!,10));expect(pose.target).toEqual(a.target);
 view.pan=[10,-5,3];const moved=cameraEditorPose(a,view);
 expect(moved.target).toEqual([20,15,33]);moved.position.forEach((n,i)=>expect(n-a.position[i]!).toBeCloseTo(view.pan![i]!,10));
 expect(a.target).toEqual([10,20,30]);
});
test('Panorama owns linear interpolation between camera A and camera B',()=>{
 const clip=makeClip('panorama');clip.settings.cameraA=a;clip.settings.cameraB=b;
 const project=buildClip({data,look:'monument'},clip).engine;
 for(const aspect of [.5,1,2])for(const t of [0,.5,1]){
  const pose=sampleCamera(data,project,project.duration*t,aspect);
  pose.position.toArray().forEach((n,i)=>expect(n).toBeCloseTo(a.position[i]!+(b.position[i]!-a.position[i]!)*t,10));
  pose.target.toArray().forEach((n,i)=>expect(n).toBeCloseTo(a.target[i]!+(b.target[i]!-a.target[i]!)*t,10));
  expect(pose.fov).toBeCloseTo(45+10*t);
 }
});
test('single initial camera preserves scene motion after its saved start',()=>{
 const clip=makeClip('presentation');clip.settings.cameraA=a;
 const project=buildClip({data,look:'monument'},clip).engine,start=sampleCamera(data,project,0,1),end=sampleCamera(data,project,project.duration,1);
 start.position.toArray().forEach((n,i)=>expect(n).toBeCloseTo(a.position[i]!,10));start.target.toArray().forEach((n,i)=>expect(n).toBeCloseTo(a.target[i]!,10));
 expect(end.position.distanceTo(start.position)).toBeGreaterThan(1);
});
