import {test,expect} from 'bun:test';
import snapshot from '../src/demo.json';
import type {SceneData} from '../src/editor-model';
import {createFilm,validateFilm,makeClip} from '../src/clips/film';
import {makeText} from '../src/texts/registry';
import {copyTimelineItem,pasteTimelineItem,pasteFrame,insertTimelineItem,clipboardProblem} from '../src/timeline-clipboard';
import {ProjectHistory} from '../src/history';
const data=snapshot as SceneData;
test('copy is a snapshot; paste with available room preserves parameters and generates an independent ID',()=>{
 const film=createFilm(data),source=film.clips[0]!;source.styleOverride={material:'wireframe',accent:'#abcdef'};source.framing.zoom=1.1;
 const copy=copyTimelineItem(film,source.id,data.hash);if(copy.kind!=='clip')throw Error('Expected scene');source.seed=123;source.styleOverride.accent='#000000';
 const result=pasteTimelineItem(film,copy,data.hash,1000),inserted=result.film.clips.find(c=>c.id===result.id)!;
 expect(inserted.id).not.toBe(source.id);expect(inserted.durationFrames).toBe(copy.item.durationFrames);
 expect({...inserted,id:copy.item.id,startFrame:copy.item.startFrame}).toEqual(copy.item);
 expect(film.clips).toHaveLength(3);expect(result.film.clips).toHaveLength(4);expect(validateFilm(result.film,data)).toEqual(result.film);
});
test('paste into a gap holds the requested frame and only shifts peers by the missing space',()=>{
 const film=createFilm(data);film.clips[0]!.durationFrames=60;film.clips[1]!.startFrame=120;film.clips[1]!.durationFrames=60;film.clips[2]!.startFrame=400;
 film.texts=[makeText('caption',0,180,{text:'Keep this text'})];const before=structuredClone(film);
 const result=insertTimelineItem(film,'clip',makeClip('presentation',60),90);
 expect(result.startFrame).toBe(90);expect(result.shifted).toBe(1);expect(result.adjusted).toBe(false);
 expect(result.film.clips.find(c=>c.id===film.clips[1]!.id)!.startFrame).toBe(150);
 expect(result.film.clips.find(c=>c.id===film.clips[2]!.id)!.startFrame).toBe(400);
 expect(result.film.texts).toEqual(before.texts);expect(film).toEqual(before);validateFilm(result.film,data);
});
test('occupied frames adjust to the item end without splitting or shortening it',()=>{
 const film=createFilm(data),first=film.clips[0]!,copy=copyTimelineItem(film,first.id,data.hash);
 const result=pasteTimelineItem(film,copy,data.hash,30);
 expect(result.startFrame).toBe(first.durationFrames);expect(result.adjusted).toBe(true);
 expect(result.film.clips.find(c=>c.id===first.id)).toEqual(first);expect(result.film.texts).toEqual(film.texts);validateFilm(result.film,data);
});
test('text paste preserves content, fades and duration; one undo restores the entire insertion',()=>{
 const film=createFilm(data);film.texts=[makeText('caption',30,90,{text:'Copied caption'}),makeText('caption',150,90,{text:'Next'})];
 film.texts[0]!.fadeInFrames=15;film.texts[0]!.scale=1.2;const before=structuredClone(film),history=new ProjectHistory(film);
 const result=pasteTimelineItem(film,copyTimelineItem(film,film.texts[0]!.id,data.hash),data.hash,120,'text',false);history.record(result.film);
 const inserted=result.film.texts.find(t=>t.id===result.id)!;
 expect(inserted.durationFrames).toBe(90);expect(inserted.settings.text).toBe('Copied caption');expect(inserted.scale).toBe(1.2);expect(inserted.fadeInFrames).toBe(15);
 expect(result.film.texts.find(t=>t.id===film.texts[1]!.id)!.startFrame).toBe(210);expect(result.film.clips).toEqual(film.clips);
 expect(history.undo()).toEqual(before);expect(history.redo()).toEqual(result.film);validateFilm(result.film,data);
});
test('wrong bitmap/track, invalid time, duplicate IDs and film limits never mutate the project',()=>{
 const film=createFilm(data),copy=copyTimelineItem(film,film.clips[0]!.id,data.hash),before=structuredClone(film);
 expect(clipboardProblem(null,data.hash)).not.toBeNull();expect(clipboardProblem(copy,'other')).not.toBeNull();expect(clipboardProblem(copy,data.hash,'text')).not.toBeNull();
 expect(()=>pasteTimelineItem(film,copy,'other',0)).toThrow();expect(()=>pasteTimelineItem(film,copy,data.hash,0,'text')).toThrow();
 expect(()=>pasteTimelineItem(film,copy,data.hash,Infinity)).toThrow();expect(()=>pasteTimelineItem(film,copy,data.hash,Number.MAX_SAFE_INTEGER)).toThrow();
 expect(()=>insertTimelineItem(film,'clip',film.clips[0]!,0)).toThrow();expect(film).toEqual(before);
 const full={...film,clips:Array.from({length:40},(_,i)=>makeClip('presentation',60,i*60))};expect(()=>pasteTimelineItem(full,copy,data.hash,0)).toThrow('40 scenes');expect(full.clips).toHaveLength(40);
});

test('paste uses the same-type selected item end, otherwise the playhead',()=>{
 const film=createFilm(data);film.texts=[makeText('caption',30,90,{text:'A'}),makeText('caption',200,90,{text:'B'})];
 const sceneCopy=copyTimelineItem(film,film.clips[0]!.id,data.hash),textCopy=copyTimelineItem(film,film.texts[0]!.id,data.hash);
 for(const copied of [sceneCopy,textCopy]){
  const peers=copied.kind==='clip'?film.clips:film.texts,other=copied.kind==='clip'?film.texts:film.clips;
  expect(pasteFrame(film,copied,null,17)).toBe(17);
  expect(pasteFrame(film,copied,copied.item.id,17)).toBe(copied.item.startFrame+copied.item.durationFrames);
  expect(pasteFrame(film,copied,peers[1]!.id,17)).toBe(peers[1]!.startFrame+peers[1]!.durationFrames);
  expect(pasteFrame(film,copied,other[0]!.id,17)).toBe(17);
  const result=pasteTimelineItem(film,copied,data.hash,pasteFrame(film,copied,other[0]!.id,0));
  expect(result.kind).toBe(copied.kind);expect(result.startFrame).toBe(0);validateFilm(result.film,data);
 }
});

test('paste shortens a callout to fit the gap without moving the following text',()=>{
 const film=createFilm(data);film.texts=[makeText('callout',30,90,{txIndex:0}),makeText('transaction-labels',180,90)];
 const before=structuredClone(film),copy=copyTimelineItem(film,film.texts[0]!.id,data.hash);
 const result=pasteTimelineItem(film,copy,data.hash,120);
 expect(result.film.texts.find(t=>t.id===result.id)!.durationFrames).toBe(60);
 expect(result.shortened).toBe(true);expect(result.shifted).toBe(0);
 expect(result.film.texts.find(t=>t.id===film.texts[1]!.id)).toEqual(film.texts[1]);
 expect(film).toEqual(before);expect(copy.item.durationFrames).toBe(90);validateFilm(result.film,data);
});
test('paste stops shrinking at template minimum and shifts only the missing space',()=>{
 const film=createFilm(data);film.texts=[makeText('caption',0,90,{text:'A'}),makeText('caption',100,90,{text:'B'})];
 const copy=copyTimelineItem(film,film.texts[0]!.id,data.hash),result=pasteTimelineItem(film,copy,data.hash,90);
 expect(result.film.texts.find(t=>t.id===result.id)!.durationFrames).toBe(15);
 expect(result.film.texts.find(t=>t.id===film.texts[1]!.id)!.startFrame).toBe(105);
 expect(result.shifted).toBe(1);validateFilm(result.film,data);
});
test('scene paste respects scene minimum; duplicate can keep full duration',()=>{
 const film=createFilm(data);film.clips[0]!.durationFrames=90;film.clips[1]!.startFrame=120;film.clips[2]!.startFrame=400;
 const copy=copyTimelineItem(film,film.clips[0]!.id,data.hash),result=pasteTimelineItem(film,copy,data.hash,90);
 expect(result.film.clips.find(c=>c.id===result.id)!.durationFrames).toBe(30);
 expect(result.film.clips.find(c=>c.id===film.clips[1]!.id)!.startFrame).toBe(120);validateFilm(result.film,data);
 const duplicate=pasteTimelineItem(film,copy,data.hash,90,undefined,false);
 expect(duplicate.film.clips.find(c=>c.id===duplicate.id)!.durationFrames).toBe(90);
 const atEnd=pasteTimelineItem(film,copy,data.hash,1000);expect(atEnd.shortened).toBe(false);
});
