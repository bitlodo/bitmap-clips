import type {Film} from '../clips/film';
import {timelineDragTarget,moveTimelineItems} from '../timeline-move';

export function textDragTarget(film:Film,id:string,wantedStart:number,pointerFrame:number){
 return timelineDragTarget(film.texts,id,wantedStart,pointerFrame);
}
export function moveTextPreview(film:Film,id:string,wantedStart:number,pointerFrame:number,snapFrames=0):Film {
 if(!film.texts.some(t=>t.id===id))throw Error('Text not found.');
 return {...structuredClone(film),texts:moveTimelineItems(film.texts,id,wantedStart,pointerFrame,snapFrames)};
}
