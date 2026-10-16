import {test,expect} from 'bun:test';
import snapshot from '../src/demo.json';
import type {SceneData} from '../src/editor-model';
import {createFilm} from '../src/clips/film';
import {ClipFilmRenderer} from '../src/clips/renderer';
import {makeText} from '../src/texts/registry';

test('editorial clip fades reduce layer alpha; gaps clear to transparency without any background fill',()=>{
 const data=snapshot as SceneData,film=createFilm(data);film.look='editorial';film.clips=[film.clips[0]!];
 const clip=film.clips[0]!;clip.startFrame=30;clip.fadeInFrames=30;clip.fadeOutFrames=30;
 const composites:number[]=[],textAlpha:number[]=[],fills:string[]=[];let pixelAlpha=0;
 function context(main:boolean){
  const stack:number[]=[];
  return new Proxy({globalAlpha:1,fillStyle:'',
   save(){stack.push(this.globalAlpha);},restore(){this.globalAlpha=stack.pop()??1;},
   clearRect(){if(main)pixelAlpha=0;},
   drawImage(){if(main){pixelAlpha=this.globalAlpha;composites.push(this.globalAlpha);}},
   fillRect(){if(main)fills.push(this.fillStyle);},fillText(){if(main)textAlpha.push(this.globalAlpha);},
   measureText(text:string){return {width:text.length*8};},createLinearGradient(){return {addColorStop(){}};},
  },{get(target,key){return Reflect.get(target,key)??(()=>{});}}) as unknown as CanvasRenderingContext2D;
 }
 const ctx=context(true),layerCtx=context(false);
 const canvas={width:720,height:720,dataset:{},getContext(){return ctx;}} as unknown as HTMLCanvasElement;
 const layer={width:720,height:720,dataset:{},getContext(){return layerCtx;}};
 const renderer=Object.create(ClipFilmRenderer.prototype) as ClipFilmRenderer;
 Object.assign(renderer,{canvas,data,plans:new Map(),backgrounds:new Map(),textKey:'',texts:[],modelVisible:false,engine:{canvas:layer,render(){},anchor(){return {x:100,y:100,visible:true};},pick(){return 0;}}});
 renderer.render(film,30/30);expect(pixelAlpha).toBe(0);
 renderer.render(film,45/30);expect(pixelAlpha).toBeCloseTo(.5);
 renderer.render(film,90/30);expect(pixelAlpha).toBe(1);
 renderer.render(film,165/30);expect(pixelAlpha).toBeCloseTo(.5);
 expect(fills).toEqual([]);
 renderer.render(film,29/30);expect(pixelAlpha).toBe(0);expect(renderer.pick(0,0)).toBeNull();expect(composites).toHaveLength(4);expect(fills).toEqual([]);
 film.texts=[makeText('caption',0,240,{text:'Independent'})];film.texts[0]!.fadeInFrames=0;film.texts[0]!.fadeOutFrames=0;
 renderer.render(film,45/30);expect(composites.at(-1)).toBeCloseTo(.5);expect(textAlpha.at(-1)).toBe(1);
 film.texts[0]!.fadeInFrames=60;renderer.render(film,30/30);expect(composites.at(-1)).toBe(0);expect(textAlpha.at(-1)).toBeCloseTo(.5);
 renderer.render(film,200/30);expect(pixelAlpha).toBe(0);expect(canvas.dataset.clip).toBe('');
 // Camera editing bypasses both the HUD and independently composed text.
 const written:string[]=[];layerCtx.fillText=(text:string)=>written.push(text);ctx.fillText=(text:string)=>written.push(text);
 let editedProject:unknown;
 Reflect.get(renderer,'engine').render=(project:unknown)=>editedProject=project;
 renderer.render(film,45/30,720,720,undefined,{position:[10,20,30],target:[0,0,0],fov:38});
 expect(written).toEqual([]);expect(pixelAlpha).toBe(1);
 expect(editedProject).toMatchObject({grid:true,fades:[]});
 renderer.render(film,45/30);expect(written).toContain('Independent');
});
