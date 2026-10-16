import { definition } from './registry';
import { type Film } from './film';
import {textDefinition} from '../texts/registry';

/** Resize the end only, stopping at the next clip; preserve all other timing. */
export function resizeClipPreview(film:Film,id:string,frames:number,ripple:boolean|'push'=false):Film {
  const preview=structuredClone(film),clip=preview.clips.find(c=>c.id===id);
  if(!clip)throw Error('Scene not found.');
  const {min,max}=definition(clip.type).duration;
  const next=preview.clips.filter(c=>c.id!==id&&c.startFrame>=clip.startFrame).sort((a,b)=>a.startFrame-b.startFrame)[0];
  const end=clip.startFrame+clip.durationFrames,oldDuration=clip.durationFrames;
  clip.durationFrames=Math.max(min,Math.min(max,!ripple&&next?next.startFrame-clip.startFrame:Number.MAX_SAFE_INTEGER-clip.startFrame,Math.round(frames)));
  if(ripple==='push')pushFollowing(preview,id,'clip',end);else if(ripple)shiftFollowing(preview,end,clip.durationFrames-oldDuration,id,'clip');
  return preview;
}

/** Keep the initial timeline scale while dragging, independent of the new total. */
export function resizedFrames(initial:number,deltaPixels:number,width:number,total:number):number {
  return initial+Math.round(deltaPixels/width*total);
}

/** The last text can extend the film; neighbors still prevent overlap. */
export function resizeTextPreview(film:Film,id:string,frames:number,ripple:boolean|'push'=false):Film {
 const preview=structuredClone(film),text=preview.texts.find(t=>t.id===id);if(!text)throw Error('Text not found.');
 const next=preview.texts.filter(t=>t.id!==id&&t.startFrame>=text.startFrame).sort((a,b)=>a.startFrame-b.startFrame)[0];
 const end=text.startFrame+text.durationFrames,oldDuration=text.durationFrames;
 const max=!ripple&&next?next.startFrame-text.startFrame:Number.MAX_SAFE_INTEGER-text.startFrame,min=textDefinition(text.type).duration.min;
 text.durationFrames=Math.max(min,Math.min(max,Math.round(frames)));if(ripple==='push')pushFollowing(preview,id,'text',end);else if(ripple)shiftFollowing(preview,end,text.durationFrames-oldDuration,id,'text');return preview;
}

/** Ripple edits preserve downstream gaps within the resized item's track. */
function shiftFollowing(film:Film,end:number,delta:number,id:string,kind:'clip'|'text'){
 const items=kind==='clip'?film.clips:film.texts;
 const ordered=items.toSorted((a,b)=>a.startFrame-b.startFrame);
 for(let i=0;i<ordered.length;i++){
  const item=ordered[i]!;
  if(item.id===id||item.startFrame<end)continue;
  const previous=ordered[i-1];
  item.startFrame=Math.max(0,item.startFrame+delta,previous?previous.startFrame+previous.durationFrames:0);
 }
}

/** Consume the gap first, then shift the downstream group only by the overlap. */
function pushFollowing(film:Film,id:string,kind:'clip'|'text',oldEnd:number){
 const track=kind==='clip'?film.clips:film.texts,item=track.find(t=>t.id===id)!;
 const next=track.filter(t=>t.id!==id&&t.startFrame>=oldEnd).toSorted((a,b)=>a.startFrame-b.startFrame)[0];
 if(!next)return;
 const delta=Math.max(0,item.startFrame+item.durationFrames-next.startFrame);
 if(delta)shiftFollowing(film,next.startFrame,delta,id,kind);
}

/** Fill the next same-track gap, or extend to the existing timeline end. */
export function fillTimelineGap(film:Film,id:string,kind:'clip'|'text'):Film{
 const track=kind==='clip'?film.clips:film.texts,item=track.find(t=>t.id===id);if(!item)throw Error('Timeline item not found.');
 const next=track.filter(t=>t.id!==id&&t.startFrame>=item.startFrame+item.durationFrames).toSorted((a,b)=>a.startFrame-b.startFrame)[0];
 const total=Math.max(0,...film.clips.map(t=>t.startFrame+t.durationFrames),...film.texts.map(t=>t.startFrame+t.durationFrames));
 const frames=Math.max(item.durationFrames,(next?.startFrame??total)-item.startFrame);
 return (kind==='clip'?resizeClipPreview:resizeTextPreview)(film,id,frames);
}

/** Snap near a neighbor edge; dragging beyond the tolerance resumes pushing. */
export function snapResizeFrames(film:Film,id:string,kind:'clip'|'text',frames:number,tolerance:number):number{
 const track=kind==='clip'?film.clips:film.texts,item=track.find(t=>t.id===id);if(!item)return frames;
 const next=track.filter(t=>t.id!==id&&t.startFrame>=item.startFrame+item.durationFrames).toSorted((a,b)=>a.startFrame-b.startFrame)[0];
 const boundary=next?next.startFrame-item.startFrame:undefined;
 return boundary!==undefined&&Math.abs(frames-boundary)<=tolerance?boundary:frames;
}
