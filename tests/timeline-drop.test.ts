import {expect,test} from 'bun:test';
import {withinTimelinePanel} from '../src/timeline-drop';
import snapshot from '../src/demo.json';
import {createFilm,makeClip,validateFilm} from '../src/clips/film';
import {insertLibraryClip} from '../src/clips/library-insert';
import {insertTimelineItem} from '../src/timeline-clipboard';
import {makeText} from '../src/texts/registry';
import type {SceneData} from '../src/editor-model';

const panel={left:40,right:1040,top:300,bottom:540};
test('library drops accept the ruler, either track, audio and panel edges regardless of DOM target',()=>{
 for(const clientX of [40,500,1040])for(const clientY of [300,320,370,420,470,540]){
  expect(withinTimelinePanel({clientX,clientY},panel)).toBe(true);
 }
});
test('leaving any panel boundary removes drop eligibility',()=>{
 for(const point of [{clientX:39,clientY:400},{clientX:1041,clientY:400},{clientX:500,clientY:299},{clientX:500,clientY:541}]){
  expect(withinTimelinePanel(point,panel)).toBe(false);
 }
});
test('cross-track release retains the preview item in its original track for scenes and texts',()=>{
 const data=snapshot as SceneData;
 for(const kind of ['clip','text'] as const){
  const film=createFilm(data),before=structuredClone(film),item=kind==='clip'?makeClip('reveal'):makeText('caption',0);
  const preview=kind==='clip'?insertLibraryClip(film,item as ReturnType<typeof makeClip>,60):insertTimelineItem(film,'text',item as ReturnType<typeof makeText>,60).film;
  const oppositeTrack={clientX:500,clientY:kind==='clip'?370:420};
  expect(withinTimelinePanel(oppositeTrack,panel)).toBe(true);
  const committed=validateFilm(preview,data),track=kind==='clip'?committed.clips:committed.texts;
  expect(track.find(candidate=>candidate.id===item.id)).toBeDefined();
  expect(kind==='clip'?committed.texts.some(candidate=>candidate.id===item.id):committed.clips.some(candidate=>candidate.id===item.id)).toBe(false);
  expect(film).toEqual(before);
 }
});
