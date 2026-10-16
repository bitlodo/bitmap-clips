import {expect,test} from 'bun:test';
import snapshot from '../src/demo.json';
import type {SceneData} from '../src/editor-model';
import {createFilm,makeClip,parseDocument,validateFilm} from '../src/clips/film';
import {settingsFor,buildClip} from '../src/clips/registry';
import {ClipFilmRenderer} from '../src/clips/renderer';
import {sampleCamera} from '../src/camera-motion';
import {cameraMode} from '../src/camera-settings';
const data=snapshot as SceneData;
const custom={position:[100,140,180] as [number,number,number],target:[10,20,30] as [number,number,number],fov:45};

test('camera menu reports default, inherited and custom states including the first scene',()=>{
  const settings=makeClip('presentation-ready').settings;
  expect(cameraMode(settings,false)).toBe('default');expect(cameraMode(settings,true)).toBe('inherit');
  settings.cameraA=custom;
  expect(cameraMode(settings,false)).toBe('custom');expect(cameraMode(settings,true)).toBe('inherit');
  settings.inheritLastCamera=false;
  expect(cameraMode(settings,true)).toBe('custom');
  delete settings.cameraA;delete settings.cameraB;
  expect(cameraMode(settings,true)).toBe('default');
  const film=createFilm(data);film.clips=[makeClip('presentation-ready')];film.clips[0]!.settings={...settings};
  const restored=parseDocument(JSON.parse(JSON.stringify({data,film}))).film;
  expect(cameraMode(restored.clips[0]!.settings,false)).toBe('default');
});

test('inherit defaults on and persists; old explicit cameras remain custom',()=>{
  expect(makeClip('presentation-ready').settings.inheritLastCamera).toBe(true);
  expect(settingsFor('presentation-ready',{cameraA:custom}).inheritLastCamera).toBe(false);
  const film=createFilm(data);film.clips[0]!.settings.inheritLastCamera=false;
  expect(parseDocument(JSON.parse(JSON.stringify({data,film}))).film.clips[0]!.settings.inheritLastCamera).toBe(false);
});

test('inherit takes the rendered last frame including procedural motion, gaps and chained inheritance',()=>{
  const film=createFilm(data),first=makeClip('presentation-gravity'),second=makeClip('presentation-ready'),third=makeClip('presentation-ready');
  first.startFrame=30;first.settings.inheritLastCamera=false;first.settings.cameraA=custom;first.settings.movement='rotating';
  second.startFrame=first.startFrame+first.durationFrames+30;third.startFrame=second.startFrame+second.durationFrames;
  film.clips=[third,first,second];
  const renderer=Object.create(ClipFilmRenderer.prototype) as ClipFilmRenderer;
  Object.assign(renderer,{canvas:{width:720,height:720},data,plans:new Map()});
  const check=(previous:typeof first,next:typeof first)=>{
    const last=sampleCamera(data,renderer.plan(film,previous).engine,(previous.durationFrames-1)/30,1);
    const start=sampleCamera(data,renderer.plan(film,next).engine,0,1);
    expect(start.position.distanceTo(last.position)).toBeLessThan(1e-8);
    expect(start.target.distanceTo(last.target)).toBeLessThan(1e-8);expect(start.fov).toBe(last.fov);
    return start;
  };
  const before=check(first,second);check(second,third);
  expect(before.position.toArray()).not.toEqual(custom.position);
  first.settings.movement='zoom-in';const after=check(first,second);check(second,third);
  expect(after.position.distanceTo(before.position)).toBeGreaterThan(1);
  second.settings.inheritLastCamera=false;second.settings.cameraA=custom;
  expect(sampleCamera(data,renderer.plan(film,second).engine,0,1).position.toArray()).toEqual(custom.position);
  check(second,third);
  validateFilm(film,data);
});

test('first scene uses the default camera and accepts direct camera edits without an inheritance toggle',()=>{
  const film=createFilm(data),clip=makeClip('presentation-ready');film.clips=[clip];
  const renderer=Object.create(ClipFilmRenderer.prototype) as ClipFilmRenderer;
  Object.assign(renderer,{canvas:{width:720,height:720},data,plans:new Map()});
  const inherited=sampleCamera(data,renderer.plan(film,clip).engine,0,1);
  const native=sampleCamera(data,buildClip({data,look:film.look},{...clip,settings:{...clip.settings,cameraA:undefined}}).engine,0,1);
  expect(inherited.position.distanceTo(native.position)).toBeLessThan(1e-8);
  clip.settings.cameraA=custom;
  expect(sampleCamera(data,renderer.plan(film,clip).engine,0,1).position.toArray()).toEqual(custom.position);
  expect(clip.settings.cameraA).toEqual(custom);
});
