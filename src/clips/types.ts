import {z} from 'zod';
import {cameraModule,sceneStyleModule,sceneModules,extendSettings,extendInstance,type TimelineModule} from '../timeline-modules';
import {cameraSettingsSchema} from '../camera-settings';
import {timelineSchema} from '../timeline-contract';
import type {SceneStyle} from '../scene-style';
import type {Project,SceneData,Binding,TextTemplate} from '../editor-model';

export const FPS=30;
export const commonSchema=timelineSchema.extend({
  id:z.string().min(1).max(100),type:z.string().min(1),settingsVersion:z.literal(1),
  durationFrames:z.number().int().min(30).max(1800),seed:z.number().int().min(0).max(999999),
  framing:cameraModule.schema.shape.framing,
  ...sceneStyleModule.schema.shape,
});
export type ClipCommon=z.infer<typeof commonSchema>;
export type ClipInstance=ClipCommon & {settings:Record<string,unknown>};
export interface ClipContext {data:SceneData;look:Project['preset'];sceneStyle?:SceneStyle;}
export interface ClipPhase {id:string;label:string;from:number;to:number;}
export interface TextSuggestion {source:Binding;from:number;to:number;template:TextTemplate;}
/** Local engine plan is an implementation detail, never an editable track. */
export interface ClipPlan {engine:Project;txIndex:number;phases:ClipPhase[];text?:TextSuggestion;}
export interface Control<K extends string=string> {
  key:K;label:string;kind:'select'|'range'|'toggle'|'transaction';
  options?:readonly {value:string;label:string}[];min?:number;max?:number;step?:number;unit?:'percent'|'degrees'|'seconds'|'multiplier';
  when?:{key:K;value:unknown};
}
/** Conditions use the actual setting value, including boolean checkbox values. */
export function controlVisible(settings:Record<string,unknown>,control:Control):boolean {
  return !control.when||settings[control.when.key]===control.when.value;
}
export interface ClipDefinition<S extends z.ZodObject=z.ZodObject> {
  id:string;version:1;category?:string;name:string;description:string;complexity:'simple'|'complex';glyph:string;
  duration:{min:number;max:number;default:number};schema:S;modules?:readonly TimelineModule[];
  inheritCameraByDefault?:boolean;
  cameraControls?:readonly {key:string;label:string;at:number}[];
  controls:readonly Control<Extract<keyof z.output<S>,string>>[];
  build(context:ClipContext,settings:z.output<S>&z.output<typeof cameraSettingsSchema>,common:ClipCommon):ClipPlan;
}
export function defineClip<S extends z.ZodObject>(definition:ClipDefinition<S>){
 const modules=definition.modules??sceneModules;
 const base=commonSchema.omit({framing:true,styleOverride:true,fadeInFrames:true,fadeOutFrames:true});
 const settings=extendSettings(definition.schema,modules);
 if(definition.inheritCameraByDefault!==undefined)settings.shape.inheritLastCamera=z.boolean().default(definition.inheritCameraByDefault);
 return {...definition,modules,instanceSchema:extendInstance(base,modules),settingsSchema:definition.schema,schema:settings as z.ZodObject<S["shape"] & typeof cameraSettingsSchema.shape>};
}
