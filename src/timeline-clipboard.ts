import {definition} from './clips/registry';
import {textDefinition} from './texts/registry';
import type {Film,FilmText} from './clips/film';
import type {ClipInstance} from './clips/types';
export type TimelineKind='clip'|'text';
export type TimelineClipboard={hash:string;kind:'clip';item:ClipInstance}|{hash:string;kind:'text';item:FilmText};
export function copyTimelineItem(film:Film,id:string,hash:string):TimelineClipboard {
 const clip=film.clips.find(c=>c.id===id);if(clip)return {hash,kind:'clip',item:structuredClone(clip)};
 const text=film.texts.find(t=>t.id===id);if(text)return {hash,kind:'text',item:structuredClone(text)};
 throw Error('Select a scene or text to copy.');
}
export function clipboardProblem(clipboard:TimelineClipboard|null,hash:string,kind?:TimelineKind):string|null {
 if(!clipboard)return 'Copy a scene or text first.';
 if(clipboard.hash!==hash)return 'This item belongs to another bitmap. Copy an item from this film.';
 if(kind&&clipboard.kind!==kind)return `Paste this ${clipboard.kind==='clip'?'scene in the Scenes':'text in the Text'} track.`;
 return null;
}
/** Keep the requested gap/time; occupied items are never split or shortened. */
export function insertTimelineItem(film:Film,kind:TimelineKind,item:ClipInstance|FilmText,wantedFrame:number,shrinkToFit=false){
 if(!Number.isFinite(wantedFrame))throw Error('Invalid insertion time.');
 const next=structuredClone(film),peers=(kind==='clip'?next.clips:next.texts).toSorted((a,b)=>a.startFrame-b.startFrame);
 if([...next.clips,...next.texts].some(peer=>peer.id===item.id))throw Error('Duplicate timeline item ID.');
 if(peers.length>=(kind==='clip'?40:100))throw Error(kind==='clip'?'The film already has 40 scenes.':'The film already has 100 texts.');
 let startFrame=Math.max(0,Math.round(wantedFrame));
 const occupied=peers.find(peer=>peer.startFrame<startFrame&&startFrame<peer.startFrame+peer.durationFrames);
 if(occupied)startFrame=occupied.startFrame+occupied.durationFrames;
 const copy=structuredClone(item);copy.startFrame=startFrame;
 if(shrinkToFit){
  const following=peers.find(peer=>peer.startFrame>=startFrame);
  if(following){const minimum=kind==='clip'?definition(copy.type).duration.min:textDefinition(copy.type).duration.min;
   copy.durationFrames=Math.min(copy.durationFrames,Math.max(minimum,following.startFrame-startFrame));
  }
 }
 const shortened=copy.durationFrames<item.durationFrames;
 let end=startFrame+copy.durationFrames,shifted=0;
 if(!Number.isSafeInteger(end))throw Error('Invalid insertion time.');
 for(const peer of peers){if(peer.startFrame<startFrame)continue;if(peer.startFrame<end){peer.startFrame=end;shifted++;}end=peer.startFrame+peer.durationFrames;if(!Number.isSafeInteger(end))throw Error('Invalid insertion time.');}
 if(kind==='clip')next.clips=[...peers as ClipInstance[],copy as ClipInstance].toSorted((a,b)=>a.startFrame-b.startFrame);
 else next.texts=[...peers as FilmText[],copy as FilmText].toSorted((a,b)=>a.startFrame-b.startFrame);
 return {film:next,id:copy.id,startFrame,shifted,shortened,adjusted:startFrame!==Math.max(0,Math.round(wantedFrame)),kind};
}
export function pasteTimelineItem(film:Film,clipboard:TimelineClipboard,hash:string,frame:number,kind?:TimelineKind,shrinkToFit=true){
 const problem=clipboardProblem(clipboard,hash,kind);if(problem)throw Error(problem);
 const item=structuredClone(clipboard.item);item.id=crypto.randomUUID();
 return insertTimelineItem(film,clipboard.kind,item,frame,shrinkToFit);
}

/** Same-type selection anchors paste; unrelated selections use the playhead. */
export function pasteFrame(film:Film,clipboard:TimelineClipboard,selectedId:string|null,playheadFrame:number):number {
 const peers=clipboard.kind==='clip'?film.clips:film.texts,item=peers.find(item=>item.id===selectedId);
 return item?item.startFrame+item.durationFrames:playheadFrame;
}
