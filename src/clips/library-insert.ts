import type {Film} from './film';
import type {ClipInstance} from './types';
import {insertClipPreview} from './move';
export function insertLibraryClip(film:Film,clip:ClipInstance,frame:number):Film {
 const preview=insertClipPreview(film,clip,frame);
 const shifted=film.clips.toSorted((a,b)=>a.startFrame-b.startFrame).find(c=>preview.clips.find(p=>p.id===c.id)!.startFrame>c.startFrame);
 if(!shifted)return preview;
 const delta=preview.clips.find(c=>c.id===shifted.id)!.startFrame-shifted.startFrame;
 for(const c of preview.clips){const original=film.clips.find(p=>p.id===c.id);if(original&&original.startFrame>=shifted.startFrame)c.startFrame=original.startFrame+delta;}
 const insertionFrame=preview.clips.find(c=>c.id===clip.id)!.startFrame;
 for(const text of preview.texts)if(text.startFrame>insertionFrame)text.startFrame+=delta;
 return preview;
}
