import { z } from 'zod';
import {textStyleOverrideSchema} from '../text-style';
import {textModules,extendInstance,type TimelineModule} from '../timeline-modules';
import {timelineSchema} from '../timeline-contract';
import type { Preset, SceneData, TitleClip } from '../editor-model';
import type { TitleFrame } from '../title-renderer';

export const textCommonSchema=timelineSchema.extend({
 textStyleOverride:textStyleOverrideSchema.nullable().default(null),
  id:z.string().min(1).max(100),type:z.string().min(1).max(100),settingsVersion:z.literal(1),
  durationFrames:z.number().int().min(15).max(Number.MAX_SAFE_INTEGER),
  position:z.enum(['bottom','center','top']),scale:z.number().min(.7).max(1.4),
});
export type TextCommon=z.infer<typeof textCommonSchema>;
export const textInstanceSchema=textCommonSchema.extend({settings:z.record(z.string(),z.unknown())});
export type TextInstance=z.infer<typeof textInstanceSchema>;
export interface TextContext { data:SceneData;look:Preset; }
export interface TextPlan {
  common:TextCommon;summary:string;titles:TitleClip[];identity?:boolean;
  labels?:{txIndex:number;text:string}[];
}
export interface TextControl<K extends string=string> {
  key:K;label:string;kind:'text'|'textarea'|'number'|'select'|'range'|'toggle';
  options?:readonly {value:string;label:string}[];min?:number;max?:number;step?:number;maxLength?:number;
  when?:{key:K;value:unknown};
}
export interface TextDefinition<S extends z.ZodObject=z.ZodObject> {
  id:string;version:1;name:string;description:string;glyph:string;supportedProperties:readonly string[];
  layout:'screen'|'transactions'|'frame';duration:{min:number;default:number};schema:S;modules?:readonly TimelineModule[];
  controls:readonly TextControl<Extract<keyof z.output<S>,string>>[];
  build(context:TextContext,settings:z.output<S>,common:TextCommon):TextPlan;
}
export function defineText<S extends z.ZodObject>(definition:TextDefinition<S>){return {...definition,instanceSchema:extendInstance(textCommonSchema.omit({fadeInFrames:true,fadeOutFrames:true,textStyleOverride:true}),definition.modules??textModules),settingsSchema:definition.schema,modules:definition.modules??textModules};}
export function textControlVisible(settings:Record<string,unknown>,control:TextControl){return !control.when||settings[control.when.key]===control.when.value;}
export type TextFrame=TitleFrame;
