import {z} from 'zod';

export const renderResolutionSchema=z.enum(['auto','1280','1920','2560','3840','7680']);
export const renderResolutions=[
 {value:'auto',label:'Auto'},
 {value:'1280',label:'HD · 1280 px'},
 {value:'1920',label:'Full HD · 1920 px'},
 {value:'2560',label:'QHD · 2560 px'},
 {value:'3840',label:'4K · 3840 px'},
 {value:'7680',label:'Maximum · 8K / 7680 px'},
] as const;
/** Fixed options specify the longest edge; preserve aspect and GPU limits. */
export function renderDimensions(width:number,height:number,resolution:z.infer<typeof renderResolutionSchema>,gpuLimit:number,pixelRatio=1){
 const longest=Math.max(width,height),wanted=resolution==='auto'?Math.min(longest*Math.min(pixelRatio,1.5),1600):Number(resolution);
 const scale=Math.min(wanted,Math.max(1,gpuLimit))/longest;
 return [Math.max(1,Math.round(width*scale)),Math.max(1,Math.round(height*scale))] as const;
}

/** Match the visible canvas at the screen's physical pixel density. */
export function previewDimensions(width:number,height:number,gpuLimit:number,pixelRatio=1){
 const scale=Math.min(Math.max(1,pixelRatio),Math.max(1,gpuLimit)/Math.max(width,height));
 return [Math.max(1,Math.round(width*scale)),Math.max(1,Math.round(height*scale))] as const;
}
