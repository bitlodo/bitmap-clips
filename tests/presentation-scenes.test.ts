import {test,expect} from 'bun:test';
import snapshot from '../src/demo.json';
import {clips,controlsFor,buildClip} from '../src/clips/registry';
import {createFilm,makeClip,validateFilm,parseDocument} from '../src/clips/film';
import type {SceneData} from '../src/editor-model';
const data=snapshot as SceneData;
const modes={build:'build',radial:'scatter',wave:'wave',ready:'none'};
test('Presentation is a category with independent scenes and applicable controls',()=>{
 expect(clips.some(c=>c.id==='presentation')).toBe(false);
 expect(clips.map(c=>c.id)).toEqual(['reveal','display']);
 for(const [name,mode] of Object.entries(modes)){
  const c=makeClip('presentation-'+name),controls=controlsFor(c.type).map(c=>c.key);
  expect(controls).not.toContain('assembly');expect(c.settings).not.toHaveProperty('assembly');
  expect(controls.includes('bounceBack')).toBe(name==='build');expect(controls.includes('buildOrder')).toBe(name==='build');
  expect(controls.includes('strength')).toBe(['radial','wave'].includes(name));
  expect(controls.includes('revealFraction')).toBe(name!=='ready');
  const p=buildClip({data,look:'monument'},c);expect(p.engine.models[0]?.kind??'none').toBe(mode);
 }
});
test('old presentation scenes migrate by opening mode while preserving timing identity and settings',()=>{
 for(const [name,mode] of Object.entries(modes)){
  const film=createFilm(data),old=makeClip('presentation',150,0);Object.assign(old.settings,{assembly:mode,bounceBack:.3,buildOrder:'sequential',revealFraction:.6,stagger:.4,strength:1.1});old.framing.yawOffset=20;film.clips[0]=old;
  const restored=parseDocument(JSON.parse(JSON.stringify({data,film}))).film,scene=restored.clips[0]!;
  expect(scene.type).toBe(name==='ready'?'display':'reveal');expect(scene.id).toBe(old.id);expect(scene.startFrame).toBe(old.startFrame);expect(scene.durationFrames).toBe(old.durationFrames);expect(scene.framing).toEqual(old.framing);expect(scene.fadeInFrames).toBe(old.fadeInFrames);
  const before=buildClip({data,look:film.look},old),after=buildClip({data,look:film.look},scene);expect(after.engine.models).toEqual(before.engine.models);
  expect(validateFilm(restored,data)).toEqual(restored);
 }
});

test('removed Vertical scenes reopen as Build with timing preserved',()=>{
 for(const legacy of [false,true]){
  const film=createFilm(data),original=structuredClone(film.clips[0]!);
  film.clips[0]!.type=legacy?'presentation':'presentation-vertical';
  if(legacy)film.clips[0]!.settings.assembly='rise';
  const restored=validateFilm(film,data).clips[0]!;
  expect(restored.type).toBe('presentation-build');expect(restored.id).toBe(original.id);
  expect(restored.startFrame).toBe(original.startFrame);expect(restored.durationFrames).toBe(original.durationFrames);
 }
 expect(clips.some(c=>c.id==='presentation-vertical')).toBe(false);
});
