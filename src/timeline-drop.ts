export interface TimelineDropPoint {clientX:number;clientY:number;}
export interface TimelineDropBounds {left:number;right:number;top:number;bottom:number;}

/** Hit testing uses the complete panel, independently of the event's DOM target. */
export function withinTimelinePanel(point:TimelineDropPoint,bounds:TimelineDropBounds):boolean {
 return point.clientX>=bounds.left&&point.clientX<=bounds.right&&point.clientY>=bounds.top&&point.clientY<=bounds.bottom;
}
