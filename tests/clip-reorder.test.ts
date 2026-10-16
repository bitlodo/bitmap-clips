import {test,expect} from 'bun:test';
import snapshot from '../src/demo.json';
import {createFilm,makeClip,totalFrames,clipFrames,clipStart,activeClip,validateFilm,parseDocument,videoProject,suggestedText,fadeAmount} from '../src/clips/film';
import {moveClipPreview,clipDragTarget,insertClipPreview} from '../src/clips/move';
import {movePreview} from '../src/clips/reorder';
import {resizeClipPreview} from '../src/clips/resize';
import {makeText} from '../src/texts/registry';
import {ProjectHistory} from '../src/history';
import type {SceneData} from '../src/editor-model';
const data=snapshot as SceneData;
function fixture(){const p=createFilm(data);p.clips=[makeClip('reveal',90,30),makeClip('display',150,240),makeClip('transaction',180,600)];p.texts=[makeText('caption',80,180,{text:'Independent'})];return validateFilm(p,data);}

test('free clip movement creates real gaps without moving peers or independent texts',()=>{
 const film=fixture(),original=structuredClone(film),moving=film.clips[1]!;
 expect(clipDragTarget(film,moving.id,400,430)).toBeNull();
 const preview=validateFilm(moveClipPreview(film,moving.id,400,430),data);
 expect(preview.clips[1]!.startFrame).toBe(400);expect(clipStart(preview,moving.id)).toBe(400);
 expect(preview.clips[0]).toEqual(film.clips[0]);expect(preview.clips[2]).toEqual(film.clips[2]);expect(preview.texts).toEqual(film.texts);
 for(const frame of [0,29,120,239,399,550,599,780])expect(activeClip(preview,frame)).toBeNull();
 expect(activeClip(preview,400)?.clip.id).toBe(moving.id);expect(activeClip(preview,549)?.clip.id).toBe(moving.id);
 expect(totalFrames(preview)).toBe(780);expect(film).toEqual(original);
});

test('collision in the existing slot stops at a neighbour without pushing it',()=>{
 const film=fixture(),moving=film.clips[0]!,next=film.clips[1]!;
 expect(clipDragTarget(film,moving.id,155,185)).toBe(next.id);
 const preview=validateFilm(moveClipPreview(film,moving.id,155,185),data);
 expect(preview.clips[0]!.startFrame).toBe(150);expect(preview.clips.slice(1)).toEqual(film.clips.slice(1));
});

test('insertion uses the gap before shifting only the missing space and snaps to peer ends',()=>{
 const film=fixture(),moving=film.clips[2]!,first=film.clips[0]!,next=film.clips[1]!;
 const preview=validateFilm(moveClipPreview(film,moving.id,220,250),data);
 expect(preview.clips.map(c=>c.id)).toEqual([first.id,moving.id,next.id]);
 expect(preview.clips[0]).toEqual(first);expect(preview.clips[1]!.startFrame).toBe(120);expect(preview.clips[2]).toEqual({...next,startFrame:300});expect(preview.texts).toEqual(film.texts);
 const snap=validateFilm(moveClipPreview(film,moving.id,389,410),data);expect(snap.clips.find(c=>c.id===moving.id)!.startFrame).toBe(390);expect(snap.clips.find(c=>c.id===next.id)).toEqual(next);
});

test('moving/removing clips preserves gaps and movie end includes leading/intermediate silence',()=>{
 const film=fixture(),moving=film.clips[2]!,history=new ProjectHistory(film);
 const preview=validateFilm(moveClipPreview(film,moving.id,1000,1030),data);
 expect(totalFrames(preview)).toBe(1180);expect(clipFrames(preview)).toBe(1180);expect(videoProject(preview).duration).toBe(1180/30);
 expect(history.canUndo).toBe(false);history.record(preview);expect(history.undo()).toEqual(film);expect(history.redo()).toEqual(preview);
 expect(parseDocument(JSON.parse(JSON.stringify({data,film:preview}))).film).toEqual(preview);
 preview.clips.splice(1,1);expect(preview.clips.at(-1)!.startFrame).toBe(1000);expect(totalFrames(validateFilm(preview,data))).toBe(1180);
 const text=makeText('caption',1200,90);preview.texts.push(text);expect(totalFrames(validateFilm(preview,data))).toBe(1290);
});

test('library insertion, duplicate placement, and inspector reordering preserve independent text',()=>{
 const film=fixture(),original=structuredClone(film),extra=makeClip('presentation',90);
 const gap=validateFilm(insertClipPreview(film,extra,420),data);expect(gap.clips.find(c=>c.id===extra.id)!.startFrame).toBe(420);expect(gap.clips.filter(c=>c.id!==extra.id)).toEqual(film.clips);
 const inserted=validateFilm(insertClipPreview(film,extra,240),data);expect(inserted.clips.find(c=>c.id===extra.id)!.startFrame).toBe(150);expect(inserted.clips.find(c=>c.id===film.clips[1]!.id)!.startFrame).toBe(240);
 const moved=validateFilm(movePreview(film,film.clips[2]!.id,0),data);expect(moved.clips[0]!.id).toBe(film.clips[2]!.id);expect(moved.texts).toEqual(film.texts);
 const suggestion=suggestedText(gap,data,gap.clips.find(c=>c.id===extra.id)!)!;expect(suggestion.startFrame).toBeGreaterThanOrEqual(420);expect(suggestion.startFrame+suggestion.durationFrames).toBeLessThanOrEqual(510);
 expect(film).toEqual(original);expect(()=>moveClipPreview(film,'missing',0,0)).toThrow('Scene not found');
});

test('v6 and v5 sequential clips migrate once, while v8 enforces explicit nonoverlapping intervals',()=>{
 const current=createFilm(data);current.clips[0]!.fadeInFrames=12;current.clips[0]!.fadeOutFrames=9;const legacy={...current,version:6,openingFrames:12,endingFrames:18,clips:current.clips.map(({startFrame,...clip})=>({...clip,transitionAfter:{type:'fade',frames:18}}))};
 const migrated=parseDocument({data,film:legacy}).film;expect(migrated).toEqual(current);expect(migrated.clips.map(c=>c.startFrame)).toEqual([0,150,300]);expect(legacy.clips[0]).not.toHaveProperty('startFrame');
 const moved=validateFilm(moveClipPreview(migrated,migrated.clips[2]!.id,900,910),data);expect(parseDocument({data,film:moved}).film).toEqual(moved);
 const v5=parseDocument({data,film:{...legacy,version:5,texts:[]}}).film;expect(v5).toEqual(current);
 const bad=structuredClone(moved);bad.clips[1]!.startFrame=1;expect(()=>validateFilm(bad,data)).toThrow('Scenes overlap');
 expect(()=>validateFilm({...current,clips:legacy.clips},data)).toThrow();bad.clips[1]!.startFrame=-1;expect(()=>validateFilm(bad,data)).toThrow();
 bad.clips[1]!.startFrame=Number.MAX_SAFE_INTEGER;expect(()=>validateFilm(bad,data)).toThrow('Invalid duration');
});

test('resize into free space keeps other clips fixed and transitions follow absolute boundaries',()=>{
 const film=fixture(),clip=film.clips[0]!;clip.fadeOutFrames=9;
 const resized=validateFilm(resizeClipPreview(film,clip.id,300),data);expect(resized.clips[0]!.durationFrames).toBe(210);expect(resized.clips.slice(1)).toEqual(film.clips.slice(1));
 expect(activeClip(film,120)).toBeNull();expect(fadeAmount(film,119)).toBeGreaterThan(.9);expect(fadeAmount(film,239)).toBe(0);expect(fadeAmount(film,240)).toBe(1);
 film.clips[2]!.fadeInFrames=0;expect(fadeAmount(film,600)).toBe(0);
});

test('clip drag stays valid across unequal durations and grab offsets without accumulated preview edits',()=>{
 const film=fixture(),moving=film.clips[2]!,original=structuredClone(film);
 for(let wanted=0;wanted<1000;wanted+=47)for(const offset of [1,90,179])validateFilm(moveClipPreview(film,moving.id,wanted,wanted+offset,6),data);
 expect(film).toEqual(original);
});
