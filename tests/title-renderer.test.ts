import {test,expect} from 'bun:test';
import snapshot from '../src/demo.json';
import {createProject,type SceneData} from '../src/editor-model';
import {drawTitle,type Anchor} from '../src/title-renderer';

// Record the rendered card and connector rather than depending on layout internals.
function recordingContext(){
 const cards:number[][]=[],connectors:number[][]=[],texts:string[]=[];
 const methods={fillText:(text:string)=>texts.push(text),createLinearGradient:()=>({addColorStop:()=>{}}),roundRect:(...args:number[])=>cards.push(args),moveTo:(...args:number[])=>connectors.push(args),measureText:(text:string)=>({width:text.length*12})};
 const ctx=new Proxy(methods,{get:(target,key)=>key in target?target[key as keyof typeof methods]:()=>{}}) as unknown as CanvasRenderingContext2D;
 return {ctx,cards,connectors,texts};
}
test('callout mantém o cartão fixo ao cruzar o centro e sair do enquadramento',()=>{
 const data=snapshot as SceneData,project=createProject(data);
 const clip={...project.titles[0]!,template:'callout' as const,binding:null,start:0,duration:10,text:'5,50 BTC\nLote #956 · 4 × 4',kicker:'TRANSAÇÃO #956'};
 for(const [width,height] of [[1280,720],[720,720],[720,1280]] as const){
  for(const position of ['top','center','bottom'] as const){
   clip.position=position;
   const anchors:Anchor[]=[{x:width*.49,y:height*.3,visible:true},{x:width*.51,y:height*.3,visible:true},{x:width*.7,y:height*.4,visible:true},{x:width*1.1,y:height*.4,visible:false}];
   const frames=anchors.map(anchor=>{const frame=recordingContext();drawTitle(frame.ctx,clip,project,data,2,{width:width!,height:height!,anchor:()=>anchor});return frame;});
   for(const frame of frames)expect(frame.cards).toEqual(frames[0]!.cards);
   expect(frames[0]!.connectors[0]).toEqual([anchors[0]!.x,anchors[0]!.y]);
   expect(frames[1]!.connectors[0]).toEqual([anchors[1]!.x,anchors[1]!.y]);
   expect(frames[3]!.connectors).toHaveLength(0);
   // Seeking backward to the same timestamp must reproduce the same layout.
   const replay=recordingContext();drawTitle(replay.ctx,clip,project,data,2,{width:width!,height:height!,anchor:()=>anchors[0]!});expect(replay.cards).toEqual(frames[0]!.cards);
  }
 }
});

test('counter animates English thousands and decimal separators correctly',()=>{
 const data=snapshot as SceneData,project=createProject(data),clip={...project.titles[0]!,template:'counter' as const,binding:null,start:0,duration:10,text:'1,000.50 BTC\nOutput value',kicker:'TRANSACTION'};
 const halfway=recordingContext();drawTitle(halfway.ctx,clip,project,data,.575,{width:720,height:720});expect(halfway.texts).toContain('500.25 BTC');
 const final=recordingContext();drawTitle(final.ctx,clip,project,data,2,{width:720,height:720});expect(final.texts).toContain('1,000.50 BTC');
});

test('gradient backdrops fade at every interior edge for top, center and bottom text',()=>{
 const data=snapshot as SceneData;
 for(const template of ['cinematic','counter'] as const)for(const position of ['top','center','bottom'] as const)for(const background of ['paper','void'] as const){
  const project=createProject(data);project.background=background;
  const clip={...project.titles[0]!,template,position,binding:null,start:0,duration:10,text:'840000.bitmap',kicker:'ONE BLOCK'};
  const gradients:{bounds:number[];stops:[number,string][]}[]=[],rects:number[][]=[];
  const ctx=new Proxy({
   createLinearGradient(...bounds:number[]){const gradient={bounds,stops:[] as [number,string][]};gradients.push(gradient);return {addColorStop(at:number,color:string){gradient.stops.push([at,color]);}};},
   fillRect(...rect:number[]){rects.push(rect);},measureText(text:string){return {width:text.length*12};},
  },{get(target,key){return Reflect.get(target,key)??(()=>{});}}) as unknown as CanvasRenderingContext2D;
  drawTitle(ctx,clip,project,data,2,{width:720,height:720});
  const gradient=gradients[0]!,rect=rects[0]!,first=gradient.stops[0]!,last=gradient.stops.at(-1)!;
  expect(rect[1]).toBe(gradient.bounds[1]);expect(rect[1]!+rect[3]!).toBe(gradient.bounds[3]!);
  if(position==='top'){expect(rect[1]).toBe(0);expect(first[1].endsWith('00')).toBe(false);expect(last[1].endsWith('00')).toBe(true);}
  if(position==='center'){expect(first[1].endsWith('00')).toBe(true);expect(last[1].endsWith('00')).toBe(true);}
  if(position==='bottom'){expect(rect[1]!+rect[3]!).toBe(720);expect(first[1].endsWith('00')).toBe(true);expect(last[1].endsWith('00')).toBe(false);}
 }
});
