import {findTextGap,suggestedText,type Film,type FilmText} from '../clips/film';
import type {SceneData} from '../editor-model';

/** Prepare an offer without changing the film; only the confirmation adds it. */
export function prepareTextSuggestions(film:Film,data:SceneData,ids:string[]):FilmText[]{
  const occupied=structuredClone(film),offers:FilmText[]=[];
  for(const id of ids){
    const clip=occupied.clips.find(c=>c.id===id);if(!clip)continue;
    const text=suggestedText(occupied,data,clip);if(!text)continue;
    const gap=findTextGap(occupied,text.startFrame,text.durationFrames);if(!gap)continue;
    text.startFrame=gap.start;text.durationFrames=gap.duration;
    offers.push(text);occupied.texts.push(text);
  }
  return offers;
}
