import {test,expect} from 'bun:test';
import snapshot from '../src/demo.json';
import {type SceneData,infoBlocks} from '../src/editor-model';
import {makeClip,createFilm,validateFilm,parseDocument,suggestedText,textRange,resolvedText,totalFrames} from '../src/clips/film';
import {texts,textDefinition,textSettingsFor,makeText,buildText} from '../src/texts/registry';
import {textControlVisible} from '../src/texts/types';
import {prepareTextSuggestions} from '../src/texts/suggestions';
import {drawTextPlan} from '../src/texts/renderer';
import {resizeTextPreview} from '../src/clips/resize';
import {movePreview} from '../src/clips/reorder';
import {buildClip} from '../src/clips/registry';
import {FilmRenderer} from '../src/film-renderer';
import * as THREE from 'three';

const data=snapshot as SceneData;

test('text definitions declare typed schemas, controls and plans for one, two or zero manual fields',()=>{
 expect(texts).toHaveLength(8);
 for(const d of texts){
  const settings=textSettingsFor(d.id,{});for(const control of d.controls)expect(control.key in settings).toBe(true);
  const t=makeText(d.id,0),plan=buildText({data,look:'monument'},t);expect(plan.summary.length).toBeGreaterThan(0);
  expect(plan.common.durationFrames).toBe(t.durationFrames);
 }
 const manualFields=(type:string)=>textDefinition(type).controls.filter(c=>c.kind==='text'||c.kind==='textarea');
 expect(manualFields('caption')).toHaveLength(1);expect(manualFields('cinematic')).toHaveLength(2);expect(textDefinition('transaction-labels').controls).toHaveLength(0);
 expect(textSettingsFor('transaction-labels',{})).toEqual({});expect(()=>textSettingsFor('transaction-labels',{text:'bad'})).toThrow();
 expect(()=>textSettingsFor('caption',{text:123})).toThrow();expect(()=>textSettingsFor('cinematic',{text:'x'.repeat(501)})).toThrow();expect(()=>textDefinition('unknown')).toThrow();
 const field=textDefinition('cinematic').controls.find(c=>c.key==='text')!;
 expect(textControlVisible({source:'manual'},field)).toBe(true);expect(textControlVisible({source:'identity'},field)).toBe(false);
 expect(textControlVisible({enabled:false},{key:'text',label:'Message',kind:'text',when:{key:'enabled',value:true}})).toBe(false);
});

test('adding clips prepares an optional offer; texts become snapshots only after accepting it',()=>{
 const film=createFilm(data),original=structuredClone(film);expect(film.texts).toEqual([]);
 const offers=prepareTextSuggestions(film,data,film.clips.map(c=>c.id));expect(offers).toHaveLength(3);expect(film).toEqual(original);
 film.texts.push(...offers);const accepted=validateFilm(film,data),before=structuredClone(accepted.texts);
 const tx=accepted.clips[2]!;tx.settings.target='selected';tx.settings.txIndex=0;tx.settings.zoomInDuration=3;
 expect(validateFilm(accepted,data).texts).toEqual(before);expect(movePreview(accepted,tx.id,0).texts).toEqual(before);
 const text=accepted.texts[0]!;expect(text).not.toHaveProperty('anchor');expect(text).not.toHaveProperty('clipId');
 const serialized=parseDocument(JSON.parse(JSON.stringify({data,film:accepted}))).film;expect(serialized.texts).toEqual(before);
});

test('all clip types suggest independent templates with concrete transaction targets and timing',()=>{
 const film=createFilm(data);
 for(const c of film.clips){const t=suggestedText(film,data,c)!;expect(t.startFrame).toBeGreaterThanOrEqual(0);expect(t.durationFrames).toBeGreaterThanOrEqual(15);expect(typeof t.settings.txIndex).toBe('number');expect(t.startFrame+t.durationFrames).toBeLessThanOrEqual(totalFrames(film));}
});

test('end resize preserves text start, source and clip durations, stopping at neighbors and extending the film end',()=>{
 const film=createFilm(data),first=makeText('caption',30,90),second=makeText('cinematic',210,90);film.texts=[first,second];
 const original=structuredClone(film),long=validateFilm(resizeTextPreview(film,first.id,400),data);expect(textRange(long,long.texts[0]!)).toEqual({start:30,duration:180});expect(long.clips).toEqual(film.clips);expect(long.texts[0]!.settings).toEqual(first.settings);
 expect(resizeTextPreview(film,first.id,0).texts[0]!.durationFrames).toBe(15);
 expect(resizeTextPreview(film,second.id,900).texts[1]!.durationFrames).toBe(900);expect(film).toEqual(original);
 expect(()=>validateFilm({...film,texts:[makeText('caption',0,10)]},data)).toThrow();
 expect(()=>validateFilm({...film,texts:[makeText('callout',0,90,{source:'transaction',txIndex:999999})]},data)).toThrow('Invalid text transaction');
 expect(()=>validateFilm({...film,texts:[makeText('callout',0,90,{source:'manual',txIndex:999999})]},data)).toThrow('Invalid text transaction');
});

test('v5 linked text migrates once to independent timing and targets without losing manual content',()=>{
 const base=createFilm(data);base.clips[2]=makeClip('transaction',300,300);const clip=base.clips[2]!,plan=buildClip({data,look:base.look},clip),start=base.clips[0]!.durationFrames+base.clips[1]!.durationFrames;
 const legacy={...base,version:5,openingFrames:12,endingFrames:18,clips:base.clips.map(c=>({...c,transitionAfter:{type:'fade',frames:18}})),texts:[{id:'legacy',anchor:{kind:'clip',clipId:clip.id,slot:'custom',from:.2,to:.8},mode:'manual',source:'transaction',text:'My custom value',kicker:'KEEP',template:'callout',position:'top',scale:1.2,txIndex:null}]};
 const migrated=parseDocument({data,film:legacy}).film,text=migrated.texts[0]!;
 expect(migrated.version).toBe(8);expect(text.id).toBe('legacy');expect(textRange(migrated,text)).toEqual({start:start+60,duration:180});expect(text.settings.txIndex).toBe(plan.txIndex);expect(text.settings.text).toBe('My custom value');expect(text.settings.kicker).toBe('KEEP');expect(text.position).toBe('top');expect(text.scale).toBe(1.2);expect(text).not.toHaveProperty('anchor');
 migrated.clips[2]!.settings.target='selected';migrated.clips[2]!.settings.txIndex=0;expect(validateFilm(migrated,data).texts[0]).toEqual(text);
 expect(parseDocument({data,film:JSON.parse(JSON.stringify(migrated))}).film).toEqual(migrated);
});

test('automatic v5 text preserves its data and timing, and malformed legacy links are rejected',()=>{
 const base=createFilm(data),c=base.clips[0]!;
 const legacy={...base,version:5,openingFrames:12,endingFrames:18,clips:base.clips.map(c=>({...c,transitionAfter:{type:'fade',frames:18}})),texts:[{id:'legacy-auto',anchor:{kind:'clip',clipId:c.id,slot:'suggestion',from:.18,to:.9},mode:'auto',source:'identity',text:'',kicker:'',template:'cinematic',position:'bottom',scale:1,txIndex:null}]};
 const migrated=parseDocument({data,film:legacy}).film;
 expect(resolvedText(migrated,data,migrated.texts[0]!).text).toBe(`${data.height}.bitmap`);expect(migrated.texts[0]!.startFrame).toBe(27);expect(migrated.texts[0]!.durationFrames).toBe(108);
 legacy.texts[0]!.anchor.clipId='missing';expect(()=>parseDocument({data,film:legacy})).toThrow('Text has no source scene');
 const badge={...legacy,texts:[{...legacy.texts[0]!,anchor:{kind:'free',startFrame:0,durationFrames:90},mode:'manual',template:'caption',text:'Message',kicker:'EYEBROW'}]};
 const convertedBadge=parseDocument({data,film:badge}).film.texts[0]!;
 expect(convertedBadge.settings.text).toBe('EYEBROW\nMessage');
});

test('dynamic transaction labels render through moving anchors with no manual content fields',()=>{
 const text=makeText('transaction-labels',0,150),plan=buildText({data,look:'monument'},text),project=buildClip({data,look:'monument'},createFilm(data).clips[0]!).engine;
 expect(plan.titles).toEqual([]);expect(plan.labels).toHaveLength(data.txCount);
 const output:string[]=[],anchors:number[]=[];
 const ctx={save(){},restore(){},measureText(s:string){return {width:s.length*6};},fillRect(){},fillText(s:string){output.push(s);}} as unknown as CanvasRenderingContext2D;
 drawTextPlan(ctx,plan,project,data,1,{width:720,height:720,anchor:index=>{anchors.push(index);return {x:100+(index%5)*120,y:100+Math.floor(index/5)%5*100,visible:index<25};}});
 expect(anchors.length).toBe(data.txCount);expect(output.length).toBeGreaterThan(0);expect(output.every(s=>s.endsWith(' BTC'))).toBe(true);
 const count=output.length;drawTextPlan(ctx,plan,project,data,6,{width:720,height:720,anchor:()=>{throw Error('Inactive text sampled anchors');}});expect(output).toHaveLength(count);
 expect(infoBlocks(data,0).some(b=>b.key==='identity')).toBe(true);
});

test('transaction anchors resolve nonsequential IDs directly and keep prior projections independent',()=>{
 const camera=new THREE.PerspectiveCamera(60,1,.1,100);camera.position.set(0,0,5);camera.updateMatrixWorld();
 const calls:number[]=[],renderer=Object.create(FilmRenderer.prototype) as FilmRenderer;
 Object.assign(renderer,{parcelIndices:new Map([[7,1],[99,0]]),matrix:new THREE.Matrix4(),anchorPoint:new THREE.Vector3(),camera,width:200,height:200,mesh:{getMatrixAt(index:number,matrix:THREE.Matrix4){calls.push(index);matrix.makeTranslation(index,0,0);}}});
 const first=renderer.anchor(7),saved={...first},second=renderer.anchor(99);
 expect(calls).toEqual([1,0]);expect(first.x).toBeGreaterThan(second.x);expect(first).toEqual(saved);expect(renderer.anchor(1000)).toEqual({x:0,y:0,visible:false});expect(calls).toHaveLength(2);
});

test('Transaction values is absent from the library but saved items still load',()=>{
 expect(texts.some(t=>t.id==='transaction-labels')).toBe(false);
 const film=createFilm(data);film.texts=[makeText('transaction-labels',0,90)];
 expect(parseDocument({data,film}).film.texts).toEqual(film.texts);
});
