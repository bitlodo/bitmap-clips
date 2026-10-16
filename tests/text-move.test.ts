import {test,expect} from 'bun:test';
import snapshot from '../src/demo.json';
import {createFilm,validateFilm} from '../src/clips/film';
import {makeText} from '../src/texts/registry';
import {moveTextPreview,textDragTarget} from '../src/texts/move';
import {ProjectHistory} from '../src/history';
import type {SceneData} from '../src/editor-model';

const data=snapshot as SceneData;
function fixture(){const film=createFilm(data);film.texts=[makeText('caption',30,100,{text:'First'}),makeText('caption',200,100,{text:'Previous'}),makeText('caption',400,120,{text:'Moving'})];return validateFilm(film,data);}

test('reordering preview activates only on peer collisions and ends when moving back into free space',()=>{
 const film=fixture(),moving=film.texts[2]!,previous=film.texts[1]!;
 expect(textDragTarget(film,moving.id,400,410)).toBeNull();
 expect(textDragTarget(film,moving.id,304,314)).toBeNull();
 expect(textDragTarget(film,moving.id,300,310)).toBeNull();
 expect(textDragTarget(film,moving.id,299,320)).toBe(previous.id);
 expect(textDragTarget(film,moving.id,220,230)).toBe(previous.id);
 expect(textDragTarget(film,moving.id,400,410)).toBeNull();
 expect(textDragTarget(film,moving.id,900,910)).toBeNull();
});

test('a slight overlap snaps the moving text exactly to the previous text end',()=>{
 const film=fixture(),previous=film.texts[1]!,moving=film.texts[2]!,original=structuredClone(film);
 for(const [wanted,pointer] of [[299,320],[295,298],[280,290]]){
  const preview=validateFilm(moveTextPreview(film,moving.id,wanted!,pointer!,4),data);
  expect(preview.texts.find(t=>t.id===moving.id)!.startFrame).toBe(300);
  expect(preview.texts.find(t=>t.id===previous.id)).toEqual(previous);expect(preview.clips).toEqual(film.clips);
 }
 expect(film).toEqual(original);
});

test('moving before a peer uses its preceding gap and displaces only the missing space',()=>{
 const film=fixture(),previous=film.texts[1]!,moving=film.texts[2]!,original=structuredClone(film);
 const preview=validateFilm(moveTextPreview(film,moving.id,220,230,4),data);
 expect(preview.texts.map(t=>t.id)).toEqual([film.texts[0]!.id,moving.id,previous.id]);
 expect(preview.texts[1]!.startFrame).toBe(130);expect(preview.texts[2]!.startFrame).toBe(250);
 expect(preview.texts[2]!.settings).toEqual(previous.settings);expect(preview.texts[2]!.durationFrames).toBe(previous.durationFrames);expect(preview.texts[1]!.durationFrames).toBe(moving.durationFrames);
 expect(film).toEqual(original);expect(moveTextPreview(film,moving.id,220,230,4)).toEqual(preview);
});

test('inserting before texts pushes only collisions and preserves later gaps',()=>{
 const film=fixture(),moving=film.texts[2]!;
 const adjacent=makeText('caption',300,50),later=makeText('caption',700,100);film.texts.push(adjacent,later);
 const preview=validateFilm(moveTextPreview(film,moving.id,210,220,4),data);
 expect(preview.texts.find(t=>t.id===adjacent.id)!.startFrame).toBe(350);
 expect(preview.texts.find(t=>t.id===later.id)).toEqual(later);
});

test('right-edge collision enters reorder mode without pushing the next text in the same slot',()=>{
 const film=fixture();film.texts=[makeText('caption',112,108,{text:'Cinematic'}),makeText('caption',230,203,{text:'Callout 3D'}),makeText('caption',475,120,{text:'Counter'})];
 const [moving,callout,counter]=film.texts,original=structuredClone(film);
 for(const [wanted,pointer] of [[124,190],[200,266],[260,326]]){
  expect(textDragTarget(film,moving!.id,wanted!,pointer!)).toBe(callout!.id);
  const preview=validateFilm(moveTextPreview(film,moving!.id,wanted!,pointer!),data);
  expect(preview.texts.map(t=>t.id)).toEqual(film.texts.map(t=>t.id));
  expect(preview.texts[0]!.startFrame).toBe(122);
  expect(preview.texts[1]).toEqual(callout);expect(preview.texts[2]).toEqual(counter);
 }
 expect(film).toEqual(original);
});

test('insertion between Callout and Counter moves only Counter by the gap deficit',()=>{
 const film=fixture();film.texts=[makeText('caption',112,108,{text:'Cinematic'}),makeText('caption',230,203,{text:'Callout 3D'}),makeText('caption',475,120,{text:'Counter'}),makeText('caption',700,100,{text:'Later'})];
 const [moving,callout,counter,later]=film.texts,original=structuredClone(film);
 for(const [wanted,pointer] of [[310,376],[380,446],[410,476]]){
  const preview=validateFilm(moveTextPreview(film,moving!.id,wanted!,pointer!),data);
  expect(preview.texts.map(t=>t.id)).toEqual([callout!.id,moving!.id,counter!.id,later!.id]);
  expect(preview.texts[0]).toEqual(callout);expect(preview.texts[1]!.startFrame).toBe(433);
  expect(preview.texts[2]).toEqual({...counter!,startFrame:541});expect(preview.texts[3]).toEqual(later);
  expect(541-counter!.startFrame).toBe(moving!.durationFrames-(counter!.startFrame-(callout!.startFrame+callout!.durationFrames)));
 }
 expect(film).toEqual(original);
});

test('a new slot with enough room does not move any peer',()=>{
 const film=fixture(),moving=film.texts[2]!,peers=film.texts.slice(0,2);moving.durationFrames=60;
 const preview=validateFilm(moveTextPreview(film,moving.id,220,230),data);
 expect(preview.texts.find(t=>t.id===moving.id)!.startFrame).toBe(140);
 for(const peer of peers)expect(preview.texts.find(t=>t.id===peer.id)).toEqual(peer);
});

test('free motion preserves gaps and near edges snap without requiring overlap',()=>{
 const film=fixture(),moving=film.texts[2]!;moving.durationFrames=30;
 expect(moveTextPreview(film,moving.id,135,145,0).texts.find(t=>t.id===moving.id)!.startFrame).toBe(135);
 expect(moveTextPreview(film,moving.id,135,145,6).texts.find(t=>t.id===moving.id)!.startFrame).toBe(130);
 expect(moveTextPreview(film,moving.id,166,176,6).texts.find(t=>t.id===moving.id)!.startFrame).toBe(170);
 expect(moveTextPreview(film,moving.id,900,910,6).texts.find(t=>t.id===moving.id)!.startFrame).toBe(900);
 expect(moveTextPreview(film,moving.id,-30,-20,6).texts.find(t=>t.id===moving.id)!.startFrame).toBe(0);
});

test('preview is valid across unequal-length drags and only the committed drop enters history',()=>{
 const film=fixture(),moving=film.texts[2]!,history=new ProjectHistory(film);
 for(let wanted=0;wanted<900;wanted+=13)for(const grabOffset of [1,60,119])validateFilm(moveTextPreview(film,moving.id,wanted,wanted+grabOffset,6),data);
 expect(history.canUndo).toBe(false);
 const preview=moveTextPreview(film,moving.id,220,230,4);history.record(preview);expect(history.undo()).toEqual(film);expect(history.canUndo).toBe(false);expect(history.redo()).toEqual(preview);
 expect(()=>moveTextPreview(film,'missing',10,20)).toThrow('Text not found');
});
