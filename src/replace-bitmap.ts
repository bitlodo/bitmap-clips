import {validateFilm,type Film} from './clips/film';
import {definition} from './clips/registry';
import {largestParcel,type SceneData} from './editor-model';
/** Preserve the video while recalibrating scene cameras and repairing transaction references. */
export function prepareBitmapReplacement(film:Film,data:SceneData){
 const next=structuredClone(film),valid=new Set(data.layout.parcels.map(p=>p.txIndex)),fallback=largestParcel(data);let adjusted=0;
 for(const clip of next.clips){
  clip.framing={yawOffset:0,pitchOffset:0,zoom:1};
  const cameraKeys=new Set(['cameraA','cameraB',...(definition(clip.type).cameraControls??[]).map(control=>control.key)]);
  for(const key of cameraKeys)delete clip.settings[key];
 }
 for(const item of [...next.clips,...next.texts]){
  const index=item.settings.txIndex;
  if(typeof index==='number'&&!valid.has(index)){item.settings.txIndex=fallback;adjusted++;}
 }
 return {film:validateFilm(next,data),adjusted};
}
