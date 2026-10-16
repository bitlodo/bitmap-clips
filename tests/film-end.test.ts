import {test,expect} from 'bun:test';
import snapshot from '../src/demo.json';
import {createFilm,totalFrames,clipFrames,activeClip,validateFilm,videoProject,fadeAmount,clipFadeFrames,findTextGap,parseDocument} from '../src/clips/film';
import {ClipFilmRenderer} from '../src/clips/renderer';
import {makeText} from '../src/texts/registry';
import {resizeTextPreview} from '../src/clips/resize';
import {ProjectHistory} from '../src/history';
import type {SceneData} from '../src/editor-model';

const data=snapshot as SceneData;

test('timeline fade extents match the independent render boundaries and duration limits',()=>{
 const film=createFilm(data),[first,next,last]=film.clips;
 first!.fadeInFrames=12;first!.fadeOutFrames=19;next!.fadeInFrames=10;
 expect(clipFadeFrames(film,first!)).toEqual({incoming:12,outgoing:19});
 expect(clipFadeFrames(film,next!)).toEqual({incoming:10,outgoing:9});
 expect(fadeAmount(film,first!.startFrame+first!.durationFrames-19)).toBe(0);
 expect(fadeAmount(film,first!.startFrame+first!.durationFrames-18)).toBeGreaterThan(0);
 expect(fadeAmount(film,next!.startFrame+9)).toBeGreaterThan(0);
 expect(fadeAmount(film,next!.startFrame+10)).toBe(0);
 first!.durationFrames=60;first!.fadeInFrames=60;first!.fadeOutFrames=60;
 expect(clipFadeFrames(film,first!)).toEqual({incoming:30,outgoing:30});
 first!.fadeOutFrames=0;expect(clipFadeFrames(film,first!)).toEqual({incoming:30,outgoing:0});
 expect(clipFadeFrames(film,next!).incoming).toBe(10);
 last!.startFrame=700;expect(clipFadeFrames(film,last!).outgoing).toBe(18);
 last!.fadeOutFrames=0;expect(clipFadeFrames(film,last!).outgoing).toBe(0);
 film.clips=[first!];first!.fadeInFrames=0;expect(clipFadeFrames(film,first!)).toEqual({incoming:0,outgoing:0});
});

test('delete the last clip: independent text defines the film end, export duration and undo',()=>{
 let film=createFilm(data);film.texts=[makeText('callout',345,247,{text:'Keep this text'})];
 const original=structuredClone(film),history=new ProjectHistory(film),texts=structuredClone(film.texts);
 film.clips.pop();film=validateFilm(film,data);history.record(film);
 expect(clipFrames(film)).toBe(300);expect(totalFrames(film)).toBe(592);expect(videoProject(film).duration).toBe(592/30);expect(film.texts).toEqual(texts);
 expect(activeClip(film,299)?.clip.id).toBe(film.clips[1]!.id);expect(activeClip(film,300)).toBeNull();expect(activeClip(film,591)).toBeNull();
 expect(parseDocument({data,film}).film).toEqual(film);expect(history.undo()).toEqual(original);expect(history.redo()).toEqual(film);
 film.texts=[];expect(totalFrames(validateFilm(film,data))).toBe(300);
});

test('text-only films are valid and the last text can extend or shorten their end',()=>{
 let film=createFilm(data);film.clips=[];film.texts=[makeText('caption',60,90)];film=validateFilm(film,data);
 expect(totalFrames(film)).toBe(150);expect(activeClip(film,100)).toBeNull();
 const resized=validateFilm(resizeTextPreview(film,film.texts[0]!.id,240),data);expect(totalFrames(resized)).toBe(300);expect(resized.clips).toEqual([]);
 expect(totalFrames(validateFilm(resizeTextPreview(resized,film.texts[0]!.id,30),data))).toBe(90);
 const gap=findTextGap(film,150,90)!;expect(gap).toEqual({start:150,duration:90});
 film.texts.push(makeText('caption',gap.start,gap.duration));expect(totalFrames(validateFilm(film,data))).toBe(240);
 const empty=validateFilm({...film,texts:[]},data);expect(empty.clips).toEqual([]);expect(empty.texts).toEqual([]);expect(totalFrames(empty)).toBe(0);
});

test('camera fades end with their clip and leave text tails and empty gaps unaffected',()=>{
 const film=createFilm(data);film.clips=[film.clips[0]!];film.clips[0]!.fadeInFrames=12;film.clips[0]!.fadeOutFrames=18;film.texts=[makeText('caption',90,300)];
 expect(fadeAmount(film,0)).toBe(1);expect(fadeAmount(film,149)).toBeGreaterThan(.98);
 for(const frame of [150,300,389])expect(fadeAmount(film,frame)).toBe(0);
 film.clips[0]!.startFrame=60;
 expect(fadeAmount(film,59)).toBe(0);expect(fadeAmount(film,60)).toBe(1);expect(fadeAmount(film,209)).toBeGreaterThan(.98);expect(fadeAmount(film,210)).toBe(0);
});

test('renderer stops all 3D rendering and picking at the clip end while continuing text',()=>{
 const film=createFilm(data);film.clips=[film.clips[0]!];film.texts=[makeText('caption',90,300,{text:'Tail text'})];
 const written:string[]=[],draws:number[]=[],anchors:number[]=[],picks:number[]=[],layers:string[]=[];
 const ctx=new Proxy({
  fillText(text:string){written.push(text);layers.push('text:'+text);},fillRect(){layers.push('fill');},drawImage(){layers.push('clip');},measureText(text:string){return {width:text.length*8};},createLinearGradient(){return {addColorStop(){}};},
 },{get(target,key){return Reflect.get(target,key)??(()=>{});}}) as unknown as CanvasRenderingContext2D;
 const canvas={width:720,height:720,dataset:{},getContext(){return ctx;}} as unknown as HTMLCanvasElement;
 const renderer=Object.create(ClipFilmRenderer.prototype) as ClipFilmRenderer;
 Object.assign(renderer,{canvas,data,plans:new Map(),backgrounds:new Map(),textKey:'',texts:[],modelVisible:false,engine:{canvas:{width:720,height:720,dataset:{},getContext(){return ctx;}},
  render(_project:unknown,time:number){draws.push(time);},anchor(index:number){anchors.push(index);return {x:100,y:100,visible:true};},pick(){picks.push(1);return 0;},
 }});
 renderer.render(film,149/30,720,720);expect(layers.lastIndexOf('text:Tail text')).toBeGreaterThan(layers.lastIndexOf('clip'));expect(draws).toHaveLength(1);expect(renderer.pick(0,0)).toBe(0);
 written.length=0;renderer.render(film,5,720,720);renderer.render(film,10,720,720);
 expect(draws).toHaveLength(1);expect(written).toContain('Tail text');expect(canvas.dataset.clip).toBe('');expect(renderer.pick(0,0)).toBeNull();expect(picks).toHaveLength(1);expect(anchors).toHaveLength(0);
 renderer.render(film,1,720,720);expect(draws).toHaveLength(2);expect(canvas.dataset.clip).toBe(film.clips[0]!.id);
 film.clips[0]!.startFrame=300;renderer.render(film,5,720,720);expect(draws).toHaveLength(2);expect(renderer.pick(0,0)).toBeNull();
 renderer.render(film,301/30,720,720);expect(draws).toHaveLength(3);expect(draws.at(-1)).toBeCloseTo(1/30);
 film.clips=[];renderer.render(film,5,720,720);expect(draws).toHaveLength(3);expect(written).toContain('Tail text');
});
