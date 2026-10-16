export interface TimelineItem {id:string;startFrame:number;durationFrames:number;}

/** Only a real peer collision activates the reordering preview. */
export function timelineDragTarget<T extends TimelineItem>(items:readonly T[],id:string,wantedStart:number,pointerFrame:number):string|null {
  const moving=items.find(t=>t.id===id);if(!moving)throw Error('Timeline item not found.');
  const wanted=Math.max(0,Math.round(wantedStart)),peers=items.filter(t=>t.id!==id).sort((a,b)=>a.startFrame-b.startFrame);
  return (peers.find(t=>pointerFrame>=t.startFrame&&pointerFrame<t.startFrame+t.durationFrames)
    ??peers.find(t=>wanted<t.startFrame+t.durationFrames&&wanted+moving.durationFrames>t.startFrame))?.id??null;
}

/** Provisional move, computed from the initial film so preview never accumulates edits. */
export function moveTimelineItems<T extends TimelineItem>(items:readonly T[],id:string,wantedStart:number,pointerFrame:number,snapFrames=0):T[] {
  const preview=structuredClone(items),moving=preview.find(t=>t.id===id);if(!moving)throw Error('Timeline item not found.');
  const peers=preview.filter(t=>t.id!==id).sort((a,b)=>a.startFrame-b.startFrame);
  const wanted=Math.max(0,Math.round(wantedStart)),duration=moving.durationFrames;
  const targetId=timelineDragTarget(items,id,wanted,pointerFrame),target=peers.find(t=>t.id===targetId);
  const hovered=target&&pointerFrame>=target.startFrame&&pointerFrame<target.startFrame+target.durationFrames;
  let index=peers.findIndex(t=>t.startFrame>=wanted),start=wanted;
  if(index<0)index=peers.length;
  if(target){
    const targetIndex=peers.indexOf(target);
    const before=hovered?pointerFrame<target.startFrame+target.durationFrames/2:wanted<target.startFrame;
    index=targetIndex+(before?0:1);
    const previousEnd=index?peers[index-1]!.startFrame+peers[index-1]!.durationFrames:0;
    const nextStart=peers[index]?.startFrame;
    // Use the existing gap first. Crossing an edge activates reorder mode,
    // but cannot push a neighbour while the moving item stays in the same slot.
    // In a new slot, shift the next peer only by the missing space.
    start=Math.max(previousEnd,nextStart===undefined?wanted:Math.min(wanted,Math.max(previousEnd,nextStart-duration)));
  }else{
    const candidates=peers.flatMap((t,i)=>[
      {start:t.startFrame+t.durationFrames,index:i+1},
      {start:t.startFrame-duration,index:i},
    ]).filter(c=>c.start>=0&&Math.abs(c.start-wanted)<=snapFrames&&peers.every(t=>c.start+duration<=t.startFrame||c.start>=t.startFrame+t.durationFrames));
    candidates.sort((a,b)=>Math.abs(a.start-wanted)-Math.abs(b.start-wanted));
    if(candidates[0])({start,index}=candidates[0]);
  }
  moving.startFrame=start;
  // Preserve gaps and content; only peers that need room move to the right.
  let end=start+duration;
  for(const peer of peers.slice(index)){peer.startFrame=Math.max(peer.startFrame,end);end=peer.startFrame+peer.durationFrames;}
  peers.splice(index,0,moving);return peers;
}
