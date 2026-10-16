import type {Film} from './clips/film';
import {definition,settingsFor} from './clips/registry';
/** Module settings (including camera poses) do not invalidate collision frames. */
export function physicsPreviewKey(film:Film){
 return JSON.stringify(film.clips.filter(c=>c.type==='presentation-gravity'||c.type==='reveal'&&c.settings.revealType==='gravity').map(c=>{
  if(c.type==='presentation-gravity')return [c.id,c.durationFrames,c.seed,definition(c.type).settingsSchema.parse(c.settings)];
  const s=settingsFor(c.type,c.settings);return [c.id,c.durationFrames,c.seed,{speed:s.speed,dropHeight:s.dropHeight,flow:s.flow}];
 }));
}
