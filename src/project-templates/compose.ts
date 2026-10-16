import {filmSchema,makeClip,type Film} from '../clips/film';
import {settingsFor} from '../clips/registry';
import {makeText} from '../texts/registry';
import {styleDefaults,type SceneStyle} from '../scene-style';
import type {SceneData} from '../editor-model';
export interface SceneSpec {type:string;startFrame:number;durationFrames:number;settings?:Record<string,unknown>;framing?:Film['clips'][number]['framing'];styleOverride?:Film['clips'][number]['styleOverride'];fadeInFrames?:number;fadeOutFrames?:number;}
export interface TextSpec {type:string;startFrame:number;durationFrames:number;settings?:Record<string,unknown>;position?:Film['texts'][number]['position'];scale?:number;textStyleOverride?:Film['texts'][number]['textStyleOverride'];fadeInFrames?:number;fadeOutFrames?:number;}
export interface TemplateComposition {
 look?:Film['look'];aspect?:Film['aspect'];sceneStyle?:SceneStyle;textStyle?:Partial<Film['textStyle']>;
 scenes?:readonly SceneSpec[];texts?:readonly TextSpec[];audio?:Partial<Film['audio']>;
}
/** Modules declare their own items and styling; helpers only supply instance defaults. */
export function composeTemplate(data:SceneData,spec:TemplateComposition):Film {
 const look=spec.look??'monument';
 const film=filmSchema.parse({version:8,fps:30,aspect:spec.aspect??'1:1',look,textStyle:spec.textStyle,sceneStyle:{...styleDefaults(data,look),...spec.sceneStyle},clips:[],texts:[],audio:{enabled:false,score:'deep',volume:.55,...spec.audio}});
 film.clips=(spec.scenes??[]).map(scene=>{
  const item=makeClip(scene.type,scene.durationFrames,scene.startFrame);item.settings=settingsFor(scene.type,scene.settings??{});
  if(scene.framing)item.framing=structuredClone(scene.framing);if(scene.styleOverride!==undefined)item.styleOverride=structuredClone(scene.styleOverride);
  if(scene.fadeInFrames!==undefined)item.fadeInFrames=scene.fadeInFrames;if(scene.fadeOutFrames!==undefined)item.fadeOutFrames=scene.fadeOutFrames;return item;
 });
 film.texts=(spec.texts??[]).map(text=>{
  const item=makeText(text.type,text.startFrame,text.durationFrames,text.settings);
  if(text.textStyleOverride)item.textStyleOverride=structuredClone(text.textStyleOverride);
  if(text.position)item.position=text.position;if(text.scale!==undefined)item.scale=text.scale;
  if(text.fadeInFrames!==undefined)item.fadeInFrames=text.fadeInFrames;if(text.fadeOutFrames!==undefined)item.fadeOutFrames=text.fadeOutFrames;return item;
 });
 return film;
}
