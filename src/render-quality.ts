import {z} from 'zod';

export const renderQualityProfileSchema=z.object({
 preset:z.enum(['standard','high','custom']).default('standard'),
 antialias:z.enum(['auto','none','msaa','fxaa','msaa-fxaa']).default('auto'),
 supersampling:z.union([z.literal(1),z.literal(1.5),z.literal(2)]).default(1),
 shadowResolution:z.union([z.literal(0),z.literal(1024),z.literal(2048),z.literal(4096)]).default(0),
});
export type RenderQualityProfile=z.infer<typeof renderQualityProfileSchema>;
export const renderQualitySchema=z.object({
 preview:renderQualityProfileSchema.default(()=>renderQualityProfileSchema.parse({})),
 export:renderQualityProfileSchema.default(()=>renderQualityProfileSchema.parse({})),
});
export const standardQuality=renderQualityProfileSchema.parse({});
export function qualityProfile(profile:RenderQualityProfile):RenderQualityProfile {
 if(profile.preset==='custom')return profile;
 return {...standardQuality,preset:profile.preset,supersampling:profile.preset==='high'?2:1};
}
/** Clamp internal buffers without changing the dimensions sent to the encoder. */
export function qualityPlan(width:number,height:number,profile:RenderQualityProfile,maxSize:number,maxSamples:number,maxPixels=16_777_216){
 const quality=qualityProfile(profile);
 const scale=Math.min(quality.supersampling,maxSize/Math.max(width,height),Math.sqrt(maxPixels/(width*height)));
 const internalWidth=Math.max(1,Math.floor(width*scale)),internalHeight=Math.max(1,Math.floor(height*scale));
 const actualScale=Math.min(internalWidth/width,internalHeight/height);
 const useMSAA=['auto','msaa','msaa-fxaa'].includes(quality.antialias);
 const samples=useMSAA?Math.min(4,Math.max(0,maxSamples)):0;
 const fxaa=quality.antialias==='fxaa'||quality.antialias==='msaa-fxaa'||(quality.antialias==='auto'&&(actualScale<1.5||samples===0))||(quality.antialias==='msaa'&&samples===0);
 return {internalWidth,internalHeight,scale:actualScale,requestedScale:quality.supersampling,samples,fxaa,shadowResolution:Math.min(quality.shadowResolution||4096,maxSize)};
}
