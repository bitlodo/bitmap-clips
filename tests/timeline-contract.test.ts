import {test,expect} from 'bun:test';
import snapshot from '../src/demo.json';
import type {SceneData} from '../src/editor-model';
import {titleAlpha,smooth} from '../src/editor-model';
import {timelineSchema,itemAlpha,itemFadeFrames} from '../src/timeline-contract';
import {createFilm,parseDocument,validateFilm,fadeAmount,clipFadeFrames} from '../src/clips/film';
import {moveClipPreview} from '../src/clips/move';
import {resizeClipPreview} from '../src/clips/resize';
import {texts,makeText,buildText} from '../src/texts/registry';
import {ProjectHistory} from '../src/history';
const data=snapshot as SceneData;

test('changing Panorama fades does not change Spotlight, Presentation, text, or audio',()=>{
 const film=createFilm(data);film.texts=[makeText('caption',0,180)];
 const original=structuredClone(film),spotlight=film.clips[2]!,samples=[300,301,305,310,580,590,599].map(f=>fadeAmount(film,f));
 film.clips[1]!.fadeInFrames=33;film.clips[1]!.fadeOutFrames=54;
 const edited=validateFilm(film,data);
 expect(edited.clips[2]).toEqual(spotlight);expect(edited.clips[0]).toEqual(original.clips[0]);
 expect([300,301,305,310,580,590,599].map(f=>fadeAmount(edited,f))).toEqual(samples);
 expect(edited.texts).toEqual(original.texts);expect(edited.audio).toEqual(original.audio);
 expect(clipFadeFrames(edited,edited.clips[1]!)).toEqual({incoming:33,outgoing:54});
});

test('fades belong to the item through reordering, removal, resize, save and undo',()=>{
 const film=createFilm(data),clip=film.clips[1]!;clip.fadeInFrames=21;clip.fadeOutFrames=30;
 const history=new ProjectHistory(film),moved=validateFilm(moveClipPreview(film,clip.id,900,910),data);
 const movedClip=moved.clips.find(c=>c.id===clip.id)!;expect(clipFadeFrames(moved,movedClip)).toEqual({incoming:21,outgoing:30});
 moved.clips=moved.clips.filter(c=>c.id===clip.id);expect(clipFadeFrames(moved,movedClip)).toEqual({incoming:21,outgoing:30});
 const resized=validateFilm(resizeClipPreview(moved,clip.id,60),data);expect(clipFadeFrames(resized,resized.clips[0]!)).toEqual({incoming:21,outgoing:30});
 history.record(resized);expect(history.undo()).toEqual(film);expect(history.redo()).toEqual(resized);
 expect(parseDocument(JSON.parse(JSON.stringify({data,film:resized}))).film).toEqual(resized);
});

test('every text template receives the common independent fades and text alpha matches the contract',()=>{
 for(const definition of texts){
  const text=makeText(definition.id,100,90);text.fadeInFrames=24;text.fadeOutFrames=36;
  const plan=buildText({data,look:'monument'},text);
  expect(itemFadeFrames(plan.common)).toEqual({incoming:24,outgoing:36});
  for(const title of plan.titles){expect(title.fadeIn).toBe(.8);expect(title.fadeOut).toBe(1.2);for(const frame of [99,100,105,112,124,145,154,177,189,190])expect(titleAlpha(title,frame/30)).toBeCloseTo(itemAlpha(text,frame),10);}
  const film=createFilm(data);film.texts=[text];const clips=structuredClone(film.clips);
  film.texts[0]!.fadeInFrames=0;film.texts[0]!.fadeOutFrames=60;
  expect(validateFilm(film,data).clips).toEqual(clips);
 }
});

test('common fade limits and cut edges produce valid isolated envelopes',()=>{
 const text=makeText('caption',30,15);text.fadeInFrames=60;text.fadeOutFrames=60;
 expect(itemFadeFrames(text)).toEqual({incoming:7.5,outgoing:7.5});expect(itemAlpha(text,37.5)).toBe(1);
 for(const frame of [0,29,45,60])expect(itemAlpha(text,frame)).toBe(0);
 text.fadeInFrames=0;text.fadeOutFrames=0;expect(itemAlpha(text,30)).toBe(1);expect(itemAlpha(text,44)).toBe(1);
 expect(()=>timelineSchema.parse({...text,fadeInFrames:-1})).toThrow();expect(()=>timelineSchema.parse({...text,fadeOutFrames:61})).toThrow();
});

test('v7 migration captures legacy neighbour fades once and preserves the previous render timings',()=>{
 const current=createFilm(data);current.clips[1]!.startFrame=300;current.clips[2]!.startFrame=600;
 const legacy={...current,version:7,openingFrames:60,endingFrames:30,clips:current.clips.map(({fadeInFrames,fadeOutFrames,...clip},index)=>({...clip,transitionAfter:{type:index===1?'cut':'fade',frames:19}})),texts:[makeText('caption',40,90)]};
 legacy.clips[0]!.durationFrames=60;
 const before=structuredClone(legacy),migrated=parseDocument({data,film:legacy}).film;
 expect(migrated.version).toBe(8);expect(migrated.clips.map(c=>[c.fadeInFrames,c.fadeOutFrames])).toEqual([[12,9],[10,0],[0,30]]);
 expect(migrated.texts[0]!.fadeInFrames).toBe(7.5);expect(migrated).not.toHaveProperty('openingFrames');expect(migrated.clips[0]).not.toHaveProperty('transitionAfter');
 expect(fadeAmount(migrated,5)).toBeCloseTo(1-smooth(5/12));expect(fadeAmount(migrated,12)).toBe(0);expect(fadeAmount(migrated,310)).toBe(0);expect(fadeAmount(migrated,600)).toBe(0);
 migrated.clips[0]!.fadeOutFrames=60;expect(migrated.clips[1]!.fadeInFrames).toBe(10);
 expect(legacy).toEqual(before);expect(parseDocument({data,film:migrated}).film).toEqual(migrated);
});
