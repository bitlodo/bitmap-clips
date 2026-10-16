import type {Film} from './film';
import {moveClipPreview} from './move';

/** Inspector buttons select a chronological slot; existing gaps are preserved. */
export function movePreview(film:Film,id:string,index:number):Film {
 const source=film.clips.find(c=>c.id===id);if(!source)throw Error('Scene not found.');
 const peers=film.clips.filter(c=>c.id!==id).toSorted((a,b)=>a.startFrame-b.startFrame);
 const slot=Math.max(0,Math.min(peers.length,index)),next=peers[slot],previous=peers[slot-1];
 const wanted=next?next.startFrame:previous?previous.startFrame+previous.durationFrames:source.startFrame;
 return moveClipPreview(film,id,wanted,next?next.startFrame:previous?previous.startFrame+previous.durationFrames-.01:wanted);
}
