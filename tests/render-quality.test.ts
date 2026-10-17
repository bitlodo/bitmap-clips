import {test,expect} from 'bun:test';
import snapshot from '../src/demo.json';
import type {SceneData} from '../src/editor-model';
import {createFilm,parseDocument,videoProject} from '../src/clips/film';
import {qualityPlan,qualityProfile,standardQuality,renderQualityProfileSchema} from '../src/render-quality';
import {ProjectHistory} from '../src/history';
import {ClipFilmRenderer} from '../src/clips/renderer';
import {makeText} from '../src/texts/registry';

const data=snapshot as SceneData;
test('independent rendering profiles survive save/import/undo without changing timing or output dimensions',()=>{
 const film=createFilm(data),before=videoProject(film),history=new ProjectHistory(film);
 film.renderQuality.export={preset:'custom',antialias:'msaa',supersampling:2,shadowResolution:2048};history.record(film);
 const doc=parseDocument(JSON.parse(JSON.stringify({data,film})));
 expect(doc.film.renderQuality.preview).toEqual(standardQuality);
 expect(doc.film.renderQuality.export).toEqual(film.renderQuality.export);
 expect(videoProject(doc.film).duration).toBe(before.duration);expect(doc.film.clips).toEqual(film.clips);
 expect(history.undo()!.renderQuality.export).toEqual({...standardQuality,preset:'high',supersampling:2});
 expect(history.redo()!.renderQuality.export.supersampling).toBe(2);
 const {renderQuality,...old}=film;expect(parseDocument({data,film:old}).film.renderQuality).toEqual({preview:standardQuality,export:{...standardQuality,preset:'high',supersampling:2}});
 expect(renderQualityProfileSchema.safeParse({...standardQuality,supersampling:4}).success).toBe(false);
 expect(renderQualityProfileSchema.safeParse({...standardQuality,shadowResolution:8192}).success).toBe(false);
});
test('supersampling applies to internal 3D buffers while GPU and pixel limits preserve final size',()=>{
 const high={...standardQuality,preset:'high' as const};
 for(const [width,height] of [[1920,1080],[1080,1920],[1080,1080]]){
  const plan=qualityPlan(width!,height!,high,8192,4);
  expect(plan.internalWidth).toBe(width!*2);expect(plan.internalHeight).toBe(height!*2);expect(plan.scale).toBe(2);
 }
 const limited=qualityPlan(1920,1080,high,2048,4);
 expect(limited.internalWidth).toBe(2048);expect(limited.internalHeight).toBe(1152);expect(limited.requestedScale).toBe(2);
 const budget=qualityPlan(7680,4320,high,8192,4);
 expect(budget.internalWidth*budget.internalHeight).toBeLessThanOrEqual(16_777_216);
 expect(budget.internalWidth/budget.internalHeight).toBeCloseTo(16/9,2);
 expect(qualityPlan(1920,1080,{...high,preset:'custom',supersampling:1.5},8192,4).internalWidth).toBe(2880);
});
test('AA modes control real samples and post-AA, including unavailable MSAA',()=>{
 const plan=(antialias:typeof standardQuality.antialias,maxSamples=4,ss:1|1.5|2=1)=>qualityPlan(1280,720,{...standardQuality,preset:'custom',antialias,supersampling:ss},8192,maxSamples);
 expect(plan('none').samples).toBe(0);expect(plan('none').fxaa).toBe(false);
 expect(plan('msaa').samples).toBe(4);expect(plan('msaa').fxaa).toBe(false);
 expect(plan('fxaa').samples).toBe(0);expect(plan('fxaa').fxaa).toBe(true);
 expect(plan('msaa-fxaa').samples).toBe(4);expect(plan('msaa-fxaa').fxaa).toBe(true);
 expect(plan('auto',4,1).fxaa).toBe(true);expect(plan('auto',4,2).fxaa).toBe(false);
 expect(plan('auto',0,2).fxaa).toBe(true);expect(plan('msaa',0).fxaa).toBe(true);
 expect(plan('msaa',2).samples).toBe(2);
 expect(qualityPlan(1280,720,{...standardQuality,preset:'custom',shadowResolution:4096},2048,4).shadowResolution).toBe(2048);
 expect(qualityProfile({...standardQuality,preset:'high'}).supersampling).toBe(2);
});
test('clip render forwards its quality to 3D while composing text and HUD at final dimensions',()=>{
 const film=createFilm(data);film.clips=[film.clips[0]!];film.texts=[makeText('caption',0,180,{text:'Final size'})];
 const calls:unknown[][]=[],texts:string[]=[],dimensions:number[][]=[];
 const ctx=new Proxy({fillText(text:string){texts.push(text);},measureText(text:string){return {width:text.length*8};},createLinearGradient(){return {addColorStop(){}};}},{get(target,key){return Reflect.get(target,key)??(()=>{});}}) as unknown as CanvasRenderingContext2D;
 const canvas={width:1920,height:1080,dataset:{},getContext(this:{width:number;height:number}){dimensions.push([this.width,this.height]);return ctx;}} as unknown as HTMLCanvasElement;
 const renderer=Object.create(ClipFilmRenderer.prototype) as ClipFilmRenderer;
 Object.assign(renderer,{canvas,data,plans:new Map(),backgrounds:new Map(),textKey:'',texts:[],engine:{canvas:{width:1920,height:1080,dataset:{},getContext(){return ctx;}},render(...args:unknown[]){calls.push(args);},anchor(){return {x:100,y:100,visible:true};}}});
 const quality={...standardQuality,preset:'high' as const};renderer.render(film,1,1920,1080,quality);
 expect(calls[0]![2]).toBe(1920);expect(calls[0]![3]).toBe(1080);expect(calls[0]![6]).toBe(quality);
 expect(texts).toContain('Final size');expect(dimensions.every(([w,h])=>w===1920&&h===1080)).toBe(true);
});


test('new films export at high quality and preserve explicitly saved standard quality',()=>{
 const film=createFilm(data);
 expect(qualityProfile(film.renderQuality.export).supersampling).toBe(2);
 expect(film.renderQuality.preview).toEqual(standardQuality);
 film.renderQuality.export={...standardQuality};
 expect(parseDocument({data,film}).film.renderQuality.export).toEqual(standardQuality);
});
