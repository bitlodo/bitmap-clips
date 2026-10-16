import {importedAudioSchema} from '../imported-audio';
import {textStyleSchema} from '../text-style';
import {z} from 'zod';
import {sceneStyleSchema} from '../scene-style';
import {renderQualitySchema} from '../render-quality';
import {renderResolutionSchema} from '../render-resolution';
import {itemFadeFrames,itemAlpha} from '../timeline-contract';
import {commonSchema,FPS,type ClipInstance} from './types';
import {definition,settingsFor,buildClip,migratePresentation,migrateScene} from './registry';
import {clamp,infoBlocks,largestParcel,type SceneData} from '../editor-model';
import {textInstanceSchema,type TextInstance} from '../texts/types';
import {makeText,buildText,textDefinition,textSettingsFor} from '../texts/registry';

export const textSchema=textInstanceSchema;
export type FilmText=TextInstance;
export const filmSchema=z.object({version:z.literal(8),fps:z.literal(30),aspect:z.enum(['1:1','9:16','16:9']),look:z.enum(['monument','data-city','terminal','editorial']),sceneStyle:sceneStyleSchema.default({}),textStyle:textStyleSchema.default(()=>textStyleSchema.parse({})),renderResolution:renderResolutionSchema.default('auto'),renderQuality:renderQualitySchema.default(()=>renderQualitySchema.parse({})),clips:z.array(commonSchema.extend({settings:z.record(z.string(),z.unknown())})).max(40),texts:z.array(textSchema).max(100),audio:z.object({file:importedAudioSchema.optional(),enabled:z.boolean(),score:z.enum(['deep','pulse','acid','minimal','ambient','jazz']),volume:z.number().min(0).max(1)})});
export type Film=z.infer<typeof filmSchema>;
export function clipFrames(p:Film){return p.clips.reduce((end,c)=>Math.max(end,c.startFrame+c.durationFrames),0);}
/** The film ends with the last item, including independent text after the clips. */
export function totalFrames(p:Film){return p.texts.reduce((end,t)=>Math.max(end,t.startFrame+t.durationFrames),clipFrames(p));}
/** Audio-only preview is playable without changing the visual film/export boundary. */
export function previewFrames(p:Film){
 const visual=totalFrames(p);
 return visual|| (p.audio.enabled?Math.max(1,Math.ceil((p.audio.file?.duration??10)*FPS)):0);
}
export function clipStart(p:Film,id:string){const clip=p.clips.find(c=>c.id===id);if(!clip)throw Error('Scene not found.');return clip.startFrame;}
export function activeClip(p:Film,frame:number){const clip=p.clips.find(c=>frame>=c.startFrame&&frame<c.startFrame+c.durationFrames);return clip?{clip,start:clip.startFrame}:null;}
export function textRange(_p:Film,t:FilmText){return {start:t.startFrame,duration:t.durationFrames};}
export function resolvedText(p:Film,data:SceneData,t:FilmText){const plan=buildText({data,look:p.look},t),first=plan.titles[0];return {text:plan.summary,kicker:first?.kicker??'',txIndex:first?.txIndex??largestParcel(data)};}
export function makeClip(type:string,durationFrames=definition(type).duration.default,startFrame=0):ClipInstance{return {id:crypto.randomUUID(),type,settingsVersion:1,startFrame,durationFrames,fadeInFrames:type==='reveal'?0:9,fadeOutFrames:type==='reveal'?0:9,seed:42,settings:settingsFor(type,{}),framing:{yawOffset:0,pitchOffset:0,zoom:1},styleOverride:null};}
/** A suggestion is a snapshot, never a persistent link to the clip. */
export function suggestedText(p:Film,data:SceneData,c:ClipInstance):FilmText|null {
 const plan=buildClip({data,look:p.look},c),s=plan.text;if(!s)return null;
 const start=clipStart(p,c.id)+Math.round(c.durationFrames*s.from),end=clipStart(p,c.id)+Math.round(c.durationFrames*s.to);
 return makeText(s.template,start,end-start,{source:s.source,txIndex:plan.txIndex});
}
export function createFilm(data:SceneData):Film {let start=0;const clips=['reveal','display','display'].map((type,index)=>{const c=makeClip(type,index===2?300:definition(type).duration.default,start);start+=c.durationFrames;return c;});clips.at(-1)!.fadeOutFrames=18;return validateFilm({version:8,fps:30,aspect:'1:1',look:'monument',clips,texts:[],audio:{enabled:true,score:'deep',volume:.55}},data);}

const legacyAnchor=z.discriminatedUnion('kind',[
 z.object({kind:z.literal('free'),startFrame:z.number().int().min(0),durationFrames:z.number().int().min(15)}),
 z.object({kind:z.literal('clip'),clipId:z.string(),slot:z.enum(['suggestion','custom']).default('custom'),from:z.number().min(0).max(1),to:z.number().min(0).max(1)}).refine(a=>a.to>a.from),
]);
const legacyText=z.object({id:z.string().min(1).max(100),anchor:legacyAnchor,mode:z.enum(['auto','manual']),source:z.enum(['identity','transactions','transaction','volume']).nullable(),text:z.string().max(500),kicker:z.string().max(100),template:z.enum(['cinematic','terminal','counter','card','callout','poster','caption']),position:z.enum(['bottom','center','top']),scale:z.number().min(.7).max(1.4),txIndex:z.number().int().min(0).nullable()});
const legacyClipSchema=commonSchema.omit({fadeInFrames:true,fadeOutFrames:true}).extend({settings:z.record(z.string(),z.unknown()),transitionAfter:z.object({type:z.enum(['fade','cut']),frames:z.number().int().min(0).max(60)})});
const legacyClips=z.array(legacyClipSchema.omit({startFrame:true})).max(40);
const legacyBase=filmSchema.extend({openingFrames:z.number().int().min(0).max(60),endingFrames:z.number().int().min(0).max(60)});
const legacyFilm=legacyBase.extend({version:z.literal(5),clips:legacyClips,texts:z.array(legacyText).max(100)});
const legacyFilm6=legacyBase.extend({version:z.literal(6),clips:legacyClips,texts:z.array(textSchema.omit({fadeInFrames:true,fadeOutFrames:true})).max(100)});
const legacyFilm7=legacyFilm6.extend({version:z.literal(7),clips:z.array(legacyClipSchema).max(40)});
function sequentialClips(clips:z.infer<typeof legacyClips>){let start=0;return clips.map(c=>{const clip={...c,startFrame:start};start+=c.durationFrames;return clip;});}
function migrateFades(old:z.infer<typeof legacyFilm7>){
 const {openingFrames,endingFrames,...film}=old;
 const clips=old.clips.map(({transitionAfter,...clip},index)=>{
  const previous=old.clips[index-1];
  const incoming=index===0?openingFrames:previous?.transitionAfter.type==='fade'?Math.ceil(previous.transitionAfter.frames/2):0;
  const outgoing=index===old.clips.length-1?endingFrames:transitionAfter.type==='fade'?Math.floor(transitionAfter.frames/2):0;
  return {...clip,fadeInFrames:Math.min(incoming,clip.durationFrames*.2),fadeOutFrames:Math.min(outgoing,clip.durationFrames*.2)};
 });
 return {...film,version:8,clips,texts:old.texts.map(t=>({...t,fadeInFrames:7.5,fadeOutFrames:7.5}))};
}
function migrateFilm(value:unknown,data:SceneData):unknown {
 if(!value||typeof value!=='object'||!('version' in value))return value;
 if(value.version===7)return migrateFades(legacyFilm7.parse(value));
 if(value.version===6){const old=legacyFilm6.parse(value);return migrateFades({...old,version:7,clips:sequentialClips(old.clips)});}
 if(value.version!==5)return value;
 const old=legacyFilm.parse(value);
 const texts=old.texts.map(t=>{
  let start:number,duration:number,tx=t.txIndex??largestParcel(data);
  if(t.anchor.kind==='free'){start=t.anchor.startFrame;duration=t.anchor.durationFrames;}
  else {const anchor=t.anchor,c=old.clips.find(c=>c.id===anchor.clipId);if(!c)throw Error('Text has no source scene.');let offset=0;for(const clip of old.clips){if(clip.id===c.id)break;offset+=clip.durationFrames;}start=offset+Math.round(c.durationFrames*anchor.from);duration=Math.round(c.durationFrames*anchor.to)-Math.round(c.durationFrames*anchor.from);if(t.txIndex===null)tx=buildClip({data,look:old.look},{...c,startFrame:offset,fadeInFrames:0,fadeOutFrames:0}).txIndex;}
  if(!data.layout.parcels.some(p=>p.txIndex===tx))throw Error('Invalid text transaction.');
  if(t.mode==='auto'&&!t.source)throw Error('Automatic text requires a source.');
  const content=t.mode==='auto'?infoBlocks(data,tx).find(b=>b.key===t.source):t;
  const settings=t.template==='caption'?{text:[content?.kicker??t.kicker,content?.text??t.text].filter(Boolean).join('\n')}:{source:t.mode==='auto'?t.source:'manual',text:t.text,kicker:t.kicker,txIndex:tx};
  return {...makeText(t.template,start,duration,settings),id:t.id,position:t.position,scale:t.scale};
 });
 return migrateFades({...old,version:7,clips:sequentialClips(old.clips),texts});
}
export function validateFilm(value:unknown,data:SceneData):Film {
 const p=filmSchema.parse(migrateFilm(value,data)),ids=new Set<string>();

 p.clips=p.clips.map(migratePresentation);p.clips.sort((a,b)=>a.startFrame-b.startFrame);
 for(let i=0;i<p.clips.length;i++){const c=p.clips[i]!;if(ids.has(c.id))throw Error('Duplicate scene IDs.');ids.add(c.id);const d=definition(c.type);d.instanceSchema.parse(c);if(c.durationFrames<d.duration.min||c.durationFrames>d.duration.max||!Number.isSafeInteger(c.startFrame+c.durationFrames))throw Error(`Invalid duration for ${d.name}.`);if(i&&c.startFrame<p.clips[i-1]!.startFrame+p.clips[i-1]!.durationFrames)throw Error('Scenes overlap. Move or shorten one of them.');c.settings=settingsFor(c.type,c.settings);buildClip({data,look:p.look},c);}
 for(const t of p.texts){if(ids.has(t.id))throw Error('Duplicate text IDs.');ids.add(t.id);const d=textDefinition(t.type);d.instanceSchema.parse(t);if(t.durationFrames<d.duration.min||!Number.isSafeInteger(t.startFrame+t.durationFrames))throw Error('Invalid text duration.');t.settings=textSettingsFor(t.type,t.settings);buildText({data,look:p.look},t);}
 const sorted=p.texts.toSorted((a,b)=>a.startFrame-b.startFrame);for(let i=1;i<sorted.length;i++)if(sorted[i]!.startFrame<sorted[i-1]!.startFrame+sorted[i-1]!.durationFrames)throw Error('Text scenes overlap. Move or shorten one of them.');
 return p;
}
/** Each clip owns both fade edges; neighbours never enter this calculation. */
export function clipFadeFrames(_p:Film,clip:ClipInstance){return itemFadeFrames(clip);}
export function fadeAmount(p:Film,frame:number):number {
 const active=activeClip(p,frame);return active?1-itemAlpha(active.clip,frame):0;
}
export function videoProject(p:Film){return {...p,duration:totalFrames(p)/FPS,music:p.audio.enabled,volume:p.audio.volume,score:p.audio.score,audioFile:p.audio.file};}
export function findTextGap(p:Film,preferred:number,wanted=90):{start:number;duration:number}|null {
 const intervals=p.texts.toSorted((a,b)=>a.startFrame-b.startFrame),gaps:{start:number;duration:number}[]=[];let start=0;
 for(const t of intervals){if(t.startFrame-start>=15)gaps.push({start,duration:t.startFrame-start});start=t.startFrame+t.durationFrames;}if(totalFrames(p)-start>=15)gaps.push({start,duration:totalFrames(p)-start});
 const choices=gaps.map(g=>{const duration=Math.min(wanted,g.duration);return {start:Math.round(clamp(preferred,g.start,g.start+g.duration-duration)),duration};});
 choices.push({start:Math.round(Math.max(start,preferred)),duration:wanted});
 choices.sort((a,b)=>Number(b.duration>=wanted)-Number(a.duration>=wanted)||Math.abs(a.start-preferred)-Math.abs(b.start-preferred));return choices[0]??null;
}
export const dataSchema=z.object({height:z.number().int().min(0),hash:z.string().regex(/^[a-f\d]{64}$/),timestamp:z.number().min(0),bytes:z.number().min(1).max(10000000),fees:z.number().min(0).nullable(),totalSats:z.string().regex(/^\d{1,30}$/),txCount:z.number().int().min(1),source:z.enum(['live','snapshot']),checkedAt:z.string().max(100),layout:z.object({width:z.number().min(1).max(10000),height:z.number().min(1).max(10000),parcels:z.array(z.object({txIndex:z.number().int().min(0),txid:z.string().regex(/^[a-f\d]{64}$/),totalSats:z.string().regex(/^\d{1,30}$/),x:z.number().min(0),y:z.number().min(0),size:z.number().min(1).max(100)})).min(1).max(100000)})}).superRefine((d,ctx)=>{const seen=new Set<number>();if(d.txCount!==d.layout.parcels.length)ctx.addIssue({code:'custom',message:'Invalid transaction count.'});for(const x of d.layout.parcels){if(seen.has(x.txIndex)||x.txIndex>=d.txCount||x.x+x.size>d.layout.width||x.y+x.size>d.layout.height)ctx.addIssue({code:'custom',message:'Invalid geometry.'});seen.add(x.txIndex);}});
export function parseDocument(value:unknown){const doc=z.object({data:dataSchema,film:z.unknown()}).parse(value);const film=validateFilm(doc.film,doc.data);film.clips=film.clips.map(migrateScene);return {data:doc.data,film:validateFilm(film,doc.data)};}
