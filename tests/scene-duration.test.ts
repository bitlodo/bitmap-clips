import {test,expect} from 'bun:test';
import snapshot from '../src/demo.json';
import type {SceneData} from '../src/editor-model';
import {clips,buildClip} from '../src/clips/registry';
import {makeClip,createFilm,validateFilm} from '../src/clips/film';
import {resizeClipPreview} from '../src/clips/resize';
const data=snapshot as SceneData;
test('all scenes accept 1s through 1min and reject durations outside those limits',()=>{
 for(const definition of clips){
  expect(definition.duration.min).toBe(30);expect(definition.duration.max).toBe(1800);
  for(const frames of [30,1800]){
   const clip=makeClip(definition.id,frames),film={...createFilm(data),clips:[clip],texts:[]};
   expect(validateFilm(film,data).clips[0]!.durationFrames).toBe(frames);
   const plan=buildClip({data,look:film.look},clip);
   for(const phase of plan.phases){expect(phase.from).toBeGreaterThanOrEqual(0);expect(phase.to).toBeLessThanOrEqual(1);expect(phase.to).toBeGreaterThanOrEqual(phase.from);}
   expect(resizeClipPreview(film,clip.id,0,'push').clips[0]!.durationFrames).toBe(30);
   expect(resizeClipPreview(film,clip.id,10000,'push').clips[0]!.durationFrames).toBe(1800);
  }
  for(const frames of [29,1801])expect(()=>validateFilm({...createFilm(data),clips:[makeClip(definition.id,frames)],texts:[]},data)).toThrow();
 }
});
