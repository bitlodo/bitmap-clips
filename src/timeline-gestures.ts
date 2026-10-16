import type {Film} from './clips/film';

/** Center drag stays in its original gap. Left drag moves a downstream group within the same track. */
export function moveTimelinePreview(film:Film,id:string,kind:'clip'|'text',wanted:number,group=false):Film{
 const preview=structuredClone(film),track=kind==='clip'?preview.clips:preview.texts,item=track.find(t=>t.id===id);
 if(!item)throw Error('Timeline item not found.');
 const start=item.startFrame;
 const moving=group?track.filter(t=>t.startFrame>=start):[item];
 let minDelta=-Math.min(...moving.map(t=>t.startFrame)),maxDelta=Infinity;
 for(const t of track){
  if(!moving.includes(t))continue;
  const before=track.filter(p=>!moving.includes(p)&&p.startFrame<t.startFrame).toSorted((a,b)=>a.startFrame-b.startFrame).at(-1);
  const after=track.filter(p=>!moving.includes(p)&&p.startFrame>t.startFrame).toSorted((a,b)=>a.startFrame-b.startFrame)[0];
  if(before)minDelta=Math.max(minDelta,before.startFrame+before.durationFrames-t.startFrame);
  if(after)maxDelta=Math.min(maxDelta,after.startFrame-t.startFrame-t.durationFrames);
 }
 const delta=Math.max(minDelta,Math.min(maxDelta,Math.round(wanted)-start));
 for(const t of moving)t.startFrame+=delta;
 return preview;
}
