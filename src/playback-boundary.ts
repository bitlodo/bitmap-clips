/** Resolve an elapsed playback time without changing the user's loop preference. */
export function playbackBoundary(time:number,end:number,start:number,loop:boolean,once:boolean):{time:number;restart:boolean;stop:boolean}{
 if(time<end)return {time,restart:false,stop:false};
 if(loop&&!once&&end>start)return {time:start+(time-end)%(end-start),restart:true,stop:false};
 return {time:Math.max(0,end),restart:false,stop:true};
}
