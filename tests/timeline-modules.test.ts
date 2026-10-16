import {test,expect} from 'bun:test';
import {z} from 'zod';
import snapshot from '../src/demo.json';
import {clips,settingsFor,buildClip} from '../src/clips/registry';
import {texts} from '../src/texts/registry';
import {createFilm,validateFilm,parseDocument} from '../src/clips/film';
import {makeText} from '../src/texts/registry';
import {cameraModule,sceneStyleModule,textStyleModule,fadeModule,extendSettings,extendInstance} from '../src/timeline-modules';
import type {SceneData} from '../src/editor-model';
const data=snapshot as SceneData;
test('objects reference shared modules and keep camera properties out of their own Settings schema',()=>{
 for(const definition of clips){
  expect(definition.modules).toEqual([cameraModule,sceneStyleModule,fadeModule]);
  expect(definition.settingsSchema.shape).not.toHaveProperty('cameraA');expect(definition.settingsSchema.shape).not.toHaveProperty('cameraB');
  expect(definition.schema.shape.cameraA).toBe(cameraModule.schema.shape.cameraA);
  expect(definition.instanceSchema.shape.fadeInFrames).toBe(fadeModule.schema.shape.fadeInFrames);
  expect(definition.instanceSchema.shape.styleOverride).toBe(sceneStyleModule.schema.shape.styleOverride);
 }
 for(const definition of texts){expect(definition.modules).toEqual([textStyleModule,fadeModule]);expect(definition.instanceSchema.shape).not.toHaveProperty('styleOverride');expect(definition.instanceSchema.shape.fadeOutFrames).toBe(fadeModule.schema.shape.fadeOutFrames);}
});
test('extension composition rejects duplicate properties and validates shared camera bounds',()=>{
 expect(()=>extendSettings(z.object({cameraA:z.string()}),[cameraModule])).toThrow('Duplicate');
 expect(()=>extendInstance(z.object({fadeInFrames:z.number()}),[fadeModule])).toThrow('Duplicate');
 expect(()=>settingsFor('presentation-radial',{cameraA:{position:[0,0,0],target:[0,0,0],fov:50}})).toThrow();
 expect(()=>fadeModule.schema.parse({fadeInFrames:61,fadeOutFrames:0})).toThrow();
});
test('shared modules survive saved projects and scene style overrides the current film style locally',()=>{
 const film=createFilm(data);film.sceneStyle={background:'studio',lightIntensity:1,accent:'#123456'};
 film.clips[0]!.styleOverride={background:'paper',lightIntensity:3,accent:'#abcdef'};
 film.clips[0]!.settings.cameraA={position:[10,10,10],target:[0,0,0],fov:50};film.clips[0]!.fadeInFrames=15;
 film.texts=[makeText('caption',0,90,{text:'Preserved'})];film.texts[0]!.fadeOutFrames=12;
 const validated=validateFilm(film,data),restored=parseDocument(JSON.parse(JSON.stringify({film:validated,data}))).film;
 expect(restored).toEqual(validated);
 const first=buildClip({data,look:film.look,sceneStyle:film.sceneStyle},restored.clips[0]!).engine;
 expect(first.background).toBe('paper');expect(first.lightIntensity).toBe(3);expect(first.accent).toBe('#abcdef');
 const second=buildClip({data,look:film.look,sceneStyle:film.sceneStyle},restored.clips[1]!).engine;
 expect(second.background).toBe('studio');expect(second.lightIntensity).toBe(1);expect(second.accent).toBe('#123456');
});
