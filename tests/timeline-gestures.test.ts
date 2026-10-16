import {test,expect} from 'bun:test';
import snapshot from '../src/demo.json';
import type {SceneData} from '../src/editor-model';
import {createFilm,validateFilm,suggestedText} from '../src/clips/film';
import {moveTimelinePreview} from '../src/timeline-gestures';
import {makeText} from '../src/texts/registry';
import {resizeClipPreview,resizeTextPreview} from '../src/clips/resize';
const data=snapshot as SceneData;
function fixture(){const film=createFilm(data);film.clips[1]!.startFrame+=60;film.clips[2]!.startFrame+=60;film.texts=[suggestedText(film,data,film.clips[2]!)!];return validateFilm(film,data);}
test('center movement stops at either neighbor without moving texts or peers',()=>{
 const film=fixture(),item=film.clips[1]!;
 for(const wanted of [-100,10000]){
  const preview=validateFilm(moveTimelinePreview(film,item.id,'clip',wanted),data);
  expect(preview.texts).toEqual(film.texts);expect(preview.clips[0]).toEqual(film.clips[0]);expect(preview.clips[2]).toEqual(film.clips[2]);
  expect(preview.clips[1]!.startFrame).toBe(wanted<0?film.clips[0]!.durationFrames:item.startFrame);
 }
});
test('left scene movement shifts only following scenes and clamps against previous scenes',()=>{
 const film=fixture(),item=film.clips[1]!;
 for(const wanted of [item.startFrame-100,item.startFrame+40]){
  const preview=validateFilm(moveTimelinePreview(film,item.id,'clip',wanted,true),data),delta=wanted<item.startFrame?-60:40;
  expect(preview.clips[0]).toEqual(film.clips[0]);
  expect(preview.clips[1]!.startFrame).toBe(item.startFrame+delta);
  expect(preview.clips[2]!.startFrame).toBe(film.clips[2]!.startFrame+delta);
  expect(preview.texts).toEqual(film.texts);
 }
});
test('right scene resize consumes gaps and pushes only following scenes',()=>{
 const film=fixture(),item=film.clips[0]!,original=structuredClone(film);
 for(const extra of [-30,30,60,90]){
  const preview=validateFilm(resizeClipPreview(film,item.id,item.durationFrames+extra,'push'),data),delta=Math.max(0,extra-60);
  expect(preview.clips[0]!.durationFrames).toBe(item.durationFrames+extra);
  expect(preview.clips[1]!.startFrame).toBe(film.clips[1]!.startFrame+delta);
  expect(preview.clips[2]!.startFrame).toBe(film.clips[2]!.startFrame+delta);
  expect(preview.texts).toEqual(film.texts);
 }
 expect(film).toEqual(original);
});

test('double-click resize fills the next gap without pushing following items',async()=>{
 const {fillTimelineGap}=await import('../src/clips/resize');
 const film=fixture(),first=film.clips[0]!,next=film.clips[1]!,preview=validateFilm(fillTimelineGap(film,first.id,'clip'),data);
 expect(preview.clips[0]!.durationFrames).toBe(next.startFrame-first.startFrame);
 expect(preview.clips.slice(1)).toEqual(film.clips.slice(1));expect(preview.texts).toEqual(film.texts);
 expect(fillTimelineGap(preview,first.id,'clip')).toEqual(preview);
});
test('double-click fills to total timeline end for the last item and respects scene limits',async()=>{
 const {fillTimelineGap}=await import('../src/clips/resize');const {makeText}=await import('../src/texts/registry');
 const film=fixture(),last=film.clips.at(-1)!;film.texts=[makeText('caption',last.startFrame+last.durationFrames+120,60,{text:'Tail'})];
 const preview=validateFilm(fillTimelineGap(film,last.id,'clip'),data);
 expect(preview.clips.at(-1)!.durationFrames).toBe(last.durationFrames+180);
 film.texts[0]!.startFrame=10000;expect(fillTimelineGap(film,last.id,'clip').clips.at(-1)!.durationFrames).toBe(1800);
 const text=film.texts[0]!;film.clips=[];expect(fillTimelineGap(film,text.id,'text').texts[0]).toEqual(text);
});
test('resize snaps near collision and resumes pushing after the snap tolerance',async()=>{
 const {snapResizeFrames}=await import('../src/clips/resize');const film=fixture(),first=film.clips[0]!,boundary=film.clips[1]!.startFrame-first.startFrame;
 for(const delta of [-3,0,3])expect(snapResizeFrames(film,first.id,'clip',boundary+delta,4)).toBe(boundary);
 const beyond=snapResizeFrames(film,first.id,'clip',boundary+5,4);expect(beyond).toBe(boundary+5);
 expect(resizeClipPreview(film,first.id,beyond,'push').clips[1]!.startFrame).toBe(film.clips[1]!.startFrame+5);
});

test('left text movement preserves scenes and text gaps, clamping only against earlier texts',()=>{
 const film=fixture();film.texts=[makeText('caption',0,60),makeText('caption',120,60),makeText('caption',240,60)];
 const original=structuredClone(film),item=film.texts[1]!;
 for(const [wanted,delta] of [[-100,-60],[150,30],[600,480]]){
  const preview=validateFilm(moveTimelinePreview(film,item.id,'text',wanted!,true),data);
  expect(preview.clips).toEqual(film.clips);
  expect(preview.texts[0]).toEqual(film.texts[0]);
  expect(preview.texts[1]!.startFrame).toBe(item.startFrame+delta!);
  expect(preview.texts[2]!.startFrame).toBe(film.texts[2]!.startFrame+delta!);
 }
 expect(film).toEqual(original);
});

test('left scene movement ignores text collisions and leaves all texts unchanged',()=>{
 const film=fixture(),item=film.clips[1]!;
 film.texts=[makeText('caption',item.startFrame-30,60),makeText('caption',item.startFrame+60,60)];
 const original=structuredClone(film);
 const preview=validateFilm(moveTimelinePreview(film,item.id,'clip',item.startFrame-60,true),data);
 expect(preview.clips[1]!.startFrame).toBe(item.startFrame-60);
 expect(preview.clips[2]!.startFrame).toBe(film.clips[2]!.startFrame-60);
 expect(preview.texts).toEqual(film.texts);
 expect(film).toEqual(original);
});

test('right text resize consumes gaps and pushes only following texts',()=>{
 const film=fixture();film.texts=[makeText('caption',0,60),makeText('caption',120,60),makeText('caption',240,60)];
 const original=structuredClone(film),item=film.texts[0]!;
 for(const extra of [-30,30,60,90,240]){
  const preview=validateFilm(resizeTextPreview(film,item.id,item.durationFrames+extra,'push'),data);
  const delta=Math.max(0,extra-60);
  expect(preview.clips).toEqual(film.clips);
  expect(preview.texts[0]!.durationFrames).toBe(item.durationFrames+extra);
  expect(preview.texts[1]!.startFrame).toBe(film.texts[1]!.startFrame+delta);
  expect(preview.texts[2]!.startFrame).toBe(film.texts[2]!.startFrame+delta);
 }
 expect(film).toEqual(original);
});
