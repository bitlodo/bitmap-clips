import { test, expect } from 'bun:test';
import snapshot from '../src/demo.json';
import { suggestedText,createFilm, clipStart, totalFrames, textRange, validateFilm } from '../src/clips/film';
import { resizeClipPreview, resizedFrames } from '../src/clips/resize';
import { definition } from '../src/clips/registry';
import { ProjectHistory } from '../src/history';
import type { SceneData } from '../src/editor-model';

const data=snapshot as SceneData;
function filmWithTexts(){const p=createFilm(data);for(const c of [p.clips[0]!,p.clips[2]!])p.texts.push(suggestedText(p,data,c)!);return validateFilm(p,data);}

test('resize preserves all starts, leaves a gap when shortened, and stops at the next clip',()=>{
 const film=filmWithTexts(),original=structuredClone(film),clip=film.clips[1]!,start=clipStart(film,clip.id),next=film.clips[2]!;
 for(const delta of [-30,60]){
  const preview=resizeClipPreview(film,clip.id,clip.durationFrames+delta);
  expect(clipStart(preview,clip.id)).toBe(start);expect(clipStart(preview,next.id)).toBe(clipStart(film,next.id));
  expect(totalFrames(preview)).toBe(totalFrames(film));
  expect(preview.clips[1]!.durationFrames).toBe(Math.min(clip.durationFrames,clip.durationFrames+delta));
  expect(preview.clips.map(c=>c.id)).toEqual(film.clips.map(c=>c.id));
  expect(preview.clips[0]).toEqual(film.clips[0]);expect(preview.clips[2]).toEqual(next);
  expect(validateFilm(preview,data)).toEqual(preview);
 }
 expect(film).toEqual(original);
});

test('end resize is quantized to frames, clamps to type limits and handles the last clip',()=>{
 const film=filmWithTexts();
 for(const clip of film.clips){
  const limits=definition(clip.type).duration;
  expect(resizeClipPreview(film,clip.id,-100).clips.find(c=>c.id===clip.id)!.durationFrames).toBe(limits.min);
  expect(resizeClipPreview(film,clip.id,100000).clips.find(c=>c.id===clip.id)!.durationFrames).toBe(Math.min(limits.max,(film.clips[film.clips.indexOf(clip)+1]?.startFrame??(clip.startFrame+limits.max))-clip.startFrame));
  expect(resizeClipPreview(film,clip.id,clip.durationFrames+.6).clips.find(c=>c.id===clip.id)!.durationFrames).toBe(Math.min(clip.durationFrames+1,(film.clips[film.clips.indexOf(clip)+1]?.startFrame??(clip.startFrame+limits.max))-clip.startFrame));
 }
 expect(resizedFrames(150,100,1000,600)).toBe(210);
 expect(resizedFrames(150,-100,1000,600)).toBe(90);
 expect(resizedFrames(150,50,500,600)).toBe(210);
 expect(()=>resizeClipPreview(film,'missing',100)).toThrow('Scene not found');
});

test('text timing stays independent of clip resize; shortening clips leaves the film running until the text ends',()=>{
 const film=filmWithTexts(),clip=film.clips[2]!,text=film.texts[1]!;text.settings.source='manual';text.settings.text='Keep my content';
 const before=textRange(film,text),preview=validateFilm(resizeClipPreview(film,clip.id,clip.durationFrames+60),data),after=textRange(preview,preview.texts[1]!);
 expect(after).toEqual(before);expect(preview.texts[1]!.settings.text).toBe(text.settings.text);
 film.texts=[{...text,startFrame:totalFrames(film)-30,durationFrames:30}];
 const shorter=validateFilm(resizeClipPreview(film,clip.id,180),data);expect(totalFrames(shorter)).toBe(600);expect(shorter.texts).toEqual(film.texts);
 expect(totalFrames(film)).toBe(600);
});

test('preview gestures leave history untouched; the final resize is one undoable edit',()=>{
 const film=filmWithTexts(),clip=film.clips[2]!,history=new ProjectHistory(film);
 for(const frames of [160,180,200])resizeClipPreview(film,clip.id,frames);
 expect(history.canUndo).toBe(false);
 const final=validateFilm(resizeClipPreview(film,clip.id,200),data);history.record(final);
 expect(history.undo()).toEqual(film);expect(history.canUndo).toBe(false);expect(history.redo()).toEqual(final);
});

test('Ripple scene resize shifts only following scenes by the actual duration delta',()=>{
 const film=filmWithTexts(),clip=film.clips[0]!,original=structuredClone(film);
 for(const delta of [-30,60]){
  const preview=validateFilm(resizeClipPreview(film,clip.id,clip.durationFrames+delta,true),data);
  expect(preview.clips[0]!.durationFrames).toBe(clip.durationFrames+delta);
  for(let i=1;i<film.clips.length;i++)expect(preview.clips[i]!.startFrame).toBe(film.clips[i]!.startFrame+delta);
  expect(preview.texts).toEqual(film.texts);
  expect(preview.texts.map(t=>t.durationFrames)).toEqual(film.texts.map(t=>t.durationFrames));
 }
 expect(film).toEqual(original);
});

test('Ripple resize preserves gaps and uses the clamped duration when shifting',()=>{
 const film=filmWithTexts(),clip=film.clips[0]!;
 for(let i=1;i<film.clips.length;i++)film.clips[i]!.startFrame+=45;
 const preview=validateFilm(resizeClipPreview(film,clip.id,100000,true),data),delta=definition(clip.type).duration.max-clip.durationFrames;
 expect(preview.clips[1]!.startFrame).toBe(film.clips[1]!.startFrame+delta);
 expect(preview.clips[1]!.startFrame-preview.clips[0]!.durationFrames).toBe(45);
});

test('Ripple text resize moves only later texts and supports undo',async()=>{
 const {resizeTextPreview}=await import('../src/clips/resize');
 const film=filmWithTexts(),text=film.texts[0]!;
 const preview=validateFilm(resizeTextPreview(film,text.id,text.durationFrames+30,true),data);
 expect(preview.texts[0]!.durationFrames).toBe(text.durationFrames+30);
 expect(preview.texts[1]!.startFrame).toBe(film.texts[1]!.startFrame+30);
 expect(preview.clips).toEqual(film.clips);
 const history=new ProjectHistory(film);history.record(preview);expect(history.undo()).toEqual(film);expect(history.redo()).toEqual(preview);
});
