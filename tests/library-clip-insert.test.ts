import {test,expect} from 'bun:test';
import snapshot from '../src/demo.json';
import {createFilm,makeClip,validateFilm} from '../src/clips/film';
import {makeText} from '../src/texts/registry';
import {insertLibraryClip} from '../src/clips/library-insert';
import type {SceneData} from '../src/editor-model';
const data=snapshot as SceneData;
function fixture(){const film=createFilm(data);film.clips=[makeClip('presentation-build',90,0),makeClip('panorama',90,150),makeClip('transaction',180,400)];film.texts=[];return validateFilm(film,data);}

test('only texts starting after the actual insertion point move, including texts in the gap',()=>{
 for(const [start,duration,expected] of [[60,60,60],[90,60,90],[91,30,121],[120,30,150],[165,60,195]]){
  const film=fixture();film.texts=[makeText('caption',start!,duration!)];const before=structuredClone(film);
  const preview=validateFilm(insertLibraryClip(film,makeClip('presentation-wave',90),120),data);
  expect(preview.clips.find(c=>c.type==='presentation-wave')!.startFrame).toBe(90);
  expect(preview.texts[0]!.startFrame).toBe(expected!);expect(preview.texts[0]!.durationFrames).toBe(duration!);expect(film).toEqual(before);
 }
});

test('insertion shifts both tracks equally and preserves later gaps',()=>{
 const film=fixture();film.texts=[makeText('caption',165,60),makeText('caption',420,60)];const before=structuredClone(film),clip=makeClip('presentation-wave',90);
 const preview=validateFilm(insertLibraryClip(film,clip,120),data);
 expect(preview.clips.map(c=>c.startFrame)).toEqual([0,90,180,430]);expect(preview.texts.map(t=>t.startFrame)).toEqual([195,450]);expect(film).toEqual(before);
 const free=insertLibraryClip(film,clip,250);expect(free.texts).toEqual(film.texts);expect(free.clips.filter(c=>c.id!==clip.id)).toEqual(film.clips);
 expect(insertLibraryClip(film,clip,120)).toEqual(preview);
});
