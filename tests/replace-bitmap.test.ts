import {test,expect} from 'bun:test';
import snapshot from '../src/demo.json';
import {createFilm,makeClip} from '../src/clips/film';
import {makeText} from '../src/texts/registry';
import {largestParcel,type SceneData} from '../src/editor-model';
import {prepareBitmapReplacement} from '../src/replace-bitmap';
const data=snapshot as SceneData;

test('replacement preserves video and source while repairing missing scene and text targets',()=>{
 const film=createFilm(data),index=data.layout.parcels.at(-1)!.txIndex;
 film.clips[2]=makeClip('transaction',300,300);
 film.clips[2]!.settings.target='selected';film.clips[2]!.settings.txIndex=index;
 const text=makeText('callout',0,90);text.settings.txIndex=index;text.settings.text='Keep this message';film.texts.push(text);
 const before=structuredClone(film),nextData={...data,height:data.height+1,layout:{...data.layout,parcels:data.layout.parcels.filter(p=>p.txIndex!==index)}};
 const result=prepareBitmapReplacement(film,nextData),expected=structuredClone(film);
 expected.clips[2]!.settings.txIndex=largestParcel(nextData);expected.texts[0]!.settings.txIndex=largestParcel(nextData);
 expect(result.adjusted).toBe(2);expect(result.film).toEqual(expected);expect(film).toEqual(before);
});
test('replacement retains existing targets and build animation settings',()=>{
 const film=createFilm(data);film.clips[0]!.settings.bounceBack=.3;film.clips[0]!.settings.buildOrder='sequential';
 const result=prepareBitmapReplacement(film,{...data,height:data.height+1});
 expect(result.adjusted).toBe(0);expect(result.film).toEqual(film);
});

test('replacement recalibrates every scene camera for a single-transaction bitmap',()=>{
 const film=createFilm(data),pose={position:[1000,800,900],target:[200,100,200],fov:45};
 for(const clip of film.clips){clip.framing={yawOffset:20,pitchOffset:10,zoom:3};clip.settings.cameraA=structuredClone(pose);clip.settings.cameraB=structuredClone(pose);}
 const before=structuredClone(film),parcel=data.layout.parcels[0]!;
 const nextData={...data,layout:{...data.layout,width:parcel.size,height:parcel.size,parcels:[{...parcel,x:0,y:0}]}};
 const result=prepareBitmapReplacement(film,nextData);
 for(const clip of result.film.clips){expect(clip.framing).toEqual({yawOffset:0,pitchOffset:0,zoom:1});expect(clip.settings.cameraA).toBeUndefined();expect(clip.settings.cameraB).toBeUndefined();}
 expect(result.film.clips.map(c=>[c.id,c.type,c.startFrame,c.durationFrames,c.seed])).toEqual(film.clips.map(c=>[c.id,c.type,c.startFrame,c.durationFrames,c.seed]));
 expect(film).toEqual(before);
});
