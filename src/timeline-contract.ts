import {z} from 'zod';
import {fadeModule} from './timeline-modules';

/** Shared time/fade contract for every visual timeline item. */
export const timelineSchema=z.object({
 startFrame:z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
 durationFrames:z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
 ...fadeModule.schema.shape,
});
export type TimelineCommon=z.infer<typeof timelineSchema>;
export const timelineControls=fadeModule.controls;
export function itemFadeFrames(item:Pick<TimelineCommon,'durationFrames'|'fadeInFrames'|'fadeOutFrames'>){
 return {incoming:Math.min(item.fadeInFrames,item.durationFrames/2),outgoing:Math.min(item.fadeOutFrames,item.durationFrames/2)};
}
export function itemAlpha(item:TimelineCommon,frame:number){
 const age=frame-item.startFrame;if(age<0||age>=item.durationFrames)return 0;
 const smooth=(v:number)=>{v=Math.max(0,Math.min(1,v));return v*v*v*(v*(v*6-15)+10);};
 const {incoming,outgoing}=itemFadeFrames(item);
 return (incoming?smooth(age/incoming):1)*(outgoing?smooth((item.durationFrames-age)/outgoing):1);
}
