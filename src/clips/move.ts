import type {Film} from './film';
import type {ClipInstance} from './types';
import {timelineDragTarget,moveTimelineItems} from '../timeline-move';

export function clipDragTarget(film:Film,id:string,wantedStart:number,pointerFrame:number){
 return timelineDragTarget(film.clips,id,wantedStart,pointerFrame);
}
export function moveClipPreview(film:Film,id:string,wantedStart:number,pointerFrame:number,snapFrames=0):Film {
 if(!film.clips.some(c=>c.id===id))throw Error('Scene not found.');
 return {...structuredClone(film),clips:moveTimelineItems(film.clips,id,wantedStart,pointerFrame,snapFrames)};
}
/** New clips use the same insertion rules, with a detached source instance. */
export function insertClipPreview(film:Film,clip:ClipInstance,startFrame:number):Film {
 const initial={...film,clips:[...film.clips,structuredClone(clip)]};
 return moveClipPreview(initial,clip.id,startFrame,startFrame);
}
