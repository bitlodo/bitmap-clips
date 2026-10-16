import {textStyleOverrideSchema} from './text-style';
import {z} from 'zod';
import {cameraSettingsSchema} from './camera-settings';
import {sceneStyleSchema} from './scene-style';

/** A module owns one schema. Objects reference modules; storage stays compatible. */
export const cameraModule={id:'camera',label:'Camera',schema:cameraSettingsSchema.extend({
 framing:z.object({yawOffset:z.number().min(-60).max(60),pitchOffset:z.number().min(-20).max(20),zoom:z.number().min(.75).max(1.3)}),
}),settingsKeys:['inheritLastCamera','cameraA','cameraB','rotation','rotationSpeed','zoomEnabled','zoomMode','cameraZoomStrength','cameraZoomEasing'] as const,instanceKeys:['framing'] as const};
export const sceneStyleModule={id:'scene-style',label:'Scene Settings',schema:z.object({styleOverride:sceneStyleSchema.nullable()}),settingsKeys:[] as const,instanceKeys:['styleOverride'] as const};
export const textStyleModule={id:'text-style',label:'Text Style',schema:z.object({textStyleOverride:textStyleOverrideSchema.nullable().default(null)}),settingsKeys:[] as const,instanceKeys:['textStyleOverride'] as const};
export const fadeModule={id:'fade',label:'Fade',schema:z.object({fadeInFrames:z.number().min(0).max(60),fadeOutFrames:z.number().min(0).max(60)}),settingsKeys:[] as const,instanceKeys:['fadeInFrames','fadeOutFrames'] as const,controls:[{key:'fadeInFrames',label:'Fade in / seconds'},{key:'fadeOutFrames',label:'Fade out / seconds'}] as const};
export const timelineModules=[cameraModule,sceneStyleModule,textStyleModule,fadeModule] as const;
export type TimelineModule=typeof timelineModules[number];
export const sceneModules=[cameraModule,sceneStyleModule,fadeModule] as const;
export const textModules=[textStyleModule,fadeModule] as const;
export function extendSettings(schema:z.ZodObject,modules:readonly TimelineModule[]):z.ZodObject {
 let composed=schema;
 for(const module of modules)for(const key of module.settingsKeys){if(key in composed.shape)throw Error(`Duplicate module setting: ${key}`);composed=composed.extend({[key]:(module.schema.shape as Record<string,z.ZodType>)[key]!});}
 return composed;
}

export function extendInstance(schema:z.ZodObject,modules:readonly TimelineModule[]):z.ZodObject {
 let composed=schema;
 for(const module of modules)for(const key of module.instanceKeys){if(key in composed.shape)throw Error(`Duplicate module property: ${key}`);composed=composed.extend({[key]:(module.schema.shape as Record<string,z.ZodType>)[key]!});}
 return composed;
}
