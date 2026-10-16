import {z} from 'zod';
import {validateFilm,totalFrames,dataSchema} from '../clips/film';
import {largestParcel} from '../editor-model';
import {defineProjectTemplate} from './types';

/** Keep exported film configuration intact; resolve content against the chosen bitmap. */
export function defineExportedProjectTemplate(id:string,value:unknown,description='Your saved composition, adapted to the selected bitmap.'){
 const document=z.object({name:z.string().trim().min(1),film:z.unknown(),data:z.unknown()}).parse(value);
 // Validate against the source bitmap before adapting references for another bitmap.
 const source=validateFilm(document.film,dataSchema.parse(document.data));
 const frames=totalFrames(source);
 return defineProjectTemplate({
  id,version:1,name:document.name,description,
  tag:`${source.clips.length} scenes · ${Number((frames/30).toFixed(1))} seconds`,
  actionLabel:'Use template',preview:{kind:'frame',time:Math.min(4,Math.max(0,(frames-1)/30))},
  build(data){
   const film=structuredClone(source),valid=new Set(data.layout.parcels.map(parcel=>parcel.txIndex));
   for(const item of [...film.clips,...film.texts]){
    const index=item.settings.txIndex;
    if(typeof index==='number'&&!valid.has(index))item.settings.txIndex=largestParcel(data);
   }
   return validateFilm(film,data);
  },
 });
}
